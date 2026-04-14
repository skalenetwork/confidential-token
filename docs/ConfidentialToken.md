# Solidity API

## ConfidentialToken

ERC20-like token with encrypted balances

### OnDecryptAction

```solidity
enum OnDecryptAction {
  TRANSFER,
  HISTORIC_VIEW
}
```

### TransferInfo

```solidity
struct TransferInfo {
  address from;
  address to;
  address spender;
  address gasPayer;
  uint256 submittedBlockNumber;
}
```

### callbackFee

Specifies number of ETH to be sent to pay for callback execution

```solidity
uint256 callbackFee
```

### encryptECIESAddress

Address of the EncryptECIES precompiled contract

```solidity
address encryptECIESAddress
```

### encryptTEAddress

Address of the EncryptTE precompiled contract

```solidity
address encryptTEAddress
```

### viewerAddresses

Mapping of holder addresses to their viewers' addresses

```solidity
mapping(address => address) viewerAddresses
```

### publicKeys

Mapping of addresses to their public keys

```solidity
mapping(address => struct PublicKey) publicKeys
```

### submitCTXAddress

Address of the submitCTX precompiled contract

```solidity
address submitCTXAddress
```

### version

Version of the contract

```solidity
string version
```

**dev:** _Is used to get proper ABI_

### AccessViolation

```solidity
error AccessViolation()
```

### ActionNotRecognized

```solidity
error ActionNotRecognized()
```

### InsufficientBalance

```solidity
error InsufficientBalance()
```

### InsufficientEth

```solidity
error InsufficientEth(uint256 required, uint256 available)
```

### InvalidPublicKey

```solidity
error InvalidPublicKey()
```

### InvalidTransferId

```solidity
error InvalidTransferId(uint256 transferId)
```

### NoViewerRegisteredForHolder

```solidity
error NoViewerRegisteredForHolder(address holder)
```

### PublicKeyIsNotRegistered

```solidity
error PublicKeyIsNotRegistered(address viewer)
```

### ValueIsEncrypted

```solidity
error ValueIsEncrypted()
```

### ValueWasNotEncryptedCorrectly

```solidity
error ValueWasNotEncryptedCorrectly()
```

### onlyRegisteredUser

Modifier to check if the user is registered

```solidity
modifier onlyRegisteredUser(address user)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | The address of the user to check |

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

### receive

Allows the contract to receive ETH to pay for callback execution

```solidity
receive() external payable
```

### burn

Burns tokens from the caller's balance

```solidity
function burn(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 |  |

### onDecrypt

Called by the DecryptAndExecute precompiled contract after decryption

```solidity
function onDecrypt(bytes[] decryptedArguments, bytes[] plaintextArguments) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| decryptedArguments | bytes[] | The decrypted arguments |
| plaintextArguments | bytes[] | The plaintext arguments |

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
| fromTimestamp | uint256 | Inclusive lower bound timestamp |
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

### setCallbackFee

Sets number of ETH to be sent to pay for callback execution

```solidity
function setCallbackFee(uint256 newFee) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint256 | New callback fee |

### setSubmitCTXAddress

Sets the address of the SubmitCTX precompiled contract

```solidity
function setSubmitCTXAddress(address newAddress) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the SubmitCTX precompiled contract |

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

### withdraw

Withdraws ETH from the caller's balance

```solidity
function withdraw(uint256 value, address receiver) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 |  |
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

### deposit

Deposits ETH to any holder balance

```solidity
function deposit(address receiver) public payable
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | The address of the receiver holder |

### transferFrom

Transfers `value` tokens from `from` to `to` using allowance mechanism.

```solidity
function transferFrom(address from, address to, uint256 value) public virtual returns (bool result)
```

**dev:** _This function call may return true and revert on callback producing no changes_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | uint256 | Amount of tokens to be transferred |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| result | bool | Always returns true |

### registerPublicKey

Registers a view key in the contract

```solidity
function registerPublicKey(struct PublicKey publicKey) public
```

**dev:** _Does not associate the public key with a holder_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| publicKey | struct PublicKey | The public key to register |

### setViewerAddress

Sets the address of the viewer allowed to view the sender's balance

```solidity
function setViewerAddress(address viewer) public payable
```

**dev:** _The viewer must be already registered in the system via registerPublicKey_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| viewer | address | The address of the viewer |

### totalSupply

```solidity
function totalSupply() public view virtual returns (uint256 supply)
```

**dev:** _Returns the value of tokens in existence._

### balanceOf

```solidity
function balanceOf(address) public pure virtual returns (uint256)
```

**dev:** _Returns the value of tokens owned by `account`._

### _handleTransferRequest

```solidity
function _handleTransferRequest(bytes[] decryptedArguments, bytes[] plaintextArguments) internal
```

### _decryptedUpdate

Internal function to handle decrypted balance updates

```solidity
function _decryptedUpdate(address from, address to, uint256 fromBalance, uint256 toBalance, uint256 value) internal
```

**dev:** _Alternative implementation of _update function from ERC20_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| fromBalance | uint256 | Decrypted balance of the `from` address |
| toBalance | uint256 | Decrypted balance of the `to` address |
| value | uint256 | Amount of tokens to be transferred |

### _onUpdate

```solidity
function _onUpdate(address from, address to, uint256 value) internal virtual
```

### _update

Transfers a `value` amount of tokens from `from` to `to`
or alternatively mints (or burns) if `from` (or `to`) is the zero address.

```solidity
function _update(address from, address to, uint256 value) internal virtual
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | uint256 | Amount of tokens to be transferred |

### _updateWithGasPayer

```solidity
function _updateWithGasPayer(address from, address to, address gasPayer, uint256 value) internal
```

### _encryptedUpdate

Transfers a `encryptedValue` amount of tokens from `from` to `to`
or alternatively mints (or burns) if `from` (or `to`) is the zero address.

```solidity
function _encryptedUpdate(address from, address to, address spender, address gasPayer, bytes encryptedValue) internal virtual
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| spender | address | Address of the spender for transferFrom operations |
| gasPayer | address | Address of the account paying for the gas |
| encryptedValue | bytes | TE-encrypted amount of tokens to be transferred |

### _transferFrom

```solidity
function _transferFrom(address from, address to, uint256 value) internal virtual
```

### _encryptedTransferFrom

```solidity
function _encryptedTransferFrom(address from, address to, bytes value) internal virtual
```

### _encryptedTransfer

Transfers a `encryptedValue` amount of tokens from `from` to `to`

```solidity
function _encryptedTransfer(address from, address to, bytes value) internal virtual
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | bytes | TE-encrypted amount of tokens to be transferred |

