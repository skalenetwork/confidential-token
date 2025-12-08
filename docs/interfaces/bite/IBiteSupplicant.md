# Solidity API

## IBiteSupplicant

Interface for contracts that can handle decrypted data from BITE

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

