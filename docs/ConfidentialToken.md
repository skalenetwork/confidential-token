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

### publicKeys

Mapping of holder addresses to their public keys

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

Emitted when a public key is registered

```solidity
event PublicKeyRegistered(address holder)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| holder | address | Address of the holder whose public key is registered |

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

### PublicKeyIsNotRegistered

```solidity
error PublicKeyIsNotRegistered(address holder)
```

### ValueIsEncrypted

```solidity
error ValueIsEncrypted()
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
| amount | uint256 | The amount of tokens to burn |

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

### registerPublicKey

Registers the public key of any address

```solidity
function registerPublicKey(struct PublicKey publicKey) external payable
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

### totalSupply

```solidity
function totalSupply() public view returns (uint256 supply)
```

**dev:** _Returns the value of tokens in existence._

### balanceOf

```solidity
function balanceOf(address) public pure returns (uint256)
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

### _update

Transfers a `value` amount of tokens from `from` to `to`
or alternatively mints (or burns) if `from` (or `to`) is the zero address.

```solidity
function _update(address from, address to, uint256 value) internal
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | uint256 | Amount of tokens to be transferred |

