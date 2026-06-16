import { AddressLike } from "ethers";
import { ethers, upgrades } from "hardhat";
import { AccessManager } from "../typechain-types";

const PROXY_ADMIN_ABI = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner)"
];

export const transferAndCheckUpgradeableOwnership = async (
    proxy: AddressLike,
    accessManager: AccessManager,
    expectedOwner: AddressLike
) => {
    const [deployer] = await ethers.getSigners();
    const proxyAddress = await ethers.resolveAddress(proxy);
    const expectedOwnerAddress = await ethers.resolveAddress(expectedOwner);
    const deployerAddress = await ethers.resolveAddress(deployer);

    const proxyAdminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    const proxyAdmin = await ethers.getContractAt(PROXY_ADMIN_ABI, proxyAdminAddress);
    let proxyAdminOwner = await proxyAdmin.owner();

    if (proxyAdminOwner !== expectedOwnerAddress && expectedOwnerAddress !== deployerAddress) {
        const transferTransaction = await proxyAdmin.transferOwnership(expectedOwnerAddress);
        await transferTransaction.wait();
        console.log(`Transferred ProxyAdmin ownership to: ${expectedOwnerAddress}`);
        proxyAdminOwner = await proxyAdmin.owner();
    }

    if (proxyAdminOwner !== expectedOwnerAddress) {
        throw new Error(
            `ProxyAdmin owner is ${proxyAdminOwner}, expected ${expectedOwnerAddress}`
        );
    }

    const adminRole = await accessManager.ADMIN_ROLE();
    const [hasAdminRole, executionDelay] = await accessManager.hasRole(adminRole, expectedOwnerAddress);
    if (!hasAdminRole || executionDelay !== 0n) {
        throw new Error(
            `AccessManager ADMIN_ROLE is not immediately granted to ${expectedOwnerAddress}`
        );
    }
};
