import { ethers } from "hardhat";
import { cleanDeployment } from "./tools/fixtures";
import chai, { expect } from "chai";

chai.should();

describe("ConfidentialToken", () => {

    it("should not allow everyone to call onDecrypt", async () => {
        const [, hacker] = await ethers.getSigners();
        const { token } = await cleanDeployment();
        await expect(token.connect(hacker).onDecrypt([], []))
            .to.be.revertedWithCustomError(
            token,
            "AccessViolation"
        );
    });
});
