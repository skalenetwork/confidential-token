# Solidity API

## ConfidentialToken

ERC20-like token with encrypted balances

### encryptTEaddress

Address of the EncryptTE precompiled contract

```solidity
address encryptTEaddress
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

```solidity
string version
```

### Transferred

Emitted when tokens are transferred, including mints and burns

```solidity
event Transferred()
```

### SubmitCTXAddressChanged

Emitted when SubmitCTX precompiled contract address is changed

```solidity
event SubmitCTXAddressChanged(address newAddress)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the SubmitCTX precompiled contract |

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

### ValueIsEncrypted

```solidity
error ValueIsEncrypted()
```

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
| version_ | string |  |
| initialAuthority | address | Address of AccessManager initial authority |

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
function registerPublicKey(struct PublicKey publicKey) external
```

**dev:** _The address is calculated from the public key_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| publicKey | struct PublicKey | The public key to register |

### setSubmitCTXAddress

Sets the address of the SubmitCTX precompiled contract

```solidity
function setSubmitCTXAddress(address newAddress) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the SubmitCTX precompiled contract |

### setEncryptTEAddress

Sets the address of the EncryptTE precompiled contract

```solidity
function setEncryptTEAddress(address newAddress) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAddress | address | New address of the EncryptTE precompiled contract |

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
function _update(address from, address to, uint256 value) internal view
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Address to transfer tokens from |
| to | address | Address to transfer tokens to |
| value | uint256 | Amount of tokens to be transferred |

