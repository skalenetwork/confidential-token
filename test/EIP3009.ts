// cspell:words typehash

import { ethers } from "hardhat";
import { AddressLike, BaseWallet, BigNumberish, HDNodeWallet, Wallet } from "ethers";
import { expect } from "chai";
import { BiteMock, ConfidentialToken } from "../typechain-types";
import { withMintedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf, feedAccounts, nowPlusSeconds } from "./tools/helpers";

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.id(
    "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);

const RECEIVE_WITH_AUTHORIZATION_TYPEHASH = ethers.id(
    "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);

const CANCEL_AUTHORIZATION_TYPEHASH = ethers.id(
    "CancelAuthorization(address authorizer,bytes32 nonce)"
);

describe("EIP3009", () => {
    let token: ConfidentialToken;
    let bite: BiteMock;
    let domainSeparator: string;
    let alice: HDNodeWallet;
    let bob: HDNodeWallet;
    let charlie: HDNodeWallet;
    let nonce: string;
    const initialBalance = 10e6;

    before(async () => {
        alice = Wallet.createRandom(ethers.provider);
        bob = Wallet.createRandom(ethers.provider);
        charlie = Wallet.createRandom(ethers.provider);
    });

    beforeEach(async () => {
        const { bite: deployedBite, token: deployedToken } =
            await withMintedTokens();
        bite = deployedBite;
        token = deployedToken;
        domainSeparator = await token.DOMAIN_SEPARATOR();
        nonce = ethers.hexlify(ethers.randomBytes(32));

        await feedAccounts([
            alice,
            bob,
            charlie
        ]);

        for (const user of [alice, bob, charlie]) {
            await token
                .connect(user)
                .deposit(user, { value: ethers.parseEther("3") });
        }

        await token.connect(alice).setViewerPublicKey(await getPublicKey(alice));
        await bite.sendCallback();
        await token.connect(bob).setViewerPublicKey(await getPublicKey(bob));
        await bite.sendCallback();
        await token.connect(charlie).setViewerPublicKey(await getPublicKey(charlie));
        await bite.sendCallback();

        await token.transfer(alice, initialBalance);
        await bite.sendCallback();
    });

    it("has the expected type hashes", async () => {
        expect(await token.TRANSFER_WITH_AUTHORIZATION_TYPEHASH()).to.equal(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH
        );

        expect(await token.RECEIVE_WITH_AUTHORIZATION_TYPEHASH()).to.equal(
            RECEIVE_WITH_AUTHORIZATION_TYPEHASH
        );

        expect(await token.CANCEL_AUTHORIZATION_TYPEHASH()).to.equal(
            CANCEL_AUTHORIZATION_TYPEHASH
        );
    });

    interface TransferParams {
        from: BaseWallet;
        to: BaseWallet;
        value: BigNumberish;
        validAfter: BigNumberish;
        validBefore: BigNumberish;
    }

    describe("transferWithAuthorization", () => {
        let transferParams: TransferParams;

        before(async () => {
            transferParams = {
                from: alice,
                to: bob,
                value: 7e6,
                validAfter: 0,
                validBefore: ethers.MaxUint256,
            };
        });

        it("executes a transfer when a valid authorization is given", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create an authorization to transfer money from Alice to Bob and sign
            // with Alice's key
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect(await balanceOf(token, bite, from)).to.equal(10e6);
            expect(await balanceOf(token, bite, to)).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.equal(false);
            // need to top-up some ETH for gas fees
            await token
                .connect(charlie)
                .deposit(charlie, { value: ethers.parseEther("0.3") });

            // a third-party, Charlie (not Alice) submits the signed authorization
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.emit(token, "AuthorizationUsed").withArgs(from, nonce);

            await bite.sendCallback().should.emit(token, "Transfer(address,address)").withArgs(from, to);

            // check that balance is updated
            expect(await balanceOf(token, bite, from)).to.equal(
                initialBalance - Number(value)
            );
            expect(await balanceOf(token, bite, to)).to.equal(value);

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.equal(true);
        });

        it("reverts if the signature does not match given parameters", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create a signed authorization
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to cheat by claiming the transfer amount is double

            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                Number(value) * 2, // pass incorrect value
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });

        it("reverts if the signature is not signed with the right key", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create an authorization to transfer money from Alice to Bob, but
            // sign with Bob's key instead of Alice's
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                bob
            );

            // try to cheat by submitting the signed authorization that is signed by
            // a wrong person
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });

        it("reverts if the authorization is not yet valid", async () => {
            const { from, to, value, validBefore } = transferParams;

            // create a signed authorization that won't be valid until 10 seconds
            // later
            const validAfter = await nowPlusSeconds(10);

            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );
            // try to submit the authorization early
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationIsNotYetValid").withArgs(validAfter);
       });

        it("reverts if the authorization is expired", async () => {
            // create a signed authorization that expires immediately
            const { from, to, value, validAfter } = transferParams;
            const validBefore = await nowPlusSeconds(0);
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization that is expired
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationIsExpired").withArgs(validBefore);
        });

       it("reverts if the authorization has already been used", async () => {
            const { from, to, validAfter, validBefore } = transferParams;
            // create a signed authorization
            const value = 1e6;
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );
            await bite.sendCallback();

            //try to submit the authorization again
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.revertedWithCustomError(token, "AuthorizationUsedError").withArgs(from, nonce);
        });

        it("reverts if the authorization has a nonce that has already been used by the signer", async () => {
            const { from, to, value, validAfter, validBefore } = transferParams;
            // create a signed authorization
            const authorization = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                authorization.v,
                authorization.r,
                authorization.s
            );

            // create another authorization with the same nonce, but with different
            // parameters
            const authorization2 = await signTransferAuthorization(
                from,
                to,
                1e6,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization again
            await token.transferWithAuthorization(
                    from,
                    to,
                    1e6,
                    validAfter,
                    validBefore,
                    nonce,
                    authorization2.v,
                    authorization2.r,
                    authorization2.s
            ).should.be.revertedWithCustomError(token, "AuthorizationUsedError").withArgs(from, nonce);
        });

        it("reverts if the authorization includes invalid transfer parameters", async () => {
            const { from, to, validAfter, validBefore } = transferParams;
            // create a signed authorization that attempts to transfer an amount
            // that exceeds the sender's balance
            const value = initialBalance + 1;
            const { v, r, s } = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization with invalid transfer parameters
            // This will succeed because transfer is executed on callback
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );
            await bite.sendCallback().should.revertedWithCustomError(token, "InsufficientBalance()");
        });

        it("reverts if the authorization is not for transferWithAuthorization", async () => {
            const {
                from: owner,
                to: spender,
                value,
                validAfter,
                validBefore,
            } = transferParams;

            // create a signed authorization for an approval (granting allowance)
            const { v, r, s } = await signReceiveAuthorization(
                owner,
                spender,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the approval authorization
            await token.connect(charlie).transferWithAuthorization(
                owner,
                spender,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });
    });

    describe("receiveWithAuthorization", () => {
        let receiveParams: TransferParams;
        before(async () => {
            receiveParams = {
                from: alice,
                to: charlie,
                value: 7e6,
                validAfter: 0,
                validBefore: ethers.MaxUint256
            };
        });


        it("executes a transfer when a valid authorization is submitted by the payee", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a receive authorization to transfer money from Alice to Charlie
            // and sign with Alice's key
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect((await balanceOf(token, bite, from))).to.equal(10e6);
            expect((await balanceOf(token, bite, to))).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.eql(false);

            // The payee submits the signed authorization
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.emit(token, "AuthorizationUsed").withArgs(from, nonce);

            await bite.sendCallback().should.emit(token, "Transfer(address,address)").withArgs(from, to);

            // check that balance is updated
            expect((await balanceOf(token, bite, from))).to.equal(
                initialBalance - Number(value)
            );
            expect((await balanceOf(token, bite, to))).to.equal(value);

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.eql(true);
        });

        it("reverts if the caller is not the payee", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect((await balanceOf(token, bite, from))).to.equal(10e6);
            expect((await balanceOf(token, bite, to))).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.eql(false);

            // The payee submits the signed authorization (wrong payee, correct is charlie)
            await token.connect(bob).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "CallerMustBeThePayee").withArgs(bob, to);
        });

        it("reverts if the signature does not match given parameters", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to cheat by claiming the transfer amount is double
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                Number(value) * 2, // pass incorrect value
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });

        it("reverts if the signature is not signed with the right key", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create an authorization to transfer money from Alice to Bob, but
            // sign with Bob's key instead of Alice's
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                bob
            );

            // try to cheat by submitting the signed authorization that is signed by
            // a wrong person
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });

        it("reverts if the authorization is not yet valid", async () => {
            const { from, to, value, validBefore } = receiveParams;
            // create a signed authorization that won't be valid until 10 seconds
            // later
            const validAfter = await nowPlusSeconds(10);
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization early
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationIsNotYetValid").withArgs(validAfter);
        });

        it("reverts if the authorization is expired", async () => {
            // create a signed authorization that expires immediately
            const { from, to, value, validAfter } = receiveParams;
            const validBefore = await nowPlusSeconds(0);
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization that is expired
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationIsExpired").withArgs(validBefore);
        });

        it("reverts if the authorization has already been used", async () => {
            const { from, to, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const value = 1e6;
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );
            await bite.sendCallback();

            // try to submit the authorization again
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationUsedError").withArgs(from, nonce);
        });

        it("reverts if the authorization has a nonce that has already been used by the signer", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            // create a signed authorization
            const authorization = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                authorization.v,
                authorization.r,
                authorization.s
            );

            await bite.sendCallback();

            // create another authorization with the same nonce, but with different
            // parameters
            const authorization2 = await signReceiveAuthorization(
                from,
                to,
                1e6,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                1e6,
                validAfter,
                validBefore,
                nonce,
                authorization2.v,
                authorization2.r,
                authorization2.s
            ).should.be.revertedWithCustomError(token, "AuthorizationUsedError").withArgs(from, nonce);
        });

        it("reverts if the authorization includes invalid transfer parameters", async () => {
            const { from, to, validAfter, validBefore } = receiveParams;
            // create a signed authorization that attempts to transfer an amount
            // that exceeds the sender's balance
            const value = initialBalance + 1;
            const { v, r, s } = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization with invalid transfer parameters
            // Should succeed because only executed on callback
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );

            await bite.sendCallback().should.be.revertedWithCustomError(
                token,
                "InsufficientBalance()"
            );
        });

        it("reverts if the authorization is not for receiveWithAuthorization", async () => {
            const {
                from: owner,
                to: spender,
                value,
                validAfter,
                validBefore,
            } = receiveParams;
            // create a signed authorization for an approval (granting allowance)
            const { v, r, s } = await signTransferAuthorization(
                owner,
                spender,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the approval authorization
            await token.connect(charlie).receiveWithAuthorization(
                owner,
                spender,
                value,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });
    });

    describe("cancelAuthorization", () => {
        let receiveParams: TransferParams;
        before(async () => {
            receiveParams = {
                from: alice,
                to: charlie,
                value: 7e6,
                validAfter: 0,
                validBefore: ethers.MaxUint256
            };
        });

        it("cancels an unused transfer authorization if the signature is valid", async () => {
            const { from, to, validAfter, value, validBefore } = receiveParams;


            // create a signed authorization
            const authorization = await signTransferAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // create cancellation
            const cancellation = await signCancelAuthorization(
                nonce,
                domainSeparator,
                alice //
            );

            // check that the authorization is unused
            expect(await token.authorizationState(from, nonce)).to.be.eql(false);

            // cancel the authorization
            await token.connect(charlie).cancelAuthorization(
                from,
                nonce,
                cancellation.v,
                cancellation.r,
                cancellation.s
            );

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.eql(true);

            // attempt to use the canceled authorization
            await token.connect(charlie).transferWithAuthorization(
                from,
                to,
                value,
                validAfter,
                 validBefore,
                nonce,
                authorization.v,
                authorization.r,
                authorization.s
            ).should.be.revertedWithCustomError(
                token,
                "AuthorizationUsedError"
            ).withArgs(from, nonce);
        });

        it("cancels an unused receive authorization if the signature is valid", async () => {
            const { from, to, validAfter, value, validBefore } = receiveParams;

            // create a signed authorization
            const authorization = await signReceiveAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // create cancellation
            const cancellation = await signCancelAuthorization(
                nonce,
                domainSeparator,
                alice
            );

            // check that the authorization is unused
            expect(await token.authorizationState(from, nonce)).to.be.eql(false);

            // cancel the authorization
            await token.connect(charlie).cancelAuthorization(
                from,
                nonce,
                cancellation.v,
                cancellation.r,
                cancellation.s
            );

            // check that the authorization is now used
            expect(await token.authorizationState(from, nonce)).to.be.eql(true);

            // attempt to use the canceled authorization
            await token.connect(charlie).receiveWithAuthorization(
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce,
                authorization.v,
                authorization.r,
                authorization.s
            ).should.be.revertedWithCustomError(token, "AuthorizationUsedError").withArgs(from, nonce);
        });

        it("reverts if the authorization is already canceled", async () => {
            // create cancellation
            const cancellation = await signCancelAuthorization(
                nonce,
                domainSeparator,
                alice
            );

            // submit the cancellation
            await token.cancelAuthorization(
                alice,
                nonce,
                cancellation.v,
                cancellation.r,
                cancellation.s
            );

            // try to submit the same cancellation again
            await token.connect(charlie).cancelAuthorization(
                alice,
                nonce,
                cancellation.v,
                cancellation.r,
                cancellation.s
            ).should.be.revertedWithCustomError(token, "AuthorizationUsedError").withArgs(alice, nonce);
        });
    });
});

interface Signature {
    v: number;
    r: string;
    s: string;
}

const signTransferAuthorization = async (
    from: AddressLike,
    to: AddressLike,
    value: BigNumberish,
    validAfter: BigNumberish,
    validBefore: BigNumberish,
    nonce: string,
    domainSeparator: string,
    signer: BaseWallet
): Promise<Signature> => {
  return signEIP712(
    domainSeparator,
    TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
    ["address", "address", "uint256", "uint256", "uint256", "bytes32"],
    [
      await ethers.resolveAddress(from),
      await ethers.resolveAddress(to),
      ethers.toBigInt(value),
      ethers.toBigInt(validAfter),
      ethers.toBigInt(validBefore),
      nonce,
    ],
    signer
  );
};

async function signReceiveAuthorization(
    from: AddressLike,
    to: AddressLike,
    value: BigNumberish,
    validAfter: BigNumberish,
    validBefore: BigNumberish,
    nonce: string,
    domainSeparator: string,
    signer: BaseWallet
): Promise<Signature> {
    return signEIP712(
        domainSeparator,
        RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
        ["address", "address", "uint256", "uint256", "uint256", "bytes32"],
        [
            await ethers.resolveAddress(from),
            await ethers.resolveAddress(to),
            ethers.toBigInt(value),
            ethers.toBigInt(validAfter),
            ethers.toBigInt(validBefore),
            nonce
        ],
        signer
    );
}

async function signCancelAuthorization(
    nonce: string,
    domainSeparator: string,
    signer: BaseWallet
): Promise<Signature> {
    return signEIP712(
        domainSeparator,
        CANCEL_AUTHORIZATION_TYPEHASH,
        ["address", "bytes32"],
        [await ethers.resolveAddress(signer), nonce],
        signer
    );
}

const signEIP712 = async (
    domainSeparator: string,
    typeHash: string,
    types: string[],
    parameters: BigNumberish[],
    signer: BaseWallet
): Promise<Signature> => {
    const digest = ethers.keccak256(
        "0x1901" +
        strip0x(domainSeparator) +
        strip0x(
            ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bytes32", ...types],
                    [typeHash, ...parameters]
                )
            )
        )
    );
    const signature = signer.signingKey.sign(ethers.getBytes(digest));
    return ethers.Signature.from(signature);
};

const strip0x = (v: string): string => {
    return v.replace(/^0x/, "");
};
