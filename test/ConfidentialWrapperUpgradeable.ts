// cspell:words ECIES

import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BaseContract } from "ethers";
import { ethers, upgrades } from "hardhat";
import "chai/register-should";
import {
    BiteMock,
    ConfidentialToken,
    ConfidentialWrapper,
    TestERC20
} from "../typechain-types";
import { deployWrapperWithTokenDeployer } from "./tools/tokenDeployerHelpers";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf } from "./tools/helpers";

const UNDERLYING_NAME = "D2 Example";
const UNDERLYING_SYMBOL = "D2E";
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

const deployUnderlyingToken = async () => {
    const underlyingFactory = await ethers.getContractFactory("TestERC20");
    const underlyingToken = await underlyingFactory.deploy(UNDERLYING_NAME, UNDERLYING_SYMBOL) as TestERC20;
    await underlyingToken.waitForDeployment();
    return underlyingToken;
};

const deployUpgradeableWrapper = async () => {
    const [owner] = await ethers.getSigners();
    const underlyingToken = await deployUnderlyingToken();
    const contracts = await deployWrapperWithTokenDeployer({
        proxyMode: true,
        ownerEnvVariable: "TEST_OWNER_WRAPPER",
        ownerAddress: owner,
        originToken: underlyingToken,
        version: TOKEN_VERSION
    });
    const token = contracts.ConfidentialWrapper as unknown as ConfidentialWrapper;

    return {
        accessManager: contracts.AccessManager,
        owner,
        token,
        underlyingToken
    };
};

const deployUpgradeableWrapperFixture = async () => {
    const deployment = await deployUpgradeableWrapper();
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

describe("ConfidentialWrapperUpgradeable", () => {
    it("initializes proxy storage", async () => {
        const { token, accessManager, underlyingToken } = await deployUpgradeableWrapper();

        (await token.name()).should.be.equal(`Confidential ${UNDERLYING_NAME}`);
        (await token.symbol()).should.be.equal(`cnf${UNDERLYING_SYMBOL}`);
        (await token.version()).should.be.equal(TOKEN_VERSION);
        (await token.authority()).should.be.equal(await ethers.resolveAddress(accessManager));
        (await token.underlying()).should.be.equal(await ethers.resolveAddress(underlyingToken));
        (await token.decimals()).should.be.equal(await underlyingToken.decimals());
        (await token.callbackFee()).should.be.equal(1_000_000_000_000n);
        (await token.encryptECIESAddress()).should.be.equal(ENCRYPT_ECIES_ADDRESS);
        (await token.encryptTEAddress()).should.be.equal(ENCRYPT_TE_ADDRESS);
        (await token.submitCTXAddress()).should.be.equal(SUBMIT_CTX_ADDRESS);
    });

    it("transfers proxy admin ownership to configured owner", async () => {
        const [, configuredOwner] = await ethers.getSigners();
        const underlyingToken = await deployUnderlyingToken();
        const contracts = await deployWrapperWithTokenDeployer({
            proxyMode: true,
            ownerEnvVariable: "TEST_OWNER_WRAPPER",
            ownerAddress: configuredOwner,
            originToken: underlyingToken,
            version: TOKEN_VERSION
        });
        const token = contracts.ConfidentialWrapper as unknown as ConfidentialWrapper;

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
        const { token, accessManager, underlyingToken } = await loadFixture(deployUpgradeableWrapperFixture);

        await token["initialize(address,string,address)"](
            underlyingToken,
            TOKEN_VERSION,
            accessManager
        ).should.be.revertedWithCustomError(token, "InvalidInitialization");
    });

    it("rejects the inherited token initializer through the wrapper proxy", async () => {
        const { token, owner } = await loadFixture(deployUpgradeableWrapperFixture);

        await token["initialize(string,string,string,address)"](
            "Wrapped",
            "WRP",
            TOKEN_VERSION,
            owner
        ).should.be.revertedWithCustomError(token, "WrongInitializer");
    });

    it("locks the implementation contract", async () => {
        const [owner] = await ethers.getSigners();
        const underlyingToken = await deployUnderlyingToken();
        const accessManagerFactory = await ethers.getContractFactory("AccessManager");
        const accessManager = await accessManagerFactory.deploy(owner);
        await accessManager.waitForDeployment();
        const tokenFactory = await ethers.getContractFactory("ConfidentialWrapper");
        const implementation = await tokenFactory.deploy(true, ethers.ZeroAddress, "", ethers.ZeroAddress) as ConfidentialWrapper;
        await implementation.waitForDeployment();

        await implementation["initialize(address,string,address)"](
            underlyingToken,
            TOKEN_VERSION,
            accessManager
        ).should.be.revertedWithCustomError(implementation, "InvalidInitialization");
    });

    it("keeps restricted settings protected through the proxy", async () => {
        const { token, accessManager } = await loadFixture(deployUpgradeableWrapperFixture);
        const [, unauthorized] = await ethers.getSigners();

        await token.connect(unauthorized).setCallbackFee(123n)
            .should.be.revertedWithCustomError(token, "AccessManagedUnauthorized")
            .withArgs(unauthorized);
        (await token.authority()).should.be.equal(await ethers.resolveAddress(accessManager));
    });

    it("runs a representative wrap and unwrap flow through the proxy", async () => {
        const { token, underlyingToken, owner, bite } = await loadFixture(deployUpgradeableWrapperFixture);
        const [, recipient] = await ethers.getSigners();
        const amount = ethers.parseEther("1");

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1")
        });
        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        await bite.sendCallback();

        await underlyingToken.mint(owner, amount);
        await underlyingToken.connect(owner).approve(token, amount);
        await token.connect(owner).depositFor(owner, amount);
        await bite.sendCallback();

        (await balanceOf(token as unknown as ConfidentialToken, bite, owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(amount);
        (await token.totalSupply()).should.be.equal(amount);

        await token.connect(owner).withdrawTo(recipient, amount);
        await bite.sendCallback();

        (await balanceOf(token as unknown as ConfidentialToken, bite, owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
        (await token.totalSupply()).should.be.equal(0);
    });

    it("preserves initialized storage across an upgrade", async () => {
        const { token, underlyingToken } = await loadFixture(deployUpgradeableWrapperFixture);
        await token.setCallbackFee(123n);

        const tokenFactory = await ethers.getContractFactory("ConfidentialWrapper");
        const upgraded = await upgrades.upgradeProxy(
            await token.getAddress(),
            tokenFactory,
            { constructorArgs: [true, ethers.ZeroAddress, "", ethers.ZeroAddress] }
        ) as unknown as ConfidentialWrapper;
        await upgraded.waitForDeployment();

        (await upgraded.name()).should.be.equal(`Confidential ${UNDERLYING_NAME}`);
        (await upgraded.symbol()).should.be.equal(`cnf${UNDERLYING_SYMBOL}`);
        (await upgraded.version()).should.be.equal(TOKEN_VERSION);
        (await upgraded.underlying()).should.be.equal(await ethers.resolveAddress(underlyingToken));
        (await upgraded.callbackFee()).should.be.equal(123n);
    });
});
