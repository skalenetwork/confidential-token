
import { getVersion, verify, verifyProxy } from "@skalenetwork/upgrade-tools";
import chalk from "chalk";
import { ethers, upgrades } from "hardhat";
import { getRequiredEnvironmentVariable, storeAddresses } from "./deployMintable";
import { AddressLike } from "ethers";
import { transferAndCheckUpgradeableOwnership } from "./upgradeableOwnership";

export const deployMintableUpgradeable = async (tokenName: string, tokenSymbol: string, version: string, ownerAddress: AddressLike) => {
    const accessManagerFactory = await ethers.getContractFactory("AccessManager");
    const accessManager = await accessManagerFactory.deploy(ownerAddress);
    await accessManager.deploymentTransaction()!.wait();
    console.log(`Deployed AccessManager at: ${await ethers.resolveAddress(accessManager)}`);

    const MintableConfidentialTokenFactory = await ethers.getContractFactory("MintableConfidentialToken");
    const mintableConfidentialToken = await upgrades.deployProxy(
        MintableConfidentialTokenFactory,
        [
            tokenName,
            tokenSymbol,
            version,
            await ethers.resolveAddress(accessManager)
        ],
        {
            initializer: "initialize",
            constructorArgs: [true, "", "", "", ethers.ZeroAddress]
        }
    );
    await mintableConfidentialToken.waitForDeployment();
    console.log(`Deployed MintableConfidentialToken at: ${await ethers.resolveAddress(mintableConfidentialToken)}`);
    await transferAndCheckUpgradeableOwnership(mintableConfidentialToken, accessManager, ownerAddress);

    return {
        AccessManager: accessManager,
        MintableConfidentialToken: mintableConfidentialToken
    };
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
    const deployedContracts = await deployMintableUpgradeable(
        getRequiredEnvironmentVariable("NAME"),
        getRequiredEnvironmentVariable("SYMBOL"),
        version,
        ownerAddress
    );

    console.log("Store addresses");
    await storeAddresses(deployedContracts, version);

    console.log("Verify contracts");
    await verify("AccessManager", await ethers.resolveAddress(deployedContracts.AccessManager));
    await verifyProxy("MintableConfidentialToken", await ethers.resolveAddress(deployedContracts.MintableConfidentialToken));

    console.log("Done");
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
