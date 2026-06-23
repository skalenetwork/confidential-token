<!-- cspell:words ECIES -->
# Developer Notes

Practical how-to guides for integrating with Confidential Token contracts. These complement the high-level overview in [README.md](README.md) with concrete implementation details.

## Table of Contents

- [Encrypting a Transfer Value](#encrypting-a-transfer-value)

---

## Encrypting a Transfer Value

`encryptedTransfer(to, value)`, `encryptedTransferFrom(from, to, value)` and other transfer functions expect `value` to be a TE-encrypted bytes blob. There are two ways to produce it.

### Option 1 — On-chain via `encryptValue` (simple)

```solidity
bytes memory encryptedValue = token.encryptValue(msg.sender, amount);
token.encryptedTransfer(recipient, encryptedValue);
```

This is the easiest path. The downside is that `amount` travels as plaintext in the RPC call to `encryptValue`, which may be unacceptable when privacy at the network layer matters. This path is perfectly acceptable for PoCs, testing and demonstrations.

### Option 2 — Local encryption

To encrypt client-side you need to:

1. **Encode** the plaintext as `abi.encode(address salt, uint256 amount)` — always exactly 64 bytes.

   The `salt` must be the address of **the account submitting the transaction** (`msg.sender`):
   - For `encryptedTransfer`: salt = the token holder / sender (`msg.sender`).
   - For `encryptedTransferFrom`: salt = the spender (`msg.sender`), not `from`. Same for other delegated transfers.

   This binding prevents replaying another account's stored cipher-text as your own transfer value.
   Example:
   ```ts
   import { AbiCoder } from "ethers";

   const coder = AbiCoder.defaultAbiCoder();
   const plaintext = coder.encode(["address", "uint256"], [senderAddress, amount]);
   // plaintext is a 64-byte hex string
   ```

2. **Encrypt** using the bite-ts library.

   - You will need to use the [bite-ts](https://github.com/skalenetwork/bite-ts) library.

   Example:
   ```ts
   import { BITE } from '@skalenetwork/bite';

   const providerUrl = 'https://example.com/jsonrpc'; // Replace with your provider URL
   const bite = new BITE(providerUrl);
   const encryptedValue = bite.encryptMessageForCTX(plaintext, addressOfConfidentialToken);

   // plaintext is the value obtained from the previous step
   // addressOfConfidentialToken is the deployed address of the token you are submitting the value to.
   // The code pulls the shared threshold public key from the network, and encrypts the value locally.
   ```

