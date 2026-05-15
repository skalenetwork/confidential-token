# Solidity API

## IMintableERC20

Interface of ERC20 with minting functionality

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

### burn

Burns tokens from the caller's account

```solidity
function burn(uint256 amount) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of tokens to burn |

