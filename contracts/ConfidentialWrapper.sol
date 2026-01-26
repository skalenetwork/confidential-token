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

// cspell:words IERC20

pragma solidity ^0.8.24;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { ConfidentialToken } from "./ConfidentialToken.sol";
import { IConfidentialWrapper } from "./interfaces/IConfidentialWrapper.sol";


/// @title ConfidentialWrapper
/// @author Dmytro Stebaiev
/// @notice Confidential wrapper that adds confidentiality to an ERC20 token
contract ConfidentialWrapper is ConfidentialToken, IConfidentialWrapper {
    using SafeERC20 for IERC20;

    /// @notice Address of the original token
    IERC20 public immutable WRAPPED_TOKEN;

    /// @notice Amount of tokens requested to be wrapped
    /// @dev Almost always equals to zero
    /// @dev Has non-zero value only before the callback call is made
    mapping (address holder => uint256 value) public requestedMints;

    error OutdatedMint(address to, uint256 value);

    constructor(
        IERC20Metadata wrappedTokenAddress,
        string memory version_,
        address initialAuthority
    )
        ConfidentialToken(
            string.concat("Confidential ", wrappedTokenAddress.name()),
            string.concat("cnf", wrappedTokenAddress.symbol()),
            version_,
            initialAuthority
        )
    {
        WRAPPED_TOKEN = wrappedTokenAddress;
    }

    /// @inheritdoc IConfidentialWrapper
    function release(uint256 value) external override {
        requestedMints[msg.sender] -= value;
        WRAPPED_TOKEN.safeTransfer(msg.sender, value);
    }

    /// @inheritdoc IConfidentialWrapper
    function unwrap(uint256 value) external override {
        _burn(msg.sender, value);
    }

    /// @inheritdoc IConfidentialWrapper
    function wrap(uint256 value) external override {
        requestedMints[msg.sender] += value;
        WRAPPED_TOKEN.safeTransferFrom(msg.sender, address(this), value);
        _mint(msg.sender, value);
    }

    // Internal functions

    function _onUpdate(address from, address to, uint256 value) internal override {
        ConfidentialToken._onUpdate(from, to, value);
        if (from == address(0)) {
            _onMint(to, value);
        }
        if (to == address(0)) {
            _onBurn(from, value);
        }
    }

    // Private functions

    function _onMint(address to, uint256 value) private {
        bool previouslyRequested;
            (previouslyRequested, requestedMints[to]) = Math.trySub(
                requestedMints[to],
                value
            );
            require(previouslyRequested, OutdatedMint(to, value));
    }

    function _onBurn(address from, uint256 value) private {
        WRAPPED_TOKEN.safeTransfer(from, value);
    }
}
