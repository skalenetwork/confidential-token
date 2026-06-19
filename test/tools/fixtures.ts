import {
    loadFixture,
    setCode
} from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { HDNodeWallet, Wallet } from "ethers";
import { AccessManager, MintableConfidentialToken } from "../../typechain-types";
import {
    deployMintableWithTokenDeployer,
    deployWrapperWithTokenDeployer
} from "./tokenDeployerHelpers";
import { deployTestERC20 } from "../../scripts/deployTestERC20";
import { getPublicKey } from "./cryptography";
import { feedAccounts } from "./helpers";

// cspell:words ECIES

// Auxiliary functions

const deployBiteMocks = async () => {
    const biteFactory = await ethers.getContractFactory("BiteMock");
    const bite = await biteFactory.deploy();
    const encryptECIESFactory = await ethers.getContractFactory("EncryptECIESMock");
    const encryptECIES = await encryptECIESFactory.deploy(bite);
    const encryptTEFactory = await ethers.getContractFactory("EncryptTEMock");
    const encryptTE = await encryptTEFactory.deploy(bite);
    const submitCTXFactory = await ethers.getContractFactory("SubmitCTXMock");
    const submitCTX = await submitCTXFactory.deploy(bite);

    // Set precompiles at predefined addresses
    await setCode(
        "0x000000000000000000000000000000000000001c", // ENCRYPT_ECIES_ADDRESS
        await ethers.provider.getCode(encryptECIES)
    );
    await setCode(
        "0x000000000000000000000000000000000000001d", // ENCRYPT_TE_ADDRESS
        await ethers.provider.getCode(encryptTE)
    );
    await setCode(
        "0x000000000000000000000000000000000000001b", // SUBMIT_CTX_ADDRESS
        await ethers.provider.getCode(submitCTX)
    );

    return {
        bite,
        encryptECIES,
        encryptTE,
        submitCTX
    }
}

// Fixtures

const deployMintableFixture = async () => {
    const tokenName = "Confidential Token";
    const tokenSymbol = "CTK";
    const version = "testing";
    const [deployer] = await ethers.getSigners();

    const deployedContracts = await deployMintableWithTokenDeployer({
        proxyMode: false,
        ownerEnvVariable: "TEST_OWNER_MINTABLE_FIXTURE",
        ownerAddress: deployer,
        name: tokenName,
        symbol: tokenSymbol,
        version
    });
    const accessManager = deployedContracts.AccessManager as AccessManager;
    const mintableConfidentialToken = deployedContracts.MintableConfidentialToken as MintableConfidentialToken;

    const mocks = await deployBiteMocks();
    await mintableConfidentialToken.setCallbackFee(ethers.parseEther("0.003"));

    return {
        accessManager,
        owner: deployer,
        token: mintableConfidentialToken,
        ...mocks
    }
}

const mintedFixture = async () => {
    const minted = ethers.parseEther("1000");
    const gasTokenBalance = ethers.parseEther("1.0");
    const context = await cleanMintableDeployment();
    await context.owner.sendTransaction({
        to: await ethers.resolveAddress(context.token),
        value: gasTokenBalance
    });
    await context.token.mint(context.owner, minted);
    await context.bite.sendCallback();
    return {
        minted,
        ...context
    }
}

const deployWrapperFixture = async () => {
    const version = "testing";
    const [deployer] = await ethers.getSigners();

    const {TestERC20: underlyingToken} = await deployTestERC20(
        "D2 Example",
        "D2E"
    );

    const contracts = await deployWrapperWithTokenDeployer({
        proxyMode: false,
        ownerEnvVariable: "TEST_OWNER_WRAPPER_FIXTURE",
        ownerAddress: deployer,
        originToken: underlyingToken,
        version
    });

    const mocks = await deployBiteMocks();
    await contracts.ConfidentialWrapper.setCallbackFee(ethers.parseEther("0.003"));

    return {
        accessManager: contracts.AccessManager,
        owner: deployer,
        token: contracts.ConfidentialWrapper,
        underlyingToken,
        ...mocks
    }
}

const wrappedFixture = async () => {
    const wrapped = ethers.parseEther("1000");
    const gasTokenBalance = ethers.parseEther("1.0");
    const context = await cleanWrapperDeployment();
    await context.owner.sendTransaction({
        to: await ethers.resolveAddress(context.token),
        value: gasTokenBalance
    });
    await context.underlyingToken.mint(context.owner, wrapped);
    await context.underlyingToken.approve(
        context.token,
        wrapped
    );
    await context.token.depositFor(context.owner, wrapped);
    await context.bite.sendCallback();
    return {
        wrapped,
        ...context
    }
}

const eip3009Fixture = async () => {
    const alice = Wallet.createRandom(ethers.provider) as HDNodeWallet;
    const bob = Wallet.createRandom(ethers.provider) as HDNodeWallet;
    const charlie = Wallet.createRandom(ethers.provider) as HDNodeWallet;

    // Inline minting setup — avoids nesting loadFixture calls
    const minted = ethers.parseEther("1000");
    const gasTokenBalance = ethers.parseEther("1.0");
    const context = await deployMintableFixture();

    await context.owner.sendTransaction({
        to: await ethers.resolveAddress(context.token),
        value: gasTokenBalance
    });
    await context.token.mint(context.owner, minted);
    await context.bite.sendCallback();
    await feedAccounts([alice, bob, charlie]);
    for (const user of [alice, bob, charlie]) {
        await context.token.connect(user).fundWithGasToken(user, { value: ethers.parseEther("3") });
    }

    // Start: Time consuming section under coverage
    await context.token.transfer(alice, 10e6);
    await context.bite.sendCallback();

    await context.token.connect(alice).setViewerPublicKey(await getPublicKey(alice));
    await context.bite.sendCallback();
    await context.token.connect(bob).setViewerPublicKey(await getPublicKey(bob));
    await context.bite.sendCallback();
    //await context.token.connect(charlie).setViewerPublicKey(await getPublicKey(charlie));
    //await context.bite.sendCallback();
    // End: Time consuming section under coverage

    return { ...context, alice, bob, charlie, minted };
};

// External functions

export const cleanMintableDeployment = async () => loadFixture(deployMintableFixture);
export const withMintedTokens = async () => loadFixture(mintedFixture);
export const cleanWrapperDeployment = async () => loadFixture(deployWrapperFixture);
export const withWrappedTokens = async () => loadFixture(wrappedFixture);
export const withEIP3009Setup = async () => loadFixture(eip3009Fixture);
