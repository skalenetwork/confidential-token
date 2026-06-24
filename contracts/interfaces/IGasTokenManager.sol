// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IGasTokenManager.sol - confidential-token
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


/// @title IGasTokenManager
/// @author Dmytro Stebaiev
/// @notice Interface of the GasTokenManager contract
interface IGasTokenManager {

    /// @notice Emitted when gas token balance is topped up
    /// @param sender Address of the sender
    /// @param receiver Address of the receiver
    /// @param value Amount of gas token topped up
    event GasTokenBalanceToppedUp(address indexed sender, address indexed receiver, uint256 indexed value);

    /// @notice Emitted when gas token is withdrawn
    /// @param receiver Address of the receiver
    /// @param value Amount of gas token withdrawn
    event GasTokenWithdrawn(address indexed receiver, uint256 indexed value);

    /// @notice Allows the contract to receive gas token to pay for callback execution
    receive() external payable;

    /// @notice Deposits gas token to any holder balance
    /// @param receiver The address of the receiver holder
    function fundWithGasToken(address receiver) external payable;

    /// @notice Withdraws gas token from the caller's balance
    /// @param amount Amount of gas token to withdraw
    /// @param receiver Address to send the withdrawn gas token to
    function retrieveGasToken(uint256 amount, address payable receiver) external;

    /// @notice Gets the gas token balance of a holder
    /// @param holder The address of the holder
    /// @return balance The gas token balance of the holder
    function gasTokenBalanceOf(address holder) external view returns (uint256 balance);
}
