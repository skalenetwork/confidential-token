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

// cspell:words IERC20


pragma solidity ^0.8.27;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IConfidentialToken } from "./IConfidentialToken.sol";


/// @title IConfidentialWrapper
/// @author Dmytro Stebaiev
/// @author Eduardo Vasques
/// @notice Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token
interface IConfidentialWrapper is IConfidentialToken {

    /// @notice depositFor like function that allows to top up gas token wallet in the same transaction
    /// @param account The address to credit the wrapped tokens to
    /// @param value The amount of tokens to wrap
    /// @return success Whether the deposit was successful
    function depositForWithGasToken(address account, uint256 value) external payable returns (bool success);

    /// @notice Releases the caller's pending wrapped tokens to `account`.
    /// @notice Only the recipient of a prior `depositFor` (i.e. an address with a
    /// non-zero `requestedMints` entry) can call this; the depositor cannot.
    /// @param account The address to release the underlying tokens to
    /// @param value The amount of tokens to release
    function releaseTo(address account, uint256 value) external;

    /// @notice Initializes the contract for proxy deployment.
    /// @param underlyingToken Token to wrap confidentially.
    /// @param version_ Version of the wrapper.
    /// @param initialAuthority Initial authority address.
    function initialize(
        IERC20Metadata underlyingToken,
        string calldata version_,
        address initialAuthority
    ) external;
}
