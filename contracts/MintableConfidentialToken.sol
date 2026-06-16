// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MintableConfidentialToken.sol - confidential-token
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

// cspell:words mixedcase

pragma solidity ^0.8.27;

import { ConfidentialToken } from "./ConfidentialToken.sol";
import { IMintableERC20 } from "./interfaces/IMintableERC20.sol";


/// @title MintableConfidentialToken
/// @author Dmytro Stebaiev
/// @author Eduardo Vasques
/// @notice ConfidentialToken with minting functionality
contract MintableConfidentialToken is ConfidentialToken, IMintableERC20 {
    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @notice Sets up the contract for proxy or direct deployment.
    /// @param proxyMode If true, disables initializers for proxy deployment.
    ///                  If false, initializes the contract directly.
    /// @param name Name of the token. Ignored when proxyMode is true.
    /// @param symbol Symbol of the token. Ignored when proxyMode is true.
    /// @param version_ Version of the token. Ignored when proxyMode is true.
    /// @param initialAuthority Initial authority address. Ignored when proxyMode is true.
    constructor(
        bool proxyMode,
        string memory name,
        string memory symbol,
        string memory version_,
        address initialAuthority
    ) ConfidentialToken(proxyMode, name, symbol, version_, initialAuthority) {}

    /// @inheritdoc IMintableERC20
    function mint(address to, uint256 amount) external override restricted {
        _mint(to, amount);
    }

    /// @inheritdoc IMintableERC20
    function burn(uint256 amount) external override {
        _burn(_msgSender(), amount);
    }

    /// @notice Initializes the contract for proxy deployment.
    /// @param name Name of the token.
    /// @param symbol Symbol of the token.
    /// @param version_ Version of the token.
    /// @param initialAuthority Initial authority address.
    function initialize(
        string memory name,
        string memory symbol,
        string memory version_,
        address initialAuthority
    )
        public
        override(ConfidentialToken)
        initializer
    {
        __MintableConfidentialToken_init(name, symbol, version_, initialAuthority);
    }

    // The OpenZeppelin Upgrades plugin's static analyzer relies on the __ContractName_init naming
    // convention to identify and track which parent contracts have been initialized.
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
