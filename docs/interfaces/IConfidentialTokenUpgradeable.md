# Solidity API

## IConfidentialTokenUpgradeable

Initializer interface for upgradeable confidential token deployments.

### initialize

Initializes the contract for proxy deployment.

```solidity
function initialize(string name_, string symbol_, string version_, address initialAuthority) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string | Name of the token. |
| symbol_ | string | Symbol of the token. |
| version_ | string | Version of the contract. |
| initialAuthority | address | Address of AccessManager initial authority. |

