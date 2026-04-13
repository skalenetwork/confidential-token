// SPDX-License-Identifier: AGPL-3.0-only


/**
 *   HistoricView.sol - confidential-token
 *   Copyright (C) 2026-Present SKALE Labs
 *   @author Eduardo Vasques
 *
 *   confidential-token is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   confidential-token is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with confidential-token.  If not, see <https://www.gnu.org/licenses/>.
 */

// cspell:words ECIES

pragma solidity ^0.8.27;

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { BITE, PublicKey } from "@skalenetwork/bite-solidity/BITE.sol";

import { DecryptionBadFormat } from "./errors.sol";

/// @title HistoricView
/// @author Eduardo Vasques
/// @notice Helpers and storage types for historic transfer decryption permissions.
library HistoricView {
    using EnumerableSet for EnumerableSet.UintSet;

    struct HistoricViewAuth {
        uint256 fromTimestamp;
        uint256 toTimestamp;
        EnumerableSet.UintSet transferIds;
    }

    struct AuthStorage {
        mapping(address holder => mapping(address viewer => HistoricViewAuth auth)) data;
    }

    struct TransferData {
        address from;
        address to;
        uint256 value;
        uint256 timestamp;
        uint256 transferId;
    }

    /// @notice Emitted when a transfer event is decrypted for a viewer.
    /// @param viewer The account who paid and had rights for the decryption of the transfer event.
    /// @param from Address of the sender.
    /// @param to Address of the recipient.
    /// @param encryptedValue ECIES-encrypted transfer value for `viewer`.
    event ReEncryptedTransfer(address indexed viewer, address indexed from, address indexed to, bytes encryptedValue);

    /// @notice Emitted when a holder revokes all historic view permissions for a viewer.
    /// @param holder Address of the holder revoking access.
    /// @param viewer Address of the viewer whose permissions are revoked.
    event HistoricViewPermissionsRevoked(address indexed holder, address indexed viewer);

    /// @notice Emitted when a holder revokes a viewer's access to a specific transfer.
    /// @param holder Address of the holder revoking access.
    /// @param viewer Address of the viewer losing access.
    /// @param transferId ID of the transfer being revoked.
    event HistoricViewTransferIdRevoked(address indexed holder, address indexed viewer, uint256 indexed transferId);

    // Irrelevant to index any of the next parameters here
    // solhint-disable gas-indexed-events
    /// @notice Emitted when a holder grants a viewer access to transfers within a time range.
    /// @param holder Address of the holder granting access.
    /// @param viewer Address of the viewer receiving access.
    /// @param fromTimestamp Non-inclusive lower bound of the authorized time range.
    /// @param toTimestamp Non-inclusive upper bound of the authorized time range.
    event HistoricViewTimeRangeAuthorized(
        address indexed holder,
        address indexed viewer,
        uint256 fromTimestamp,
        uint256 toTimestamp
    );
    // solhint-enable gas-indexed-events

    /// @notice Emitted when a holder grants a viewer access to a specific transfer.
    /// @param holder Address of the holder granting access.
    /// @param viewer Address of the viewer receiving access.
    /// @param transferId ID of the transfer being authorized.
    event HistoricViewTransferIdAuthorized(address indexed holder, address indexed viewer, uint256 indexed transferId);

    error UserIsNotAuthorizedToDecryptTransfer(address viewer, uint256 transferId);

    function handleDecrypt(
        AuthStorage storage authStorage,
        address sender,
        PublicKey memory senderPublicKey,
        address encryptECIESAddress,
        bytes calldata decryptedTransferData
    )
        internal
    {
        require(decryptedTransferData.length == 160, DecryptionBadFormat());
        TransferData memory transferData = abi.decode(decryptedTransferData, (TransferData));

        if (!_isAuthorized(authStorage, transferData, sender)) {
            revert UserIsNotAuthorizedToDecryptTransfer(sender, transferData.transferId);
        }

        _emitReEncryptedTransferEvent(transferData, sender, senderPublicKey, encryptECIESAddress);
    }

    function revokeAll(
        AuthStorage storage authStorage,
        address holder,
        address viewer
    )
        internal
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        auth.fromTimestamp = type(uint256).max;
        auth.toTimestamp = type(uint256).max;
        auth.transferIds.clear();
        emit HistoricViewPermissionsRevoked(holder, viewer);
    }

    function revokeTransferId(
        AuthStorage storage authStorage,
        address holder,
        address viewer,
        uint256 transferId
    )
        internal
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        if (auth.transferIds.remove(transferId)) {
            emit HistoricViewTransferIdRevoked(holder, viewer, transferId);
        }
    }

    function authorizeTimeRange(
        AuthStorage storage authStorage,
        address holder,
        address viewer,
        uint256 fromTimestamp,
        uint256 toTimestamp
    )
        internal
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        auth.fromTimestamp = fromTimestamp;
        auth.toTimestamp = toTimestamp;
        emit HistoricViewTimeRangeAuthorized(holder, viewer, fromTimestamp, toTimestamp);
    }

    function authorizeTransferId(
        AuthStorage storage authStorage,
        address holder,
        address viewer,
        uint256 transferId
    )
        internal
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        if (auth.transferIds.add(transferId)) {
            emit HistoricViewTransferIdAuthorized(holder, viewer, transferId);
        }
    }

    function _emitReEncryptedTransferEvent(
        TransferData memory transferData,
        address sender,
        PublicKey memory senderPublicKey,
        address encryptECIESAddress
    )
        private
    {
        emit ReEncryptedTransfer(
            sender,
            transferData.from,
            transferData.to,
            BITE.encryptECIES(
                encryptECIESAddress,
                abi.encodePacked(transferData.value),
                senderPublicKey
            )
        );
    }

    function _isAuthorized(
        AuthStorage storage authStorage,
        TransferData memory transferData,
        address sender
    )
        private
        view
        returns (bool isAuthorized)
    {
        address from = transferData.from;
        address to = transferData.to;

        if (sender == from || sender == to) {
            return true;
        }

        HistoricViewAuth storage fromAuth = authStorage.data[from][sender];
        if (fromAuth.fromTimestamp < transferData.timestamp && fromAuth.toTimestamp > transferData.timestamp) {
            return true;
        }

        HistoricViewAuth storage toAuth = authStorage.data[to][sender];
        if (toAuth.fromTimestamp < transferData.timestamp && toAuth.toTimestamp > transferData.timestamp) {
            return true;
        }

        return
            fromAuth.transferIds.contains(transferData.transferId) ||
            toAuth.transferIds.contains(transferData.transferId);
    }

}
