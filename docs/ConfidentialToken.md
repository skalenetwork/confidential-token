# Solidity API

## ConfidentialToken

ERC20-like token with encrypted balances

### constructor

Sets the values for {name} and {symbol}.

```solidity
constructor(string name_, string symbol_, string version_, address initialAuthority) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string | Name of the token |
| symbol_ | string | Symbol of the token |
| version_ | string | Version of the contract |
| initialAuthority | address | Address of AccessManager initial authority |

