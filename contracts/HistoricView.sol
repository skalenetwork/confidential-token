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

    error UserIsNotAuthorizedToDecryptTransfer(address viewer, uint256 transferId);

    function revokeAll(
        AuthStorage storage authStorage,
        address holder,
        address viewer
    )
        internal
        returns (bool hadPermissions)
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        hadPermissions = auth.fromTimestamp < auth.toTimestamp || auth.transferIds.length() > 0;
        auth.fromTimestamp = 0;
        auth.toTimestamp = 0;
        auth.transferIds.clear();
    }

    function revokeTransferId(
        AuthStorage storage authStorage,
        address holder,
        address viewer,
        uint256 transferId
    )
        internal
        returns (bool removed)
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        return auth.transferIds.remove(transferId);
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
        // Allow any values. If from >= to, there will be no permissions basically
        auth.fromTimestamp = fromTimestamp;
        auth.toTimestamp = toTimestamp;
    }

    function authorizeTransferId(
        AuthStorage storage authStorage,
        address holder,
        address viewer,
        uint256 transferId
    )
        internal
        returns (bool authorized)
    {
        HistoricViewAuth storage auth = authStorage.data[holder][viewer];
        return auth.transferIds.add(transferId);
    }

    function canDecrypt(
        AuthStorage storage authStorage,
        address sender,
        bytes calldata decryptedTransferData
    )
        internal
        view
        returns (address from, address to, uint256 value)
    {
        require(decryptedTransferData.length == 160, DecryptionBadFormat());
        TransferData memory transferData = abi.decode(decryptedTransferData, (TransferData));

        if (!_isAuthorized(authStorage, transferData, sender)) {
            revert UserIsNotAuthorizedToDecryptTransfer(sender, transferData.transferId);
        }
        return (transferData.from, transferData.to, transferData.value);
    }

    function encodedTransferData(
        address from,
        address to,
        uint256 value,
        uint256 timestamp,
        uint256 transferId
    )
        internal
        pure
        returns (bytes memory decryptedTransferData)
    {
        return abi.encode(TransferData({
            from: from,
            to: to,
            value: value,
            timestamp: timestamp,
            transferId: transferId
        }));
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
        if (fromAuth.fromTimestamp <= transferData.timestamp && fromAuth.toTimestamp > transferData.timestamp) {
            return true;
        }

        HistoricViewAuth storage toAuth = authStorage.data[to][sender];
        if (toAuth.fromTimestamp <= transferData.timestamp && toAuth.toTimestamp > transferData.timestamp) {
            return true;
        }

        return
            fromAuth.transferIds.contains(transferData.transferId) ||
            toAuth.transferIds.contains(transferData.transferId);
    }

}
