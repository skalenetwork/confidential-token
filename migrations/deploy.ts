import { ethers, network, upgrades } from "hardhat";
import chalk from "chalk";
import { AddressLike } from "ethers";
import { verify, verifyProxy } from "@skalenetwork/upgrade-tools";
import { promises as fs } from "fs";
import { transferAndCheckUpgradeableOwnership } from "./upgradeableOwnership";


export const getRequiredEnvironmentVariable = (name: string): string => {
    if (!process.env[name]) {
        throw new Error(`Please set value for ${name} environment variable`);
    }
    return process.env[name];
}

export const getUpgradeabilityMode = (): boolean => {
    const value = getRequiredEnvironmentVariable("UPGRADEABLE");
    if (value !== "true" && value !== "false") {
        throw new Error(`UPGRADEABLE environment variable must be "true" or "false", got "${value}"`);
    }
    return value === "true";
}

export const resolveOwnerAddress = async (ownerEnvironmentVariable: string = "OWNER"): Promise<string> => {
    const [deployer] = await ethers.getSigners();
    if (!process.env[ownerEnvironmentVariable]) {
        console.log(chalk.gray(`${ownerEnvironmentVariable} environment variable is not set. Using deployer address as the owner`));
    }
    const ownerAddress = process.env[ownerEnvironmentVariable] || await ethers.resolveAddress(deployer);
    console.log(`Set ${ownerAddress} as owner`);
    return ownerAddress;
}

export interface TokenDeployParams {
    name: string;
    symbol: string;
    version: string;
}

export interface WrapperDeployParams {
    originToken: AddressLike;
    version: string;
}


export class TokenDeployer {

    private contractNames: string[] = [];
    private deployedContracts: Record<string, string> = {};
    private proxyPattern: boolean;
    private ownerEnvironmentVariable: string;

    constructor(proxyPattern: boolean = false, ownerEnvironmentVariable: string = "OWNER") {
        this.proxyPattern = proxyPattern;
        this.ownerEnvironmentVariable = ownerEnvironmentVariable;
    }

    async deployConfidentialToken(params: TokenDeployParams) {
        this._assertCanDeployToken();
        await this._deployToken("ConfidentialToken", params);
    }

    async deployMintableToken(params: TokenDeployParams) {
        this._assertCanDeployToken();
        await this._deployToken("MintableConfidentialToken", params);
    }

    async deployTokenWrapper(params: WrapperDeployParams) {
        this._assertCanDeployToken();
        const accessManagerAddress = await this._deployAccessManager();
        const originToken = await ethers.resolveAddress(params.originToken);
        const { version } = params;
        if (this.proxyPattern) {
            await this._deployProxy(
                "ConfidentialWrapper",
                [originToken, version, accessManagerAddress],
                [true, ethers.ZeroAddress, "", ethers.ZeroAddress]
            );
        } else {
            await this._deployContract(
                "ConfidentialWrapper",
                [false, originToken, version, accessManagerAddress]
            );
        }
    }

    private async _deployToken(contractName: string, params: TokenDeployParams) {
        const accessManagerAddress = await this._deployAccessManager();
        const { name, symbol, version } = params;
        if (this.proxyPattern) {
            await this._deployProxy(
                contractName,
                [name, symbol, version, accessManagerAddress],
                [true, "", "", "", ethers.ZeroAddress]
            );
        } else {
            await this._deployContract(
                contractName,
                [false, name, symbol, version, accessManagerAddress]
            );
        }
    }

    getDeployedContracts() {
        return this.deployedContracts;
    }

    getContractNames() {
        return this.contractNames;
    }

    isProxyMode(): boolean {
        return this.proxyPattern;
    }

    async verifyAll() {
        for (const contractName of this.contractNames) {
            const address = this.deployedContracts[contractName];
            if (this.proxyPattern && contractName !== "AccessManager") {
                await verifyProxy(contractName, address);
            } else {
                await verify(contractName, address);
            }
        }
    }

    async transferUpgradeableOwnership() {
        if (!this.proxyPattern) {
            return;
        }

        const accessManagerAddress = this.deployedContracts["AccessManager"];
        if (!accessManagerAddress) {
            throw new Error("AccessManager has not been deployed yet");
        }

        const accessManager = await ethers.getContractAt("AccessManager", accessManagerAddress);
        const ownerAddress = await resolveOwnerAddress(this.ownerEnvironmentVariable);

        for (const contractName of this.contractNames) {
            if (contractName === "AccessManager") {
                continue;
            }
            await transferAndCheckUpgradeableOwnership(
                this.deployedContracts[contractName],
                accessManager,
                ownerAddress
            );
        }
    }

    async storeAddresses(version: string, extraName: string = "") {
        for (const contractName in this.deployedContracts) {
            console.log(`${contractName}: ${this.deployedContracts[contractName]}`);
        }

        const suffix = extraName ? `-${extraName}` : "";
        await fs.writeFile(
            `data/confidential-token-${version}-${network.name}${suffix}-contracts.json`,
            JSON.stringify(this.deployedContracts, null, 4)
        );
    }

    private async _deployContract(contractName: string, constructorArgs: unknown[]) {
        console.log(`Deploying ${contractName}...`);
        const factory = await ethers.getContractFactory(contractName);
        const contract = await factory.deploy(...constructorArgs);
        await contract.deploymentTransaction()?.wait();
        const deployedAddress = await ethers.resolveAddress(contract);
        console.log(`Deployed ${contractName} at: ${deployedAddress}`);
        this._storeDeployment(contractName, deployedAddress);
    }

    private async _deployProxy(
        contractName: string,
        initializerArgs: unknown[],
        implementationConstructorArgs: unknown[]
    ) {
        console.log(`Deploying ${contractName}...`);
        const factory = await ethers.getContractFactory(contractName);
        let initializer = "initialize";
        if (contractName === "ConfidentialWrapper") {
            initializer = "initialize(address,string,address)";
        }
        const contract = await upgrades.deployProxy(
            factory,
            initializerArgs,
            {
                initializer,
                constructorArgs: implementationConstructorArgs
            }
        );
        await contract.waitForDeployment();
        const deployedAddress = await ethers.resolveAddress(contract);
        console.log(`Deployed ${contractName} at: ${deployedAddress}`);
        this._storeDeployment(contractName, deployedAddress);
    }

    private _storeDeployment(contractName: string, deployedAddress: string) {
        this.deployedContracts[contractName] = deployedAddress;
        this.contractNames.push(contractName);
    }

    private _assertCanDeployToken() {
        const deployedContracts = Object.keys(this.deployedContracts);
        if (deployedContracts.length === 0) {
            return;
        }

        if (deployedContracts.length === 1) {
            throw new Error("Invalid deployer state: exactly one contract is registered. Use a fresh TokenDeployer instance.");
        }

        if (this.deployedContracts["AccessManager"]) {
            throw new Error("This TokenDeployer instance already deployed AccessManager plus a token/wrapper. Create a new instance for another deployment.");
        }

        throw new Error("Invalid deployer state: unexpected deployed contract set. Use a fresh TokenDeployer instance.");
    }

    private async _deployAccessManager(): Promise<string> {
        const existingAddress = this.deployedContracts["AccessManager"];
        if (existingAddress) {
            return existingAddress;
        }

        const ownerAddress = await resolveOwnerAddress(this.ownerEnvironmentVariable);
        const factory = await ethers.getContractFactory("AccessManager");
        const accessManager = await factory.deploy(ownerAddress);
        await accessManager.deploymentTransaction()!.wait();
        const accessManagerAddress = await ethers.resolveAddress(accessManager);
        console.log(`Deployed AccessManager at: ${accessManagerAddress}`);
        this._storeDeployment("AccessManager", accessManagerAddress);

        return accessManagerAddress;
    }

}

export const createTokenDeployer = (ownerEnvironmentVariable: string = "OWNER"): TokenDeployer => {
    return new TokenDeployer(getUpgradeabilityMode(), ownerEnvironmentVariable);
}
