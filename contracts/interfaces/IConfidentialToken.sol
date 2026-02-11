// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IConfidentialToken.sol - confidential-token
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

// cspell:words ECIES

pragma solidity ^0.8.24;

import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/BITE.sol";


/// @title IConfidentialToken
/// @author Dmytro Stebaiev
/// @notice Interface of the ConfidentialToken contract
interface IConfidentialToken is IBiteSupplicant {
    /// @notice Allows the contract to receive ETH to pay for callback execution
    receive() external payable;

    /// @notice Burns tokens from the caller's balance
    /// @param amount The amount of tokens to burn
    function burn(uint256 amount) external;

    /// @notice Deposits ETH to any holder balance
    /// @param receiver The address of the receiver holder
    function deposit(address receiver) external payable;

    /// @notice Registers a view key for the message sender
    /// @dev Combination of registerPublicKey and setViewerAddress (payable version)
    /// @param publicKey The public key to register
    function setViewerPublicKey(PublicKey memory publicKey) external payable;

    /// @notice Registers a view key in the contract
    /// @dev Does not associate the public key with a holder
    /// @param publicKey The public key to register
    function registerPublicKey(PublicKey memory publicKey) external;

    /// @notice Sets the address of the viewer allowed to view the sender's balance
    /// @dev The viewer must be already registered in the system via registerPublicKey
    /// @param viewer The address of the viewer
    function setViewerAddress(address viewer) external payable;

    /// @notice Sets number of ETH to be sent to pay for callback execution
    /// @param newFee New callback fee
    function setCallbackFee(uint256 newFee) external;

    /// @notice Sets the address of the EncryptECIES precompiled contract
    /// @param newAddress New address of the EncryptECIES precompiled contract
    function setEncryptECIESAddress(address newAddress) external;

    /// @notice Sets the address of the EncryptTE precompiled contract
    /// @param newAddress New address of the EncryptTE precompiled contract
    function setEncryptTEAddress(address newAddress) external;

    /// @notice Sets the address of the SubmitCTX precompiled contract
    /// @param newAddress New address of the SubmitCTX precompiled contract
    function setSubmitCTXAddress(address newAddress) external;

    /// @notice Withdraws ETH from the caller's balance
    /// @param amount Amount of ETH to withdraw
    /// @param receiver Address to send the withdrawn ETH to
    function withdraw(uint256 amount, address receiver) external;

    /// @notice Gets the encrypted balance of a holder
    /// @param holder The address of the holder
    /// @return encryptedBalance The encrypted balance of the holder
    function encryptedBalanceOf(address holder) external view returns (bytes memory encryptedBalance);

    /// @notice Gets the ETH balance of a holder
    /// @param holder The address of the holder
    /// @return balance The ETH balance of the holder
    function ethBalanceOf(address holder) external view returns (uint256 balance);
}
