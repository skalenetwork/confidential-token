# Solidity API

## IConfidentialToken

Interface of the ConfidentialToken contract

### receive

Allows the contract to receive ETH to pay for callback execution

```solidity
receive() external payable
```

### deposit

Deposits ETH to any holder balance

```solidity
function deposit(address receiver) external payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | The address of the receiver holder |

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

### registerPublicKey

Registers the public key of any address

```solidity
function registerPublicKey(struct PublicKey publicKey) external
```

**dev:** _The address is calculated from the public key_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| publicKey | struct PublicKey | The public key to register |

### setCallbackFee

Sets number of ETH to be sent to pay for callback execution

```solidity
function setCallbackFee(uint256 newFee) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint256 | New callback fee |

### setEncryptECIESAddress

Sets the address of the EncryptECIES precompiled contract

```solidity
function setEncryptECIESAddress(address newAddress) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the EncryptECIES precompiled contract |

### setEncryptTEAddress

Sets the address of the EncryptTE precompiled contract

```solidity
function setEncryptTEAddress(address newAddress) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the EncryptTE precompiled contract |

### setSubmitCTXAddress

Sets the address of the SubmitCTX precompiled contract

```solidity
function setSubmitCTXAddress(address newAddress) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the SubmitCTX precompiled contract |

### withdraw

Withdraws ETH from the caller's balance

```solidity
function withdraw(uint256 amount, address receiver) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of ETH to withdraw |
| receiver | address | Address to send the withdrawn ETH to |

### encryptedBalanceOf

Gets the encrypted balance of a holder

```solidity
function encryptedBalanceOf(address holder) external view returns (bytes encryptedBalance)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | The address of the holder |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| encryptedBalance | bytes | The encrypted balance of the holder |

