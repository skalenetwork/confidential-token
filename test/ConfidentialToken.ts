import { ethers } from "hardhat";
import { cleanMintableDeployment } from "./tools/fixtures";
import "chai/register-should";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf } from "./tools/helpers";


describe("ConfidentialToken", () => {

    it("should not allow everyone to call onDecrypt", async () => {
        const [, hacker] = await ethers.getSigners();
        const { token } = await cleanMintableDeployment();
        await token.connect(hacker).onDecrypt([], [])
            .should.be.revertedWithCustomError(
                token,
                "AccessViolation"
            );
    });

    it("should confidentially transfer tokens", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, recipient] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        await token.registerPublicKey(await getPublicKey(recipient));

        await token.mint(owner, amount);
        await bite.sendCallback();

        await token.transfer(recipient, amount);
        await bite.sendCallback();

        const encryptedBalance = await token.encryptedBalanceOf(recipient);
        encryptedBalance.should.not.be.equal(amount);

        const decryptedBalance = await bite.decrypt(encryptedBalance);
        decryptedBalance.should.be.equal(amount);
    });

    it("should be able to burn tokens", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        await token.registerPublicKey(await getPublicKey(owner));

        // No action yet
        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");

        await token.mint(owner, amount);
        await bite.sendCallback();

        // No action yet
        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
        (await token.totalSupply()).should.be.equal(amount);

        await token.burn(amount);
        await bite.sendCallback();

        // Should be encrypted
        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
        (await balanceOf(token, bite, owner)).should.be.equal(0);
    });

    it("should be possible to set callback fee", async () => {
        const amount = ethers.parseEther("1.0");
        const callbackFee = ethers.parseEther("1.0");
        const [owner] = await ethers.getSigners();
        const { bite, token } = await cleanMintableDeployment();

        await token.setCallbackFee(callbackFee);
        (await token.callbackFee()).should.be.equal(callbackFee);

        const initialBalance = ethers.parseEther("5.0");
        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: initialBalance
        });
        (await token.ethBalanceOf(owner)).should.be.equal(initialBalance);

        await token.mint(owner, amount);
        await bite.sendCallback();

        (await token.ethBalanceOf(owner)).should.be.equal(initialBalance - callbackFee);

        (await token.withdraw(initialBalance - callbackFee, owner))
            .should.changeEtherBalance(owner, initialBalance - callbackFee);
        (await token.ethBalanceOf(owner)).should.be.equal(0);
    });

    it("should not return token balance", async () => {
        const { token } = await cleanMintableDeployment();
        const [owner] = await ethers.getSigners();

        await token.balanceOf(owner)
            .should.be.revertedWithCustomError(token, "ValueIsEncrypted");
    })
});
