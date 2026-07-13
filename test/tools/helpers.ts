// cspell:words ECIES

import { AddressLike } from "ethers";
import { BiteMock } from "../../typechain-types";
import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { assert } from "chai";

type EncryptedBalanceToken = {
    encryptedBalanceOf(holder: AddressLike): Promise<string>;
    viewerAddresses(holder: AddressLike): Promise<string>;
    publicKeys(address: string): Promise<{ x: string; y: string }>;
};

export const balanceOf = async (token: EncryptedBalanceToken, bite: BiteMock, holder: AddressLike) => {
    const encryptedBalance = await token.encryptedBalanceOf(holder);
    if (encryptedBalance === "0x") throw new Error("Unexpected empty data");

    // We use the registered view key for mock decryption
    // In production the private key of the view key registered should be used
    const publicKey = await token.publicKeys(await token.viewerAddresses(holder));
    const decrypted = await bite.decryptECIES(
        encryptedBalance,
        await bite.pubKeyToUint256(publicKey.x, publicKey.y)
    );
    return ethers.toBigInt(decrypted);
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

export const sendCallbackAndMakeRefund = async (bite: BiteMock) => {
    const callbackSender = await ethers.getContractAt("CallbackSender", await bite.getNextCallbackSender());

    const tx = await bite.sendCallback();
    const receipt = await tx.wait();
    assert(receipt);
    const ethSpent = receipt.gasUsed * receipt.gasPrice;

    // simulate gas token spending
    await setBalance(
        await ethers.resolveAddress(callbackSender),
        await ethers.provider.getBalance(callbackSender) - ethSpent
    );

    const supplicant = await callbackSender.SUPPLICANT();
    const rest = await ethers.provider.getBalance(callbackSender);

    await setBalance(await ethers.resolveAddress(callbackSender), 0n);
    await setBalance(supplicant, rest + await ethers.provider.getBalance(supplicant));

    return rest;
}

export const sendRevertingCallbackAndMakeRefund = async (bite: BiteMock) => {
    const callbackSender = await ethers.getContractAt("CallbackSender", await bite.getNextCallbackSender());

    // A callback that is going to revert would normally never even be sent: ethers
    // estimates gas first and refuses to broadcast a transaction it can see will fail.
    // Passing a fixed gas limit skips that estimation, so the transaction still lands
    // in a block - just like a real reverted transaction does on a live network.
    let receipt;
    try {
        const tx = await bite.sendCallback({ gasLimit: 10_000_000 });
        receipt = await tx.wait();
    } catch (error) {
        // Hardhat still mines a transaction that reverts, exactly like a real
        // network would, but throws instead of resolving normally. The mined
        // transaction's hash is on the error, so the real receipt (status 0) can
        // still be fetched directly from the provider.
        const { transactionHash } = error as { transactionHash?: string };
        assert(transactionHash, "expected a transaction hash on the revert error");
        receipt = await ethers.provider.getTransactionReceipt(transactionHash);
    }
    assert(receipt);
    assert.equal(receipt.status, 0, "expected the callback to revert");
    const ethSpent = receipt.gasUsed * receipt.gasPrice;

    // simulate gas token spending
    await setBalance(
        await ethers.resolveAddress(callbackSender),
        await ethers.provider.getBalance(callbackSender) - ethSpent
    );

    const supplicant = await callbackSender.SUPPLICANT();
    const rest = await ethers.provider.getBalance(callbackSender);

    await setBalance(await ethers.resolveAddress(callbackSender), 0n);
    await setBalance(supplicant, rest + await ethers.provider.getBalance(supplicant));

    return rest;
}
