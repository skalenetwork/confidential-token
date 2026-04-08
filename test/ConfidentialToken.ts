// cspell:words ECIES automine

import { ethers, network } from "hardhat";
import { cleanMintableDeployment, withMintedTokens } from "./tools/fixtures";
import "chai/register-should";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf } from "./tools/helpers";
import { expect } from "chai";
import { mine } from "@nomicfoundation/hardhat-network-helpers";


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

        await token.connect(recipient).setViewerPublicKey(
            await getPublicKey(recipient),
            {value: ethers.parseEther("1.0")}
        );
        await bite.sendCallback();

        await token.mint(owner, amount);
        await bite.sendCallback();

        await token.transfer(recipient, amount);
        await bite.sendCallback();

        const encryptedBalance = await token.encryptedBalanceOf(recipient);
        encryptedBalance.should.not.be.equal(amount);

        const decryptedBalance = await balanceOf(token, bite, recipient);
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

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        await bite.sendCallback();

        // Balance is encrypted after registering public key
        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");

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
    });

    it("should not return encrypted token balance until view address registered", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();

        await token.registerPublicKey(await getPublicKey(owner));
        await token.encryptedBalanceOf(owner).should.be.revertedWithCustomError(token, "NoViewerRegisteredForHolder");

        await token.setViewerAddress(owner.address, {value: amount});
        await bite.sendCallback();

        (await token.encryptedBalanceOf(owner)).should.not.be.equal("0x");
    });

    it("should show different balances for different users", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, user] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner),
            {value: amount}
        );
        await bite.sendCallback();

        await token.connect(user).setViewerPublicKey(
            await getPublicKey(user),
            {value: amount}
        );
        await bite.sendCallback();

        // Different encrypted balances
        expect(await token.encryptedBalanceOf(owner)).to.not.equal(await token.encryptedBalanceOf(user));
        // Same decrypted balances
        expect(await balanceOf(token, bite, owner)).to.be.equal(await balanceOf(token, bite, user));
    });

    it("user should be able to view other user's balance in tests", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, user] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();
        const userPublicKey = await getPublicKey(user);
        const ownerPublicKey = await getPublicKey(owner);
        await token.connect(owner).setViewerPublicKey(
            ownerPublicKey,
            {value: amount}
        );
        await bite.sendCallback();
         await token.connect(user).setViewerPublicKey(
            userPublicKey,
            {value: amount}
        );
        await bite.sendCallback();

        const encryptedBalance = await token.encryptedBalanceOf(owner);
        const realBalance = await balanceOf(token, bite, owner);
        const triedToDecrypt = await bite.decryptECIES(
            encryptedBalance,
            await bite.pubKeyToUint256(userPublicKey.x, userPublicKey.y)
        );
        // Decryption with wrong key should not yield the real balance even with mock encryption
        expect(triedToDecrypt).to.not.be.equal(realBalance);
    });

    it("user should not be able to register an empty view key", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner] = await ethers.getSigners();
        const { token } = await cleanMintableDeployment();
        await token.connect(owner).setViewerPublicKey(
            {x: ethers.ZeroHash, y: ethers.ZeroHash},
            {value: amount}
        ).should.be.revertedWithCustomError(
            token,
            "InvalidPublicKey"
        );
    });

    it("should re-encrypt balance if view key is updated", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, user] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();
        const userPublicKey = await getPublicKey(user);
        const ownerPublicKey = await getPublicKey(owner);
        await token.connect(owner).setViewerPublicKey(
            ownerPublicKey,
            {value: amount}
        );
        expect(await token.publicKeys(owner)).to.deep.equal([ownerPublicKey.x , ownerPublicKey.y]);
        expect(await token.viewerAddresses(owner)).to.equal(owner.address);
        await bite.sendCallback();

        const encryptedBalanceBefore = await token.encryptedBalanceOf(owner);
        const realBalanceBefore = await balanceOf(token, bite, owner);

        // Update public key
        const newOwnerPublicKey = userPublicKey;
        await token.connect(owner).setViewerPublicKey(
            newOwnerPublicKey,
            {value: amount}
        );
        expect(await token.publicKeys(user)).to.deep.equal([newOwnerPublicKey.x , newOwnerPublicKey.y]);
        expect(await token.viewerAddresses(owner)).to.equal(user.address);
        await bite.sendCallback();

        const encryptedBalanceAfter = await token.encryptedBalanceOf(owner);
        const realBalanceAfter = await balanceOf(token, bite, owner);

        // Encrypted balance should change
        expect(encryptedBalanceBefore).to.not.equal(encryptedBalanceAfter);
        // Real balance should stay the same
        expect(realBalanceBefore).to.equal(realBalanceAfter);
    });

    it("transfer to self should not change balance", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner)
        );
        await bite.sendCallback();

        const balanceBefore = await balanceOf(token, bite, owner);

        await token.connect(owner).transfer(owner, amount);
        await bite.sendCallback();

        const balanceAfter = await balanceOf(token, bite, owner);
        balanceAfter.should.be.equal(balanceBefore);
    });

    it("should always charge callback fee from the sender of transferFrom", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, spender ] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();
        const callbackFee = await token.callbackFee();
        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner)
        );
        await bite.sendCallback();
        await token.connect(spender).setViewerPublicKey(
            await getPublicKey(spender),
            {value: amount}
        );
        await bite.sendCallback();
        const depositedSpender = await token.ethBalanceOf(spender);
        depositedSpender.should.be.equal(amount - callbackFee);
        // Callback should fail because no allowance yet
        await token.connect(spender).transferFrom(owner, spender, amount);

        const depositedSpenderAfter = await token.ethBalanceOf(spender);
        depositedSpenderAfter.should.be.equal(depositedSpender - callbackFee);

        await bite.sendCallback().should.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
        depositedSpenderAfter.should.be.equal(await token.ethBalanceOf(spender));
    });

    it("should only update and check allowance on callback", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, spender ] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();
        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner)
        );
        await bite.sendCallback();
        await token.connect(spender).setViewerPublicKey(
            await getPublicKey(spender),
            {value: amount}
        );
        await bite.sendCallback();
        // Callback should fail because no allowance yet
        await token.connect(spender).transferFrom(owner, spender, amount);

        await bite.sendCallback().should.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");

        await token.connect(owner).approve(spender, amount);
        expect(await token.allowance(owner, spender)).to.be.equal(amount);

        await token.connect(spender).transferFrom(owner, spender, amount);
        await bite.sendCallback();

        // Allowance should be updated after callback
        expect(await token.allowance(owner, spender)).to.be.equal(0);
        expect(await balanceOf(token, bite, spender)).to.be.equal(amount);
    });

    it("should be able to transfer with encrypted values", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, recipient] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner)
        );
        await bite.sendCallback();

        await token.connect(recipient).setViewerPublicKey(
            await getPublicKey(recipient),
            {value: amount}
        );
        await bite.sendCallback();

        // Must be correctly encoded to hide the value, otherwise it leaks the length of the value
        const encryptedAmount = await bite.encryptTE(ethers.zeroPadValue(ethers.toBeHex(amount), 32));

        await token.connect(owner).encryptedTransfer(recipient, encryptedAmount);

        await bite.sendCallback();

        const decryptedBalance = await balanceOf(token, bite, recipient);
        decryptedBalance.should.be.equal(amount);
    });

    it("should be able to transferFrom with encrypted values", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, spender, recipient] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner)
        );
        await bite.sendCallback();

        await token.connect(spender).setViewerPublicKey(
            await getPublicKey(spender),
            {value: amount}
        );
        await bite.sendCallback();

        await token.connect(recipient).setViewerPublicKey(
            await getPublicKey(recipient),
            {value: amount}
        );
        await bite.sendCallback();

        await token.connect(owner).approve(spender, amount);

        // Must be correctly encoded to hide the value, otherwise it leaks the length of the value
        const encryptedAmount = await bite.encryptTE(ethers.zeroPadValue(ethers.toBeHex(amount), 32));

        await token.connect(spender).encryptedTransferFrom(owner, recipient, encryptedAmount);

        await bite.sendCallback();

        const decryptedBalance = await balanceOf(token, bite, recipient);
        decryptedBalance.should.be.equal(amount);
    });

    it("should not allow double spending during BITE execution", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, user1, user2] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();
        const viewPublicKey = await getPublicKey(owner);

        await token.connect(owner).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();
        await token.deposit(user1, {value: await token.callbackFee()});
        await token.connect(user1).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();
        await token.deposit(user2, {value: await token.callbackFee()});
        await token.connect(user2).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();

        const balanceBefore = await balanceOf(token, bite, owner);
        (await balanceOf(token, bite, user1)).should.be.equal(0n);
        (await balanceOf(token, bite, user2)).should.be.equal(0n);

        await token.connect(owner).transfer(user1, amount);
        await token.connect(owner).transfer(user2, amount);

        // 2 callbacks should be run in the one block
        await network.provider.send("evm_setAutomine", [false]);
        const gasLimit = 10_000_000;
        await bite.sendCallback({gasLimit});
        const secondCTX = await bite.sendCallback({gasLimit});
        await mine(1);
        await expect(secondCTX).not.to.be.reverted;
        await expect(secondCTX)
            .to.emit(token, "CTXResubmitted");
        await network.provider.send("evm_setAutomine", [true]);

        // Second callback resubmitted the transfer
        // New CTX was created
        await bite.sendCallback();

        const balanceAfter = await balanceOf(token, bite, owner);
        balanceAfter.should.be.equal(balanceBefore - 2n * amount);
        (await balanceOf(token, bite, user1)).should.be.equal(amount);
        (await balanceOf(token, bite, user2)).should.be.equal(amount);
    });

    it("should not allow double spending when not all CTXs are in the same block", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, user1, user2] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();
        const viewPublicKey = await getPublicKey(owner);

        await token.connect(owner).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();
        await token.deposit(user1, {value: await token.callbackFee()});
        await token.connect(user1).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();
        await token.deposit(user2, {value: await token.callbackFee()});
        await token.connect(user2).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();

        const balanceBefore = await balanceOf(token, bite, owner);
        (await balanceOf(token, bite, user1)).should.be.equal(0n);
        (await balanceOf(token, bite, user2)).should.be.equal(0n);

        await token.connect(owner).transfer(user1, amount);
        await token.connect(owner).transfer(user2, amount);

        await bite.sendCallback();
        await expect(bite.sendCallback())
            .to.emit(token, "CTXResubmitted");

        // Second callback resubmitted the transfer
        // New CTX was created
        await bite.sendCallback();

        const balanceAfter = await balanceOf(token, bite, owner);
        balanceAfter.should.be.equal(balanceBefore - 2n * amount);
        (await balanceOf(token, bite, user1)).should.be.equal(amount);
        (await balanceOf(token, bite, user2)).should.be.equal(amount);
    });
});
