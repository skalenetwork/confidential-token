// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfidentialToken.sol - confidential-token
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

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { EIP3009 } from "./eip3009/EIP3009.sol";

import { NotImplemented } from "./errors.sol";


/// @title ConfidentialToken
/// @author Dmytro Stebaiev
/// @notice ERC20-like token with encrypted balances
contract ConfidentialToken is EIP3009, ERC20Permit {
    using Address for address;
    using Math for uint256;

    error ValueIsEncrypted();

    /// @notice Sets the values for {name} and {symbol}.
    /// @param name_     Name of the token
    /// @param symbol_   Symbol of the token
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC20Permit(name_) {
    }

    /// @inheritdoc ERC20
    function balanceOf(address account) public pure override returns (uint256 balance) {
        account = account; // TODO: remove
        revert ValueIsEncrypted();
    }

    // Internal functions

    /// @notice Transfers a `value` amount of tokens from `from` to `to`
    /// @notice or alternatively mints (or burns) if `from` (or `to`) is the zero address.
    /// @param from  Address to transfer tokens from
    /// @param to    Address to transfer tokens to
    /// @param value Amount of tokens to be transferred
    function _update(address from, address to, uint256 value) internal pure override {
        from = to; // TODO: remove
        value = value; // TODO: remove
        revert NotImplemented();
    }
}
