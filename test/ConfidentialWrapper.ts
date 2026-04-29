import { ethers } from "hardhat";
import { cleanWrapperDeployment, withWrappedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import "chai/register-should";
import { balanceOf } from "./tools/helpers";
import { expect } from "chai";
import { feedAccounts } from "./tools/helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialWrapper, TestERC20 } from "../typechain-types";

describe("ConfidentialWrapper", () => {
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

            // Alice's callback resubmits (same-address staleness) then finalises
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
            // Second deposit is stale after first minted; it resubmits once then finalises
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

            // Alice's callback finalises
            await bite.sendCallback();
            await checkInvariant("after Alice callback");

            // Carol releases half her pending
            await token.connect(carol).releaseTo(carol, bobAmount / 2n);
            await checkInvariant("after Carol partial releaseTo");

            // Bob's callback finalises (Carol gets remaining cnf)
            await bite.sendCallback();
            await checkInvariant("after Bob/Carol callback");
        });
    });
});
