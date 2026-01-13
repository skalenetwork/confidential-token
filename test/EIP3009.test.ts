// cspell:words typehash

import { ethers } from "hardhat";
import { AddressLike, BigNumberish, Wallet } from "ethers";
import { expect } from "chai";
import { BiteMock, ConfidentialToken } from "../typechain-types";
import { withMintedTokens } from "./tools/fixtures";
import { getPublicKey } from "./tools/cryptography";
import { balanceOf } from "./tools/helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { PRIVATE_KEYS } from "./tools/constants";

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
  let deployer: HardhatEthersSigner;
  let alice: Wallet;
  let bob: Wallet;
  let charlie: Wallet;
  let nonce: string;
  const initialBalance = 10e6;

  before(async () => {
    [deployer] = await ethers.getSigners();
    [alice, bob, charlie] = PRIVATE_KEYS.slice(0, 3).map((key => new Wallet(key).connect(ethers.provider)));
  });

  beforeEach(async () => {
    const { bite: deployedBite, token: deployedToken } = await withMintedTokens();
    bite = deployedBite;
    token = deployedToken;
    domainSeparator = await token.DOMAIN_SEPARATOR();
    nonce = ethers.hexlify(ethers.randomBytes(32));

    await token.registerPublicKey(await getPublicKey(alice));
    await token.registerPublicKey(await getPublicKey(bob));

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
    from: Wallet;
    to: Wallet;
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
      await token.connect(charlie).deposit(charlie.address, { value: ethers.parseEther("0.3") });
      // a third-party, Charlie (not Alice) submits the signed authorization
      const result = await token.connect(charlie).transferWithAuthorization(
        from,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
        v,
        r,
        s,
      );

      // // check that balance is updated
      // expect((await balanceOf(token, bite, from))).to.equal(
      //   initialBalance - value
      // );
      // expect((await balanceOf(token, bite, to))).to.equal(value);

      // // check that AuthorizationUsed event is emitted
      // const log0 = result.logs[0] as Truffle.TransactionLog<AuthorizationUsed>;
      // expect(log0.event).to.equal("AuthorizationUsed");
      // expect(log0.args[0]).to.equal(from);
      // expect(log0.args[1]).to.equal(nonce);

      // // check that Transfer event is emitted
      // const log1 = result.logs[1] as Truffle.TransactionLog<Transfer>;
      // expect(log1.event).to.equal("Transfer");
      // expect(log1.args[0]).to.equal(from);
      // expect(log1.args[1]).to.equal(to);
      // expect(log1.args[2].toNumber()).to.equal(value);

      // // check that the authorization is now used
      // expect(await token.authorizationState(from, nonce)).to.be.true;
    });

  //   it("reverts if the signature does not match given parameters", async () => {
  //     const { from, to, value, validAfter, validBefore } = transferParams;
  //     // create a signed authorization
  //     const { v, r, s } = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to cheat by claiming the transfer amount is double
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value * 2, // pass incorrect value
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "invalid signature"
  //     );
  //   });

  //   it("reverts if the signature is not signed with the right key", async () => {
  //     const { from, to, value, validAfter, validBefore } = transferParams;
  //     // create an authorization to transfer money from Alice to Bob, but
  //     // sign with Bob's key instead of Alice's
  //     const { v, r, s } = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       bob.key
  //     );

  //     // try to cheat by submitting the signed authorization that is signed by
  //     // a wrong person
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "invalid signature"
  //     );
  //   });

  //   it("reverts if the authorization is not yet valid", async () => {
  //     const { from, to, value, validBefore } = transferParams;
  //     // create a signed authorization that won't be valid until 10 seconds
  //     // later
  //     const validAfter = Math.floor(Date.now() / 1000) + 10;
  //     const { v, r, s } = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization early
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "authorization is not yet valid"
  //     );
  //   });

  //   it("reverts if the authorization is expired", async () => {
  //     // create a signed authorization that expires immediately
  //     const { from, to, value, validAfter } = transferParams;
  //     const validBefore = Math.floor(Date.now() / 1000);
  //     const { v, r, s } = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization that is expired
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "authorization is expired"
  //     );
  //   });

  //   it("reverts if the authorization has already been used", async () => {
  //     const { from, to, validAfter, validBefore } = transferParams;
  //     // create a signed authorization
  //     const value = 1e6;
  //     const { v, r, s } = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // submit the authorization
  //     await token.transferWithAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       v,
  //       r,
  //       s,
  //       { from: charlie }
  //     );

  //     // try to submit the authorization again
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });

  //   it("reverts if the authorization has a nonce that has already been used by the signer", async () => {
  //     const { from, to, value, validAfter, validBefore } = transferParams;
  //     // create a signed authorization
  //     const authorization = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // submit the authorization
  //     await token.transferWithAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       authorization.v,
  //       authorization.r,
  //       authorization.s,
  //       { from: charlie }
  //     );

  //     // create another authorization with the same nonce, but with different
  //     // parameters
  //     const authorization2 = signTransferAuthorization(
  //       from,
  //       to,
  //       1e6,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization again
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         1e6,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         authorization2.v,
  //         authorization2.r,
  //         authorization2.s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });

  //   it("reverts if the authorization includes invalid transfer parameters", async () => {
  //     const { from, to, validAfter, validBefore } = transferParams;
  //     // create a signed authorization that attempts to transfer an amount
  //     // that exceeds the sender's balance
  //     const value = initialBalance + 1;
  //     const { v, r, s } = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization with invalid transfer parameters
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "transfer amount exceeds balance"
  //     );
  //   });

  //   it("reverts if the authorization is not for transferWithAuthorization", async () => {
  //     const {
  //       from: owner,
  //       to: spender,
  //       value,
  //       validAfter,
  //       validBefore,
  //     } = transferParams;
  //     // create a signed authorization for an approval (granting allowance)
  //     const { v, r, s } = signReceiveAuthorization(
  //       owner,
  //       spender,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the approval authorization
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         owner,
  //         spender,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "invalid signature"
  //     );
  //   });
  });

  // describe("receiveWithAuthorization", () => {
  //   const receiveParams = {
  //     from: alice.address,
  //     to: charlie,
  //     value: 7e6,
  //     validAfter: 0,
  //     validBefore: MAX_UINT256,
  //   };

  //   it("executes a transfer when a valid authorization is submitted by the payee", async () => {
  //     const { from, to, value, validAfter, validBefore } = receiveParams;
  //     // create a receive authorization to transfer money from Alice to Charlie
  //     // and sign with Alice's key
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // check initial balance
  //     expect((await token.balanceOf(from)).toNumber()).to.equal(10e6);
  //     expect((await token.balanceOf(to)).toNumber()).to.equal(0);

  //     expect(await token.authorizationState(from, nonce)).to.be.false;

  //     // The payee submits the signed authorization
  //     const result = await token.receiveWithAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       v,
  //       r,
  //       s,
  //       { from: charlie }
  //     );

  //     // check that balance is updated
  //     expect((await token.balanceOf(from)).toNumber()).to.equal(
  //       initialBalance - value
  //     );
  //     expect((await token.balanceOf(to)).toNumber()).to.equal(value);

  //     // check that AuthorizationUsed event is emitted
  //     const log0 = result.logs[0] as Truffle.TransactionLog<AuthorizationUsed>;
  //     expect(log0.event).to.equal("AuthorizationUsed");
  //     expect(log0.args[0]).to.equal(from);
  //     expect(log0.args[1]).to.equal(nonce);

  //     // check that Transfer event is emitted
  //     const log1 = result.logs[1] as Truffle.TransactionLog<Transfer>;
  //     expect(log1.event).to.equal("Transfer");
  //     expect(log1.args[0]).to.equal(from);
  //     expect(log1.args[1]).to.equal(to);
  //     expect(log1.args[2].toNumber()).to.equal(value);

  //     // check that the authorization is now used
  //     expect(await token.authorizationState(from, nonce)).to.be.true;
  //   });

  //   it("reverts if the caller is not the payee", async () => {
  //     const { from, to, value, validAfter, validBefore } = receiveParams;
  //     // create a signed authorization
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // check initial balance
  //     expect((await token.balanceOf(from)).toNumber()).to.equal(10e6);
  //     expect((await token.balanceOf(to)).toNumber()).to.equal(0);

  //     expect(await token.authorizationState(from, nonce)).to.be.false;

  //     // The payee submits the signed authorization
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: deployer }
  //       ),
  //       "caller must be the payee"
  //     );
  //   });

  //   it("reverts if the signature does not match given parameters", async () => {
  //     const { from, to, value, validAfter, validBefore } = receiveParams;
  //     // create a signed authorization
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to cheat by claiming the transfer amount is double
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value * 2, // pass incorrect value
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "invalid signature"
  //     );
  //   });

  //   it("reverts if the signature is not signed with the right key", async () => {
  //     const { from, to, value, validAfter, validBefore } = receiveParams;
  //     // create an authorization to transfer money from Alice to Bob, but
  //     // sign with Bob's key instead of Alice's
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       bob.key
  //     );

  //     // try to cheat by submitting the signed authorization that is signed by
  //     // a wrong person
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "invalid signature"
  //     );
  //   });

  //   it("reverts if the authorization is not yet valid", async () => {
  //     const { from, to, value, validBefore } = receiveParams;
  //     // create a signed authorization that won't be valid until 10 seconds
  //     // later
  //     const validAfter = Math.floor(Date.now() / 1000) + 10;
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization early
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "authorization is not yet valid"
  //     );
  //   });

  //   it("reverts if the authorization is expired", async () => {
  //     // create a signed authorization that expires immediately
  //     const { from, to, value, validAfter } = receiveParams;
  //     const validBefore = Math.floor(Date.now() / 1000);
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization that is expired
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "authorization is expired"
  //     );
  //   });

  //   it("reverts if the authorization has already been used", async () => {
  //     const { from, to, validAfter, validBefore } = receiveParams;
  //     // create a signed authorization
  //     const value = 1e6;
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // submit the authorization
  //     await token.receiveWithAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       v,
  //       r,
  //       s,
  //       { from: charlie }
  //     );

  //     // try to submit the authorization again
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });

  //   it("reverts if the authorization has a nonce that has already been used by the signer", async () => {
  //     const { from, to, value, validAfter, validBefore } = receiveParams;
  //     // create a signed authorization
  //     const authorization = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // submit the authorization
  //     await token.receiveWithAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       authorization.v,
  //       authorization.r,
  //       authorization.s,
  //       { from: charlie }
  //     );

  //     // create another authorization with the same nonce, but with different
  //     // parameters
  //     const authorization2 = signReceiveAuthorization(
  //       from,
  //       to,
  //       1e6,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization again
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         1e6,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         authorization2.v,
  //         authorization2.r,
  //         authorization2.s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });

  //   it("reverts if the authorization includes invalid transfer parameters", async () => {
  //     const { from, to, validAfter, validBefore } = receiveParams;
  //     // create a signed authorization that attempts to transfer an amount
  //     // that exceeds the sender's balance
  //     const value = initialBalance + 1;
  //     const { v, r, s } = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the authorization with invalid transfer parameters
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "transfer amount exceeds balance"
  //     );
  //   });

  //   it("reverts if the authorization is not for receiveWithAuthorization", async () => {
  //     const {
  //       from: owner,
  //       to: spender,
  //       value,
  //       validAfter,
  //       validBefore,
  //     } = receiveParams;
  //     // create a signed authorization for an approval (granting allowance)
  //     const { v, r, s } = signTransferAuthorization(
  //       owner,
  //       spender,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // try to submit the approval authorization
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         owner,
  //         spender,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         v,
  //         r,
  //         s,
  //         { from: charlie }
  //       ),
  //       "invalid signature"
  //     );
  //   });
  // });

  // describe("cancelAuthorization", () => {
  //   it("cancels an unused transfer authorization if the signature is valid", async () => {
  //     const from = alice.address;
  //     const to = bob.address;
  //     const value = 7e6;
  //     const validAfter = 0;
  //     const validBefore = MAX_UINT256;

  //     // create a signed authorization
  //     const authorization = signTransferAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // create cancellation
  //     const cancellation = signCancelAuthorization(
  //       from,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // check that the authorization is unused
  //     expect(await token.authorizationState(from, nonce)).to.be.false;

  //     // cancel the authorization
  //     await token.cancelAuthorization(
  //       from,
  //       nonce,
  //       cancellation.v,
  //       cancellation.r,
  //       cancellation.s,
  //       { from: charlie }
  //     );

  //     // check that the authorization is now used
  //     expect(await token.authorizationState(from, nonce)).to.be.true;

  //     // attempt to use the canceled authorization
  //     await expectRevert(
  //       token.transferWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         authorization.v,
  //         authorization.r,
  //         authorization.s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });

  //   it("cancels an unused receive authorization if the signature is valid", async () => {
  //     const from = alice.address;
  //     const to = charlie;
  //     const value = 7e6;
  //     const validAfter = 0;
  //     const validBefore = MAX_UINT256;

  //     // create a signed authorization
  //     const authorization = signReceiveAuthorization(
  //       from,
  //       to,
  //       value,
  //       validAfter,
  //       validBefore,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // create cancellation
  //     const cancellation = signCancelAuthorization(
  //       from,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // check that the authorization is unused
  //     expect(await token.authorizationState(from, nonce)).to.be.false;

  //     // cancel the authorization
  //     await token.cancelAuthorization(
  //       from,
  //       nonce,
  //       cancellation.v,
  //       cancellation.r,
  //       cancellation.s,
  //       { from: charlie }
  //     );

  //     // check that the authorization is now used
  //     expect(await token.authorizationState(from, nonce)).to.be.true;

  //     // attempt to use the canceled authorization
  //     await expectRevert(
  //       token.receiveWithAuthorization(
  //         from,
  //         to,
  //         value,
  //         validAfter,
  //         validBefore,
  //         nonce,
  //         authorization.v,
  //         authorization.r,
  //         authorization.s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });

  //   it("reverts if the authorization is already canceled", async () => {
  //     // create cancellation
  //     const cancellation = signCancelAuthorization(
  //       alice.address,
  //       nonce,
  //       domainSeparator,
  //       alice.key
  //     );

  //     // submit the cancellation
  //     await token.cancelAuthorization(
  //       alice.address,
  //       nonce,
  //       cancellation.v,
  //       cancellation.r,
  //       cancellation.s,
  //       { from: charlie }
  //     );

  //     // try to submit the same cancellation again
  //     await expectRevert(
  //       token.cancelAuthorization(
  //         alice.address,
  //         nonce,
  //         cancellation.v,
  //         cancellation.r,
  //         cancellation.s,
  //         { from: charlie }
  //       ),
  //       "authorization is used"
  //     );
  //   });
  // });
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
  signer: Wallet
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
      nonce
    ],
    signer
  );
}

// function signReceiveAuthorization(
//   from: string,
//   to: string,
//   value: number | string,
//   validAfter: number | string,
//   validBefore: number | string,
//   nonce: string,
//   domainSeparator: string,
//   privateKey: string
// ): Signature {
//   return signEIP712(
//     domainSeparator,
//     RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
//     ["address", "address", "uint256", "uint256", "uint256", "bytes32"],
//     [from, to, value, validAfter, validBefore, nonce],
//     privateKey
//   );
// }

// export function signCancelAuthorization(
//   signer: string,
//   nonce: string,
//   domainSeparator: string,
//   privateKey: string
// ): Signature {
//   return signEIP712(
//     domainSeparator,
//     CANCEL_AUTHORIZATION_TYPEHASH,
//     ["address", "bytes32"],
//     [signer, nonce],
//     privateKey
//   );
// }

const signEIP712 = async (
  domainSeparator: string,
  typeHash: string,
  types: string[],
  parameters: (BigNumberish)[],
  signer: Wallet
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
}

const strip0x = (v: string): string => {
  return v.replace(/^0x/, "");
}
