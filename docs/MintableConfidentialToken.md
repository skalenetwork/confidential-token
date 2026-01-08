# Solidity API

## MintableConfidentialToken

ConfidentialToken with minting functionality

### constructor

Constructor of the MintableConfidentialToken contract

```solidity
constructor(string name, string symbol, string version, address initialAuthority) public
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | string | Name of the token |
| symbol | string | Symbol of the token |
| version | string | Version of the token |
| initialAuthority | address | Initial authority address |

### mint

Mints new tokens to the specified address

```solidity
function mint(address to, uint256 amount) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address to mint tokens to |
| amount | uint256 | The amount of tokens to mint |

