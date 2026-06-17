# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

### depositForWithGasToken

depositFor-like function
that allows the sender to top up their gas token balance in the same transaction

```solidity
function depositForWithGasToken(address account, uint256 value) external payable returns (bool success)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to credit the wrapped tokens to |
| value | uint256 | The amount of tokens to wrap |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | Whether the deposit was successful |

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

### withdrawToWithGasToken

withdrawTo-like function
that allows the sender to top up their gas token balance in the same transaction

```solidity
function withdrawToWithGasToken(address account, uint256 value) external payable returns (bool success)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to release the underlying tokens to |
| value | uint256 | The amount of tokens to release |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | Whether the withdrawal was successful |

