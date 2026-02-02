import { ethers } from "hardhat";

export const deployTestERC20 = async (tokenName: string, tokenSymbol: string) => {
    const factory = await ethers.getContractFactory("TestERC20");
    const token = await factory.deploy(
        tokenName,
        tokenSymbol
    );
    await token.deploymentTransaction()!.wait();
    console.log(`Deployed TestERC20 at: ${await ethers.resolveAddress(token)}`);
    return {TestERC20: token};
};

const main = async () => {
    await deployTestERC20(
        "D2 Example",
        "D2E"
    );
    console.log("Done");
};

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
