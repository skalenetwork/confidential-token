// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IConfidentialTokenUpgradeable.sol - confidential-token
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


/// @title IConfidentialTokenUpgradeable
/// @author Eduardo Vasques
/// @notice Initializer interface for upgradeable confidential token deployments.
interface IConfidentialTokenUpgradeable {
    /// @notice Initializes the contract for proxy deployment.
    /// @param name_ Name of the token.
    /// @param symbol_ Symbol of the token.
    /// @param version_ Version of the contract.
    /// @param initialAuthority Address of AccessManager initial authority.
    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata version_,
        address initialAuthority
    ) external;
}
