# Solidity API

## EIP712Utils

A library that provides EIP712 helper functions

### recover

Recover signer's address from a EIP712 signature

```solidity
function recover(bytes32 domainSeparator, uint8 v, bytes32 r, bytes32 s, bytes typeHashAndData) internal pure returns (address signer)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| domainSeparator | bytes32 | Domain separator |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |
| typeHashAndData | bytes | Type hash concatenated with data |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| signer | address | Signer's address |

