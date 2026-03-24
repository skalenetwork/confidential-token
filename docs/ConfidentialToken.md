# Solidity API

## ConfidentialToken

ERC20-like token with encrypted balances

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

### CallbackFeeChanged

Emitted when callback fee is changed

```solidity
event CallbackFeeChanged(uint256 newFee)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint256 | New callback fee |

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

Emitted when `value` tokens are moved from one account (`from`) to another (`to`).

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

### AccessViolation

```solidity
error AccessViolation()
```

### DecryptionBadFormat

```solidity
error DecryptionBadFormat()
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
function _onUpdate(address from, address to, uint256) internal virtual
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

### _update

Transfers a `encryptedValue` amount of tokens from `from` to `to`
or alternatively mints (or burns) if `from` (or `to`) is the zero address.

```solidity
function _update(address from, address to, bytes encryptedValue, bool isTransferFrom) internal virtual
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| encryptedValue | bytes | TE-encrypted amount of tokens to be transferred |
| isTransferFrom | bool | Flag for transferFrom (true) or transfer (false) |

### _transferFrom

```solidity
function _transferFrom(address from, address to, uint256 value) internal virtual
```

### _transferFrom

```solidity
function _transferFrom(address from, address to, bytes value) internal virtual
```

### _transfer

Transfers a `encryptedValue` amount of tokens from `from` to `to`

```solidity
function _transfer(address from, address to, bytes value) internal virtual
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | bytes | TE-encrypted amount of tokens to be transferred |

