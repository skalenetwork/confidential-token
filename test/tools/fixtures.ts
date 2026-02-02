import {
    loadFixture
} from "@nomicfoundation/hardhat-network-helpers";
import { deployMintable } from "../../migrations/deployMintable";
import { ethers } from "hardhat";
import { deployWrapper } from "../../migrations/deployWrapper";

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
    await contracts.ConfidentialToken.setEncryptECIESAddress(mocks.encryptECIES);
    await contracts.ConfidentialToken.setEncryptTEAddress(mocks.encryptTE);
    await contracts.ConfidentialToken.setSubmitCTXAddress(mocks.submitCTX);
    await contracts.ConfidentialToken.setCallbackFee(ethers.parseEther("0.003"));

    return {
        accessManager: contracts.AccessManager,
        owner: deployer,
        token: contracts.ConfidentialToken,
        ...mocks
    }
}

const mintedFixture = async () => {
    const minted = ethers.parseEther("1000");
    const ethBalance = ethers.parseEther("1.0");
    const context = await cleanMintableDeployment();
    await context.owner.sendTransaction({
        to: await ethers.resolveAddress(context.token),
        value: ethBalance
    });
    await context.token.mint(context.owner, minted);
    await context.bite.sendCallback();
    return {
        minted,
        ...context
    }
}

const deployWrapperFixture = async () => {
    const tokenName = "Regular Token";
    const tokenSymbol = "RTK";
    const version = "testing";
    const [deployer] = await ethers.getSigners();

    const underlyingFactory = await ethers.getContractFactory("MintableERC20");
    const underlyingToken = await underlyingFactory.deploy(
        tokenName,
        tokenSymbol
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

// External functions

export const cleanMintableDeployment = async () => loadFixture(deployMintableFixture);
export const withMintedTokens = async () => loadFixture(mintedFixture);
export const cleanWrapperDeployment = async () => loadFixture(deployWrapperFixture);
