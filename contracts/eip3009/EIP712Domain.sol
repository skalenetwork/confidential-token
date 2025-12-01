// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   EIP712Domain.sol - confidential-token
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

// ----------------------------------------------------------------------------
// This file is a modified version of the original EIP-3009 implementation.
//
// Original Source: https://github.com/CoinbaseStablecoin/eip-3009
// Original Copyright (c) 2018-2020 Coinbase, Inc.
//
// The original code is licensed under the MIT License.
// A copy of the original MIT License is included in this repository at:
// /licenses/LICENSE_COINBASE
// ----------------------------------------------------------------------------

pragma solidity ^0.8.24;

interface EIP712Domain {
    /**
     * @dev EIP712 Domain Separator
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
