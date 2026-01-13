import {
    loadFixture
} from "@nomicfoundation/hardhat-network-helpers";
import { deploy } from "../../migrations/deploy";
import { ethers } from "hardhat";
import { feedAccounts } from "./helpers";
import { PRIVATE_KEYS } from "./contants";
import { Wallet } from "ethers";

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

const deployFixture = async () => {
    const tokenName = "Confidential Token";
    const tokenSymbol = "CTK";
    const version = "testing";
    const [deployer] = await ethers.getSigners();
    const contracts = await deploy(
        tokenName,
        tokenSymbol,
        version,
        deployer
    );
    const mocks = await deployBiteMocks();
    await contracts.ConfidentialToken.setEncryptECIESAddress(mocks.encryptECIES);
    await contracts.ConfidentialToken.setEncryptTEAddress(mocks.encryptTE);
    await contracts.ConfidentialToken.setSubmitCTXAddress(mocks.submitCTX);

    await feedAccounts(PRIVATE_KEYS.map(key => (new Wallet(key).address)));
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
    const context = await cleanDeployment();
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

// External functions

export const cleanDeployment = async () => loadFixture(deployFixture);
export const withMintedTokens = async () => loadFixture(mintedFixture);
