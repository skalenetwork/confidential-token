# Solidity API

## HistoricView

Helpers and storage types for historic transfer decryption permissions.

### HistoricViewAuth

```solidity
struct HistoricViewAuth {
  uint256 fromTimestamp;
  uint256 toTimestamp;
  struct EnumerableSet.UintSet transferIds;
}
```

### AuthStorage

```solidity
struct AuthStorage {
  mapping(address => mapping(address => struct HistoricView.HistoricViewAuth)) data;
}
```

### TransferData

```solidity
struct TransferData {
  address from;
  address to;
  uint256 value;
  uint256 timestamp;
  uint256 transferId;
}
```

### UserIsNotAuthorizedToDecryptTransfer

```solidity
error UserIsNotAuthorizedToDecryptTransfer(address viewer, uint256 transferId)
```

### revokeAll

```solidity
function revokeAll(struct HistoricView.AuthStorage authStorage, address holder, address viewer) internal returns (bool hadPermissions)
```

### revokeTransferId

```solidity
function revokeTransferId(struct HistoricView.AuthStorage authStorage, address holder, address viewer, uint256 transferId) internal returns (bool removed)
```

### authorizeTimeRange

```solidity
function authorizeTimeRange(struct HistoricView.AuthStorage authStorage, address holder, address viewer, uint256 fromTimestamp, uint256 toTimestamp) internal
```

### authorizeTransferId

```solidity
function authorizeTransferId(struct HistoricView.AuthStorage authStorage, address holder, address viewer, uint256 transferId) internal returns (bool authorized)
```

### canDecrypt

```solidity
function canDecrypt(struct HistoricView.AuthStorage authStorage, address sender, bytes decryptedTransferData) internal view returns (address from, address to, uint256 value)
```

### encodedTransferData

```solidity
function encodedTransferData(address from, address to, uint256 value, uint256 timestamp, uint256 transferId) internal pure returns (bytes decryptedTransferData)
```

