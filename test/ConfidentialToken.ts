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

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        const message = "Get my public key";
        const signature = await recipient.signMessage(message);
        const msgHash = ethers.hashMessage(message);
        const publicKey = ethers.SigningKey.recoverPublicKey(msgHash, signature);
        const px = '0x' + publicKey.slice(4, 68);
        const py = '0x' + publicKey.slice(68);

        await token.registerPublicKey({x: px, y: py});

        await token.mint(owner, amount);
        await bite.sendCallback();

        await token.transfer(recipient, amount);
        await bite.sendCallback();

        const encryptedBalance = await token.encryptedBalanceOf(recipient);
        encryptedBalance.should.not.be.equal(amount);

        const decryptedBalance = await bite.decrypt(encryptedBalance);
        decryptedBalance.should.be.equal(amount);
    });
});
