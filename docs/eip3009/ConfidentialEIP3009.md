# Solidity API

## ConfidentialEIP3009

Extension of EIP3009 with encrypted value parameter for SKALE chains using BITE

### ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH

typehash for transfer with authorization with encrypted value

```solidity
bytes32 ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH
```

### ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH

typehash for receiving with authorization with encrypted value

```solidity
bytes32 ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH
```

### encryptedTransferWithAuthorization

Execute a transfer with a signed authorization

```solidity
function encryptedTransferWithAuthorization(address from, address to, bytes value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Payer's address (Authorizer) |
| to | address | Payee's address |
| value | bytes | Amount to be transferred (TE-encrypted) |
| validAfter | uint256 | The time after which this is valid (unix time) |
| validBefore | uint256 | The time before which this is valid (unix time) |
| nonce | bytes32 | Unique nonce |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

### encryptedReceiveWithAuthorization

Receive a transfer with a signed authorization from the payer

```solidity
function encryptedReceiveWithAuthorization(address from, address to, bytes value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external payable
```

**dev:** _This has an additional check to ensure that the payee's address matches
the caller of this function to prevent front-running attacks. (See security
considerations)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Payer's address (Authorizer) |
| to | address | Payee's address |
| value | bytes | Amount to be transferred (TE-encrypted) |
| validAfter | uint256 | The time after which this is valid (unix time) |
| validBefore | uint256 | The time before which this is valid (unix time) |
| nonce | bytes32 | Unique nonce |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

### __ConfidentialEIP3009_init

```solidity
function __ConfidentialEIP3009_init() internal
```

### _transferWithAuthorization

Internal function to execute transfer with authorization

```solidity
function _transferWithAuthorization(bytes32 typeHash, address from, address to, bytes value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) internal
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| typeHash | bytes32 | Type hash of the authorization |
| from | address | Payer's address (Authorizer) |
| to | address | Payee's address |
| value | bytes | Amount to be transferred |
| validAfter | uint256 | The time after which this is valid (unix time) |
| validBefore | uint256 | The time before which this is valid (unix time) |
| nonce | bytes32 | Unique nonce |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

### _encryptedTransfer

```solidity
function _encryptedTransfer(address from, address to, bytes value) internal virtual
```

