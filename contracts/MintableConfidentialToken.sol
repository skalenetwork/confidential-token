// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MintableConfidentialToken.sol - confidential-token
 *   Copyright (C) 2026-Present SKALE Labs
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

pragma solidity ^0.8.26;

import { ConfidentialToken } from "./ConfidentialToken.sol";
import { IMintableERC20 } from "./interfaces/IMintableERC20.sol";


/// @title MintableConfidentialToken
/// @author Dmytro Stebaiev
/// @notice ConfidentialToken with minting functionality
contract MintableConfidentialToken is ConfidentialToken, IMintableERC20 {
    /// @notice Constructor of the MintableConfidentialToken contract
    /// @param name Name of the token
    /// @param symbol Symbol of the token
    /// @param version_ Version of the token
    /// @param initialAuthority Initial authority address
    constructor(
        string memory name,
        string memory symbol,
        string memory version_,
        address initialAuthority
    )
        ConfidentialToken(name, symbol, version_, initialAuthority)
    {}

    /// @inheritdoc IMintableERC20
    function mint(address to, uint256 amount) external override restricted {
        _mint(to, amount);
    }
}
