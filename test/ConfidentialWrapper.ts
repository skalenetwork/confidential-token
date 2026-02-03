import { ethers } from "hardhat";
import { cleanWrapperDeployment } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";

describe("ConfidentialWrapper", () => {
    it("should be able to wrap and unwrap tokens", async () => {
        const { underlyingToken, token, owner, bite } = await cleanWrapperDeployment();
        await token.registerPublicKey(await getPublicKey(owner));
        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");

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

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    });

    it("should be possible to unlock underlying tokens if bite transaction fails", async () => {
        const { underlyingToken, token, owner, bite } = await cleanWrapperDeployment();
        await token.registerPublicKey(await getPublicKey(owner));
        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");

        const amount = ethers.parseEther("1");
        await underlyingToken.mint(owner, amount);
        await underlyingToken.approve(
            token,
            amount
        );
        await token.depositFor(owner, amount);

        // No callback sent by bite here

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(amount);

        await token.releaseTo(owner, amount);

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);

        // Check if bite transaction comes later there is no "double spending"
        // and no tokens are minted.
        await bite.sendCallback()
            .should.be.revertedWithCustomError(
                token, "OutdatedMint"
            ).withArgs(owner, amount);

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");
        (await underlyingToken.balanceOf(owner)).should.be.equal(amount);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    })
});
