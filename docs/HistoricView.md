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

### UserIsNotAuthorizedToDecryptTransfer

```solidity
error UserIsNotAuthorizedToDecryptTransfer(address viewer, uint256 transferId)
```

### handleDecrypt

```solidity
function handleDecrypt(struct HistoricView.AuthStorage authStorage, address sender, struct PublicKey senderPublicKey, address encryptECIESAddress, bytes decryptedTransferData) internal
```

### revokeAll

```solidity
function revokeAll(struct HistoricView.AuthStorage authStorage, address holder, address viewer) internal
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
function authorizeTransferId(struct HistoricView.AuthStorage authStorage, address holder, address viewer, uint256 transferId) internal returns (bool added)
```

