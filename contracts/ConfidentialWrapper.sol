// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfidentialWrapper.sol - confidential-token
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

// cspell:words IERC

pragma solidity ^0.8.27;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ConfidentialWrapperCore } from "./core/ConfidentialWrapperCore.sol";


/// @title ConfidentialWrapper
/// @author Dmytro Stebaiev
/// @notice Confidential wrapper that adds confidentiality to an ERC20 token
contract ConfidentialWrapper is ConfidentialWrapperCore {
    constructor(
        IERC20Metadata underlyingToken,
        string memory version_,
        address initialAuthority
    )
        initializer
    {
        __ConfidentialWrapper_init(underlyingToken, version_, initialAuthority);
    }
}
