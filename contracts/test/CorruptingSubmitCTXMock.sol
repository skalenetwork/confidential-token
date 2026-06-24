// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   CorruptingSubmitCTXMock.sol - confidential-token
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

pragma solidity ^0.8.27;

import { CallbackSender } from "@skalenetwork/bite-solidity/test/CallbackSender.sol";
import { PrecompiledMock } from "@skalenetwork/bite-solidity/test/PrecompiledMock.sol";

/// @title ICorruptingSubmitCTXMock interface
/// @author Eduardo Vasques
/// @notice Faulty SUBMIT_CTX precompile mock. --- NO PRODUCTION USE ---
interface ICorruptingSubmitCTXMock {
    /// @notice Sets the decrypted arguments that the next callback will deliver verbatim.
    /// @param decryptedArguments Arguments to pass to `onDecrypt` instead of honestly decrypting.
    function setDecryptedArguments(bytes[] calldata decryptedArguments) external;

    /// @notice Triggers the most recently created callback.
    function sendCallback() external;
}

/// @title CorruptingSubmitCTXMock
/// @author Eduardo Vasques
/// @notice Test-only SUBMIT_CTX precompile mock that delivers attacker-chosen decrypted
/// arguments to the supplicant's `onDecrypt` callback instead of faithfully decrypting the
/// submitted cipher-texts.
/// @notice DON'T USE IN PRODUCTION!
/// @dev The production contract always constructs well-formed encrypted arguments and BITE
/// protocol is trusted, so the defensive validation guards in
/// `_validateDecryptedArguments` / `_decodeBalance` should never fire through the normal flow.
/// Pointing `submitCTXAddress` at this mock (via `setSubmitCTXAddress`) lets a test deliver
/// arbitrary decrypted arguments through a legitimately registered `CallbackSender`, which is
/// the only way to exercise those guards. The plaintext arguments are forwarded unchanged so
/// routing (`_parseAction`, `TransferInfo`) behaves exactly as in production.
contract CorruptingSubmitCTXMock is PrecompiledMock, ICorruptingSubmitCTXMock {
    bytes[] private _decryptedArguments;

    /// @notice Address of the most recently created callback sender.
    address payable public lastCallbackSender;

    /// @inheritdoc ICorruptingSubmitCTXMock
    function setDecryptedArguments(bytes[] calldata decryptedArguments) external override {
        delete _decryptedArguments;
        uint256 length = decryptedArguments.length;
        for (uint256 i = 0; i < length; ++i) {
            _decryptedArguments.push(decryptedArguments[i]);
        }
    }

    /// @inheritdoc ICorruptingSubmitCTXMock
    function sendCallback() external override {
        CallbackSender(lastCallbackSender).sendCallback();
    }


    function _call(bytes calldata data) internal override returns (bytes memory result) {
        (uint256 gasLimit, bytes memory innerData) = abi.decode(data, (uint256, bytes));
        // Discard the real encrypted arguments; deliver the configured decrypted arguments.
        (, bytes[] memory plaintextArguments) = abi.decode(innerData, (bytes[], bytes[]));
        CallbackSender sender = new CallbackSender(
            msg.sender,
            gasLimit,
            _decryptedArguments,
            plaintextArguments
        );
        lastCallbackSender = payable(address(sender));
        return abi.encodePacked(bytes20(uint160(address(sender))));
    }
}
