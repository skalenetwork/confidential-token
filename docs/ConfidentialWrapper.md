# Solidity API

## ConfidentialWrapper

Confidential wrapper that adds confidentiality to an ERC20 token

### requestedMints

Amount of tokens requested to be wrapped

```solidity
mapping(address => uint256) requestedMints
```

**dev:** _Almost always equals to zero
Has non-zero value only before the callback call is made_

### OutdatedMint

```solidity
error OutdatedMint(address to, uint256 value)
```

### ZeroValue

```solidity
error ZeroValue()
```

### constructor

```solidity
constructor(contract IERC20Metadata underlyingToken, string version_, address initialAuthority) public
```

### releaseTo

Releases the caller's pending wrapped tokens to `account`.
Only the recipient of a prior `depositFor` (i.e. an address with a
non-zero `requestedMints` entry) can call this; the depositor cannot.

```solidity
function releaseTo(address account, uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to release the underlying tokens to |
| value | uint256 | The amount of tokens to release |

### burn

Burns caller's confidential wrapper balance and withdraws the
corresponding underlying amount to the caller.

```solidity
function burn(uint256 value) external
```

**dev:** _Wrapper-specific behavior: unlike base `ConfidentialToken.burn`, this
schedules an async burn callback that releases underlying in
`_handleWithdrawToRequest`._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | Amount of wrapped tokens to burn and unwrap. |

### transferFrom

Transfers `value` tokens from `from` to `to` using allowance mechanism.

```solidity
function transferFrom(address from, address to, uint256 value) public virtual returns (bool result)
```

**dev:** _This function call may return true and revert on callback producing no changes_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | uint256 | Amount of tokens to be transferred |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| result | bool | Always returns true |

### depositFor

```solidity
function depositFor(address account, uint256 value) public returns (bool success)
```

**dev:** _Pending mint accounting is keyed by the recipient `account`, so only
`account` can later call `releaseTo` for this deposit._

### withdrawTo

```solidity
function withdrawTo(address account, uint256 value) public returns (bool success)
```

**dev:** _This operation is asynchronous and finalizes in the callback. On
success, underlying tokens are sent to `account`._

### decimals

```solidity
function decimals() public view returns (uint8 decimalsValue)
```

### totalSupply

```solidity
function totalSupply() public view returns (uint256 supply)
```

**dev:** _Returns the value of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) public pure returns (uint256 balance)
```

**dev:** _Returns the value of tokens owned by `account`._

### _handleAction

```solidity
function _handleAction(uint8 action, bytes[] decryptedArguments, bytes[] plaintextArguments) internal
```

### _burnTo

```solidity
function _burnTo(address from, address to, uint256 value) internal
```

### _onUpdate

```solidity
function _onUpdate(address from, address to, uint256 value) internal
```

### _update

```solidity
function _update(address from, address to, uint256 value) internal
```

