// SPDX-License-Identifier: AGPL-3.0-only

/*
    Precompiled.sol - confidential-token
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

// cspell:words ECIES

pragma solidity ^0.8.24;

import { PublicKey } from "./types.sol";


/**
 * @title Precompiled Library
 * @author Dmytro Stebaiev
 * @notice Library for interacting with Ethereum precompiled contracts and SKALE-specific precompiles
 */
library Precompiled {
    error PrecompiledCallFailed(address precompiledContract);

    /// @notice Calls the SubmitCTX precompiled contract
    /// @param submitCTXAddress The address of the SubmitCTX precompiled contract
    /// @param gasLimit The gas limit for the callback
    /// @param encryptedArguments The encrypted arguments to pass to the precompiled contract
    /// @param plaintextArguments The plaintext arguments to pass to the precompiled contract
    /// @return callbackSender The address that will send the callback
    function submitCTX(
        address submitCTXAddress,
        uint256 gasLimit,
        bytes[] memory encryptedArguments,
        bytes[] memory plaintextArguments
    )
        internal
        returns (address payable callbackSender)
    {
        return payable(address(bytes20(_callPrecompiled(
            submitCTXAddress,
            abi.encode(
                gasLimit,
                abi.encode(
                    encryptedArguments,
                    plaintextArguments
                )
            )
        ))));
    }

    /// @notice Calls the EncryptTE precompiled contract
    /// @param encryptTEaddress The address of the EncryptTE precompiled contract
    /// @param text The plaintext data to encrypt
    /// @return cipherText The encrypted data returned by the precompiled contract
    function encryptTE(address encryptTEaddress, bytes memory text) internal returns (bytes memory cipherText) {
        return _callPrecompiled(
            encryptTEaddress,
            text
        );
    }

    /// @notice Calls the EncryptECIES precompiled contract
    /// @param encryptECIESaddress The address of the EncryptECIES precompiled contract
    /// @param text The plaintext data to encrypt
    /// @param publicKey The public key to use for encryption
    /// @return cipherText The encrypted data returned by the precompiled contract
    function encryptECIES(
        address encryptECIESaddress,
        bytes memory text,
        PublicKey memory publicKey
    )
        internal
        returns (bytes memory cipherText)
    {
        return _callPrecompiled(
            encryptECIESaddress,
            abi.encode(
                text,
                publicKey.x,
                publicKey.y
            )
        );
    }

    // Private

    /**
     * @notice Calls a precompiled contract with the given input
     * @param precompiledContract The address of the precompiled contract
     * @param input The input data to pass to the precompiled contract
     * @return output The output data from the precompiled contract
     */
    function _callPrecompiled(
        address precompiledContract,
        bytes memory input
    )
        private
        returns (bytes memory output)
    {
        // Have to use low-level calls
        // because it's the only way to call precompiled contracts
        // slither-disable-next-line low-level-calls
        (
            bool success,
            bytes memory out
        ) = precompiledContract.call(input); // solhint-disable-line avoid-low-level-calls
        require(success, PrecompiledCallFailed(precompiledContract));
        return out;
    }
}
