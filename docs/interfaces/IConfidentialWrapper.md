# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

### release

Releases the wrapped tokens to the caller
Almost never is used and is required only if callback call fails

```solidity
function release(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of tokens to release |

### unwrap

Unwraps the specified amount of confidential tokens into the underlying token

```solidity
function unwrap(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of tokens to unwrap |

### wrap

Wraps the specified amount of the underlying token into confidential tokens

```solidity
function wrap(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of tokens to wrap |

