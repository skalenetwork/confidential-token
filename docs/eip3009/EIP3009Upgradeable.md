# Solidity API

## EIP3009Upgradeable

ERC20 token with transfer and receive with authorization functionality

### TRANSFER_WITH_AUTHORIZATION_TYPEHASH

typehash for transfer with authorization

```solidity
bytes32 TRANSFER_WITH_AUTHORIZATION_TYPEHASH
```

### RECEIVE_WITH_AUTHORIZATION_TYPEHASH

typehash for receiving with authorization

```solidity
bytes32 RECEIVE_WITH_AUTHORIZATION_TYPEHASH
```

### CANCEL_AUTHORIZATION_TYPEHASH

typehash for canceling an authorization

```solidity
bytes32 CANCEL_AUTHORIZATION_TYPEHASH
```

### _authorizationStates

```solidity
mapping(address => mapping(bytes32 => bool)) _authorizationStates
```

**dev:** _authorizer address => nonce => state (true = used / false = unused)_

### AuthorizationUsed

Emitted when an authorization is used

```solidity
event AuthorizationUsed(address authorizer, bytes32 nonce)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| authorizer | address | Authorizer's address |
| nonce | bytes32 | Nonce of the authorization |

### AuthorizationCanceled

Emitted when an authorization is canceled

```solidity
event AuthorizationCanceled(address authorizer, bytes32 nonce)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| authorizer | address | Authorizer's address |
| nonce | bytes32 | Nonce of the authorization |

### InvalidSignature

```solidity
error InvalidSignature()
```

### AuthorizationIsNotYetValid

```solidity
error AuthorizationIsNotYetValid(uint256 validAfter)
```

### AuthorizationIsExpired

```solidity
error AuthorizationIsExpired(uint256 validBefore)
```

### AuthorizationUsedError

```solidity
error AuthorizationUsedError(address authorizer, bytes32 nonce)
```

### CallerMustBeThePayee

```solidity
error CallerMustBeThePayee(address caller, address payee)
```

### transferWithAuthorization

Execute a transfer with a signed authorization

```solidity
function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Payer's address (Authorizer) |
| to | address | Payee's address |
| value | uint256 | Amount to be transferred |
| validAfter | uint256 | The time after which this is valid (unix time) |
| validBefore | uint256 | The time before which this is valid (unix time) |
| nonce | bytes32 | Unique nonce |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

### receiveWithAuthorization

Receive a transfer with a signed authorization from the payer

```solidity
function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external
```

**dev:** _This has an additional check to ensure that the payee's address matches
the caller of this function to prevent front-running attacks. (See security
considerations)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Payer's address (Authorizer) |
| to | address | Payee's address |
| value | uint256 | Amount to be transferred |
| validAfter | uint256 | The time after which this is valid (unix time) |
| validBefore | uint256 | The time before which this is valid (unix time) |
| nonce | bytes32 | Unique nonce |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

### cancelAuthorization

Attempt to cancel an authorization

```solidity
function cancelAuthorization(address authorizer, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| authorizer | address | Authorizer's address |
| nonce | bytes32 | Nonce of the authorization |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

### authorizationState

Returns the state of an authorization

```solidity
function authorizationState(address authorizer, bytes32 nonce) external view returns (bool used)
```

**dev:** _Nonces are randomly generated 32-byte data unique to the authorizer's
address_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| authorizer | address | Authorizer's address |
| nonce | bytes32 | Nonce of the authorization |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| used | bool | True if the nonce is used |

### __EIP3009_init

```solidity
function __EIP3009_init() internal
```

### _transferWithAuthorization

Internal function to execute transfer with authorization

```solidity
function _transferWithAuthorization(bytes32 typeHash, address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) internal
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| typeHash | bytes32 | Type hash of the authorization |
| from | address | Payer's address (Authorizer) |
| to | address | Payee's address |
| value | uint256 | Amount to be transferred |
| validAfter | uint256 | The time after which this is valid (unix time) |
| validBefore | uint256 | The time before which this is valid (unix time) |
| nonce | bytes32 | Unique nonce |
| v | uint8 | v of the signature |
| r | bytes32 | r of the signature |
| s | bytes32 | s of the signature |

