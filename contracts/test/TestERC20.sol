// SPDX-License-Identifier: AGPL-3.0-only

/*
    TestERC20.sol - confidential-token
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

pragma solidity ^0.8.27;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IMintableERC20 } from "../interfaces/IMintableERC20.sol";

/// @title IPausable interface
/// @author Eduardo Vasques
/// @notice Interface to pause Test token
interface IPausable {
    /// @notice Pauses or unpauses token transfers. --- NO PRODUCTION USE ---
    /// @param paused weather to pause or unpause
    function setTransfersPaused(bool paused) external;
}

/// @title TestERC20
/// @author Dmytro Stebaiev
/// @notice ERC20 token with minting functionality for testing purposes
/// @notice There is no access control on the mint function
/// @notice DON'T USE IN PRODUCTION!
contract TestERC20 is ERC20, Pausable, IMintableERC20, IPausable {

    /// @notice Constructor for the TestERC20 contract
    /// @param name_ Name of the token
    /// @param symbol_ Symbol of the token
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @inheritdoc IMintableERC20
    function mint(address to, uint256 amount) external override {
        _mint(to, amount);
    }

    /// @inheritdoc IPausable
    function setTransfersPaused(bool paused) external override {
        if (paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
