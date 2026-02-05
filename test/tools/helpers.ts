// cspell:words ECIES

import { AddressLike } from "ethers";
import { BiteMock, ConfidentialToken } from "../../typechain-types";
import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

/// Mirrors the Solidity EncryptionMethod enum in BiteMock.sol
export const EncryptionMethod = {
    TE: 0n,
    ECIES: 1n
} as const;

export const balanceOf = async (token: ConfidentialToken, bite: BiteMock, holder: AddressLike) => {
    const encryptedBalance = await token.encryptedBalanceOf(holder);
    if (encryptedBalance === "0x") {
        return 0n;
    }
    return ethers.toBigInt(await bite.decrypt(encryptedBalance, EncryptionMethod.ECIES));
}


export const feedAccounts = async (addresses: AddressLike[]) => {
    for (const address of addresses) {
        await setBalance(
            await ethers.resolveAddress(address),
            ethers.parseEther("1000")
        );
    }
}

export const nowPlusSeconds = async (seconds: number) => {
    const validAfter = (await ethers.provider.getBlock("latest"))!.timestamp + seconds;
    return validAfter;
}
