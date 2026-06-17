import { AddressLike } from "ethers";
import { ethers } from "hardhat";
import { TokenDeployer } from "../../migrations/deploy";
import { AccessManager, ConfidentialWrapper, MintableConfidentialToken } from "../../typechain-types";

interface TokenDeployInput {
    proxyMode: boolean;
    ownerEnvVariable: string;
    ownerAddress: AddressLike;
    name: string;
    symbol: string;
    version: string;
}

interface WrapperDeployInput {
    proxyMode: boolean;
    ownerEnvVariable: string;
    ownerAddress: AddressLike;
    originToken: AddressLike;
    version: string;
}

const withTemporaryOwnerEnv = async <T>(ownerEnvVariable: string, ownerAddress: AddressLike, fn: () => Promise<T>): Promise<T> => {
    const previousOwnerEnv = process.env[ownerEnvVariable];
    process.env[ownerEnvVariable] = await ethers.resolveAddress(ownerAddress);

    try {
        return await fn();
    } finally {
        if (previousOwnerEnv === undefined) {
            delete process.env[ownerEnvVariable];
        } else {
            process.env[ownerEnvVariable] = previousOwnerEnv;
        }
    }
};

export const deployMintableWithTokenDeployer = async (input: TokenDeployInput): Promise<{
    AccessManager: AccessManager;
    MintableConfidentialToken: MintableConfidentialToken;
}> => {
    const { proxyMode, ownerEnvVariable, ownerAddress, name, symbol, version } = input;

    return withTemporaryOwnerEnv(ownerEnvVariable, ownerAddress, async () => {
        const tokenDeployer = new TokenDeployer(proxyMode, ownerEnvVariable);
        await tokenDeployer.deployMintableToken({ name, symbol, version });
        await tokenDeployer.transferUpgradeableOwnership();

        const deployedContracts = tokenDeployer.getDeployedContracts();
        return {
            AccessManager: await ethers.getContractAt(
                "AccessManager",
                deployedContracts["AccessManager"]
            ) as unknown as AccessManager,
            MintableConfidentialToken: await ethers.getContractAt(
                "MintableConfidentialToken",
                deployedContracts["MintableConfidentialToken"]
            ) as unknown as MintableConfidentialToken
        };
    });
};

export const deployWrapperWithTokenDeployer = async (input: WrapperDeployInput): Promise<{
    AccessManager: AccessManager;
    ConfidentialWrapper: ConfidentialWrapper;
}> => {
    const { proxyMode, ownerEnvVariable, ownerAddress, originToken, version } = input;

    return withTemporaryOwnerEnv(ownerEnvVariable, ownerAddress, async () => {
        const tokenDeployer = new TokenDeployer(proxyMode, ownerEnvVariable);
        await tokenDeployer.deployTokenWrapper({ originToken, version });
        await tokenDeployer.transferUpgradeableOwnership();

        const deployedContracts = tokenDeployer.getDeployedContracts();
        return {
            AccessManager: await ethers.getContractAt(
                "AccessManager",
                deployedContracts["AccessManager"]
            ) as unknown as AccessManager,
            ConfidentialWrapper: await ethers.getContractAt(
                "ConfidentialWrapper",
                deployedContracts["ConfidentialWrapper"]
            ) as unknown as ConfidentialWrapper
        };
    });
};
