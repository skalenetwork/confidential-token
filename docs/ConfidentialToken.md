# Solidity API

## ConfidentialToken

ERC20-like token with encrypted balances

### decryptAndExecuteAddress

Address of the DecryptAndExecute precompiled contract

```solidity
address decryptAndExecuteAddress
```

### Transferred

Emitted when tokens are transferred, including mints and burns

```solidity
event Transferred()
```

### ValueIsEncrypted

```solidity
error ValueIsEncrypted()
```

### AccessViolation

```solidity
error AccessViolation()
```

### DecryptionBadFormat

```solidity
error DecryptionBadFormat()
```

### InsufficientBalance

```solidity
error InsufficientBalance()
```

### constructor

Sets the values for {name} and {symbol}.

```solidity
constructor(string name_, string symbol_) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string | Name of the token |
| symbol_ | string | Symbol of the token |

### onDecrypt

Called by the DecryptAndExecute precompiled contract after decryption

```solidity
function onDecrypt(bytes[] decryptedArguments, bytes[] plaintextArguments) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| decryptedArguments | bytes[] | The decrypted arguments |
| plaintextArguments | bytes[] | The plaintext arguments |

### totalSupply

```solidity
function totalSupply() public view returns (uint256 supply)
```

**dev:** _Returns the value of tokens in existence._

### balanceOf

```solidity
function balanceOf(address) public pure returns (uint256)
```

**dev:** _Returns the value of tokens owned by `account`._

### _decryptedUpdate

Internal function to handle decrypted balance updates

```solidity
function _decryptedUpdate(address from, address to, uint256 fromBalance, uint256 toBalance, uint256 value) internal
```

**dev:** _Alternative implementation of _update function from ERC20_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| fromBalance | uint256 | Decrypted balance of the `from` address |
| toBalance | uint256 | Decrypted balance of the `to` address |
| value | uint256 | Amount of tokens to be transferred |

### _update

Transfers a `value` amount of tokens from `from` to `to`
or alternatively mints (or burns) if `from` (or `to`) is the zero address.

```solidity
function _update(address from, address to, uint256 value) internal view
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | uint256 | Amount of tokens to be transferred |

