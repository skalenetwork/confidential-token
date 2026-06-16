import { getVersion } from "@skalenetwork/upgrade-tools";
import { createTokenDeployer, getRequiredEnvironmentVariable } from "./deploy";

export const contracts = [
    "AccessManager",
    "MintableConfidentialToken"
];

const main = async () => {
    const version = await getVersion();
    const deployer = createTokenDeployer();

    console.log("Deploy contracts");
    await deployer.deployMintableToken({
        name: getRequiredEnvironmentVariable("NAME"),
        symbol: getRequiredEnvironmentVariable("SYMBOL"),
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
