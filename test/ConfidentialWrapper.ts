import { ethers } from "hardhat";
import { cleanWrapperDeployment, withWrappedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import "chai/register-should";
import { balanceOf } from "./tools/helpers";

describe("ConfidentialWrapper", () => {
    it("should be able to wrap and unwrap tokens", async () => {
        const { underlyingToken, token, owner, bite } = await cleanWrapperDeployment();
        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });
        await token.registerPublicKey(await getPublicKey(owner));
        await bite.sendCallback();

        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");

        const amount = ethers.parseEther("1");
        await underlyingToken.mint(owner, amount);
        await underlyingToken.approve(
            token,
            amount
        );
        await token.depositFor(owner, amount);
        await bite.sendCallback();

        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(amount);

        await token.withdrawTo(owner, amount);
        await bite.sendCallback();
        // balance should be encrypted
        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");

        (await balanceOf(token, bite, owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    });

    it("should be possible to unlock underlying tokens if bite transaction fails", async () => {
        const { underlyingToken, token, owner, bite } = await cleanWrapperDeployment();
        await token.registerPublicKey(await getPublicKey(owner) , {value: ethers.parseEther("1.0")});
        await bite.sendCallback();

        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");

        const amount = ethers.parseEther("1");
        await underlyingToken.mint(owner, amount);
        await underlyingToken.approve(
            token,
            amount
        );
        await token.depositFor(owner, amount);

        // Balance hidden on registration
        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(amount);

        await token.releaseTo(owner, amount);

        // Balance hidden on registration
        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);

        // Check if bite transaction comes later there is no "double spending"
        // and no tokens are minted.
        await bite.sendCallback()
            .should.be.revertedWithCustomError(
                token, "OutdatedMint"
            ).withArgs(owner, amount);

        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    });

    it("should not allow to withdraw to the token itself", async () => {
        const { token, wrapped } = await withWrappedTokens();

        await token.withdrawTo(token, wrapped)
            .should.be.revertedWithCustomError(
                token, "ERC20InvalidReceiver"
            ).withArgs(await ethers.resolveAddress(token));
    });

    it("should return decimals of the underlying token", async () => {
        const { token, underlyingToken } = await cleanWrapperDeployment();
        (await token.decimals()).should.be.equal(await underlyingToken.decimals());
    });

    it("should return total supply", async () => {
        const { token, wrapped } = await withWrappedTokens();
        (await token.totalSupply()).should.be.equal(wrapped);
    });

    it("balanceOf should have confidential behavior", async () => {
        const { owner, token } = await withWrappedTokens();
        await token.balanceOf(owner)
            .should.be.revertedWithCustomError(token, "ValueIsEncrypted");
    });
});
