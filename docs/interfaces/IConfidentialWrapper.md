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

