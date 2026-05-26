// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfidentialWrapperCore.sol - confidential-token
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

pragma solidity ^0.8.27;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    ERC20WrapperUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20WrapperUpgradeable.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { IConfidentialWrapper } from "./../interfaces/IConfidentialWrapper.sol";
import { ConfidentialTokenCore } from "./ConfidentialTokenCore.sol";


/// @title ConfidentialWrapperCore
/// @author Dmytro Stebaiev
/// @notice Confidential wrapper that adds confidentiality to an ERC20 token
abstract contract ConfidentialWrapperCore is
    ConfidentialTokenCore,
    ERC20WrapperUpgradeable,
    IConfidentialWrapper
{
    using SafeERC20 for IERC20;

    uint8 private constant _WITHDRAW_TO_ACTION = 2;


    /// @notice Amount of tokens requested to be wrapped
    /// @dev Almost always equals to zero
    /// @dev Has non-zero value only before the callback call is made
    mapping (address holder => uint256 value) public requestedMints;

    error OutdatedMint(address to, uint256 value);
    error ZeroValue();

    // External functions

    /// @inheritdoc IConfidentialWrapper
    function releaseTo(address account, uint256 value) external override {
        requestedMints[_msgSender()] -= value;
        underlying().safeTransfer(account, value);
    }

    // Public functions

    ///@inheritdoc ConfidentialTokenCore
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public virtual override(ConfidentialTokenCore, ERC20Upgradeable) returns (bool result) {
        return ConfidentialTokenCore.transferFrom(from, to, value);
    }

    /// @inheritdoc ERC20WrapperUpgradeable
    /// @dev Pending mint accounting is keyed by the recipient `account`, so only
    /// `account` can later call `releaseTo` for this deposit.
    function depositFor(address account, uint256 value) public override returns (bool success) {
        requestedMints[account] += value;
        return super.depositFor(account, value);
    }

    /// @inheritdoc ERC20WrapperUpgradeable
    /// @dev This operation is asynchronous and finalizes in the callback. On
    /// success, underlying tokens are sent to `account`.
    function withdrawTo(address account, uint256 value) public override returns (bool success) {
        _burnTo(_msgSender(), account, value);
        return true;
    }

    /// @inheritdoc ERC20WrapperUpgradeable
    function decimals()
        public
        view
        override(ERC20Upgradeable, ERC20WrapperUpgradeable)
        returns (uint8 decimalsValue)
    {
        return ERC20WrapperUpgradeable.decimals();
    }

    /// @inheritdoc ConfidentialTokenCore
    function totalSupply() public view override(ConfidentialTokenCore, ERC20Upgradeable) returns (uint256 supply) {
        return ConfidentialTokenCore.totalSupply();
    }

    /// @inheritdoc ConfidentialTokenCore
    function balanceOf(address account)
        public
        pure
        override(ConfidentialTokenCore, ERC20Upgradeable)
        returns (uint256 balance)
    {
        return ConfidentialTokenCore.balanceOf(account);
    }

    // Internal functions

    // slither-disable-start naming-convention
    // solhint-disable-next-line func-name-mixedcase
    function __ConfidentialWrapper_init(
        IERC20Metadata underlyingToken,
        string memory version_,
        address initialAuthority
    )
        internal
        onlyInitializing
    {
        __ConfidentialToken_init(
            string.concat("Confidential ", underlyingToken.name()),
            string.concat("cnf", underlyingToken.symbol()),
            version_,
            initialAuthority
        );
        __ERC20Wrapper_init(underlyingToken);
    }
    // slither-disable-end naming-convention

    /// @notice Dispatches decrypted CTX actions for wrapper-specific flows.
    /// @dev Handles `_WITHDRAW_TO_ACTION` locally and delegates all other actions to
    /// the base ConfidentialToken logic.
    /// @param action Action discriminator encoded in callback plaintext.
    /// @param decryptedArguments Decrypted callback arguments from BITE.
    /// @param plaintextArguments Plaintext callback arguments used for routing.
    function _handleAction(
        uint8 action,
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) internal override {
        if (action == _WITHDRAW_TO_ACTION) {
            _handleWithdrawToRequest(decryptedArguments, plaintextArguments);
            return;
        }
        super._handleAction(action, decryptedArguments, plaintextArguments);
    }

    /// @notice Schedules an async burn that releases underlying to `to` on callback.
    /// @dev Encodes `to` as extra plaintext callback data for
    /// `_handleWithdrawToRequest`.
    /// @param from Address whose confidential balance is debited.
    /// @param to Recipient of the released underlying token.
    /// @param value Amount to burn and unwrap.
    function _burnTo(address from, address to, uint256 value) internal {
        if (to == address(0) || to == address(this)) {
            revert ERC20InvalidReceiver(to);
        }
        require(value != 0, ZeroValue());
        bytes memory encryptedValue = BITE.encryptTE(encryptTEAddress, abi.encodePacked(value));
        bytes[] memory extraArgs = new bytes[](1);
        extraArgs[0] = abi.encodePacked(to);
        _encryptedUpdateExtended({
            from: from,
            to: address(0),
            spender: address(0),
            gasPayer: _msgSender(),
            encryptedValue: encryptedValue,
            action: _WITHDRAW_TO_ACTION,
            extraPlaintextArguments: extraArgs
        });
    }

    function _onUpdate(address from, address to, uint256 value) internal override {
        ConfidentialTokenCore._onUpdate(from, to, value);
        if (from == address(0)) {
            _onMint(to, value);
        }
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ConfidentialTokenCore, ERC20Upgradeable)
    {
        ConfidentialTokenCore._update(from, to, value);
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

    /// @notice Finalizes a queued wrapper burn/withdraw callback.
    /// @dev Validates recipient plaintext argument, finalizes encrypted transfer
    /// accounting via `_handleTransferRequest`, then releases underlying.
    /// @param decryptedArguments Decrypted callback arguments from BITE.
    /// @param plaintextArguments Plaintext callback arguments containing recipient.
    function _handleWithdrawToRequest(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    )
        private
    {
        require(plaintextArguments.length > 2, WrongPlaintextFormat());
        require(plaintextArguments[2].length == 20, WrongPlaintextFormat());

        (bool finalized, uint256 value) = _handleTransferRequest(decryptedArguments, plaintextArguments);
        if (!finalized) {
            return;
        }

        address recipient = address(bytes20(plaintextArguments[2]));
        underlying().safeTransfer(recipient, value);
    }
}
