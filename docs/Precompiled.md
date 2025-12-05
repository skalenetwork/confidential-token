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

