// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IConfidentialWrapperUpgradeable.sol - confidential-token
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

// cspell:words IERC

pragma solidity ^0.8.27;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";


/// @title IConfidentialWrapperUpgradeable
/// @author Eduardo Vasques
/// @notice Initializer interface for upgradeable confidential wrapper deployments.
interface IConfidentialWrapperUpgradeable {
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
