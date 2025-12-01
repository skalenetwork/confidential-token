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
import { EIP712 } from "./eip3009/EIP712.sol";
import { EIP712Domain } from "./eip3009/EIP712Domain.sol";
import { IERC20Internal } from "./eip3009/IERC20Internal.sol";

import { NotImplemented } from "./errors.sol";


/// @title ConfidentialToken
/// @author Dmytro Stebaiev
/// @notice ERC20-like token with encrypted balances
contract ConfidentialToken is EIP3009, ERC20Permit {
    using Address for address;
    using Math for uint256;

    // TODO:
    // Potentially we could override or remove
    // function balanceOf(address account) external view returns (uint256);

    // TODO:
    // Potentially we could override or remove
    // function allowance(address owner, address spender) external view returns (uint256);

    function DOMAIN_SEPARATOR() external view override(EIP712Domain, ERC20Permit) returns (bytes32) {
        return ERC20Permit.DOMAIN_SEPARATOR();
    }

    // Internal functions

    function _update(address from, address to, uint256 value) internal override {
        revert NotImplemented();
    }

    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal override(ERC20, IERC20Internal) {
        revert NotImplemented();
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal override {
        revert NotImplemented();
    }
}
