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

    it("should not allow hacker to transferFrom without allowance", async () => {
        const amount = ethers.parseEther("1.0");
        const [alice, bob, hacker] = await ethers.getSigners();
        const { token, bite } = await withMintedTokens();

        await token.connect(alice).setViewerPublicKey(
            await getPublicKey(alice)
        );
        await bite.sendCallback();

        await token.deposit(bob, {value: await token.callbackFee()});
        await token.connect(bob).setViewerPublicKey(
            await getPublicKey(bob)
        );
        await bite.sendCallback();

        await token.deposit(hacker, {value: (await token.callbackFee()) * 3n});
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

    describe("Re Encryption of Historical transfers", () => {
        const ethFunding = ethers.parseEther("1.0");
        const transferAmount = ethers.parseEther("10.0");

        const registerViewer = async (
            token: MintableConfidentialToken,
            bite: BiteMock,
            signer: Signer
        ) => {
            await token.connect(signer).setViewerPublicKey(
                await getPublicKey(signer),
                { value: ethFunding }
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
                        const decrypted = await bite.decryptECIES(parsed.args.encryptedValue, decryptionKey);
                        return ethers.toBigInt(decrypted);
                    }
                } catch { /* not a token event */ }
            }
            throw new Error("ReEncryptedTransfer event not found");
        };

        it("should emit event with TE-encrypted data and correct parameters", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, viewer);

            await token.connect(owner).authorizeHistoricViewTransferId(viewer, 9999)
                .should.be.revertedWithCustomError(token, "InvalidTransferId");
        });

        it("should allow to request decryption of a valid transfer, but revert on callback due to no permissions", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        it("should revert on callback when a viewer is authorized by a holder who was not part of the transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, outsider, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, outsider);
            await registerViewer(token, bite, viewer);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

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

        it("should be able to grant historic view permission to a viewer with fromTimestamp and toTimestamp valid, and decrypt a transfer event", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            await token.connect(owner).authorizeHistoricViewTimeRange(viewer, 0, 2n ** 64n);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        it("should be able to grant historic view permission to a viewer to a specific transfer Id and decrypt a transfer event", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewerByTime);
            await registerViewer(token, bite, viewerById);

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

        it("should NOT emit ReEncryptedTransfer if transfer timestamp is exactly on the time range boundary", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);            // fromTimestamp + 2n == timestamp of block at callback (strict < fails)
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp, transferTimestamp + 1000n
            );
            const snapshot = await takeSnapshot();
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
            await snapshot.restore(); // Need to use snapshot between callback reverts to force "flushing" the queue
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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

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

        it("should treat fromTimestamp >= toTimestamp as a no-op range that never authorizes any transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);
            const transferTimestamp = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);

            // from == to: impossible range
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp, transferTimestamp
            );
            const snapshot = await takeSnapshot();
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
            await snapshot.restore();

            // from > to: inverted range
            await token.connect(owner).authorizeHistoricViewTimeRange(
                viewer, transferTimestamp + 1000n, transferTimestamp
            );
            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            await bite.sendCallback()
                .should.be.revertedWithCustomError(token, "UserIsNotAuthorizedToDecryptTransfer");
        });

        it("should allow updating the time range with a new authorizeHistoricViewTimeRange call", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Recipient (to) grants transferId auth to viewer
            await token.connect(recipient).authorizeHistoricViewTransferId(viewer, event.transferId);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData);
            const callbackTx = await bite.sendCallback();
            await expect(callbackTx).to.emit(token, "ReEncryptedTransfer");
            expect(await decryptReEncryptedTransferValue(token, bite, viewer, callbackTx))
                .to.equal(transferAmount);
        });

        // ETH balance / fee

        it("should deduct callbackFee when requesting historic decryption", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            const callbackFee = await token.callbackFee();
            const ethBefore = await token.ethBalanceOf(owner);
            await token.connect(owner).requestDecryptHistoricTransfer(event.encryptedData);
            const ethAfter = await token.ethBalanceOf(owner);

            expect(ethBefore - ethAfter).to.equal(callbackFee);
        });

        it("should revert requestDecryptHistoricTransfer if ETH balance is insufficient", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, viewer] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer);

            const event = await performTransferAndCapture(token, bite, owner, recipient, transferAmount);

            // Drain viewer's ETH balance
            const viewerEth = await token.ethBalanceOf(viewer);
            await token.connect(viewer).withdraw(viewerEth, viewer);

            await token.connect(viewer).requestDecryptHistoricTransfer(event.encryptedData)
                .should.be.revertedWithCustomError(token, "InsufficientEth");
        });

        // Replay / idempotency

        it("should allow the same transfer to be requested multiple times by the same authorized viewer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);
            await registerViewer(token, bite, viewer1);
            await registerViewer(token, bite, viewer2);

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
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, viewer);

            // Remove a transferId that was never authorized but Exists — should not revert
            await token.connect(owner).removeHistoricViewTransferId(viewer, 0);
        });

        // Automatic TransferValueEncryptedForRecipient on transfer

        it("should automatically emit TransferValueEncryptedForRecipient readable by the recipient when recipient has a registered public key", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();
            const receipt = await callbackTx.wait();

            await expect(callbackTx).to.emit(token, "TransferValueEncryptedForRecipient");

            const event = receipt!.logs
                .map(log => { try { return token.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; } })
                .find(parsed => parsed?.name === "TransferValueEncryptedForRecipient");

            const publicKey = await token.publicKeys(recipient.address);
            const decryptionKey = await bite.pubKeyToUint256(publicKey.x, publicKey.y);
            const decrypted = await bite.decryptECIES(event!.args.encryptedValue, decryptionKey);
            expect(ethers.toBigInt(decrypted)).to.equal(transferAmount);
        });

        it("should NOT automatically emit TransferValueEncryptedForRecipient if recipient has no registered public key", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            // recipient deliberately NOT registered

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();

            await expect(callbackTx).to.not.emit(token, "TransferValueEncryptedForRecipient");
        });

        it("should NOT automatically emit TransferValueEncryptedForRecipient on self-transfer", async () => {
            const { token, bite, owner } = await withMintedTokens();
            await registerViewer(token, bite, owner);

            await token.connect(owner).transfer(owner, transferAmount);
            const callbackTx = await bite.sendCallback();

            await expect(callbackTx).to.not.emit(token, "TransferValueEncryptedForRecipient");
        });

        it("should automatically emit TransferValueEncryptedForRecipient for recipient only, not trigger one for sender", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();
            await registerViewer(token, bite, owner);
            await registerViewer(token, bite, recipient);

            await token.connect(owner).transfer(recipient, transferAmount);
            const callbackTx = await bite.sendCallback();
            const receipt = await callbackTx.wait();

            const autoEvents = receipt!.logs
                .map(log => { try { return token.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; } })
                .filter(parsed => parsed?.name === "TransferValueEncryptedForRecipient");

            expect(autoEvents).to.have.lengthOf(1);
            expect(autoEvents[0]!.args.from).to.equal(owner.address);
            expect(autoEvents[0]!.args.to).to.equal(recipient.address);
        });
    });
});
