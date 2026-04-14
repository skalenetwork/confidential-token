# Solidity API

## IConfidentialToken

Interface of the ConfidentialToken contract

### CallbackFeeChanged

Emitted when callback fee is changed

```solidity
event CallbackFeeChanged(uint256 newFee)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint256 | New callback fee |

### CTXResubmitted

Emitted when a CTX is resubmitted due to outdated decrypted information

```solidity
event CTXResubmitted(address callbackSender)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| callbackSender | address | Address of the CTX sender that triggered the resubmission |

### EthBalanceToppedUp

Emitted when ETH balance is topped up

```solidity
event EthBalanceToppedUp(address sender, address receiver, uint256 value)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | Address of the sender |
| receiver | address | Address of the receiver |
| value | uint256 | Amount of ETH topped up |

### EthWithdrawn

Emitted when ETH is withdrawn

```solidity
event EthWithdrawn(address receiver, uint256 value)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | Address of the receiver |
| value | uint256 | Amount of ETH withdrawn |

### Transfer

Emitted when tokens (value omitted) are moved from one account (`from`) to another (`to`)

```solidity
event Transfer(address from, address to)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address tokens are moved from |
| to | address | Address tokens are moved to |

### SubmitCTXAddressChanged

Emitted when SubmitCTX precompiled contract address is changed

```solidity
event SubmitCTXAddressChanged(address newAddress)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the SubmitCTX precompiled contract |

### EncryptECIESAddressChanged

Emitted when EncryptECIES precompiled contract address is changed

```solidity
event EncryptECIESAddressChanged(address newAddress)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the EncryptECIES precompiled contract |

### EncryptTEAddressChanged

Emitted when EncryptTE precompiled contract address is changed

```solidity
event EncryptTEAddressChanged(address newAddress)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the EncryptTE precompiled contract |

### EncryptedTransfer

Emitted when a transfer is made

```solidity
event EncryptedTransfer(uint256 transferId, address from, address to, bytes encryptedData)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| transferId | uint256 | ID of the transfer |
| from | address | Address of the sender |
| to | address | Address of the recipient |
| encryptedData | bytes | TE-Encrypted data of the transfer |

### ReEncryptedTransfer

Emitted when a transfer event is decrypted for a viewer.

```solidity
event ReEncryptedTransfer(address viewer, address from, address to, bytes encryptedValue)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | The account who paid and had rights for the decryption of the transfer event. |
| from | address | Address of the sender. |
| to | address | Address of the recipient. |
| encryptedValue | bytes | ECIES-encrypted transfer value for `viewer`. |

### HistoricViewPermissionsRevoked

Emitted when a holder revokes all historic view permissions for a viewer.

```solidity
event HistoricViewPermissionsRevoked(address holder, address viewer)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | Address of the holder revoking access. |
| viewer | address | Address of the viewer whose permissions are revoked. |

### HistoricViewTransferIdRevoked

Emitted when a holder revokes a viewer's access to a specific transfer.

```solidity
event HistoricViewTransferIdRevoked(address holder, address viewer, uint256 transferId)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | Address of the holder revoking access. |
| viewer | address | Address of the viewer losing access. |
| transferId | uint256 | ID of the transfer being revoked. |

### HistoricViewTransferIdAuthorized

Emitted when a holder grants a viewer access to a specific transfer.

```solidity
event HistoricViewTransferIdAuthorized(address holder, address viewer, uint256 transferId)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | Address of the holder granting access. |
| viewer | address | Address of the viewer receiving access. |
| transferId | uint256 | ID of the transfer being authorized. |

### HistoricViewTimeRangeAuthorized

Emitted when a holder grants a viewer access to transfers within a time range.

```solidity
event HistoricViewTimeRangeAuthorized(address holder, address viewer, uint256 fromTimestamp, uint256 toTimestamp)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | Address of the holder granting access. |
| viewer | address | Address of the viewer receiving access. |
| fromTimestamp | uint256 | Non-inclusive lower bound of the authorized time range. |
| toTimestamp | uint256 | Non-inclusive upper bound of the authorized time range. |

### TransferValueEncryptedForRecipient

Emitted during a transfer when the recipient has a registered public key

```solidity
event TransferValueEncryptedForRecipient(address from, address to, bytes encryptedValue)
```

**dev:** _Emitted automatically at transfer time — no explicit request or fee required_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address of the sender |
| to | address | Address of the recipient — also the holder of the decryption key |
| encryptedValue | bytes | ECIES-Encrypted transfer value for `to` Public Key |

### PublicKeyRegistered

Emitted when a public key is registered for a viewer address

```solidity
event PublicKeyRegistered(address viewer)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | Address of the viewer whose public key is registered |

### ViewerChanged

Emitted when a viewer is changed for a holder

```solidity
event ViewerChanged(address holder, address newViewer)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | Address of the holder whose viewer is changed |
| newViewer | address | Address of the new viewer |

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

### requestDecryptHistoricTransfer

Requests decryption of a single historic encrypted transfer payload

```solidity
function requestDecryptHistoricTransfer(bytes encryptedTransferData) external
```

**dev:** _Charges callbackFee from msg.sender even if not authorized to decrypt the payload_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| encryptedTransferData | bytes | TE-encrypted transfer payload emitted by the token |

### removeHistoricViewAuth

Removes all historic view permissions for a viewer for msg.sender's history

```solidity
function removeHistoricViewAuth(address viewer) external returns (bool success)
```

**dev:** _Resets time window and clears explicitly authorized transfer IDs_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | Address whose historic view permissions are removed |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | Always returns true |

### removeHistoricViewTransferId

Removes one explicitly authorized historic transfer ID for a viewer

```solidity
function removeHistoricViewTransferId(address viewer, uint256 transferId) external returns (bool success)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | Address whose transferId authorization is removed |
| transferId | uint256 | Transfer ID to revoke |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | Always returns true |

### authorizeHistoricViewTimeRange

Authorizes a viewer to decrypt transfers from msg.sender within a time range
setting fromTimestamp >= toTimestamp means no time range is authorized

```solidity
function authorizeHistoricViewTimeRange(address viewer, uint256 fromTimestamp, uint256 toTimestamp) external returns (bool success)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | Address to authorize |
| fromTimestamp | uint256 | Non-inclusive lower bound timestamp |
| toTimestamp | uint256 | Non-inclusive upper bound timestamp |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | Always returns true |

### authorizeHistoricViewTransferId

Authorizes a viewer to decrypt one historic transfer by transfer ID

```solidity
function authorizeHistoricViewTransferId(address viewer, uint256 transferId) external returns (bool success)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | Address to authorize |
| transferId | uint256 | Transfer ID to authorize |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool | Always returns true |

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

