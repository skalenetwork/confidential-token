// cspell:words ECIES automine

import { ethers, network } from "hardhat";
import { cleanMintableDeployment, withMintedTokens } from "./tools/fixtures";
import "chai/register-should";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf } from "./tools/helpers";
import { expect } from "chai";
import { BiteMock, MintableConfidentialToken } from "../typechain-types";
import { Signer, TransactionResponse } from "ethers";
import { takeSnapshot, mine } from "@nomicfoundation/hardhat-network-helpers";
import { decodeTransferData } from "./tools/utils";

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
        (await token.gasTokenBalanceOf(owner)).should.be.equal(initialBalance);

        await token.mint(owner, amount);
        await bite.sendCallback();

        (await token.gasTokenBalanceOf(owner)).should.be.equal(initialBalance - callbackFee);

        (await token.retrieveGasToken(initialBalance - callbackFee, owner))
            .should.changeEtherBalance(owner, initialBalance - callbackFee);
        (await token.gasTokenBalanceOf(owner)).should.be.equal(0);
    });

    it("retrieveGasToken reverts when withdrawing more than the available balance", async () => {
        const { token, owner } = await withMintedTokens();

        const balance = await token.gasTokenBalanceOf(owner);
        await token.connect(owner).retrieveGasToken(balance + 1n, owner)
            .should.be.revertedWithCustomError(token, "InsufficientGasToken")
            .withArgs(balance + 1n, balance);
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

    it("should not create historic transfer entries when updating viewer key", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, viewer] = await ethers.getSigners();
        const { token, bite } = await cleanMintableDeployment();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner),
            { value: amount }
        );
        const callbackTx = await bite.sendCallback();
        await expect(callbackTx).to.not.emit(token, "EncryptedTransfer");

        await token.connect(viewer).registerPublicKey(await getPublicKey(viewer));
        await token.connect(owner).authorizeHistoricViewTransferId(viewer, 0)
            .should.be.revertedWithCustomError(token, "InvalidTransferId");
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

    it("should not allow to do self transfer if value exceeds balance", async () => {
        const [owner] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner)
        );
        await bite.sendCallback();

        const balance = await balanceOf(token, bite, owner);

        await token.connect(owner).transfer(owner, balance + 1n);
        await expect(
            bite.sendCallback()
        ).to.be.revertedWithCustomError(token, "InsufficientBalance()");
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
        const depositedSpender = await token.gasTokenBalanceOf(spender);
        depositedSpender.should.be.equal(amount - callbackFee);
        // Callback should fail because no allowance yet
        await token.connect(spender).transferFrom(owner, spender, amount);

        const depositedSpenderAfter = await token.gasTokenBalanceOf(spender);
        depositedSpenderAfter.should.be.equal(depositedSpender - callbackFee);

        await bite.sendCallback().should.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
        depositedSpenderAfter.should.be.equal(await token.gasTokenBalanceOf(spender));
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
        const snapshot = await takeSnapshot();
        await bite.sendCallback().should.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
        await snapshot.restore(); // Need to use snapshot between callback reverts to force "flushing" the queue
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

        const encryptedAmount = await token.encryptValue(owner.address, amount);

        await token.connect(owner).encryptedTransfer(recipient, encryptedAmount);

        await bite.sendCallback();

        const decryptedBalance = await balanceOf(token, bite, recipient);
        decryptedBalance.should.be.equal(amount);
    });

    it("encryptedTransferFrom reverts with ERC20InvalidSender when from is the zero address", async () => {
        const [, spender, recipient] = await ethers.getSigners();
        const { token } = await withMintedTokens();

        // The sender guard is checked before the value is decoded, so any payload reverts.
        await token.connect(spender).encryptedTransferFrom(ethers.ZeroAddress, recipient, "0x")
            .should.be.revertedWithCustomError(token, "ERC20InvalidSender")
            .withArgs(ethers.ZeroAddress);
    });

    it("encryptedTransferFrom reverts with ERC20InvalidReceiver when to is the zero address", async () => {
        const [owner, spender] = await ethers.getSigners();
        const { token } = await withMintedTokens();

        await token.connect(spender).encryptedTransferFrom(owner, ethers.ZeroAddress, "0x")
            .should.be.revertedWithCustomError(token, "ERC20InvalidReceiver")
            .withArgs(ethers.ZeroAddress);
    });

    it("encryptedTransfer reverts with ERC20InvalidReceiver when to is the zero address", async () => {
        const { token, owner } = await withMintedTokens();

        // `from` is always msg.sender (non-zero), so only the receiver guard is reachable here.
        await token.connect(owner).encryptedTransfer(ethers.ZeroAddress, "0x")
            .should.be.revertedWithCustomError(token, "ERC20InvalidReceiver")
            .withArgs(ethers.ZeroAddress);
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

        // For transferFrom the value must be salted to the spender, not the owner
        const encryptedAmount = await token.encryptValue(spender.address, amount);

        await token.connect(spender).encryptedTransferFrom(owner, recipient, encryptedAmount);

        await bite.sendCallback();

        const decryptedBalance = await balanceOf(token, bite, recipient);
        decryptedBalance.should.be.equal(amount);
    });

    it("should allow encryptedTransfer with inline callback fee", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, recipient] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();
        const callbackFee = await token.callbackFee();

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner),
            { value: callbackFee * 2n }
        );
        await bite.sendCallback();

        await token.connect(recipient).setViewerPublicKey(
            await getPublicKey(recipient),
            { value: callbackFee * 2n }
        );
        await bite.sendCallback();

        const ownerGasTokenBalance = await token.gasTokenBalanceOf(owner);
        await token.connect(owner).retrieveGasToken(ownerGasTokenBalance, owner);
        (await token.gasTokenBalanceOf(owner)).should.be.equal(0n);

        const encryptedAmount = await token.encryptValue(owner.address, amount);
        await token.connect(owner).encryptedTransfer(recipient, encryptedAmount, { value: callbackFee });

        // funded and charged exactly once inline
        (await token.gasTokenBalanceOf(owner)).should.be.equal(0n);

        await bite.sendCallback();

        (await token.gasTokenBalanceOf(owner)).should.be.equal(0n);
        (await balanceOf(token, bite, recipient)).should.be.equal(amount);
    });

    it("should allow encryptedTransferFrom with inline callback fee", async () => {
        const amount = ethers.parseEther("1.0");
        const [owner, spender, recipient] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();
        const callbackFee = await token.callbackFee();
        const overpayment = callbackFee * 3n;

        await token.connect(owner).setViewerPublicKey(
            await getPublicKey(owner),
            { value: callbackFee * 2n }
        );
        await bite.sendCallback();

        await token.connect(spender).setViewerPublicKey(
            await getPublicKey(spender),
            { value: callbackFee * 2n }
        );
        await bite.sendCallback();

        await token.connect(recipient).setViewerPublicKey(
            await getPublicKey(recipient),
            { value: callbackFee * 2n }
        );
        await bite.sendCallback();

        await token.connect(owner).approve(spender, amount);

        const spenderGasTokenBalance = await token.gasTokenBalanceOf(spender);
        await token.connect(spender).retrieveGasToken(spenderGasTokenBalance, spender);
        (await token.gasTokenBalanceOf(spender)).should.be.equal(0n);

        // For transferFrom the value must be salted to the spender, not the owner
        const encryptedAmount = await token.encryptValue(spender.address, amount);
        await token.connect(spender).encryptedTransferFrom(owner, recipient, encryptedAmount, { value: overpayment });

        const expectedRemainder = overpayment - callbackFee;
        (await token.gasTokenBalanceOf(spender)).should.be.equal(expectedRemainder);

        await bite.sendCallback();

        (await token.gasTokenBalanceOf(spender)).should.be.equal(expectedRemainder);
        (await balanceOf(token, bite, recipient)).should.be.equal(amount);
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
        await token.fundWithGasToken(user1, {value: await token.callbackFee()});
        await token.connect(user1).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();
        await token.fundWithGasToken(user2, {value: await token.callbackFee()});
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
        await token.fundWithGasToken(user1, {value: await token.callbackFee()});
        await token.connect(user1).setViewerPublicKey(
            viewPublicKey
        );
        await bite.sendCallback();
        await token.fundWithGasToken(user2, {value: await token.callbackFee()});
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

    it("should not allow hacker to transferFrom without allowance", async () => {
        const amount = ethers.parseEther("1.0");
        const [alice, bob, hacker] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();

        await token.connect(alice).setViewerPublicKey(
            await getPublicKey(alice)
        );
        await bite.sendCallback();

        await token.fundWithGasToken(bob, {value: await token.callbackFee()});
        await token.connect(bob).setViewerPublicKey(
            await getPublicKey(bob)
        );
        await bite.sendCallback();

        await token.fundWithGasToken(hacker, {value: (await token.callbackFee()) * 3n});
        await token.connect(hacker).setViewerPublicKey(
            await getPublicKey(hacker)
        );
        await bite.sendCallback();

        // alice makes a legitimate transfer to bob
        await token.connect(alice).transfer(bob, amount);
        // hacker attempts transferFrom alice to hacker without any allowance
        await token.connect(hacker).transferFrom(alice, hacker, amount);

        await bite.sendCallback();
        await bite.sendCallback()
            .should.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    describe("precompile address setters", () => {
        it("allows the owner to update the EncryptECIES address", async () => {
            const { token } = await cleanMintableDeployment();
            const newAddress = ethers.Wallet.createRandom().address;
            await token.setEncryptECIESAddress(newAddress)
                .should.emit(token, "EncryptECIESAddressChanged").withArgs(newAddress);
            (await token.encryptECIESAddress()).should.equal(newAddress);
        });

        it("allows the owner to update the EncryptTE address", async () => {
            const { token } = await cleanMintableDeployment();
            const newAddress = ethers.Wallet.createRandom().address;
            await token.setEncryptTEAddress(newAddress)
                .should.emit(token, "EncryptTEAddressChanged").withArgs(newAddress);
            (await token.encryptTEAddress()).should.equal(newAddress);
        });

        it("allows the owner to update the SubmitCTX address", async () => {
            const { token } = await cleanMintableDeployment();
            const newAddress = ethers.Wallet.createRandom().address;
            await token.setSubmitCTXAddress(newAddress)
                .should.emit(token, "SubmitCTXAddressChanged").withArgs(newAddress);
            (await token.submitCTXAddress()).should.equal(newAddress);
        });

        it("blocks unauthorized callers from setting EncryptECIES address", async () => {
            const [, unauthorized] = await ethers.getSigners();
            const { token } = await cleanMintableDeployment();
            await token.connect(unauthorized).setEncryptECIESAddress(ethers.Wallet.createRandom().address)
                .should.be.revertedWithCustomError(token, "AccessManagedUnauthorized")
                .withArgs(unauthorized);
        });

        it("blocks unauthorized callers from setting EncryptTE address", async () => {
            const [, unauthorized] = await ethers.getSigners();
            const { token } = await cleanMintableDeployment();
            await token.connect(unauthorized).setEncryptTEAddress(ethers.Wallet.createRandom().address)
                .should.be.revertedWithCustomError(token, "AccessManagedUnauthorized")
                .withArgs(unauthorized);
        });

        it("blocks unauthorized callers from setting SubmitCTX address", async () => {
            const [, unauthorized] = await ethers.getSigners();
            const { token } = await cleanMintableDeployment();
            await token.connect(unauthorized).setSubmitCTXAddress(ethers.Wallet.createRandom().address)
                .should.be.revertedWithCustomError(token, "AccessManagedUnauthorized")
                .withArgs(unauthorized);
        });

        it("reverts when setting EncryptECIES address to zero", async () => {
            const { token } = await cleanMintableDeployment();
            await token.setEncryptECIESAddress(ethers.ZeroAddress)
                .should.be.revertedWithCustomError(token, "ZeroAddress");
        });

        it("reverts when setting EncryptTE address to zero", async () => {
            const { token } = await cleanMintableDeployment();
            await token.setEncryptTEAddress(ethers.ZeroAddress)
                .should.be.revertedWithCustomError(token, "ZeroAddress");
        });

        it("reverts when setting SubmitCTX address to zero", async () => {
            const { token } = await cleanMintableDeployment();
            await token.setSubmitCTXAddress(ethers.ZeroAddress)
                .should.be.revertedWithCustomError(token, "ZeroAddress");
        });
    });

    describe("Re Encryption of Historical transfers", () => {
        const gasTokenFunding = ethers.parseEther("1.0");
        const transferAmount = ethers.parseEther("10.0");

        const registerViewer = async (
            token: MintableConfidentialToken,
            bite: BiteMock,
            holder: Signer,
            viewer: Signer
        ) => {
            await token.connect(holder).setViewerPublicKey(
                await getPublicKey(viewer),
                { value: gasTokenFunding }
            );
            await bite.sendCallback();
        };

        const getEncryptedTransferEvent = async (token: MintableConfidentialToken, callbackTx: TransactionResponse) => {
            const receipt = await callbackTx.wait();
            for (const log of receipt!.logs) {
                try {
                    const parsed = token.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });
                    if (parsed?.name === "EncryptedTransfer") {
                        return parsed.args;
                    }
                } catch { /* not a token event */ }
            }
            throw new Error("EncryptedTransfer event not found");
        };

        const performTransferAndCapture = async (
            token: MintableConfidentialToken,
            bite: BiteMock,
            from: Signer,
            to: Signer,
            amount: bigint
        ) => {
            await token.connect(from).transfer(to, amount);
            const tx = await bite.sendCallback();
            return getEncryptedTransferEvent(token, tx);
        };

        const decryptReEncryptedTransferValue = async (
            token: MintableConfidentialToken,
            bite: BiteMock,
            requester: Signer,
            callbackTx: TransactionResponse
        ): Promise<bigint> => {
            const receipt = await callbackTx.wait();
            for (const log of receipt!.logs) {
                try {
                    const parsed = token.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });
                    if (parsed?.name === "ReEncryptedTransfer") {
                        const requesterAddress = await requester.getAddress();
                        const publicKey = await token.publicKeys(requesterAddress);
                        const decryptionKey = await bite.pubKeyToUint256(publicKey.x, publicKey.y);
                        const decrypted = await bite.decryptECIES(parsed.args.encryptedTransfer, decryptionKey);

                        return decodeTransferData(decrypted).value;
                    }
                } catch { /* not a token event */ }
            }
            throw new Error("ReEncryptedTransfer event not found");
        };

        it("should emit event with TE-encrypted data and correct parameters", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();

            await expect(callbackTx).to.emit(token, "EncryptedTransfer");
            const event = await getEncryptedTransferEvent(token, callbackTx);
            expect(event.from).to.equal(owner.address);
            expect(event.to).to.equal(recipient.address);
            expect(event.encryptedData).to.not.equal("0x");
        });

        it("should revert if the decryptionRequest is from an unregistered user", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, unregistered] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(unregistered)
                .requestDecryptHistoricTransfer(event.encryptedData)
                .should.be.revertedWithCustomError(token, "PublicKeyIsNotRegistered");
        });

        it("should revert if any function to grant historic view permissions is to an unregistered address", async () => {
            const { token } = await cleanMintableDeployment();
            const [, unregistered] = await ethers.getSigners();

            await token.authorizeHistoricViewTimeRange(unregistered, 0, 1000)
                .should.be.revertedWithCustomError(token, "PublicKeyIsNotRegistered");
            await token.authorizeHistoricViewTransferId(unregistered, 0)
                .should.be.revertedWithCustomError(token, "PublicKeyIsNotRegistered");
        });

        it("should revert if the decryption request is for a transfer that does not exist yet", async () => {
            const { token, bite } = await cleanMintableDeployment();
            const [owner, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, viewer, viewer);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer, 9999)
                .should.be.revertedWithCustomError(token, "InvalidTransferId");
        });

        it("should allow to request decryption of a valid transfer, but revert on callback due to no permissions", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        it("should revert on callback when a viewer is authorized by a holder who was not part of the transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, outsider, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, outsider, outsider);
            await registerViewer(token, bite, viewer, viewer);

            // Transfer is between owner and recipient — outsider is not involved
            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Outsider grants viewer access to a transfer ID they were not part of
            await token.connect(outsider).authorizeHistoricViewTransferId(viewer, event.transferId);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        it("should allow to/from to request decryption of a transfer IF registered", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).requestDecryptHistoricTransfer(event.encryptedData);
            const ownerCallbackTx = await bite.sendCallback();
            await expect(ownerCallbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, owner, ownerCallbackTx))
                .to.equal(transferAmount);

            await token.connect(recipient).requestDecryptHistoricTransfer(event.encryptedData);
            const recipientCallbackTx = await bite.sendCallback();
            await expect(recipientCallbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, recipient, recipientCallbackTx))
                .to.equal(transferAmount);
        });

        it("should return correct permissions from canDecryptHistoricTransfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);

            expect(
                await token.canDecryptHistoricTransfer(
                    viewer,
                    event.transferId,
                    event.from,
                    event.to,
                    transferTimestamp
                )
            ).to.equal(false);

            await token.connect(owner).authorizeHistoricViewTimeRange(viewer, 0, 2n ** 64n);
            expect(
                await token.canDecryptHistoricTransfer(
                    viewer,
                    event.transferId,
                    event.from,
                    event.to,
                    transferTimestamp
                )
            ).to.equal(true);

            await token.connect(owner).removeHistoricViewTimeRange(viewer);
            expect(
                await token.canDecryptHistoricTransfer(
                    viewer,
                    event.transferId,
                    event.from,
                    event.to,
                    transferTimestamp
                )
            ).to.equal(false);
        });

        it("should allow requesting historic decryption via requestDecryptHistoricTransferFor", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer, payer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event.transferId);
            // Deposit just for the callback fee
            await token.connect(payer).fundWithGasToken(payer, {value: await token.callbackFee()});
            await token.connect(payer).requestDecryptHistoricTransferFor(event.encryptedData, viewer);
            const callbackTx = await bite.sendCallback();

            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        it("should allow an unfunded viewer to call requestDecryptHistoricTransferFor with inline callbackFee", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event.transferId);

            const callbackFee = await token.callbackFee();
            const viewerGasTokenBalance = await token.gasTokenBalanceOf(viewer.address);
            await token.connect(viewer).retrieveGasToken(viewerGasTokenBalance, viewer);
            expect(await token.gasTokenBalanceOf(viewer.address)).to.equal(0);

            await token.connect(viewer).requestDecryptHistoricTransferFor(
                event.encryptedData,
                viewer,
                { value: callbackFee }
            );

            // Inline top-up is consumed exactly once by the callback
            expect(await token.gasTokenBalanceOf(viewer.address)).to.equal(0);

            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
            expect(await token.gasTokenBalanceOf(viewer.address)).to.equal(0);
        });

        it("should be able to grant historic view permission to a viewer with fromTimestamp and toTimestamp valid, and decrypt a transfer event", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTimeRange(viewer, 0, 2n ** 64n);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        it("should be able to revoke granted historic view permission to a viewer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTimeRange(viewer, 0, 2n ** 64n);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);

            await token.connect(owner).removeHistoricViewTimeRange(
                viewer
            ).should.emit(token, "HistoricViewTimeRangeRevoked").withArgs(owner.address, viewer.address);
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback().should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");


        });

        it("should be able to grant historic view permission to a viewer to a specific transfer Id and decrypt a transfer event", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event.transferId);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        it("should be able to remove all permissions at once, after verifying decryption works via both time range and transfer ID independently", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewerByTime, viewerById] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewerByTime, viewerByTime);
            await registerViewer(token, bite, viewerById, viewerById);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Grant each viewer a different type of permission
            await token.connect(owner).authorizeHistoricViewTimeRange(viewerByTime, 0, 2n ** 64n);
            await token.connect(owner).authorizeHistoricViewTransferId(viewerById, event.transferId);

            // Verify time range permission works independently
            await token.connect(viewerByTime).requestDecryptHistoricTransfer(event.encryptedData);
            const txByTime = await bite.sendCallback();
            await expect(txByTime).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewerByTime, txByTime))
                .to.equal(transferAmount);

            // Verify transfer ID permission works independently
            await token.connect(viewerById).requestDecryptHistoricTransfer(event.encryptedData);
            const txById = await bite.sendCallback();
            await expect(txById).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewerById, txById))
                .to.equal(transferAmount);

            // Remove all permissions for both viewers
            await token.connect(owner).removeHistoricViewAuth(viewerByTime);
            await token.connect(owner).removeHistoricViewAuth(viewerById);

            // Neither viewer can decrypt anymore
            const snapshotByTime = await takeSnapshot();
            await token.connect(viewerByTime).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
            await snapshotByTime.restore();

            await token.connect(viewerById).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        // Time range edge cases

        it("should emit ReEncryptedTransfer if fromTimestamp is exactly on the time range boundary", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp, transferTimestamp + 1000n
            );
            // fromTimestamp == timestamp of block at callback, but should still work because we allow [from, to) range]
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.not.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");

            // toTimestamp == timestamp of block at callback (strict > fails)
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, 0, transferTimestamp
            );
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        it("should NOT emit ReEncryptedTransfer if transfer timestamp is outside the authorized time range", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);

            // Range entirely after the transfer
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp + 3n, transferTimestamp + 1000n
            );
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        it("should revert if fromTimestamp >= toTimestamp", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);

            // from == to: impossible range
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp, transferTimestamp
            ).should.be.revertedWithCustomError(token, "InvalidTimeRange");


            // from > to: inverted range
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp + 1000n, transferTimestamp
            ).should.be.revertedWithCustomError(token, "InvalidTimeRange");

        });

        it("should allow updating the time range with a new authorizeHistoricViewTimeRange call", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);

            // Grant wide range covering transfer
            await token.connect(owner).authorizeHistoricViewTimeRange(viewer, 0, 2n ** 64n);
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await expect(bite.sendCallback()).to.emit(token, "ReEncryptedTransfer");

            // Update to range that does NOT cover the transfer
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp + 1n, transferTimestamp + 1000n
            );
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        // Transfer ID edge cases

        it("should allow authorizing multiple transfer IDs for the same viewer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event1 = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const event2 = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event1.transferId);
            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event2.transferId);

            await token.connect(viewer).requestDecryptHistoricTransfer(event1.encryptedData);
            await expect(bite.sendCallback()).to.emit(token, "ReEncryptedTransfer");

            await token.connect(viewer).requestDecryptHistoricTransfer(event2.encryptedData);
            await expect(bite.sendCallback()).to.emit(token, "ReEncryptedTransfer");
        });

        it("should NOT emit ReEncryptedTransfer after removeHistoricViewTransferId removes the specific ID, while other IDs remain valid", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event1 = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const event2 = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event1.transferId);
            await token.connect(owner).authorizeHistoricViewTransferId(viewer, event2.transferId);

            // Remove only event1's transfer ID
            await token.connect(owner).removeHistoricViewTransferId(viewer, event1.transferId);

            // event2 should still work
            await token.connect(viewer).requestDecryptHistoricTransfer(event2.encryptedData);
            await expect(bite.sendCallback()).to.emit(token, "ReEncryptedTransfer");

            // event1 should now fail
            await token.connect(viewer).requestDecryptHistoricTransfer(event1.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        // Grant from recipient (to) side

        it("should allow a viewer authorized by the recipient via time range to decrypt", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Recipient (to) grants time range auth to viewer
            await token.connect(recipient).authorizeHistoricViewTimeRange(viewer, 0, 2n ** 64n);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        it("should allow a viewer authorized by the recipient via transfer ID to decrypt", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Recipient (to) grants transferId auth to viewer
            await token.connect(recipient).authorizeHistoricViewTransferId(viewer, event.transferId);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        // Gas token balance / fee

        it("should deduct callbackFee when requesting historic decryption", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            const callbackFee = await token.callbackFee();
            const gasTokenBefore = await token.gasTokenBalanceOf(owner);
            await token.connect(owner).requestDecryptHistoricTransfer(event.encryptedData);
            const gasTokenAfter = await token.gasTokenBalanceOf(owner);

            expect(gasTokenBefore - gasTokenAfter).to.equal(callbackFee);
        });

        it("should revert requestDecryptHistoricTransfer if gas token balance is insufficient", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Drain viewer's gas token balance
            const viewerGasTokenBalance = await token.gasTokenBalanceOf(viewer);
            await token.connect(viewer).retrieveGasToken(viewerGasTokenBalance, viewer);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData)
                .should.be.revertedWithCustomError(token, "InsufficientGasToken");
        });

        // Replay / idempotency

        it("should allow the same transfer to be requested multiple times by the same authorized viewer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // First request
            await token.connect(owner).requestDecryptHistoricTransfer(event.encryptedData);
            await expect(bite.sendCallback()).to.emit(token, "ReEncryptedTransfer");

            // Same request again
            await token.connect(owner).requestDecryptHistoricTransfer(event.encryptedData);
            await expect(bite.sendCallback()).to.emit(token, "ReEncryptedTransfer");
        });

        it("should allow two different authorized viewers to each independently request decryption of the same transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer1, viewer2] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer1, viewer1);
            await registerViewer(token, bite, viewer2, viewer2);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer1, event.transferId);
            await token.connect(owner).authorizeHistoricViewTransferId(viewer2, event.transferId);

            await token.connect(viewer1).requestDecryptHistoricTransfer(event.encryptedData);
            const tx1 = await bite.sendCallback();
            await expect(tx1).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer1, tx1))
                .to.equal(transferAmount);

            await token.connect(viewer2).requestDecryptHistoricTransfer(event.encryptedData);
            const tx2 = await bite.sendCallback();
            await expect(tx2).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer2, tx2))
                .to.equal(transferAmount);
        });

        // removeHistoricViewTransferId edge case

        it("should silently succeed when removing a transferId that exists but was never authorized", async () => {
            const { token, bite } = await withMintedTokens();
            const [owner, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, viewer, viewer);

            // Remove a transferId that was never authorized but Exists — should not revert
            await token.connect(owner).removeHistoricViewTransferId(viewer, 0);
        });

        // The three removal entry points have no onlyRegisteredUser modifier, so no viewer
        // registration is needed to reach the branches they exercise.

        it("removeHistoricViewTransferId reverts for a transferId that does not exist yet", async () => {
            const { token } = await cleanMintableDeployment();
            const [owner, viewer] = await ethers.getSigners();

            await token.connect(owner).removeHistoricViewTransferId(viewer, 9999)
                .should.be.revertedWithCustomError(token, "InvalidTransferId");
        });

        it("removeHistoricViewAuth is a no-op (emits nothing) when nothing was authorized", async () => {
            const { token } = await cleanMintableDeployment();
            const [owner, viewer] = await ethers.getSigners();

            await expect(token.connect(owner).removeHistoricViewAuth(viewer))
                .to.not.emit(token, "HistoricViewPermissionsRevoked");
        });

        it("removeHistoricViewTimeRange is a no-op (emits nothing) when no time range was authorized", async () => {
            const { token } = await cleanMintableDeployment();
            const [owner, viewer] = await ethers.getSigners();

            await expect(token.connect(owner).removeHistoricViewTimeRange(viewer))
                .to.not.emit(token, "HistoricViewTimeRangeRevoked");
        });

        it("authorizeHistoricViewTransferId is idempotent: re-authorizing the same id emits nothing", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);
            await registerViewer(token, bite, viewer, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // First authorization emits the event...
            await expect(token.connect(owner).authorizeHistoricViewTransferId(viewer, event.transferId))
                .to.emit(token, "HistoricViewTransferIdAuthorized");
            // ...re-authorizing the same id is a no-op and emits nothing.
            await expect(token.connect(owner).authorizeHistoricViewTransferId(viewer, event.transferId))
                .to.not.emit(token, "HistoricViewTransferIdAuthorized");
        });

        // Automatic TransferValueEncryptedForRecipient on transfer

        it("should automatically emit TransferValueEncryptedForRecipient & Sender readable by the viewers when they have a registered viewer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            await registerViewer(token, bite, recipient, recipient);

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();
            const receipt = await callbackTx.wait();

            await expect(callbackTx).to.emit(token, "TransferValueEncryptedForRecipient").and.to.emit(token, "TransferValueEncryptedForSender");

            const eventReceiver = receipt!.logs
                .map(log => { try { return token.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; } })
                .find(parsed => parsed?.name === "TransferValueEncryptedForRecipient");

            const eventSender = receipt!.logs
                .map(log => { try { return token.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; } })
                .find(parsed => parsed?.name === "TransferValueEncryptedForSender");

            const publicKeyReceiver = await token.publicKeys(recipient.address);
            const decryptionKeyReceiver = await bite.pubKeyToUint256(publicKeyReceiver.x, publicKeyReceiver.y);
            const decryptedReceiver = await bite.decryptECIES(eventReceiver!.args.encryptedValue, decryptionKeyReceiver);
            expect(ethers.toBigInt(decryptedReceiver)).to.equal(transferAmount);

            const publicKeySender = await token.publicKeys(owner.address);
            const decryptionKeySender = await bite.pubKeyToUint256(publicKeySender.x, publicKeySender.y);
            const decryptedSender = await bite.decryptECIES(eventSender!.args.encryptedValue, decryptionKeySender);
            expect(ethers.toBigInt(decryptedSender)).to.equal(transferAmount);
        });

        it("should encrypt recipient/sender transfer values for external viewer key, not holder own keys", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, externalViewer] = await ethers.getSigners();

            // Register owner/recipient with the same external viewer key
            await registerViewer(token, bite, owner, externalViewer);
            await registerViewer(token, bite, recipient, externalViewer);
            // Ensure own keys exist so we can prove they cannot decrypt these values
            await token.connect(owner).registerPublicKey(await getPublicKey(owner));
            await token.connect(recipient).registerPublicKey(await getPublicKey(recipient));

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();
            const receipt = await callbackTx.wait();

            await expect(callbackTx).to.emit(token, "TransferValueEncryptedForRecipient").and.to.emit(token, "TransferValueEncryptedForSender");

            const eventRecipient = receipt!.logs
                .map(log => { try { return token.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; } })
                .find(parsed => parsed?.name === "TransferValueEncryptedForRecipient");

            const eventSender = receipt!.logs
                .map(log => { try { return token.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; } })
                .find(parsed => parsed?.name === "TransferValueEncryptedForSender");

            const viewerPublicKey = await token.publicKeys(externalViewer.address);
            const viewerDecryptionKey = await bite.pubKeyToUint256(viewerPublicKey.x, viewerPublicKey.y);

            const recipientOwnPublicKey = await token.publicKeys(recipient.address);
            const recipientOwnDecryptionKey = await bite.pubKeyToUint256(recipientOwnPublicKey.x, recipientOwnPublicKey.y);

            const ownerOwnPublicKey = await token.publicKeys(owner.address);
            const ownerOwnDecryptionKey = await bite.pubKeyToUint256(ownerOwnPublicKey.x, ownerOwnPublicKey.y);

            const recipientValueByViewer = await bite.decryptECIES(eventRecipient!.args.encryptedValue, viewerDecryptionKey);
            const senderValueByViewer = await bite.decryptECIES(eventSender!.args.encryptedValue, viewerDecryptionKey);
            expect(ethers.toBigInt(recipientValueByViewer)).to.equal(transferAmount);
            expect(ethers.toBigInt(senderValueByViewer)).to.equal(transferAmount);

            const recipientValueByOwnKey = await bite.decryptECIES(eventRecipient!.args.encryptedValue, recipientOwnDecryptionKey);
            const senderValueByOwnKey = await bite.decryptECIES(eventSender!.args.encryptedValue, ownerOwnDecryptionKey);
            expect(ethers.toBigInt(recipientValueByOwnKey)).to.not.equal(transferAmount);
            expect(ethers.toBigInt(senderValueByOwnKey)).to.not.equal(transferAmount);
        });

        it("should NOT automatically emit TransferValueEncryptedForRecipient if recipient has no registered view key", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner, owner);
            // recipient deliberately NOT registered

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();

            await expect(callbackTx).to.not.emit(token, "TransferValueEncryptedForRecipient");
        });

        it("should NOT automatically emit TransferValueEncryptedForRecipient on self-transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            await registerViewer(token, bite, owner, owner);

            await token.connect(owner).transfer(owner, transferAmount);
            const callbackTx = await bite.sendCallback();

            await expect(callbackTx).to.not.emit(token, "TransferValueEncryptedForRecipient");
        });
    });

    describe("Stress-testing salted encrypted data", () => {
        // This section tests that the salted encryption of values prevents replaying encrypted balance values arbitrarily, which would otherwise allow an attacker to learn a victim's balance or transfer value.
        it("should reject replaying a victim's stored balance cipher-text (passive-victim disclosure)", async () => {
            const { token, bite, owner: victim } = await withMintedTokens();
            const [, attacker, sink] = await ethers.getSigners();

            // Victim merely holds tokens and registers a viewer, so a balance cipher-text is stored
            await token.connect(victim).setViewerPublicKey(await getPublicKey(victim));
            await bite.sendCallback();
            const victimBalance = await balanceOf(token, bite, victim);

            // Attacker reconstructs the victim's world-readable _thresholdBalances[victim] cipher-text
            // In the real world, the attacker would read storage from _thresholdBalances[victim].
            // Here in local tests, this is the same
            const victimBalanceCt = await token.encryptValue(victim.address, victimBalance);

            // Attacker fully sets up: registers their own viewer and funds gas for two callbacks
            await token.fundWithGasToken(attacker, { value: (await token.callbackFee()) * 2n });
            await token.connect(attacker).setViewerPublicKey(await getPublicKey(attacker));
            await bite.sendCallback();

            // Attacker replays the victim's cipher-text as their own transfer to a sink they control
            await token.connect(attacker).encryptedTransfer(sink, victimBalanceCt);

            // Callback must revert: salt (victim) does not match the transfer's `from` (attacker),
            // so the decrypted balance is never re-encrypted to the attacker's viewer key
            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");
        });

        it("should not leak balance information (revert is InvalidSalt, not InsufficientBalance)", async () => {
            const { token, bite, owner: victim } = await withMintedTokens();
            const [, attacker, sink] = await ethers.getSigners();

            await token.connect(victim).setViewerPublicKey(await getPublicKey(victim));
            await bite.sendCallback();
            const victimBalance = await balanceOf(token, bite, victim);

            const victimBalanceCt = await token.encryptValue(victim.address, victimBalance);

            // Attacker holds NO tokens (would fail any >= check) and only funds the callback gas
            await token.fundWithGasToken(attacker, { value: await token.callbackFee() });
            await token.connect(attacker).encryptedTransfer(sink, victimBalanceCt);

            // The salt check fails before any balance comparison runs, so the revert reason is
            // independent of whether the attacker's balance is >= or < the victim's balance.
            // This denies the binary-search oracle described in CONF-01.
            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");
        });

        it("should reject replaying a value cipher-text observed from another sender's transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, attacker, sink] = await ethers.getSigners();
            const amount = ethers.parseEther("10");

            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            await bite.sendCallback();

            // Owner crafts a self-salted value cipher-text and uses it in a legitimate transfer
            const ownerValueCt = await token.encryptValue(owner.address, amount);
            await token.connect(owner).encryptedTransfer(recipient, ownerValueCt);
            await bite.sendCallback();

            // Attacker observed `ownerValueCt` in calldata and replays it as their own transfer
            await token.fundWithGasToken(attacker, { value: await token.callbackFee() });
            await token.connect(attacker).encryptedTransfer(sink, ownerValueCt);

            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");
        });

        it("should reject replaying a victim's balance cipher-text via transferFrom without allowance", async () => {
            const { token, bite, owner: victim } = await withMintedTokens();
            const [, attacker, sink] = await ethers.getSigners();

            await token.connect(victim).setViewerPublicKey(await getPublicKey(victim));
            await bite.sendCallback();
            const victimBalance = await balanceOf(token, bite, victim);
            const victimBalanceCt = await token.encryptValue(victim.address, victimBalance);

            await token.fundWithGasToken(attacker, { value: await token.callbackFee() });

            // Via transferFrom the value is salted to the spender (the attacker), so the victim's
            // balance cipher-text (salted to the victim) fails the salt check on callback before
            // the allowance is even consulted.
            await token.connect(attacker).encryptedTransferFrom(victim, sink, victimBalanceCt);

            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");
        });

        it("should allow a sender to reuse their OWN value cipher-text for legitimate transfers", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, recipient2] = await ethers.getSigners();
            const amount = ethers.parseEther("5");
            const gasFunding = ethers.parseEther("1.0");

            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            await bite.sendCallback();
            await token.connect(recipient).setViewerPublicKey(await getPublicKey(recipient), { value: gasFunding });
            await bite.sendCallback();
            await token.connect(recipient2).setViewerPublicKey(await getPublicKey(recipient2), { value: gasFunding });
            await bite.sendCallback();

            const ownValueCt = await token.encryptValue(owner.address, amount);

            // Self-salted cipher-text used in a legitimate transfer
            await token.connect(owner).encryptedTransfer(recipient, ownValueCt);
            await bite.sendCallback();
            expect(await balanceOf(token, bite, recipient)).to.equal(amount);

            // Reusing the same self-salted cipher-text is benign: it only ever moves the sender's
            // own tokens and discloses the value only to the sender's own viewer key
            await token.connect(owner).encryptedTransfer(recipient2, ownValueCt);
            await bite.sendCallback();
            expect(await balanceOf(token, bite, recipient2)).to.equal(amount);
        });

        it("should reject replaying a foreign-salted cipher-text even when it encodes zero", async () => {
            const { token, bite, owner: victim } = await withMintedTokens();
            const [, attacker, sink] = await ethers.getSigners();

            await token.connect(victim).setViewerPublicKey(await getPublicKey(victim));
            await bite.sendCallback();

            // Cipher-text salted with the victim but encoding a zero amount. _decodeAndVerifyBalance
            // requires holder == from unconditionally (no amount == 0 short-circuit), so even a
            // zero-valued foreign-salted cipher-text is rejected. This is what closes the residual
            // zero / non-zero balance oracle (see the test below).
            const zeroCt = await token.encryptValue(victim.address, 0n);

            await token.fundWithGasToken(attacker, { value: await token.callbackFee() });
            await token.connect(attacker).encryptedTransfer(sink, zeroCt);

            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");
        });

        it("should allow a legitimate self-salted zero-value transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            const gasFunding = ethers.parseEther("1.0");

            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            await bite.sendCallback();
            await token.connect(recipient).setViewerPublicKey(await getPublicKey(recipient), { value: gasFunding });
            await bite.sendCallback();

            const ownerBalanceBefore = await balanceOf(token, bite, owner);

            // Honest zero-value transfers are salted to the rightful sender, so holder == from
            // holds and the callback finalizes without moving any tokens.
            const ownZeroCt = await token.encryptValue(owner.address, 0n);
            await token.connect(owner).encryptedTransfer(recipient, ownZeroCt);
            await expect(bite.sendCallback()).to.not.be.reverted;

            expect(await balanceOf(token, bite, owner)).to.equal(ownerBalanceBefore);
            expect(await balanceOf(token, bite, recipient)).to.equal(0n);
        });

        // Submission-time size gating
        //
        // The caller-supplied `value` is validated synchronously in _encryptedUpdateExtended:
        //   require(encryptedValue.length == BITE.TE_RETURN_SIZE_THRESHOLD + 33, ...)
        // TE_RETURN_SIZE_THRESHOLD is 323, so the only accepted length is 356 bytes. Any other
        // length MUST revert in the submitting transaction itself.
        const VALID_TE_PAYLOAD_SIZE = 356;

        it("should reject any incorrectly-sized TE payload at submission time, not on callback", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();

            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            await bite.sendCallback();

            const invalidSizes = [
                "0x",                                                  // empty
                ethers.hexlify(ethers.randomBytes(1)),                 // single byte
                ethers.hexlify(ethers.randomBytes(VALID_TE_PAYLOAD_SIZE - 1)), // one byte short
                ethers.hexlify(ethers.randomBytes(VALID_TE_PAYLOAD_SIZE + 1)), // one byte long
                ethers.hexlify(ethers.randomBytes(VALID_TE_PAYLOAD_SIZE * 2))  // far too long
            ];

            const callbackFee = await token.callbackFee();
            for (const payload of invalidSizes) {
                const gasTokenBefore = await token.gasTokenBalanceOf(owner);

                // Rejected synchronously in the submitting transaction
                await token.connect(owner).encryptedTransfer(recipient, payload)
                    .should.be.revertedWithCustomError(token, "ValueWasNotEncryptedCorrectly");

                // No CTX scheduled and no fee charged: behavior is fully gated up-front
                expect(await token.gasTokenBalanceOf(owner)).to.equal(gasTokenBefore);
                expect(callbackFee).to.be.greaterThan(0n);
            }

            // Every attempt reverted at submission, so the callback queue is empty
            await bite.sendCallback().should.be.revertedWithCustomError(bite, "NoCallbacksQueued");
        });

        it("should reject an incorrectly-sized payload via transferFrom at submission time too", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, spender, recipient] = await ethers.getSigners();

            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            await bite.sendCallback();
            await token.fundWithGasToken(spender, { value: await token.callbackFee() });

            const wrongSize = ethers.hexlify(ethers.randomBytes(VALID_TE_PAYLOAD_SIZE - 1));
            const gasTokenBefore = await token.gasTokenBalanceOf(spender);

            await token.connect(spender).encryptedTransferFrom(owner, recipient, wrongSize)
                .should.be.revertedWithCustomError(token, "ValueWasNotEncryptedCorrectly");

            // Spender's gas token untouched; nothing was queued
            expect(await token.gasTokenBalanceOf(spender)).to.equal(gasTokenBefore);
            await bite.sendCallback().should.be.revertedWithCustomError(bite, "NoCallbacksQueued");
        });

        it("should accept a correctly-sized payload at submission and only enforce content in the callback", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();

            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            await bite.sendCallback();

            // A real, self-salted cipher-text of the exact valid length is accepted and finalizes.
            const amount = ethers.parseEther("1");
            const validCt = await token.encryptValue(owner.address, amount);
            expect(ethers.dataLength(validCt)).to.equal(VALID_TE_PAYLOAD_SIZE);

            await token.connect(recipient).setViewerPublicKey(
                await getPublicKey(recipient), { value: ethers.parseEther("1.0") }
            );
            await bite.sendCallback();

            await expect(token.connect(owner).encryptedTransfer(recipient, validCt)).to.not.be.reverted;
            await bite.sendCallback();
            expect(await balanceOf(token, bite, recipient)).to.equal(amount);
        });

        it("does not leak a victim's zero/non-zero balance", async () => {
            const { token, bite, owner: richVictim } = await withMintedTokens();
            const [, zeroVictim, attacker, sink] = await ethers.getSigners();
            const gasFunding = ethers.parseEther("1.0");

            // Both victims simply register a viewer (passive participants). richVictim holds the
            // minted supply; zeroVictim holds nothing.
            await token.connect(richVictim).setViewerPublicKey(await getPublicKey(richVictim));
            await bite.sendCallback();
            await token.connect(zeroVictim).setViewerPublicKey(await getPublicKey(zeroVictim), { value: gasFunding });
            await bite.sendCallback();

            const richBalance = await balanceOf(token, bite, richVictim);
            expect(richBalance).to.be.greaterThan(0n);

            // These are exactly the world-readable cipher-texts an attacker reads from storage; the
            // attacker does NOT need to know the underlying amounts to replay the raw bytes.
            const richBalanceCt = await token.encryptValue(richVictim.address, richBalance);
            const zeroBalanceCt = await token.encryptValue(zeroVictim.address, 0n);

            await token.fundWithGasToken(attacker, { value: (await token.callbackFee()) * 2n });

            // Identical attacker action against each victim now yields the SAME outcome: both
            // foreign-salted replays revert with InvalidSaltForTransactionValue, so the attacker
            // learns nothing distinguishing about either victim's balance. The two cases are run
            // from a shared snapshot because a reverting callback stays at the head of the BiteMock
            // queue, which would otherwise prevent the second callback from ever executing.
            const snapshot = await takeSnapshot();

            await token.connect(attacker).encryptedTransfer(sink, richBalanceCt);
            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");

            await snapshot.restore();

            await token.connect(attacker).encryptedTransfer(sink, zeroBalanceCt);
            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "InvalidSaltForTransactionValue");
        });
    });

    // Defensive callback-validation guards.
    //
    // In production the contract always builds well-formed encrypted arguments and BITE protocol is trusted, so the malformed-argument guards in
    // _validateDecryptedArguments / _decodeBalance should never fire through the normal flow. We
    // point submitCTXAddress at CorruptingSubmitCTXMock, which delivers attacker-chosen decrypted
    // arguments through a legitimately registered CallbackSender (the only way to reach these
    // guards), while forwarding the real plaintext arguments so routing is unchanged.
    describe("malformed decrypted callback arguments", () => {
        const coder = ethers.AbiCoder.defaultAbiCoder();
        const bytesOfLength = (length: number) => ethers.hexlify(ethers.randomBytes(length));
        const encodeBalance = (holder: string, value: bigint) =>
            coder.encode(["address", "uint256"], [holder, value]);

        // Each case delivers a different malformed shape to a real owner -> recipient transfer.
        // A reverting callback rolls back token state, so all cases share one fixture and one
        // deployed mock; only the gas-token fee for each queued transfer is consumed.
        it("rejects every malformed decrypted-argument shape on the transfer callback", async () => {
            const { token, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            const validValue = encodeBalance(owner.address, ethers.parseEther("1"));

            const mock = await (await ethers.getContractFactory("CorruptingSubmitCTXMock")).deploy();
            await token.connect(owner).setSubmitCTXAddress(mock);

            const cases: { label: string; args: string[]; error: string }[] = [
                {
                    label: "argument count is neither 2 nor 3",
                    args: [bytesOfLength(64)],
                    error: "DecryptionBadFormat"
                },
                {
                    // Length 2 implies mint or burn, which requires exactly one of from/to to be
                    // zero. A genuine transfer has both non-zero, so the check rejects it.
                    label: "2-argument payload on a real (non mint/burn) transfer",
                    args: [bytesOfLength(64), bytesOfLength(64)],
                    error: "DecryptionBadFormat"
                },
                {
                    label: "recipient balance argument has an invalid length",
                    args: [bytesOfLength(64), bytesOfLength(32), bytesOfLength(64)],
                    error: "DecryptionBadFormat"
                },
                {
                    label: "sender balance argument has an invalid length",
                    args: [bytesOfLength(32), bytesOfLength(64), bytesOfLength(64)],
                    error: "DecryptionBadFormat"
                },
                {
                    label: "value argument is not exactly 64 bytes",
                    args: [bytesOfLength(64), bytesOfLength(64), bytesOfLength(32)],
                    error: "DecryptionBadFormat"
                },
                {
                    // arg[0] is empty: _decodeBalance returns (address(0), 0), so the salt check
                    // fails because the decoded holder (zero) does not match the expected `from`.
                    // The value argument (arg[2]) is verified first and must be salted to `from`.
                    label: "empty balance argument decodes to the zero address and fails the salt check",
                    args: ["0x", validValue, validValue],
                    error: "InvalidSaltForTransactionValue"
                }
            ];

            for (const { args, error } of cases) {
                await mock.setDecryptedArguments(args);
                await token.connect(owner).transfer(recipient, ethers.parseEther("1"));
                await mock.sendCallback()
                        .should.be.revertedWithCustomError(token, error);

            }
        });
    });
});
