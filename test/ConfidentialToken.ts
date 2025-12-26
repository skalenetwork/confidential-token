import { ethers } from "hardhat";
import { cleanDeployment } from "./tools/fixtures";
import "chai/register-should";


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

        await token.mint(owner, amount, {value: ethers.parseEther("0.1")});
        await bite.sendCallback();

        await token.transfer(recipient, amount);
        await bite.sendCallback();

        const encryptedBalance = await token.encryptedBalanceOf(recipient);
        encryptedBalance.should.not.be.equal(amount);

        const decryptedBalance = await bite.decrypt(encryptedBalance);
        decryptedBalance.should.be.equal(amount);
    });
});
