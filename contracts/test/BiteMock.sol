// SPDX-License-Identifier: AGPL-3.0-only

/*
    BiteMock.sol - confidential-token
    Copyright (C) 2025-Present SKALE Labs
    @author Dmytro Stebaiev

    confidential-token is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    confidential-token is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with confidential-token.  If not, see <https://www.gnu.org/licenses/>.
*/

// cspell:words deque

pragma solidity ^0.8.24;

import { DoubleEndedQueue } from "@openzeppelin/contracts/utils/structs/DoubleEndedQueue.sol";

import { CallbackSender } from "./CallbackSender.sol";


/// @title IBiteMock
/// @author Dmytro Stebaiev
/// @notice Interface for BiteMock contract
interface IBiteMock {
    /// @notice Submits a CTX for decryption and execution
    /// @param supplicant Address of the supplicant contract
    /// @param gasLimit Gas limit for the callback
    /// @param encryptedArgs Encrypted arguments
    /// @param plaintextArgs Plaintext arguments
    /// @return callbackSender Address of the CallbackSender contract
    function submitCTX(
        address supplicant,
        uint256 gasLimit,
        bytes[] calldata encryptedArgs,
        bytes[] calldata plaintextArgs
    )
        external
        returns (address callbackSender);

    /// @notice Sends the next queued callback
    function sendCallback() external;

    /// @notice Encrypts a message
    /// @param message The message to encrypt
    /// @return cypherText The encrypted message
    function encrypt(bytes memory message) external pure returns (bytes memory cypherText);

    /// @notice Decrypts a cypherText
    /// @param cypherText The cypherText to decrypt
    /// @return message The decrypted message
    function decrypt(bytes memory cypherText) external pure returns (bytes memory message);
}

/// @title BiteMock
/// @author Dmytro Stebaiev
/// @notice Mock contract for BITE functionality
contract BiteMock is IBiteMock{
    using DoubleEndedQueue for DoubleEndedQueue.Bytes32Deque;
    DoubleEndedQueue.Bytes32Deque private _queue;

    error NoCallbacksQueued();

    /// @inheritdoc IBiteMock
    function submitCTX(
        address supplicant,
        uint256 gasLimit,
        bytes[] calldata encryptedArgs,
        bytes[] calldata plaintextArgs
    )
        external
        override
        returns (address callbackSender)
    {
        uint256 length = encryptedArgs.length;
        bytes[] memory decryptedArgs = new bytes[](length);
        for (uint256 i = 0; i < length; ++i) {
            decryptedArgs[i] = decrypt(encryptedArgs[i]);
        }
        CallbackSender sender = new CallbackSender(
            supplicant,
            gasLimit,
            decryptedArgs,
            plaintextArgs
        );

        _queue.pushBack(bytes32(uint256(uint160(address(sender)))));

        return address(sender);
    }

    /// @inheritdoc IBiteMock
    function sendCallback() external override {
        require(!_queue.empty(), NoCallbacksQueued());
        address payable senderAddress = payable(address(uint160(uint256(_queue.popFront()))));
        CallbackSender(senderAddress).sendCallback();
    }

    // Public

    /// @inheritdoc IBiteMock
    function encrypt(bytes memory message) public pure override returns (bytes memory cypherText) {
        cypherText = _reverse(message);
    }

    /// @inheritdoc IBiteMock
    function decrypt(bytes memory cypherText) public pure override returns (bytes memory message) {
        message = _reverse(cypherText);
    }

    // Private

    function _reverse(bytes memory data) internal pure returns (bytes memory reversed) {
        reversed = new bytes(data.length);
        uint256 length = data.length;
        for (uint256 i = 0; i < length; ++i) {
            reversed[i] = data[length - 1 - i];
        }
    }
}
