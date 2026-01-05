import { AddressLike } from "ethers";
import { BiteMock, ConfidentialToken } from "../../typechain-types";
import { ethers } from "hardhat";

export const balanceOf = async (token: ConfidentialToken, bite: BiteMock,holder: AddressLike) => {
    const encryptedBalance = await token.encryptedBalanceOf(holder);
    if (encryptedBalance === "0x") {
        return 0n;
    }
    return ethers.toBigInt(await bite.decrypt(encryptedBalance));
}
