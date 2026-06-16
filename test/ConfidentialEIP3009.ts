// cspell:words typehash

import "chai/register-should";
import { ethers } from "hardhat";
import { AddressLike, BaseWallet, BigNumberish, BytesLike, HDNodeWallet } from "ethers";
import { expect } from "chai";
import { BiteMock, ConfidentialToken } from "../typechain-types";
import { withEIP3009Setup } from "./tools/fixtures";
import { balanceOf, nowPlusSeconds } from "./tools/helpers";

const ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.id(
    "TransferWithAuthorization(address from,address to,bytes value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);

const ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH = ethers.id(
    "ReceiveWithAuthorization(address from,address to,bytes value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
);

describe("ConfidentialEIP3009", () => {
    let token: ConfidentialToken;
    let bite: BiteMock;
    let domainSeparator: string;
    let alice: HDNodeWallet;
    let bob: HDNodeWallet;
    let charlie: HDNodeWallet;
    let nonce: string;
    const initialBalance = 10e6;

    before(async function() {
        // warmup the fixture with larger timeout. This runs only once and is loaded in all following tests
        this.timeout(60_000);
        await withEIP3009Setup();
    });

    beforeEach(async () => {
        ({ bite, token, alice, bob, charlie } = await withEIP3009Setup());
        const latestBlock = await ethers.provider.getBlock("latest");
        await ethers.provider.send("evm_setNextBlockTimestamp", [latestBlock!.timestamp + 1]);
        domainSeparator = await token.DOMAIN_SEPARATOR();
        nonce = ethers.hexlify(ethers.randomBytes(32));
    });

    const encryptValue = async (from: AddressLike, value: BigNumberish): Promise<string> => {
        return bite.encryptTE(
            ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [await ethers.resolveAddress(from), value])
        );
    };

    it("has the expected type hashes", async () => {
        expect(await token.ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH()).to.equal(
            ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH
        );

        expect(await token.ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH()).to.equal(
            ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH
        );
    });

    interface TransferParams {
        from: BaseWallet;
        to: BaseWallet;
        value: BigNumberish;
        validAfter: BigNumberish;
        validBefore: BigNumberish;
    }

    describe("encryptedTransferWithAuthorization", () => {
        let transferParams: TransferParams;

        beforeEach(() => {
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
            const encryptedValue = await encryptValue(from, value);
            // create an authorization to transfer money from Alice to Bob and sign
            // with Alice's key
            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
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
            // a third-party, Charlie (not Alice) submits the signed authorization
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization
            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to cheat by passing a different encrypted value
            const wrongEncryptedValue = await encryptValue(from, Number(value) * 2);

            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                wrongEncryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create an authorization to transfer money from Alice to Bob, but
            // sign with Bob's key instead of Alice's
            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                bob
            );

            // try to cheat by submitting the signed authorization that is signed by
            // a wrong person
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization that won't be valid until 10 seconds
            // later
            const validAfter = await nowPlusSeconds(10);

            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization early
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationIsNotYetValid").withArgs(validAfter);
        });

        it("reverts if the authorization is expired", async () => {
            const { from, to, value, validAfter } = transferParams;
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization that expires immediately
            const validBefore = await nowPlusSeconds(0);
            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization that is expired
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );
            await bite.sendCallback();

            // try to submit the authorization again
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization
            const authorization = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                authorization.v,
                authorization.r,
                authorization.s
            );

            // create another authorization with the same nonce, but with different
            // parameters
            const smallerEncryptedValue = await encryptValue(from, 1e6);
            const authorization2 = await signEncryptedTransferAuthorization(
                from,
                to,
                smallerEncryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization again
            await token.encryptedTransferWithAuthorization(
                from,
                to,
                smallerEncryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            const { v, r, s } = await signEncryptedTransferAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization with invalid transfer parameters
            // This will succeed because transfer is executed on callback
            await token.connect(charlie).encryptedTransferWithAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );
            await bite.sendCallback().should.revertedWithCustomError(token, "InsufficientBalance()");
        });

        it("reverts if the authorization is not for encryptedTransferWithAuthorization", async () => {
            const {
                from: owner,
                to: spender,
                value,
                validAfter,
                validBefore,
            } = transferParams;
            const encryptedValue = await encryptValue(owner, value);

            // create a signed authorization for a receive (wrong type)
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                owner,
                spender,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the receive authorization as a transfer
            await token.connect(charlie).encryptedTransferWithAuthorization(
                owner,
                spender,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });
    });

    describe("encryptedReceiveWithAuthorization", () => {
        let receiveParams: TransferParams;
        beforeEach(() => {
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
            const encryptedValue = await encryptValue(from, value);

            // create a receive authorization to transfer money from Alice to Charlie
            // and sign with Alice's key
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect(await balanceOf(token, bite, from)).to.equal(10e6);
            expect(await balanceOf(token, bite, to)).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.eql(false);

            // The payee submits the signed authorization
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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
            expect(await token.authorizationState(from, nonce)).to.be.eql(true);
        });

        it("reverts if the caller is not the payee", async () => {
            const { from, to, value, validAfter, validBefore } = receiveParams;
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // check initial balance
            expect(await balanceOf(token, bite, from)).to.equal(10e6);
            expect(await balanceOf(token, bite, to)).to.equal(0);

            expect(await token.authorizationState(from, nonce)).to.be.eql(false);

            // The payee submits the signed authorization (wrong payee, correct is charlie)
            await token.connect(bob).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to cheat by passing a different encrypted value
            const wrongEncryptedValue = await encryptValue(from, Number(value) * 2);

            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                wrongEncryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create an authorization to transfer money from Alice to Charlie, but
            // sign with Bob's key instead of Alice's
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                bob
            );

            // try to cheat by submitting the signed authorization that is signed by
            // a wrong person
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization that won't be valid until 10 seconds
            // later
            const validAfter = await nowPlusSeconds(10);
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization early
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "AuthorizationIsNotYetValid").withArgs(validAfter);
        });

        it("reverts if the authorization is expired", async () => {
            const { from, to, value, validAfter } = receiveParams;
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization that expires immediately
            const validBefore = await nowPlusSeconds(0);
            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization that is expired
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            );
            await bite.sendCallback();

            // try to submit the authorization again
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            // create a signed authorization
            const authorization = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // submit the authorization
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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
            const smallerEncryptedValue = await encryptValue(from, 1e6);
            const authorization2 = await signEncryptedReceiveAuthorization(
                from,
                to,
                smallerEncryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                smallerEncryptedValue,
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
            const encryptedValue = await encryptValue(from, value);

            const { v, r, s } = await signEncryptedReceiveAuthorization(
                from,
                to,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the authorization with invalid transfer parameters
            // Should succeed because only executed on callback
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                from,
                to,
                encryptedValue,
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

        it("reverts if the authorization is not for encryptedReceiveWithAuthorization", async () => {
            const {
                from: owner,
                to: spender,
                value,
                validAfter,
                validBefore,
            } = receiveParams;
            const encryptedValue = await encryptValue(owner, value);

            // create a signed authorization for a transfer (wrong type)
            const { v, r, s } = await signEncryptedTransferAuthorization(
                owner,
                spender,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                domainSeparator,
                alice
            );

            // try to submit the transfer authorization as a receive
            await token.connect(charlie).encryptedReceiveWithAuthorization(
                owner,
                spender,
                encryptedValue,
                validAfter,
                validBefore,
                nonce,
                v,
                r,
                s
            ).should.be.revertedWithCustomError(token, "InvalidSignature");
        });
    });
});

interface Signature {
    v: number;
    r: string;
    s: string;
}

const signEncryptedTransferAuthorization = async (
    from: AddressLike,
    to: AddressLike,
    value: BytesLike,
    validAfter: BigNumberish,
    validBefore: BigNumberish,
    nonce: string,
    domainSeparator: string,
    signer: BaseWallet
): Promise<Signature> => {
    return signEncryptedEIP712(
        domainSeparator,
        ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
        signer
    );
};

async function signEncryptedReceiveAuthorization(
    from: AddressLike,
    to: AddressLike,
    value: BytesLike,
    validAfter: BigNumberish,
    validBefore: BigNumberish,
    nonce: string,
    domainSeparator: string,
    signer: BaseWallet
): Promise<Signature> {
    return signEncryptedEIP712(
        domainSeparator,
        ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
        signer
    );
}

const signEncryptedEIP712 = async (
    domainSeparator: string,
    typeHash: string,
    from: AddressLike,
    to: AddressLike,
    value: BytesLike,
    validAfter: BigNumberish,
    validBefore: BigNumberish,
    nonce: string,
    signer: BaseWallet
): Promise<Signature> => {
    // The contract uses keccak256(value) for bytes encoding in the struct hash
    const structHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ["bytes32", "address", "address", "bytes32", "uint256", "uint256", "bytes32"],
            [
                typeHash,
                await ethers.resolveAddress(from),
                await ethers.resolveAddress(to),
                ethers.keccak256(value),
                ethers.toBigInt(validAfter),
                ethers.toBigInt(validBefore),
                nonce
            ]
        )
    );

    const digest = ethers.keccak256(
        "0x1901" +
        strip0x(domainSeparator) +
        strip0x(structHash)
    );
    const signature = signer.signingKey.sign(ethers.getBytes(digest));
    return ethers.Signature.from(signature);
};

const strip0x = (v: string): string => {
    return v.replace(/^0x/, "");
};
