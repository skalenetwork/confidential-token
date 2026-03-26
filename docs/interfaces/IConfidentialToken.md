# Solidity API

## IConfidentialToken

Interface of the ConfidentialToken contract

### receive

Allows the contract to receive ETH to pay for callback execution

```solidity
receive() external payable
```

### burn

Burns tokens from the caller's balance

```solidity
function burn(uint256 amount) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | The amount of tokens to burn |

### deposit

Deposits ETH to any holder balance

```solidity
function deposit(address receiver) external payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | The address of the receiver holder |

### setViewerPublicKey

Registers a view key for the message sender

```solidity
function setViewerPublicKey(struct PublicKey publicKey) external payable
```

**dev:** _Combination of registerPublicKey and setViewerAddress (payable version)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| publicKey | struct PublicKey | The public key to register |

### registerPublicKey

Registers a view key in the contract

```solidity
function registerPublicKey(struct PublicKey publicKey) external
```

**dev:** _Does not associate the public key with a holder_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| publicKey | struct PublicKey | The public key to register |

### setViewerAddress

Sets the address of the viewer allowed to view the sender's balance

```solidity
function setViewerAddress(address viewer) external payable
```

**dev:** _The viewer must be already registered in the system via registerPublicKey_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | The address of the viewer |

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

### encryptedTransfer

Transfers tokens to another holder

```solidity
function encryptedTransfer(address to, bytes value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address of the recipient holder |
| value | bytes | The TE-encrypted amount of tokens to transfer |

### encryptedTransferFrom

Transfers tokens from one holder to another using allowance

```solidity
function encryptedTransferFrom(address from, address to, bytes value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The address of the sender holder |
| to | address | The address of the recipient holder |
| value | bytes | The TE-encrypted amount of tokens to transfer |

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

### ethBalanceOf

Gets the ETH balance of a holder

```solidity
function ethBalanceOf(address holder) external view returns (uint256 balance)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | The address of the holder |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 | The ETH balance of the holder |

