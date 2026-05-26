import { getVersion } from "@skalenetwork/upgrade-tools";
import chalk from "chalk";
import { AddressLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import { getRequiredEnvironmentVariable } from "./deployMintable";
import { storeAddresses, verifyAll } from "./deployWrapper";
import { transferAndCheckUpgradeableOwnership } from "./upgradeableOwnership";

export const deployWrapperUpgradeable = async (originToken: AddressLike, version: string, ownerAddress: AddressLike) => {
    console.log("Deploy ConfidentialWrapper for", await ethers.resolveAddress(originToken));
    const accessManagerFactory = await ethers.getContractFactory("AccessManager");
    const accessManager = await accessManagerFactory.deploy(ownerAddress);
    await accessManager.deploymentTransaction()!.wait();
    console.log(`Deployed AccessManager at: ${await ethers.resolveAddress(accessManager)}`);

    const ConfidentialWrapperFactory = await ethers.getContractFactory("ConfidentialWrapperUpgradeable");
    const confidentialWrapper = await upgrades.deployProxy(
        ConfidentialWrapperFactory,
        [
            await ethers.resolveAddress(originToken),
            version,
            await ethers.resolveAddress(accessManager)
        ],
        {
            initializer: "initialize",
        }
    );
    await confidentialWrapper.waitForDeployment();
    console.log(`Deployed ConfidentialWrapper at: ${await ethers.resolveAddress(confidentialWrapper)}`);
    await transferAndCheckUpgradeableOwnership(confidentialWrapper, accessManager, ownerAddress);

    return {
        AccessManager: accessManager,
        ConfidentialWrapper: confidentialWrapper
    };
};

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

    const deployedContracts = await deployWrapperUpgradeable(
        getRequiredEnvironmentVariable("ORIGIN_TOKEN"),
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
