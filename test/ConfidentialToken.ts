import { ethers } from "hardhat";
import { cleanDeployment } from "./tools/fixtures";
import "chai/register-should";
import { getPublicKey } from "./tools/cryptography";


describe("ConfidentialToken", () => {

    it("should not allow everyone to call onDecrypt", async () => {
        const [, hacker] = await ethers.getSigners();
        const { token } = await cleanDeployment();
        await token.connect(hacker).onDecrypt([], [])
            .should.be.revertedWithCustomError(
                token,
                "AccessViolation"
            );
    });

    it("should confidentially transfer tokens", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, recipient] = await ethers.getSigners();
        const { token, bite } = await cleanDeployment();

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
        const { token, bite } = await cleanDeployment();

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        await token.registerPublicKey(await getPublicKey(owner));

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");

        await token.mint(owner, amount);
        await bite.sendCallback();

        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");

        await token.burn(amount);
        await bite.sendCallback();

        (await token.encryptedBalanceOf(owner)).should.be.equal("0x");
    });
});
