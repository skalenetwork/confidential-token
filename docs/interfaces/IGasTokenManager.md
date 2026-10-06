# Solidity API

## IGasTokenManager

Interface of the GasTokenManager contract

### GasTokenBalanceToppedUp

Emitted when gas token balance is topped up

```solidity
event GasTokenBalanceToppedUp(address sender, address receiver, uint256 value)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | Address of the sender |
| receiver | address | Address of the receiver |
| value | uint256 | Amount of gas token topped up |

### GasTokenWithdrawn

Emitted when gas token is withdrawn

```solidity
event GasTokenWithdrawn(address receiver, uint256 value)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | Address of the receiver |
| value | uint256 | Amount of gas token withdrawn |

### receive

Allows the contract to receive gas token to pay for callback execution

```solidity
receive() external payable
```

### fundWithGasToken

Deposits gas token to any holder balance

```solidity
function fundWithGasToken(address receiver) external payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | The address of the receiver holder |

### retrieveGasToken

Withdraws gas token from the caller's balance

```solidity
function retrieveGasToken(uint256 amount, address payable receiver) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of gas token to withdraw |
| receiver | address payable | Address to send the withdrawn gas token to |

### gasTokenBalanceOf

Gets the gas token balance of a holder

```solidity
function gasTokenBalanceOf(address holder) external view returns (uint256 balance)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | The address of the holder |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 | The gas token balance of the holder |

