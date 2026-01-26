// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IConfidentialWrapper.sol - confidential-token
 *   Copyright (C) 2025-Present SKALE Labs
 *   @author Dmytro Stebaiev
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

pragma solidity ^0.8.24;

import { IConfidentialToken } from "./IConfidentialToken.sol";


/// @title IConfidentialWrapper
/// @author Dmytro Stebaiev
/// @notice Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token
interface IConfidentialWrapper is IConfidentialToken {
    /// @notice Releases the wrapped tokens to the caller
    /// @notice Almost never is used and is required only if callback call fails
    /// @param value The amount of tokens to release
    function release(uint256 value) external;

    /// @notice Unwraps the specified amount of confidential tokens into the underlying token
    /// @param value The amount of tokens to unwrap
    function unwrap(uint256 value) external;

    /// @notice Wraps the specified amount of the underlying token into confidential tokens
    /// @param value The amount of tokens to wrap
    function wrap(uint256 value) external;
}
