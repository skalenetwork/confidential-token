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

pragma solidity ^0.8.24;

/**
 * @title Precompiled Library
 * @author Dmytro Stebaiev
 * @notice Library for interacting with Ethereum precompiled contracts and SKALE-specific precompiles
 */
library Precompiled {
    error PrecompiledCallFailed(address precompiledContract);

    /// @notice Calls the DecryptAndExecute precompiled contract
    /// @param decryptAndExecuteAddress The address of the DecryptAndExecute precompiled contract
    /// @param encryptedArguments The encrypted arguments to pass to the precompiled contract
    /// @param plaintextArguments The plaintext arguments to pass to the precompiled contract
    function decryptAndExecute(
        address decryptAndExecuteAddress,
        bytes[] memory encryptedArguments,
        bytes[] memory plaintextArguments
    )
        internal
        view
    {
        _callPrecompiled(
            decryptAndExecuteAddress,
            abi.encode(
                encryptedArguments,
                plaintextArguments
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
        view
        returns (bytes memory output)
    {
        // Have to use low-level calls
        // because it's the only way to call precompiled contracts
        // slither-disable-next-line low-level-calls
        (bool success, bytes memory out) = precompiledContract.staticcall(input);
        require(success, PrecompiledCallFailed(precompiledContract));
        return out;
    }
}
