// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   GasTokenManager.sol - confidential-token
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

pragma solidity ^0.8.27;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IGasTokenManager } from "./interfaces/IGasTokenManager.sol";


/// @title GasTokenManager
/// @author Dmytro Stebaiev
/// @notice This contract manages gas token balances for holders and allows them to fund and withdraw gas tokens
contract GasTokenManager is IGasTokenManager {
    using Address for address payable;

    mapping(address holder => uint256 gasToken) private _gasTokenBalance;

    uint256 private _gasTokenBalancesSum;

    address private _lastGasTokenRefundReceiver;

    // Errors

    error InsufficientGasToken(uint256 required, uint256 available);

    // External

    /// @inheritdoc IGasTokenManager
    receive() external payable override {
        fundWithGasToken(msg.sender);
    }

    /// @inheritdoc IGasTokenManager
    function retrieveGasToken(uint256 value, address payable receiver) external override {
        emit GasTokenWithdrawn(receiver, value);
        _sendGasToken(msg.sender, receiver, value);
    }

    /// @inheritdoc IGasTokenManager
    function gasTokenBalanceOf(address holder) external view override returns (uint256 balance) {
        uint256 refund = 0;
        if (address(this).balance > _gasTokenBalancesSum) {
            if (holder == _lastGasTokenRefundReceiver) {
                refund = address(this).balance - _gasTokenBalancesSum;
            }
        }
        return _gasTokenBalance[holder] + refund;
    }

    // Public

    /// @inheritdoc IGasTokenManager
    function fundWithGasToken(address receiver) public payable override {
        uint256 value = msg.value;
        if (value > 0) {
            _setGasTokenBalance(receiver, _getGasTokenBalance(receiver) + value);
            emit GasTokenBalanceToppedUp(msg.sender, receiver, value);
        }
    }

    // Internal

    function _sendGasToken(address from, address payable to, uint256 value) internal {
        uint256 balance = _getGasTokenBalance(from);
        require(
            // value is not a constant
            // so no ability to save some gas here
            // solhint-disable-next-line gas-strict-inequalities
            balance >= value,
            InsufficientGasToken(value, balance)
        );
        // solhint-enable gas-strict-inequalities
        _setGasTokenBalance(from, balance - value);
        to.sendValue(value);
    }

    function _setLastGasTokenRefundReceiver(address receiver) internal {
        _flushGasTokenRefund();
        _lastGasTokenRefundReceiver = receiver;
    }

    // Private

    function _flushGasTokenRefund() private {
        if (address(this).balance - msg.value > _gasTokenBalancesSum && _lastGasTokenRefundReceiver != address(0)) {
            uint256 refund = address(this).balance - msg.value - _gasTokenBalancesSum;
            _setGasTokenBalance(
                _lastGasTokenRefundReceiver,
                _gasTokenBalance[_lastGasTokenRefundReceiver] + refund
            );
        }
    }

    function _getGasTokenBalance(address holder) private returns (uint256 balance) {
        _flushGasTokenRefund();
        return _gasTokenBalance[holder];
    }

    function _setGasTokenBalance(address holder, uint256 balance) private {
        uint256 balanceBefore = _gasTokenBalance[holder];
        _gasTokenBalance[holder] = balance;
        if (balance > balanceBefore) {
            _gasTokenBalancesSum += balance - balanceBefore;
        } else {
            _gasTokenBalancesSum -= balanceBefore - balance;
        }
    }
}
