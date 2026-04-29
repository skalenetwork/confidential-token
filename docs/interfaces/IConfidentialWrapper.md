# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

### releaseTo

Releases caller's pending wrapped tokens to a beneficiary account
Mostly used as a recovery path if a mint callback fails or is delayed

```solidity
function releaseTo(address account, uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to release tokens to |
| value | uint256 | The amount of tokens to release |

