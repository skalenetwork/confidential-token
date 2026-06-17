import { getVersion } from "@skalenetwork/upgrade-tools";
import { AccessManager, ConfidentialWrapper } from "../typechain-types";
import { createTokenDeployer, getRequiredEnvironmentVariable } from "./deploy";

export const contracts = [
    "AccessManager",
    "ConfidentialWrapper"
];

export interface DeployedContracts {
    AccessManager: AccessManager,
    ConfidentialWrapper: ConfidentialWrapper
}

const main = async () => {
    const version = await getVersion();
    const deployer = createTokenDeployer();

    console.log("Deploy contracts");
    await deployer.deployTokenWrapper({
        originToken: getRequiredEnvironmentVariable("ORIGIN_TOKEN"),
        version
    });

    if (deployer.isProxyMode()) {
        console.log("Transfer upgradeable ownership");
        await deployer.transferUpgradeableOwnership();
    }

    console.log("Store addresses");
    await deployer.storeAddresses(version);

    console.log("Verify contracts");
    await deployer.verifyAll();

    console.log("Done");
};

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
