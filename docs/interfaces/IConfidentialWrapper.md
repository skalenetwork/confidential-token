# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

### depositForWithGasToken

depositFor like function that allows to top up gas token wallet in the same transaction

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

### withdrawToWithGasToken

withdrawTo like function that allows to top up gas token wallet in the same transaction

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

