# Solidity API

## _wrapperName

```solidity
function _wrapperName(bool proxyMode, contract IERC20Metadata token) internal view returns (string name)
```

## _wrapperSymbol

```solidity
function _wrapperSymbol(bool proxyMode, contract IERC20Metadata token) internal view returns (string symbol)
```

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

### WrongInitializer

```solidity
error WrongInitializer()
```

### ZeroValue

```solidity
error ZeroValue()
```

### constructor

Sets up the contract for proxy or direct deployment.

```solidity
constructor(bool proxyMode, contract IERC20Metadata underlyingToken, string version_, address initialAuthority) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| proxyMode | bool | If true, disables initializers for proxy deployment.                  If false, initializes the contract directly. |
| underlyingToken | contract IERC20Metadata | Token to wrap confidentially. Ignored when proxyMode is true. |
| version_ | string | Version of the wrapper. Ignored when proxyMode is true. |
| initialAuthority | address | Initial authority address. Ignored when proxyMode is true. |

### initialize

Initializes the contract for proxy deployment.

```solidity
function initialize(contract IERC20Metadata underlyingToken, string version_, address initialAuthority) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| underlyingToken | contract IERC20Metadata | Token to wrap confidentially. |
| version_ | string | Version of the wrapper. |
| initialAuthority | address | Initial authority address. |

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

### __ConfidentialWrapper_init

```solidity
function __ConfidentialWrapper_init(contract IERC20Metadata underlyingToken, string version_, address initialAuthority) internal
```

### _handleAction

Dispatches decrypted CTX actions for wrapper-specific flows.

```solidity
function _handleAction(uint8 action, bytes[] decryptedArguments, bytes[] plaintextArguments) internal
```

**dev:** _Handles `_WITHDRAW_TO_ACTION` locally and delegates all other actions to
the base ConfidentialToken logic._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| action | uint8 | Action discriminator encoded in callback plaintext. |
| decryptedArguments | bytes[] | Decrypted callback arguments from BITE. |
| plaintextArguments | bytes[] | Plaintext callback arguments used for routing. |

### _burnTo

Schedules an async burn that releases underlying to `to` on callback.

```solidity
function _burnTo(address from, address to, uint256 value) internal
```

**dev:** _Encodes `to` as extra plaintext callback data for
`_handleWithdrawToRequest`._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address whose confidential balance is debited. |
| to | address | Recipient of the released underlying token. |
| value | uint256 | Amount to burn and unwrap. |

### _onUpdate

```solidity
function _onUpdate(address from, address to, uint256 value) internal
```

### _update

```solidity
function _update(address from, address to, uint256 value) internal
```

