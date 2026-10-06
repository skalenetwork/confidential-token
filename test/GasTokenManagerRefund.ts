import { ethers } from "hardhat";
import "chai/register-should";
import { expect } from "chai";
import { cleanWrapperDeployment, withMintedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import { sendCallbackAndMakeRefund, sendRevertingCallbackAndMakeRefund } from "./tools/helpers";

// When a callback runs, some of the gas token that was paid up front is not spent
// and comes back to the contract as plain ETH. The contract does not know about
// this refund right away - it only remembers who paid for the last callback
// (_lastGasTokenRefundReceiver) and gives that account the refund the next time
// anyone touches the gas token accounting. These tests check that this "lazy"
// bookkeeping always ends up crediting the right account, and never twice.
describe("GasTokenManager refunds", () => {
    it("gives the refund to the account that paid for that callback, even if someone else pays for the next callback", async () => {
        const { token, bite, owner } = await withMintedTokens();
        const [, bob] = await ethers.getSigners();
        const tokenAddress = await ethers.resolveAddress(token);

        // Bob needs his own gas token balance so he can pay for his own callback.
        await bob.sendTransaction({ to: tokenAddress, value: ethers.parseEther("1") });

        const callbackFee = await token.callbackFee();
        const ownerBalanceBeforeSubmit = await token.gasTokenBalanceOf(owner);
        const bobBalanceBeforeSubmit = await token.gasTokenBalanceOf(bob);

        // Owner pays for a callback and gets a refund from it.
        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        const refund = await sendCallbackAndMakeRefund(bite);

        // Bob now pays for and runs his own callback, before owner's refund was
        // ever collected.
        await token.connect(bob).setViewerPublicKey(await getPublicKey(bob));
        await bite.sendCallback();

        // The refund must still belong to owner, not leak to bob.
        expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
            ownerBalanceBeforeSubmit - callbackFee + refund
        );
        expect(await token.gasTokenBalanceOf(bob)).to.be.equal(
            bobBalanceBeforeSubmit - callbackFee
        );
    });

    it("does not show someone else's pending refund on an unrelated account's balance", async () => {
        const { token, bite, owner } = await withMintedTokens();
        const [, , stranger] = await ethers.getSigners();

        // Stranger never funded any gas token and never paid for a callback.
        expect(await token.gasTokenBalanceOf(stranger)).to.be.equal(0);

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        await sendCallbackAndMakeRefund(bite);

        // The contract now holds more ETH than the balances it has recorded so far,
        // because of owner's pending refund. That extra ETH belongs to owner, so it
        // must not show up on an account that has nothing to do with it.
        expect(await token.gasTokenBalanceOf(stranger)).to.be.equal(0);
    });

    it("lets an account withdraw their refund right after their own callback, with no extra callback needed", async () => {
        const { token, bite, owner } = await withMintedTokens();
        const [, receiver] = await ethers.getSigners();

        const callbackFee = await token.callbackFee();
        const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        const refund = await sendCallbackAndMakeRefund(bite);

        const expectedBalance = balanceBeforeSubmit - callbackFee + refund;
        const receiverEthBefore = await ethers.provider.getBalance(receiver);

        // If the refund was not counted yet, this withdrawal would revert because
        // the requested amount would be higher than what is available.
        await token.connect(owner).retrieveGasToken(expectedBalance, receiver);

        expect(await ethers.provider.getBalance(receiver)).to.be.equal(
            receiverEthBefore + expectedBalance
        );
        expect(await token.gasTokenBalanceOf(owner)).to.be.equal(0);
    });

    it("still adds the pending refund when the same account tops up their gas balance afterward", async () => {
        const { token, bite, owner } = await withMintedTokens();
        const tokenAddress = await ethers.resolveAddress(token);

        const callbackFee = await token.callbackFee();
        const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        const refund = await sendCallbackAndMakeRefund(bite);

        const topUp = ethers.parseEther("0.5");
        await owner.sendTransaction({ to: tokenAddress, value: topUp });

        // The new ETH sent in this top up must not be mistaken for more refund,
        // and the refund from the earlier callback must not be lost either.
        expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
            balanceBeforeSubmit - callbackFee + refund + topUp
        );
    });

    it("does not add the same refund twice when the balance is touched more than once", async () => {
        const { token, bite, owner } = await withMintedTokens();

        const callbackFee = await token.callbackFee();
        const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);

        await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
        const refund = await sendCallbackAndMakeRefund(bite);

        const expectedBalance = balanceBeforeSubmit - callbackFee + refund;

        // Touch the gas token accounting twice in a row, with no new refund
        // happening in between. A withdrawal of 0 is enough to trigger the check.
        await token.connect(owner).retrieveGasToken(0, owner);
        await token.connect(owner).retrieveGasToken(0, owner);

        expect(await token.gasTokenBalanceOf(owner)).to.be.equal(expectedBalance);
    });

    it("adds together refunds from two callbacks that were both paid by the same account", async () => {
        const { token, bite, owner } = await withMintedTokens();
        const [, recipient1, recipient2] = await ethers.getSigners();

        const callbackFee = await token.callbackFee();
        const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);
        const amount = ethers.parseEther("1");

        await token.connect(owner).transfer(recipient1, amount);
        const firstRefund = await sendCallbackAndMakeRefund(bite);

        await token.connect(owner).transfer(recipient2, amount);
        const secondRefund = await sendCallbackAndMakeRefund(bite);

        expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
            balanceBeforeSubmit - callbackFee * 2n + firstRefund + secondRefund
        );
    });

    // A CTX can become "stale" if the balance it was built from changes before its
    // callback runs. When that happens the contract resubmits it as a brand new CTX,
    // paid for by the same account, which means another callback fee is charged and
    // another callback (and another possible refund) happens later. These tests check
    // that every fee paid this way, and every refund earned this way, still lands
    // correctly on the account that triggered the resubmission.
    describe("refunds when a callback gets resubmitted", () => {
        it("still credits every refund to the payer through a resubmitted callback, on top of the extra fee the resubmission costs", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient1, recipient2] = await ethers.getSigners();

            const callbackFee = await token.callbackFee();
            const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);
            const amount = ethers.parseEther("1");

            // Both transfers are queued before either callback runs, so the second
            // one is built from a balance that is about to change.
            await token.connect(owner).transfer(recipient1, amount);
            await token.connect(owner).transfer(recipient2, amount);

            // First callback finalizes normally and changes owner's balance.
            const refund1 = await sendCallbackAndMakeRefund(bite);

            // Second callback is now stale: it resubmits instead of finalizing.
            // Resubmitting pays for a brand new callback, so this refund is only
            // for the wasted, stale attempt, not for the actual transfer.
            const refund2 = await sendCallbackAndMakeRefund(bite);

            // Third callback is the resubmitted one, and finalizes.
            const refund3 = await sendCallbackAndMakeRefund(bite);

            // Owner paid the callback fee three times (original transfer 1, original
            // transfer 2, and its resubmission), and should get all three refunds back.
            expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
                balanceBeforeSubmit - callbackFee * 3n + refund1 + refund2 + refund3
            );
        });

        it("keeps crediting the same payer correctly even when a callback is resubmitted more than once", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient1, recipient2, recipient3] = await ethers.getSigners();

            const callbackFee = await token.callbackFee();
            const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);
            const amount = ethers.parseEther("1");

            // Three transfers are queued before any callback runs.
            await token.connect(owner).transfer(recipient1, amount);
            await token.connect(owner).transfer(recipient2, amount);
            await token.connect(owner).transfer(recipient3, amount);

            const refunds: bigint[] = [];

            // Transfer 1 finalizes and changes owner's balance.
            refunds.push(await sendCallbackAndMakeRefund(bite));
            // Transfer 2 is now stale and resubmits.
            refunds.push(await sendCallbackAndMakeRefund(bite));
            // Transfer 3 is also stale (built before transfer 1 finalized) and resubmits.
            refunds.push(await sendCallbackAndMakeRefund(bite));
            // Transfer 2's resubmission finalizes and changes owner's balance again.
            refunds.push(await sendCallbackAndMakeRefund(bite));
            // Transfer 3's resubmission is now stale a second time (built before
            // transfer 2's resubmission finalized) and resubmits again.
            refunds.push(await sendCallbackAndMakeRefund(bite));
            // Transfer 3's second resubmission finally finalizes.
            refunds.push(await sendCallbackAndMakeRefund(bite));

            const totalRefund = refunds.reduce((sum, value) => sum + value, 0n);
            const numberOfCallbacks = BigInt(refunds.length);

            // Six callbacks ran in total, all paid for by owner: 1 for transfer 1,
            // 2 for transfer 2, 3 for transfer 3 (original + two resubmissions).
            expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
                balanceBeforeSubmit - callbackFee * numberOfCallbacks + totalRefund
            );
        });
    });

    describe("refunds when a wrapper withdrawal gets resubmitted", () => {
        it("credits the payer's refund correctly when a wrapper withdrawTo callback is stale and resubmits", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            const [, recipient] = await ethers.getSigners();
            const tokenAddress = await ethers.resolveAddress(token);
            const amount = ethers.parseEther("1");

            await owner.sendTransaction({ to: tokenAddress, value: ethers.parseEther("1.0") });
            await underlyingToken.mint(owner, amount);
            await underlyingToken.connect(owner).approve(token, amount);

            const callbackFee = await token.callbackFee();
            const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);

            // Queue a deposit (CTX1), then a withdrawal (CTX2). CTX2 is built while
            // owner still has 0 confidential balance, so it will be stale once CTX1
            // finalizes and gives owner a confidential balance to withdraw from.
            await token.connect(owner).depositFor(owner, amount);
            await token.connect(owner).withdrawTo(recipient, amount);

            // CTX1: deposit finalizes, owner gets a confidential balance.
            const depositRefund = await sendCallbackAndMakeRefund(bite);

            // CTX2: withdrawal is stale, resubmits instead of finalizing.
            const staleWithdrawRefund = await sendCallbackAndMakeRefund(bite);

            // CTX3: resubmitted withdrawal, finalizes and releases the underlying token.
            const finalWithdrawRefund = await sendCallbackAndMakeRefund(bite);

            expect(await underlyingToken.balanceOf(recipient)).to.be.equal(amount);
            expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
                balanceBeforeSubmit - callbackFee * 3n + depositRefund + staleWithdrawRefund + finalWithdrawRefund
            );
        });
    });

    // A callback can revert - for example the real balance turns out to be too low,
    // and this is only found out once the callback decrypts it. In that case the
    // receiver update in onDecrypt is rolled back with the action. The returned gas
    // is therefore attributed to the receiver recorded by the previous successful
    // callback, rather than to the payer of the reverted callback.
    describe("refunds when a callback reverts", () => {
        it("does not refund a reverted callback's payer, then gives both refunds to the previous receiver when their next callback succeeds", async () => {
            const { token, bite, owner } = await withMintedTokens();
            const [, recipient, bob] = await ethers.getSigners();
            const tokenAddress = await ethers.resolveAddress(token);

            await bob.sendTransaction({ to: tokenAddress, value: ethers.parseEther("1") });

            const callbackFee = await token.callbackFee();
            const ownerBalanceBeforeSubmit = await token.gasTokenBalanceOf(owner);
            const bobBalanceBeforeSubmit = await token.gasTokenBalanceOf(bob);

            // The fixture's successful mint callback has already made owner the
            // current refund receiver. Bob has no confidential balance, so Bob's
            // transfer callback reverts and cannot replace that receiver with Bob.
            await token.connect(bob).transfer(recipient, 1n);
            const revertedCallbackRefund = await sendRevertingCallbackAndMakeRefund(bite);

            expect(await token.gasTokenBalanceOf(bob)).to.be.equal(
                bobBalanceBeforeSubmit - callbackFee
            );

            // BiteMock's queue pop is rolled back together with a reverting callback,
            // unlike the network's one-shot delivery. Use a fresh mock queue for the
            // later callback so the failed entry cannot block it in this unit test.
            const nextBite = await ethers.deployContract("BiteMock");
            const nextSubmitCTX = await ethers.deployContract("SubmitCTXMock", [nextBite]);
            await token.setSubmitCTXAddress(nextSubmitCTX);

            // Owner now pays for another callback. Because owner was still the
            // recorded receiver, owner receives Bob's leaked refund as well as the
            // refund from this successful callback.
            await token.connect(owner).setViewerPublicKey(await getPublicKey(owner));
            const successfulCallbackRefund = await sendCallbackAndMakeRefund(nextBite);

            expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
                ownerBalanceBeforeSubmit - callbackFee + revertedCallbackRefund + successfulCallbackRefund
            );
            expect(await token.gasTokenBalanceOf(bob)).to.be.equal(
                bobBalanceBeforeSubmit - callbackFee
            );
        });

        it("still refunds the payer when the callback itself reverts, IF that payer was already the current refund receiver", async () => {
            const { token, bite, owner, minted } = await withMintedTokens();
            const [, recipient] = await ethers.getSigners();

            const callbackFee = await token.callbackFee();
            const balanceBeforeSubmit = await token.gasTokenBalanceOf(owner);

            // Owner tries to send more than they actually hold. The contract cannot
            // see this at submission time, because balances are encrypted - the
            // callback only finds out, and reverts, once it decrypts the real balance.
            // Owner is already the refund receiver here (from the mint callback in
            // the fixture), so this case does not depend on the receiver being
            // updated by the reverting callback itself.
            await token.connect(owner).transfer(recipient, minted + 1n);

            const refund = await sendRevertingCallbackAndMakeRefund(bite);

            // The transfer failed, but owner still paid for the callback and should
            // still get the unused part of that payment back.
            expect(await token.gasTokenBalanceOf(owner)).to.be.equal(
                balanceBeforeSubmit - callbackFee + refund
            );
        });
    });
});
