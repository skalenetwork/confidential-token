// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   EIP712.sol - confidential-token
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

pragma solidity ^0.8.26;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title EIP712Utils
 * @author Dmytro Stebaiev
 * @notice A library that provides EIP712 helper functions
 */
library EIP712Utils {

    /**
     * @notice Recover signer's address from a EIP712 signature
     * @param domainSeparator   Domain separator
     * @param v                 v of the signature
     * @param r                 r of the signature
     * @param s                 s of the signature
     * @param typeHashAndData   Type hash concatenated with data
     * @return signer Signer's address
     */
    function recover(
        bytes32 domainSeparator,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes memory typeHashAndData
    ) internal pure returns (address signer) {
        bytes32 digest = MessageHashUtils.toTypedDataHash(
            domainSeparator,
            keccak256(typeHashAndData)
        );
        return ECDSA.recover(digest, v, r, s);
    }
}
