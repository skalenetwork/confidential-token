# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

### releaseTo

Releases the wrapped tokens to the caller
Almost never is used and is required only if callback call fails

```solidity
function releaseTo(address account, uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to release tokens to |
| value | uint256 | The amount of tokens to release |

