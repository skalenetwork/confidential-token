// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MintableConfidentialTokenCore.sol - confidential-token
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

// cspell:words mixedcase

pragma solidity ^0.8.27;

import { IMintableERC20 } from "../interfaces/IMintableERC20.sol";
import { ConfidentialTokenCore } from "./ConfidentialTokenCore.sol";


/// @title MintableConfidentialTokenCore
/// @author Dmytro Stebaiev
/// @notice ConfidentialToken with minting functionality
abstract contract MintableConfidentialTokenCore is ConfidentialTokenCore, IMintableERC20 {
    /// @inheritdoc IMintableERC20
    function mint(address to, uint256 amount) external override restricted {
        _mint(to, amount);
    }

    /// @inheritdoc IMintableERC20
    function burn(uint256 amount) external override {
        _burn(_msgSender(), amount);
    }

    // slither-disable-start naming-convention
    // solhint-disable-next-line func-name-mixedcase
    function __MintableConfidentialToken_init(
        string memory name,
        string memory symbol,
        string memory version_,
        address initialAuthority
    )
        internal
        onlyInitializing
    {
        __ConfidentialToken_init(name, symbol, version_, initialAuthority);
    }
    // slither-disable-end naming-convention

}
