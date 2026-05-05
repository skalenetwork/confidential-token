import { ethers } from "hardhat";
import type { AddressLike } from "ethers";
import { cleanWrapperDeployment, withWrappedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import "chai/register-should";
import { balanceOf, feedAccounts } from "./tools/helpers";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialWrapper, TestERC20 } from "../typechain-types";
import { takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";

describe("ConfidentialWrapper", () => {
    const expectWrapperInvariant = async (
        token: ConfidentialWrapper,
        underlyingToken: TestERC20,
        requestedMintHolders: AddressLike[] = []
    ) => {
        let requestedMints = 0n;
        for (const holder of requestedMintHolders) {
            requestedMints += await token.requestedMints(holder);
        }
        (await underlyingToken.balanceOf(token)).should.be.equal(
            await token.totalSupply() + requestedMints
        );
    };

    it("should be able to wrap and unwrap tokens", async () => {
        const { underlyingToken, token, owner, bite } = await cleanWrapperDeployment();
        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });
        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
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

    it("withdrawTo(account, value) sends underlying to `account`", async () => {
        const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
        const [, recipient] = await ethers.getSigners();
        await feedAccounts([owner, recipient]);

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        await bite.sendCallback();

        const amount = ethers.parseEther("1");
        await underlyingToken.mint(owner, amount);
        await underlyingToken.connect(owner).approve(token, amount);
        await token.connect(owner).depositFor(owner, amount);
        await bite.sendCallback();

        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(amount);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(0);

        // Per OZ ERC20Wrapper interface, withdrawTo(account, amount) should
        // burn from msg.sender and send `amount` of underlying to `account`.
        await token.connect(owner).withdrawTo(recipient, amount);
        await bite.sendCallback();

        // Expected safe behavior:
        // underlying should be delivered to the supplied recipient.
        (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    });

    it("should not allow two pending withdrawals from the same holder", async () => {
        const { token, owner, wrapped } = await withWrappedTokens();
        const amount = wrapped / 2n;

        await token.withdrawTo(owner, amount);
        const pending = await token.pendingBurns(owner);
        pending.recipient.should.be.equal(await ethers.resolveAddress(owner));
        pending.value.should.be.equal(amount);

        await token.withdrawTo(owner, amount)
            .should.be.revertedWithCustomError(
                token, "WithdrawalPending"
            ).withArgs(owner);
    });

    it("should allow cancelling a pending withdrawal before it finalizes", async () => {
        const { token, owner, wrapped } = await withWrappedTokens();
        const amount = wrapped / 2n;

        await token.withdrawTo(owner, amount);
        await token.cancelWithdrawTo();

        const cancelled = await token.pendingBurns(owner);
        cancelled.recipient.should.be.equal(ethers.ZeroAddress);
        cancelled.value.should.be.equal(0);

        await token.withdrawTo(owner, amount);
        const pending = await token.pendingBurns(owner);
        pending.recipient.should.be.equal(await ethers.resolveAddress(owner));
        pending.value.should.be.equal(amount);
    });

    it("should not allow cancelling when there is no pending withdrawal", async () => {
        const { token, owner } = await withWrappedTokens();

        await token.cancelWithdrawTo()
            .should.be.revertedWithCustomError(
                token, "NoPendingWithdrawal"
            ).withArgs(owner);
    });

    it("should roll back a cancelled withdrawal if its callback arrives later", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const [, recipient] = await ethers.getSigners();
        const amount = wrapped / 2n;

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        await bite.sendCallback();

        const balanceBefore = await balanceOf(token, bite, owner);

        await token.withdrawTo(recipient, amount);
        await token.cancelWithdrawTo();

        await bite.sendCallback()
            .should.be.revertedWithCustomError(
                token, "OutdatedBurn"
            ).withArgs(owner, amount);

        (await balanceOf(token, bite, owner)).should.be.equal(balanceBefore);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(wrapped);
    });

    it("should preserve wrapper accounting while a withdrawal is pending and after it finalizes", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const [, recipient] = await ethers.getSigners();
        const amount = wrapped / 2n;

        await expectWrapperInvariant(token, underlyingToken, [owner]);

        await token.withdrawTo(recipient, amount);
        const pending = await token.pendingBurns(owner);
        pending.recipient.should.be.equal(await ethers.resolveAddress(recipient));
        pending.value.should.be.equal(amount);

        await expectWrapperInvariant(token, underlyingToken, [owner]);

        await bite.sendCallback();
        const cleared = await token.pendingBurns(owner);
        cleared.recipient.should.be.equal(ethers.ZeroAddress);
        cleared.value.should.be.equal(0);

        await expectWrapperInvariant(token, underlyingToken, [owner]);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
    });

    it("should be possible to unlock underlying tokens if bite transaction fails", async () => {
        const { underlyingToken, token, owner, bite } = await cleanWrapperDeployment();
        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner) , {value: ethers.parseEther("1.0")});
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

    it("burn(value) sends underlying to msg.sender and clears pendingBurns", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const burnAmount = wrapped / 2n;

        await token.connect(owner).burn(burnAmount);
        const snapshot = await takeSnapshot();
        await bite.sendCallback().should.emit(token, "Transfer(address,address)").withArgs(owner, ethers.ZeroAddress);
        await snapshot.restore();

        const pending = await token.pendingBurns(owner);
        pending.recipient.should.be.equal(await ethers.resolveAddress(owner));
        pending.value.should.be.equal(burnAmount);

        await bite.sendCallback();

        const cleared = await token.pendingBurns(owner);
        cleared.value.should.be.equal(0);

        (await token.totalSupply()).should.be.equal(wrapped - burnAmount);
        (await underlyingToken.balanceOf(owner)).should.be.equal(burnAmount);
        (await underlyingToken.balanceOf(token)).should.be.equal(wrapped - burnAmount);
        await expectWrapperInvariant(token, underlyingToken);
    });

    it("burn(value) preserves wrapper invariant while pending and after finalization", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const burnAmount = wrapped / 2n;

        await expectWrapperInvariant(token, underlyingToken);

        await token.connect(owner).burn(burnAmount);
        // cnf already debited, underlying still in wrapper — invariant still holds
        // because totalSupply decreased by burnAmount and underlying hasn't moved yet
        await expectWrapperInvariant(token, underlyingToken);

        await bite.sendCallback();
        // after callback: underlying sent out, both sides balanced
        await expectWrapperInvariant(token, underlyingToken);
    });

    it("burn(value) — full balance releases all underlying", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();

        await token.connect(owner).burn(wrapped);
        await bite.sendCallback();

        (await token.totalSupply()).should.be.equal(0);
        (await underlyingToken.balanceOf(owner)).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
        await expectWrapperInvariant(token, underlyingToken);
    });

    it("burn(value) reverts with WithdrawalPending when a burn is already in flight", async () => {
        const { token, owner, wrapped } = await withWrappedTokens();
        const burnAmount = wrapped / 2n;

        await token.connect(owner).burn(burnAmount);

        await token.connect(owner).burn(burnAmount)
            .should.be.revertedWithCustomError(token, "WithdrawalPending")
            .withArgs(owner);
    });

    it("burn(value) can be cancelled and a stale callback cannot release underlying", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const burnAmount = wrapped / 2n;

        await token.connect(owner).burn(burnAmount);
        await token.cancelWithdrawTo();

        const cancelled = await token.pendingBurns(owner);
        cancelled.recipient.should.be.equal(ethers.ZeroAddress);
        cancelled.value.should.be.equal(0);

        await bite.sendCallback()
            .should.be.revertedWithCustomError(
                token, "OutdatedBurn"
            ).withArgs(owner, burnAmount);

        (await token.totalSupply()).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(wrapped);
        await expectWrapperInvariant(token, underlyingToken);
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

    describe("ConfidentialWrapper — requestedMints scenarios", () => {

        const topUpWrapperEth = async (
            payer: HardhatEthersSigner,
            token: ConfidentialWrapper,
            amountEth: string = "1.0"
        ) => {
            await payer.sendTransaction({
                to: await ethers.resolveAddress(token),
                value: ethers.parseEther(amountEth)
            });
        };

        const mintAndApproveUnderlying = async (
            token: ConfidentialWrapper,
            underlyingToken: TestERC20,
            holder: HardhatEthersSigner,
            amount: bigint
        ) => {
            await underlyingToken.mint(holder, amount);
            await underlyingToken.connect(holder).approve(token, amount);
        };

        const depositForRecipient = async (
            token: ConfidentialWrapper,
            underlyingToken: TestERC20,
            holder: HardhatEthersSigner,
            recipient: HardhatEthersSigner,
            amount: bigint
        ) => {
            await mintAndApproveUnderlying(token, underlyingToken, holder, amount);
            await token.connect(holder).depositFor(recipient, amount);
        };

        it("depositFor: cross-account requestedMints is keyed by recipient, not by caller", async () => {
            const { token, underlyingToken, owner } = await cleanWrapperDeployment();
            const [, recipient] = await ethers.getSigners();

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, recipient, amount);

            (await token.requestedMints(recipient)).should.be.equal(amount);
            (await token.requestedMints(owner)).should.be.equal(0);
            (await underlyingToken.balanceOf(token)).should.be.equal(amount);
        });

        it("depositFor: cross-account callback mints cnf to recipient, not to caller", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            const [, recipient] = await ethers.getSigners();
            await feedAccounts([owner, recipient]);

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, recipient, amount);

            await expect(bite.sendCallback()).to.not.be.reverted;

            (await token.totalSupply()).should.be.equal(amount);
            (await token.requestedMints(recipient)).should.be.equal(0);
            (await token.requestedMints(owner)).should.be.equal(0);
        });

        it("depositFor: multiple depositors for same recipient accumulate pending and both callbacks succeed", async () => {
            const { token, underlyingToken, bite } = await cleanWrapperDeployment();
            const [alice, bob] = await ethers.getSigners();
            await feedAccounts([alice, bob]);
            await topUpWrapperEth(alice, token);
            await topUpWrapperEth(bob, token);

            const aliceAmount = ethers.parseEther("100");
            const bobAmount = ethers.parseEther("1");

            // Bob deposits for Alice (CTX1), Alice deposits for herself (CTX2)
            await depositForRecipient(token, underlyingToken, bob, alice, bobAmount);
            await depositForRecipient(token, underlyingToken, alice, alice, aliceAmount);

            (await token.requestedMints(alice)).should.be.equal(aliceAmount + bobAmount);
            (await token.requestedMints(bob)).should.be.equal(0);

            // Bob's callback runs first
            await expect(bite.sendCallback()).to.not.be.reverted;
            (await token.totalSupply()).should.be.equal(bobAmount);

            // Alice's callback resubmits (same-address staleness) then finalizes
            await expect(bite.sendCallback()).to.emit(token, "CTXResubmitted");
            await expect(bite.sendCallback()).to.not.be.reverted;

            (await token.totalSupply()).should.be.equal(aliceAmount + bobAmount);
            (await token.requestedMints(alice)).should.be.equal(0);
            (await token.requestedMints(bob)).should.be.equal(0);
        });

        it("depositFor: sequential self-deposits accumulate and both callbacks succeed", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            await feedAccounts([owner]);
            await topUpWrapperEth(owner, token, "2.0");

            const first = ethers.parseEther("3");
            const second = ethers.parseEther("7");
            await mintAndApproveUnderlying(token, underlyingToken, owner, first + second);

            await token.connect(owner).depositFor(owner, first);
            await token.connect(owner).depositFor(owner, second);
            (await token.requestedMints(owner)).should.be.equal(first + second);

            await expect(bite.sendCallback()).to.not.be.reverted;
            // Second deposit is stale after first minted; it resubmits once then finalizes
            await expect(bite.sendCallback()).to.emit(token, "CTXResubmitted");
            await expect(bite.sendCallback()).to.not.be.reverted;

            (await token.totalSupply()).should.be.equal(first + second);
            (await token.requestedMints(owner)).should.be.equal(0);
        });

        it("depositFor: reverts if caller has insufficient underlying allowance", async () => {
            const deployment = await cleanWrapperDeployment();
            const { token, underlyingToken, owner } = deployment;

            const amount = ethers.parseEther("1");
            await underlyingToken.mint(owner, amount);
            // No approve -> SafeERC20 reverts
            await expect(token.connect(owner).depositFor(owner, amount)).to.be.reverted;
        });

        it("releaseTo: sends underlying to the specified account arg, not to msg.sender", async () => {
            const deployment = await cleanWrapperDeployment();
            const { token, underlyingToken, owner } = deployment;
            const [, beneficiary] = await ethers.getSigners();

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, owner, amount);

            await token.connect(owner).releaseTo(beneficiary, amount);

            (await underlyingToken.balanceOf(beneficiary)).should.be.equal(amount);
            (await underlyingToken.balanceOf(owner)).should.be.equal(0);
            (await token.requestedMints(owner)).should.be.equal(0);
            (await underlyingToken.balanceOf(token)).should.be.equal(0);
        });

        it("releaseTo: partial release leaves remainder pending and makes old callback outdated", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            await topUpWrapperEth(owner, token);

            const amount = ethers.parseEther("10");
            const released = ethers.parseEther("3");
            const remaining = amount - released;

            await depositForRecipient(token, underlyingToken, owner, owner, amount);

            await token.connect(owner).releaseTo(owner, released);
            (await token.requestedMints(owner)).should.be.equal(remaining);
            (await underlyingToken.balanceOf(owner)).should.be.equal(released);

            await expect(bite.sendCallback()).to.be.revertedWithCustomError(token, "OutdatedMint");
        });

        it("releaseTo: reverts when value exceeds requestedMints (arithmetic underflow)", async () => {
            const { token, underlyingToken, owner } = await cleanWrapperDeployment();
            await topUpWrapperEth(owner, token);

            const amount = ethers.parseEther("1");
            await depositForRecipient(token, underlyingToken, owner, owner, amount);

            await expect(
                token.connect(owner).releaseTo(owner, amount + 1n)
            ).to.be.reverted;
            // Original pending is unchanged
            (await token.requestedMints(owner)).should.be.equal(amount);
        });

        it("releaseTo: reverts when requestedMints is 0", async () => {
            const { token, owner } = await cleanWrapperDeployment();
            await expect(token.connect(owner).releaseTo(owner, 1)).to.be.reverted;
        });

        it("releaseTo: reverts after callback already minted", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            await topUpWrapperEth(owner, token);

            const amount = ethers.parseEther("1");
            await depositForRecipient(token, underlyingToken, owner, owner, amount);
            await bite.sendCallback();

            (await token.requestedMints(owner)).should.be.equal(0);
            await expect(token.connect(owner).releaseTo(owner, amount)).to.be.reverted;
        });

        it("releaseTo: after cross-account depositFor, recipient controls releaseTo", async () => {
            const { token, underlyingToken, owner } = await cleanWrapperDeployment();
            const [, recipient] = await ethers.getSigners();

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, recipient, amount);

            // recipient calls releaseTo -> works because requestedMints[recipient] is set
            await token.connect(recipient).releaseTo(recipient, amount);

            (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
            (await token.requestedMints(recipient)).should.be.equal(0);
            (await underlyingToken.balanceOf(token)).should.be.equal(0);
        });

        it("releaseTo: after cross-account depositFor, original depositor cannot releaseTo", async () => {
            const { token, underlyingToken, owner } = await cleanWrapperDeployment();
            const [, recipient] = await ethers.getSigners();

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, recipient, amount);

            // owner's requestedMints is 0 -> reverts
            await expect(token.connect(owner).releaseTo(owner, amount)).to.be.reverted;
            // underlying is still in the wrapper
            (await underlyingToken.balanceOf(token)).should.be.equal(amount);
        });

        it("releaseTo: recipient front-runs the mint callback; pending callback reverts and invariant holds", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            const [, recipient] = await ethers.getSigners();
            await feedAccounts([owner, recipient]);

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, recipient, amount);

            // Recipient pulls underlying out before the mint CTX fires.
            await token.connect(recipient).releaseTo(recipient, amount);

            (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
            (await token.requestedMints(recipient)).should.be.equal(0);
            (await underlyingToken.balanceOf(token)).should.be.equal(0);

            // Outstanding mint CTX has nothing to debit; depositor's callback fee is consumed.
            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "OutdatedMint")
                .withArgs(recipient, amount);

            // Conservation: underlying held by wrapper == totalSupply + sum(requestedMints)
            const wrapperUnderlying = await underlyingToken.balanceOf(token);
            const supply = await token.totalSupply();
            const pending = (await token.requestedMints(recipient))
                + (await token.requestedMints(owner));
            wrapperUnderlying.should.be.equal(supply + pending);
            wrapperUnderlying.should.be.equal(0);
            supply.should.be.equal(0);
        });

        it("releaseTo: recipient front-runs and redirects underlying to a third party; invariant holds", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            const [, recipient, thirdParty] = await ethers.getSigners();
            await feedAccounts([owner, recipient, thirdParty]);

            const amount = ethers.parseEther("1");
            await topUpWrapperEth(owner, token);
            await depositForRecipient(token, underlyingToken, owner, recipient, amount);

            // Recipient redirects the pending pile to a different EOA in one tx.
            await token.connect(recipient).releaseTo(thirdParty, amount);

            (await underlyingToken.balanceOf(thirdParty)).should.be.equal(amount);
            (await underlyingToken.balanceOf(recipient)).should.be.equal(0);
            (await token.requestedMints(recipient)).should.be.equal(0);
            (await underlyingToken.balanceOf(token)).should.be.equal(0);

            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "OutdatedMint")
                .withArgs(recipient, amount);

            const wrapperUnderlying = await underlyingToken.balanceOf(token);
            const supply = await token.totalSupply();
            const pending = (await token.requestedMints(recipient))
                + (await token.requestedMints(owner))
                + (await token.requestedMints(thirdParty));
            wrapperUnderlying.should.be.equal(supply + pending);
            wrapperUnderlying.should.be.equal(0);
            supply.should.be.equal(0);
        });

        it("releaseTo: front-run drains only one of two pending deposits; the surviving callback still finalizes", async () => {
            // Two depositors fund the same recipient. Recipient releases just
            // one depositor's worth before any callback runs. Whichever CTX is
            // matched in size by the remaining pending finalizes; the other
            // hits OutdatedMint. Conservation must hold throughout.
            const { token, underlyingToken, bite } = await cleanWrapperDeployment();
            const [alice, bob, recipient] = await ethers.getSigners();
            await feedAccounts([alice, bob, recipient]);
            await topUpWrapperEth(alice, token);
            await topUpWrapperEth(bob, token);

            const aliceAmount = ethers.parseEther("3");
            const bobAmount   = ethers.parseEther("5");

            await depositForRecipient(token, underlyingToken, alice, recipient, aliceAmount);
            await depositForRecipient(token, underlyingToken, bob,   recipient, bobAmount);

            (await token.requestedMints(recipient)).should.be.equal(aliceAmount + bobAmount);

            // Recipient withdraws Alice's worth of underlying before any callback fires.
            await token.connect(recipient).releaseTo(recipient, aliceAmount);
            (await token.requestedMints(recipient)).should.be.equal(bobAmount);

            const participants = [alice, bob, recipient];
            const checkInvariant = async (label: string) => {
                const wrapperUnderlying = await underlyingToken.balanceOf(token);
                const supply = await token.totalSupply();
                let pending = 0n;
                for (const p of participants) {
                    pending += await token.requestedMints(p);
                }
                wrapperUnderlying.should.be.equal(
                    supply + pending,
                    `invariant violated after: ${label}`
                );
            };
            await checkInvariant("recipient front-run release of Alice's worth");

            // Alice's CTX (FIFO first) fires; requestedMints[recipient] == bobAmount,
            // _onMint(recipient, aliceAmount) succeeds because trySub(bob, alice) is non-negative.
            // Resulting state: requestedMints[recipient] = bobAmount - aliceAmount, totalSupply = aliceAmount.
            await expect(bite.sendCallback()).to.not.be.reverted;
            await checkInvariant("after first callback (alice's CTX consumed)");
            (await token.totalSupply()).should.be.equal(aliceAmount);
            (await token.requestedMints(recipient)).should.be.equal(bobAmount - aliceAmount);

            // Bob's CTX is now stale (recipient._lastChanged was bumped by alice's mint).
            // It resubmits, then the resubmit hits trySub(bobAmount - aliceAmount, bobAmount) -> false -> OutdatedMint.
            await expect(bite.sendCallback()).to.emit(token, "CTXResubmitted");
            await expect(bite.sendCallback())
                .to.be.revertedWithCustomError(token, "OutdatedMint")
                .withArgs(recipient, bobAmount);

            await checkInvariant("after bob's CTX final revert");

            // After the revert, requestedMints[recipient] still holds the
            // post-Alice remainder (bobAmount - aliceAmount). The wrapper
            // still custodies that remainder of underlying alongside the
            // aliceAmount that now backs the freshly minted cnf.
            (await token.totalSupply()).should.be.equal(aliceAmount);
            (await underlyingToken.balanceOf(recipient)).should.be.equal(aliceAmount);
            (await underlyingToken.balanceOf(token)).should.be.equal(bobAmount);
            (await token.requestedMints(recipient)).should.be.equal(bobAmount - aliceAmount);

            // Recipient can recover the still-pending remainder at will. The
            // aliceAmount of underlying that backs the minted cnf stays in
            // the wrapper until burn.
            await token.connect(recipient).releaseTo(recipient, bobAmount - aliceAmount);
            await checkInvariant("after recipient releases the remainder");
            (await underlyingToken.balanceOf(recipient)).should.be.equal(aliceAmount + (bobAmount - aliceAmount));
            (await underlyingToken.balanceOf(token)).should.be.equal(aliceAmount);
            (await token.requestedMints(recipient)).should.be.equal(0);
            (await token.totalSupply()).should.be.equal(aliceAmount);
        });

        it("invariant: underlying balance equals totalSupply plus all pending requestedMints through mixed operations", async () => {
            const { token, underlyingToken, bite } = await cleanWrapperDeployment();
            const [alice, bob, carol] = await ethers.getSigners();
            await feedAccounts([alice, bob, carol]);
            await topUpWrapperEth(alice, token, "2.0");
            await topUpWrapperEth(bob, token);

            const participants = [alice, bob, carol];
            const checkInvariant = async (label: string) => {
                const underlyingBalance = await underlyingToken.balanceOf(token);
                const totalSupply = await token.totalSupply();
                let pending = 0n;
                for (const p of participants) {
                    pending += await token.requestedMints(p);
                }
                underlyingBalance.should.be.equal(
                    totalSupply + pending,
                    `invariant violated after: ${label}`
                );
            };

            await checkInvariant("initial state");

            // Alice self-deposit
            const aliceAmount = ethers.parseEther("10");
            await depositForRecipient(token, underlyingToken, alice, alice, aliceAmount);
            await checkInvariant("after Alice depositFor(alice)");

            // Bob deposits for Carol
            const bobAmount = ethers.parseEther("5");
            await depositForRecipient(token, underlyingToken, bob, carol, bobAmount);
            await checkInvariant("after Bob depositFor(carol)");

            // Alice's callback finalizes
            await bite.sendCallback();
            await checkInvariant("after Alice callback");

            // Carol releases half her pending
            await token.connect(carol).releaseTo(carol, bobAmount / 2n);
            await checkInvariant("after Carol partial releaseTo");

            // Bob's callback finalizes (Carol gets remaining cnf)
            await bite.sendCallback();
            await checkInvariant("after Bob/Carol callback");
        });
    });
});
