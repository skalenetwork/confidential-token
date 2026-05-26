// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MintableConfidentialTokenUpgradeable.sol - confidential-token
 *   Copyright (C) 2026-Present SKALE Labs
 *   @author Dmytro Stebaiev
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

import { MintableConfidentialTokenCore } from "../core/MintableConfidentialTokenCore.sol";
import {
    IMintableConfidentialTokenUpgradeable
} from "../interfaces/IMintableConfidentialTokenUpgradeable.sol";


/// @title MintableConfidentialTokenUpgradeable
/// @author Dmytro Stebaiev
/// @author Eduardo Vasques
/// @notice Upgradeable ConfidentialToken with minting functionality
contract MintableConfidentialTokenUpgradeable is
    MintableConfidentialTokenCore,
    IMintableConfidentialTokenUpgradeable
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the contract for proxy deployment.
    /// @param name Name of the token.
    /// @param symbol Symbol of the token.
    /// @param version_ Version of the token.
    /// @param initialAuthority Initial authority address.
    function initialize(
        string calldata name,
        string calldata symbol,
        string calldata version_,
        address initialAuthority
    )
        external
        override
        initializer
    {
        __MintableConfidentialToken_init(name, symbol, version_, initialAuthority);
    }
}
