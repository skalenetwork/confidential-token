import { ethers } from "hardhat";
import type { AddressLike } from "ethers";
import { cleanWrapperDeployment, withWrappedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import "chai/register-should";
import { balanceOf, feedAccounts } from "./tools/helpers";
import { expect } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ConfidentialWrapper, TestERC20 } from "../typechain-types";

// cspell:words ECIES

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

    const deployBiteMocks = async () => {
        const biteFactory = await ethers.getContractFactory("BiteMock");
        const bite = await biteFactory.deploy();
        const encryptECIESFactory = await ethers.getContractFactory("EncryptECIESMock");
        const encryptECIES = await encryptECIESFactory.deploy(bite);
        const encryptTEFactory = await ethers.getContractFactory("EncryptTEMock");
        const encryptTE = await encryptTEFactory.deploy(bite);
        const submitCTXFactory = await ethers.getContractFactory("SubmitCTXMock");
        const submitCTX = await submitCTXFactory.deploy(bite);
        return {
            bite,
            encryptECIES,
            encryptTE,
            submitCTX
        };
    };

    const deployWrapperWithPausableUnderlying = async () => {
        const [owner] = await ethers.getSigners();

        const underlyingFactory = await ethers.getContractFactory("TestERC20");
        const underlyingToken = await underlyingFactory.deploy("Pausable D2E", "pD2E") as TestERC20;
        await underlyingToken.deploymentTransaction()!.wait();

        const accessManagerFactory = await ethers.getContractFactory("AccessManager");
        const accessManager = await accessManagerFactory.deploy(owner);
        await accessManager.deploymentTransaction()!.wait();

        const wrapperFactory = await ethers.getContractFactory("ConfidentialWrapper");
        const token = await wrapperFactory.deploy(underlyingToken, "testing", accessManager) as ConfidentialWrapper;
        await token.deploymentTransaction()!.wait();

        const mocks = await deployBiteMocks();
        await token.setEncryptECIESAddress(mocks.encryptECIES);
        await token.setEncryptTEAddress(mocks.encryptTE);
        await token.setSubmitCTXAddress(mocks.submitCTX);
        await token.setCallbackFee(ethers.parseEther("0.003"));

        return {
            owner,
            token,
            underlyingToken,
            ...mocks
        };
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
        console.log(await token.getAddress());
        (await underlyingToken.balanceOf(token)).should.be.equal(amount);
        await bite.sendCallback();

        // Expected safe behavior:
        // underlying should be delivered to the supplied recipient.
        (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    });

    it("should preserve wrapper accounting while a withdrawal is pending and after it finalizes", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const [, recipient] = await ethers.getSigners();
        const amount = wrapped / 2n;

        await expectWrapperInvariant(token, underlyingToken, [owner]);

        await token.withdrawTo(recipient, amount);

        await expectWrapperInvariant(token, underlyingToken, [owner]);

        await bite.sendCallback();

        await expectWrapperInvariant(token, underlyingToken, [owner]);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
    });

    it("withdrawTo: stale callback still routes underlying to the original account arg", async () => {
        // Deposit and withdrawTo are both queued before any callback fires.
        // The deposit CTX runs first, bumping _lastChanged[owner].
        // The withdrawTo CTX is now stale and must resubmit.
        // After resubmit, the recipient encoded in plaintextArguments[2] must be
        // honoured — it must not fall back to msg.sender or any other address.
        const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
        const [, recipient] = await ethers.getSigners();

        const amount = ethers.parseEther("1");
        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });
        await underlyingToken.mint(owner, amount);
        await underlyingToken.connect(owner).approve(token, amount);

        // Queue deposit CTX (CTX1), then withdraw CTX (CTX2). CTX2 is submitted
        // while owner still has 0 cnf, so it captures a stale balance.
        await token.connect(owner).depositFor(owner, amount);
        await token.connect(owner).withdrawTo(recipient, amount);

        // CTX1: mint fires, owner gets cnf, _lastChanged[owner] is bumped.
        await expect(bite.sendCallback()).to.not.be.reverted;

        // CTX2: stale — resubmits; recipient address in plaintextArguments[2] must be preserved.
        await expect(bite.sendCallback()).to.emit(token, "CTXResubmitted");

        // CTX3 (resubmit of CTX2): finalizes. Underlying must reach recipient, not owner.
        await expect(bite.sendCallback()).to.not.be.reverted;

        (await underlyingToken.balanceOf(recipient)).should.be.equal(amount);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await token.totalSupply()).should.be.equal(0);
        (await underlyingToken.balanceOf(token)).should.be.equal(0);
    });

    it("withdrawTo: two sequential withdrawals to distinct recipients both finalize correctly", async () => {
        // Two withdrawTo calls are queued before any callback fires. The first CTX
        // finalizes and bumps _lastChanged[owner], making the second stale.
        // After one resubmit the second CTX must deliver to its own recipient.
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const [, recipient1, recipient2] = await ethers.getSigners();
        const half = wrapped / 2n;

        await token.connect(owner).withdrawTo(recipient1, half);
        await token.connect(owner).withdrawTo(recipient2, half);

        // CTX1 finalizes: underlying goes to recipient1; _lastChanged[owner] is bumped.
        await expect(bite.sendCallback()).to.not.be.reverted;
        (await underlyingToken.balanceOf(recipient1)).should.be.equal(half);

        // CTX2 is stale (submitted before CTX1 updated owner's balance).
        await expect(bite.sendCallback()).to.emit(token, "CTXResubmitted");

        // CTX3 (resubmit of CTX2): fresh balance, delivers to recipient2.
        await expect(bite.sendCallback()).to.not.be.reverted;
        (await underlyingToken.balanceOf(recipient2)).should.be.equal(half);

        (await token.totalSupply()).should.be.equal(0);
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

    it("withdrawTo(account, value) with insufficient cnf balance reverts in callback and does not release underlying", async () => {
        const { token, underlyingToken, owner, bite, wrapped } = await withWrappedTokens();
        const [, recipient] = await ethers.getSigners();

        await token.connect(owner).withdrawTo(recipient, wrapped + 1n);
        await expect(bite.sendCallback()).to.be.reverted;

        (await token.totalSupply()).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(token)).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(0);
        await expectWrapperInvariant(token, underlyingToken);
    });

    it("withdrawTo(account, value) reverts on submission when caller has insufficient callback fee gas token", async () => {
        const { token, underlyingToken, owner, wrapped } = await withWrappedTokens();
        const [, recipient] = await ethers.getSigners();

        const callbackFee = await token.callbackFee();
        const availableGasTokenBalance = await token.gasTokenBalanceOf(owner);
        await token.connect(owner).retrieveGasToken(availableGasTokenBalance, owner);

        await expect(token.connect(owner).withdrawTo(recipient, 1n))
            .to.be.revertedWithCustomError(token, "InsufficientGasToken")
            .withArgs(callbackFee, 0n);

        (await token.totalSupply()).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(token)).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(0);
        await expectWrapperInvariant(token, underlyingToken);
    });

    it("withdrawTo callback reverts if underlying transfer reverts and burn state is rolled back", async () => {
        const { token, underlyingToken, owner, bite } = await deployWrapperWithPausableUnderlying();
        const [, recipient] = await ethers.getSigners();
        const wrapped = ethers.parseEther("10");
        const withdrawAmount = wrapped / 2n;

        await owner.sendTransaction({
            to: await ethers.resolveAddress(token),
            value: ethers.parseEther("1.0")
        });

        await underlyingToken.mint(owner, wrapped);
        await underlyingToken.connect(owner).approve(token, wrapped);
        await token.connect(owner).depositFor(owner, wrapped);
        await bite.sendCallback();

        await token.connect(owner).withdrawTo(recipient, withdrawAmount);
        await underlyingToken.setTransfersPaused(true);

        await expect(bite.sendCallback())
            .to.be.revertedWithCustomError(underlyingToken, "EnforcedPause");

        (await token.totalSupply()).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(token)).should.be.equal(wrapped);
        (await underlyingToken.balanceOf(owner)).should.be.equal(0);
        (await underlyingToken.balanceOf(recipient)).should.be.equal(0);
        await expectWrapperInvariant(token, underlyingToken);
    });


    it("withdrawTo(account, 0) reverts with ZeroValue", async () => {
        const { token, owner } = await withWrappedTokens();
        const [, recipient] = await ethers.getSigners();

        await token.connect(owner).withdrawTo(recipient, 0n)
            .should.be.revertedWithCustomError(token, "ZeroValue");
    });

    it("should not allow to withdraw to the token itself", async () => {
        const { token, wrapped } = await withWrappedTokens();

        await token.withdrawTo(token, wrapped)
            .should.be.revertedWithCustomError(
                token, "ERC20InvalidReceiver"
            ).withArgs(await ethers.resolveAddress(token));
    });

    it("withdrawTo(address(0), value) reverts with ERC20InvalidReceiver before submitting CTX", async () => {
        const { token, wrapped } = await withWrappedTokens();

        await token.withdrawTo(ethers.ZeroAddress, wrapped)
            .should.be.revertedWithCustomError(token, "ERC20InvalidReceiver")
            .withArgs(ethers.ZeroAddress);
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

        const topUpWrapperGasToken = async (
            payer: HardhatEthersSigner,
            token: ConfidentialWrapper,
            amountGasToken: string = "1.0"
        ) => {
            await payer.sendTransaction({
                to: await ethers.resolveAddress(token),
                value: ethers.parseEther(amountGasToken)
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
            await topUpWrapperGasToken(owner, token);
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
            await topUpWrapperGasToken(owner, token);
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
            await topUpWrapperGasToken(alice, token);
            await topUpWrapperGasToken(bob, token);

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
            await topUpWrapperGasToken(owner, token, "2.0");

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
            await topUpWrapperGasToken(owner, token);
            await depositForRecipient(token, underlyingToken, owner, owner, amount);

            await token.connect(owner).releaseTo(beneficiary, amount);

            (await underlyingToken.balanceOf(beneficiary)).should.be.equal(amount);
            (await underlyingToken.balanceOf(owner)).should.be.equal(0);
            (await token.requestedMints(owner)).should.be.equal(0);
            (await underlyingToken.balanceOf(token)).should.be.equal(0);
        });

        it("releaseTo: partial release leaves remainder pending and makes old callback outdated", async () => {
            const { token, underlyingToken, owner, bite } = await cleanWrapperDeployment();
            await topUpWrapperGasToken(owner, token);

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
            await topUpWrapperGasToken(owner, token);

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
            await topUpWrapperGasToken(owner, token);

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
            await topUpWrapperGasToken(owner, token);
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
            await topUpWrapperGasToken(owner, token);
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
            await topUpWrapperGasToken(owner, token);
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
            await topUpWrapperGasToken(owner, token);
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
            await topUpWrapperGasToken(alice, token);
            await topUpWrapperGasToken(bob, token);

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
            await topUpWrapperGasToken(alice, token, "2.0");
            await topUpWrapperGasToken(bob, token);

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

            // Carol released some, so this should no longer go through
            await bite.sendCallback().should.be.revertedWithCustomError(token, "OutdatedMint").withArgs(carol, bobAmount);
            await checkInvariant("after Bob/Carol callback");
        });
    });
});
