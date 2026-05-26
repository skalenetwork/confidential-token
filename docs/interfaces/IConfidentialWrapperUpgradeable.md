# Solidity API

## IConfidentialWrapperUpgradeable

Initializer interface for upgradeable confidential wrapper deployments.

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

