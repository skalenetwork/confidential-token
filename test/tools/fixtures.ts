import {
    loadFixture
} from "@nomicfoundation/hardhat-network-helpers";
import { deployMintable } from "../../migrations/deployMintable";
import { ethers } from "hardhat";
import { deployWrapper } from "../../migrations/deployWrapper";
import { deployTestERC20 } from "../../scripts/deployTestERC20";

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
    const contracts = await deployMintable(
        tokenName,
        tokenSymbol,
        version,
        deployer
    );
    const mocks = await deployBiteMocks();
    await contracts.MintableConfidentialToken.setEncryptECIESAddress(mocks.encryptECIES);
    await contracts.MintableConfidentialToken.setEncryptTEAddress(mocks.encryptTE);
    await contracts.MintableConfidentialToken.setSubmitCTXAddress(mocks.submitCTX);
    await contracts.MintableConfidentialToken.setCallbackFee(ethers.parseEther("0.003"));

    return {
        accessManager: contracts.AccessManager,
        owner: deployer,
        token: contracts.MintableConfidentialToken,
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

    const contracts = await deployWrapper(
        underlyingToken,
        version,
        deployer
    );

    const mocks = await deployBiteMocks();
    await contracts.ConfidentialWrapper.setEncryptECIESAddress(mocks.encryptECIES);
    await contracts.ConfidentialWrapper.setEncryptTEAddress(mocks.encryptTE);
    await contracts.ConfidentialWrapper.setSubmitCTXAddress(mocks.submitCTX);
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

// External functions

export const cleanMintableDeployment = async () => loadFixture(deployMintableFixture);
export const withMintedTokens = async () => loadFixture(mintedFixture);
export const cleanWrapperDeployment = async () => loadFixture(deployWrapperFixture);
export const withWrappedTokens = async () => loadFixture(wrappedFixture);
