import { ethers, network } from "hardhat";
import chalk from "chalk";
import { promises as fs } from 'fs';
import { getVersion, verify } from "@skalenetwork/upgrade-tools";
import { AddressLike, BaseContract } from "ethers";
import { AccessManager, MintableConfidentialToken } from "../typechain-types";

export const contracts = [
    "AccessManager",
    "MintableConfidentialToken"
];

export interface DeployedContracts {
    AccessManager: AccessManager,
    MintableConfidentialToken: MintableConfidentialToken
}

export const getRequiredEnvironmentVariable = (name: string): string => {
    if (!process.env[name]) {
        throw new Error(`Please set value for ${name} environment variable`);
    }
    return process.env[name];
}

export const deployMintable = async (tokenName: string, tokenSymbol: string, version: string, ownerAddress: AddressLike) => {
    const accessManagerFactory = await ethers.getContractFactory("AccessManager");
    const accessManager = await accessManagerFactory.deploy(ownerAddress);
    await accessManager.deploymentTransaction()!.wait();
    console.log(`Deployed AccessManager at: ${await ethers.resolveAddress(accessManager)}`);

    const MintableConfidentialTokenFactory = await ethers.getContractFactory("MintableConfidentialToken");
    const mintableConfidentialToken = await MintableConfidentialTokenFactory.deploy(
        false,
        tokenName,
        tokenSymbol,
        version,
        await ethers.resolveAddress(accessManager)
    );
    await mintableConfidentialToken.deploymentTransaction()!.wait();
    console.log(`Deployed MintableConfidentialToken at: ${await ethers.resolveAddress(mintableConfidentialToken)}`);

    return {
        AccessManager: accessManager,
        MintableConfidentialToken: mintableConfidentialToken
    };
};

export const storeAddresses = async <TContracts extends Record<string, BaseContract>>(
    deployedContracts: TContracts,
    version: string
) => {
    const addresses = Object.fromEntries(await Promise.all(Object.entries(deployedContracts).map(
            async ([name, contract]) => [name, await ethers.resolveAddress(contract)]
    )));
    for (const contract in addresses) {
        console.log(`${contract}: ${addresses[contract]}`);
    }
    await fs.writeFile(
        `data/confidential-token-${version}-${network.name}-contracts.json`,
        JSON.stringify(addresses, null, 4));
}

export const verifyAll = async (deployedContracts: DeployedContracts) => {
    for (const contractName in deployedContracts) {
        await verify(
            contractName,
            await ethers.resolveAddress(deployedContracts[contractName as keyof DeployedContracts])
        )
    }
}

const main = async () => {
    const version = await getVersion();
    const ownerEnvironmentVariable = 'OWNER';
    const [deployer] = await ethers.getSigners();

    if (!process.env[ownerEnvironmentVariable]) {
        console.log(chalk.gray(`OWNER environment variable is not set. Using deployer address as the owner`));
    }
    const ownerAddress = process.env[ownerEnvironmentVariable] || await ethers.resolveAddress(deployer);
    console.log(`Set ${ownerAddress} as owner`);

    console.log("Deploy contracts");

    const deployedContracts = await deployMintable(
        getRequiredEnvironmentVariable("NAME"),
        getRequiredEnvironmentVariable("SYMBOL"),
        version,
        ownerAddress
    );

    console.log("Store addresses");
    await storeAddresses(deployedContracts, version);

    console.log("Verify contracts");
    await verifyAll(deployedContracts);

    console.log("Done");
};

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
