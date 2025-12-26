// SPDX-License-Identifier: AGPL-3.0-only

/*
    CallbackSender.sol - confidential-token
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

pragma solidity ^0.8.24;

import { ZeroAddress } from "../errors.sol";
import { IBiteSupplicant } from "../interfaces/bite/IBiteSupplicant.sol";


/// @title ICallbackSender
/// @author Dmytro Stebaiev
/// @notice Interface for the CallbackSender contract
interface ICallbackSender {
    /// @notice Sends the decryption callback to the supplicant
    function sendCallback() external;
}

/// @title CallbackSender
/// @author Dmytro Stebaiev
/// @notice Contract to send decryption callbacks to a supplicant
contract CallbackSender is ICallbackSender{

    // slither wants immutable variables to be named in camelCase
    // but we together with solhint prefer UPPER_CASE for immutables
    // slither-disable-start naming-convention

    /// @notice Address of the supplicant contract
    address public immutable SUPPLICANT;

    /// @notice Gas limit for the callback
    uint256 public immutable GAS_LIMIT;

    // slither-disable-end naming-convention

    /// @notice Decrypted arguments to send in the callback
    bytes[] public decryptedArguments;

    /// @notice Plaintext arguments to send in the callback
    bytes[] public plaintextArguments;

    /// @notice Constructor for the CallbackSender contract
    /// @param supplicant Address of the supplicant contract
    /// @param gasLimit Gas limit for the callback
    /// @param decryptedArguments_ Decrypted arguments to send in the callback
    /// @param plaintextArguments_ Plaintext arguments to send in the callback
    constructor(
        address supplicant,
        uint256 gasLimit,
        bytes[] memory decryptedArguments_,
        bytes[] memory plaintextArguments_
    )
    {
        require(supplicant != address(0), ZeroAddress());
        SUPPLICANT = supplicant;
        GAS_LIMIT = gasLimit;
        decryptedArguments = decryptedArguments_;
        plaintextArguments = plaintextArguments_;
    }

    /// @inheritdoc ICallbackSender
    function sendCallback() external override {
        IBiteSupplicant(SUPPLICANT).onDecrypt{ gas: GAS_LIMIT }(
            decryptedArguments,
            plaintextArguments
        );
    }
}
