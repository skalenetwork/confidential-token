# Solidity API

## Precompiled

Library for interacting with Ethereum precompiled contracts and SKALE-specific precompiles

### PrecompiledCallFailed

```solidity
error PrecompiledCallFailed(address precompiledContract)
```

### decryptAndExecute

Calls the DecryptAndExecute precompiled contract

```solidity
function decryptAndExecute(address decryptAndExecuteAddress, bytes[] encryptedArguments, bytes[] plaintextArguments) internal view
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| decryptAndExecuteAddress | address | The address of the DecryptAndExecute precompiled contract |
| encryptedArguments | bytes[] | The encrypted arguments to pass to the precompiled contract |
| plaintextArguments | bytes[] | The plaintext arguments to pass to the precompiled contract |

### encryptTE

Calls the EncryptTE precompiled contract

```solidity
function encryptTE(address encryptTEaddress, bytes text) internal view returns (bytes cipherText)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| encryptTEaddress | address | The address of the EncryptTE precompiled contract |
| text | bytes | The plaintext data to encrypt |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| cipherText | bytes | The encrypted data returned by the precompiled contract |

### encryptECIES

Calls the EncryptECIES precompiled contract

```solidity
function encryptECIES(address encryptECIESaddress, bytes text, struct PublicKey publicKey) internal view returns (bytes cipherText)
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| encryptECIESaddress | address | The address of the EncryptECIES precompiled contract |
| text | bytes | The plaintext data to encrypt |
| publicKey | struct PublicKey | The public key to use for encryption |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| cipherText | bytes | The encrypted data returned by the precompiled contract |

