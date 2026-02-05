// cspell:words ECIES

import { AddressLike } from "ethers";
import { BiteMock, ConfidentialToken } from "../../typechain-types";
import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

export const balanceOf = async (token: ConfidentialToken, bite: BiteMock, holder: AddressLike) => {
    const encryptedBalance = await token.encryptedBalanceOf(holder);
    if (encryptedBalance === "0x") throw new Error("Unexpected empty data");

    // We use the registered view key for mock decryption
    // In production the private key of the view key registered should be used
    const publicKey = await token.publicKeys(holder);
    return ethers.toBigInt(
        await bite.decryptECIES(
            encryptedBalance,
            await bite.pubKeyToUint256(publicKey.x, publicKey.y)
        )
    );
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
