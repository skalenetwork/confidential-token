# Solidity API

## ECRecover

A library that provides a safe ECDSA recovery function

### recover

Recover signer's address from a signed message

```solidity
function recover(bytes32 digest, uint8 v, bytes32 r, bytes32 s) internal pure returns (address)
```

**dev:** _Adapted from: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/65e4ffde586ec89af3b7e9140bdc9235d1254853/contracts/cryptography/ECDSA.sol
Modifications: Accept v, r, and s as separate arguments_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| digest | bytes32 | Keccak-256 hash digest of the signed message |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Signer address |

