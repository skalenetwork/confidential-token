# Solidity API

## GasTokenManager

This contract manages gas token balances for holders and allows them to fund and withdraw gas tokens

### InsufficientGasToken

```solidity
error InsufficientGasToken(uint256 required, uint256 available)
```

### receive

Allows the contract to receive gas token to pay for callback execution

```solidity
receive() external payable
```

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

### fundWithGasToken

Deposits gas token to any holder balance

```solidity
function fundWithGasToken(address receiver) public payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | The address of the receiver holder |

### _sendGasToken

```solidity
function _sendGasToken(address from, address payable to, uint256 value) internal
```

### _setLastGasTokenRefundReceiver

```solidity
function _setLastGasTokenRefundReceiver(address receiver) internal
```

