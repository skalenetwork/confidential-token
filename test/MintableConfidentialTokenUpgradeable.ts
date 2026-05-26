// cspell:words ECIES

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import "chai/register-should";
import { BiteMock, MintableConfidentialTokenUpgradeable } from "../typechain-types";
import { deployMintableUpgradeable } from "../migrations/deployMintableUpgradeable";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf } from "./tools/helpers";
import { BaseContract } from "ethers";

const TOKEN_NAME = "Confidential Token";
const TOKEN_SYMBOL = "CTK";
const TOKEN_VERSION = "testing";
const CALLBACK_FEE = ethers.parseEther("0.003");

const ENCRYPT_ECIES_ADDRESS = ethers.getAddress("0x000000000000000000000000000000000000001c");
const ENCRYPT_TE_ADDRESS = ethers.getAddress("0x000000000000000000000000000000000000001d");
const SUBMIT_CTX_ADDRESS = ethers.getAddress("0x000000000000000000000000000000000000001b");
const PROXY_ADMIN_ABI = ["function owner() view returns (address)"];

type BiteMocks = {
    bite: BiteMock;
    encryptECIES: BaseContract;
    encryptTE: BaseContract;
    submitCTX: BaseContract;
};

const deployBiteMocks = async (): Promise<BiteMocks> => {
    const biteFactory = await ethers.getContractFactory("BiteMock");
    const bite = await biteFactory.deploy() as BiteMock;
    const encryptECIESFactory = await ethers.getContractFactory("EncryptECIESMock");
    const encryptECIES = await encryptECIESFactory.deploy(bite);
    const encryptTEFactory = await ethers.getContractFactory("EncryptTEMock");
    const encryptTE = await encryptTEFactory.deploy(bite);
    const submitCTXFactory = await ethers.getContractFactory("SubmitCTXMock");
    const submitCTX = await submitCTXFactory.deploy(bite);
    return {
        bite,
        encryptECIES,
        encryptTE,
        submitCTX
    };
};

const deployUpgradeableMintable = async () => {
    const [owner] = await ethers.getSigners();
    const contracts = await deployMintableUpgradeable(
        TOKEN_NAME,
        TOKEN_SYMBOL,
        TOKEN_VERSION,
        owner
    );
    const token = contracts.ConfidentialToken as unknown as MintableConfidentialTokenUpgradeable;

    return {
        accessManager: contracts.AccessManager,
        owner,
        token
    };
};

const deployUpgradeableMintableFixture = async () => {
    const deployment = await deployUpgradeableMintable();
    const mocks = await deployBiteMocks();

    await deployment.token.setEncryptECIESAddress(mocks.encryptECIES);
    await deployment.token.setEncryptTEAddress(mocks.encryptTE);
    await deployment.token.setSubmitCTXAddress(mocks.submitCTX);
    await deployment.token.setCallbackFee(CALLBACK_FEE);

    return {
        ...deployment,
        ...mocks
    };
};

describe("MintableConfidentialTokenUpgradeable", () => {
    it("initializes proxy storage", async () => {
        const { token, accessManager } = await deployUpgradeableMintable();

        (await token.name()).should.be.equal(TOKEN_NAME);
        (await token.symbol()).should.be.equal(TOKEN_SYMBOL);
        (await token.version()).should.be.equal(TOKEN_VERSION);
        (await token.authority()).should.be.equal(await ethers.resolveAddress(accessManager));
        (await token.callbackFee()).should.be.equal(1_000_000_000_000n);
        (await token.encryptECIESAddress()).should.be.equal(ENCRYPT_ECIES_ADDRESS);
        (await token.encryptTEAddress()).should.be.equal(ENCRYPT_TE_ADDRESS);
        (await token.submitCTXAddress()).should.be.equal(SUBMIT_CTX_ADDRESS);
    });

    it("transfers proxy admin ownership to configured owner", async () => {
        const [, configuredOwner] = await ethers.getSigners();
        const contracts = await deployMintableUpgradeable(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_VERSION,
            configuredOwner
        );
        const token = contracts.ConfidentialToken as unknown as MintableConfidentialTokenUpgradeable;

        const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(await token.getAddress());
        const proxyAdmin = await ethers.getContractAt(PROXY_ADMIN_ABI, proxyAdminAddress);
        (await proxyAdmin.owner()).should.be.equal(await configuredOwner.getAddress());

        const adminRole = await contracts.AccessManager.ADMIN_ROLE();
        const [hasAdminRole, executionDelay] = await contracts.AccessManager.hasRole(
            adminRole,
            await configuredOwner.getAddress()
        );
        hasAdminRole.should.be.equal(true);
        executionDelay.should.be.equal(0n);
    });

    it("rejects repeated proxy initialization", async () => {
        const { token, accessManager } = await loadFixture(deployUpgradeableMintableFixture);

        await token.initialize(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_VERSION,
            accessManager
        ).should.be.revertedWithCustomError(token, "InvalidInitialization");
    });

    it("locks the implementation contract", async () => {
        const [owner] = await ethers.getSigners();
        const accessManagerFactory = await ethers.getContractFactory("AccessManager");
        const accessManager = await accessManagerFactory.deploy(owner);
        await accessManager.waitForDeployment();
        const tokenFactory = await ethers.getContractFactory("MintableConfidentialTokenUpgradeable");
        const implementation = await tokenFactory.deploy() as MintableConfidentialTokenUpgradeable;
        await implementation.waitForDeployment();

        await implementation.initialize(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            TOKEN_VERSION,
            accessManager
        ).should.be.revertedWithCustomError(implementation, "InvalidInitialization");
    });

    it("uses the proxy address for the EIP-712 domain separator", async () => {
        const { token } = await loadFixture(deployUpgradeableMintableFixture);
        const { chainId } = await ethers.provider.getNetwork();
        const expectedDomainSeparator = ethers.TypedDataEncoder.hashDomain({
            name: TOKEN_NAME,
            version: "1",
            chainId,
            verifyingContract: await token.getAddress()
        });

        expect(await token.DOMAIN_SEPARATOR()).to.equal(expectedDomainSeparator);
    });

    it("keeps minting access restricted through the proxy", async () => {
        const { token, accessManager } = await loadFixture(deployUpgradeableMintableFixture);
        const [, unauthorized] = await ethers.getSigners();

        await token.connect(unauthorized).mint(unauthorized, ethers.parseEther("1"))
            .should.be.revertedWithCustomError(token, "AccessManagedUnauthorized")
            .withArgs(unauthorized);
        (await token.authority()).should.be.equal(await ethers.resolveAddress(accessManager));
    });

    it("runs a representative mint and transfer flow through the proxy", async () => {
        const { token, bite, owner } = await loadFixture(deployUpgradeableMintableFixture);
        const [, recipient] = await ethers.getSigners();
        const amount = ethers.parseEther("1");

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1")
        });
        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        await bite.sendCallback();
        await token.connect(recipient).setViewerPublicKey(
            await getPublicKey(recipient),
            {value: ethers.parseEther("1")}
        );
        await bite.sendCallback();

        await token.mint(owner, amount);
        await bite.sendCallback();
        await token.transfer(recipient, amount);
        await bite.sendCallback();

        (await balanceOf(token, bite, recipient)).should.be.equal(amount);
    });

    it("preserves initialized storage across an upgrade", async () => {
        const { token } = await loadFixture(deployUpgradeableMintableFixture);
        await token.setCallbackFee(123n);

        const tokenFactory = await ethers.getContractFactory("MintableConfidentialTokenUpgradeable");
        const upgraded = await upgrades.upgradeProxy(
            await token.getAddress(),
            tokenFactory
        ) as unknown as MintableConfidentialTokenUpgradeable;
        await upgraded.waitForDeployment();

        (await upgraded.name()).should.be.equal(TOKEN_NAME);
        (await upgraded.symbol()).should.be.equal(TOKEN_SYMBOL);
        (await upgraded.version()).should.be.equal(TOKEN_VERSION);
        (await upgraded.callbackFee()).should.be.equal(123n);
    });
});
