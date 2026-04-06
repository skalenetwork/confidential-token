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

import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { PublicKey } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";


/// @title IConfidentialToken
/// @author Dmytro Stebaiev
/// @notice Interface of the ConfidentialToken contract
interface IConfidentialToken is IBiteSupplicant {

    /// @notice Canonical payload schema for encrypted transfer metadata
    struct TransferData {
        address from;
        address to;
        uint256 value;
        uint256 timestamp;
        uint256 transferId;
    }

    /// @notice Struct to store authorized viewers settings to decrypt historic transfers
    struct HistoricViewAuth {
        uint256 fromTimestamp;
        uint256 toTimestamp;
        EnumerableSet.UintSet transferIds;
    }

    /// @notice Emitted when callback fee is changed
    /// @param newFee New callback fee
    event CallbackFeeChanged(uint256 indexed newFee);

    /// @notice Emitted when a CTX is resubmitted due to outdated decrypted information
    /// @param callbackSender Address of the CTX sender that triggered the resubmission
    event CTXResubmitted(address indexed callbackSender);

    /// @notice Emitted when ETH balance is topped up
    /// @param sender Address of the sender
    /// @param receiver Address of the receiver
    /// @param value Amount of ETH topped up
    event EthBalanceToppedUp(address indexed sender, address indexed receiver, uint256 indexed value);

    /// @notice Emitted when ETH is withdrawn
    /// @param receiver Address of the receiver
    /// @param value Amount of ETH withdrawn
    event EthWithdrawn(address indexed receiver, uint256 indexed value);

    /// @notice Emitted when `value` tokens are moved from one account (`from`) to another (`to`).
    /// @param from Address tokens are moved from
    /// @param to Address tokens are moved to
    event Transfer(address indexed from, address indexed to);

    /// @notice Emitted when SubmitCTX precompiled contract address is changed
    /// @param newAddress New address of the SubmitCTX precompiled contract
    event SubmitCTXAddressChanged(address indexed newAddress);

    /// @notice Emitted when EncryptECIES precompiled contract address is changed
    /// @param newAddress New address of the EncryptECIES precompiled contract
    event EncryptECIESAddressChanged(address indexed newAddress);

    /// @notice Emitted when EncryptTE precompiled contract address is changed
    /// @param newAddress New address of the EncryptTE precompiled contract
    event EncryptTEAddressChanged(address indexed newAddress);

    /// @notice Emitted when a transfer is made
    /// @param transferId ID of the transfer
    /// @param from Address of the sender
    /// @param to Address of the recipient
    /// @param encryptedData TE-Encrypted data of the transfer
    event EncryptedTransfer(uint256 indexed transferId, address indexed from, address indexed to, bytes encryptedData);

    /// @notice Emitted when a transfer event is decrypted for a viewer
    /// @param viewer The account who paid and had rights for the decryption of the transfer event
    /// @param from Address of the sender
    /// @param to Address of the recipient
    /// @param encryptedValue ECIES-Encrypted value of the transferred tokens
    event ReEncryptedTransfer(address indexed viewer, address indexed from, address indexed to, bytes encryptedValue);

    /// @notice Emitted during a transfer when the recipient has a registered public key
    /// @dev Emitted automatically at transfer time — no explicit request or fee required
    /// @param from Address of the sender
    /// @param to Address of the recipient — also the holder of the decryption key
    /// @param encryptedValue ECIES-Encrypted transfer value for `to` Public Key
    event TransferValueEncryptedForRecipient(address indexed from, address indexed to, bytes encryptedValue);

    // Irrelevant to index any of the next parameters here
    // solhint-disable gas-indexed-events
    /// @notice Emitted when a holder grants a viewer access to transfers within a time range
    /// @param holder Address of the holder granting access
    /// @param viewer Address of the viewer receiving access
    /// @param fromTimestamp Non-inclusive lower bound of the authorized time range
    /// @param toTimestamp Non-inclusive upper bound of the authorized time range
    event HistoricViewTimeRangeAuthorized(
        address indexed holder,
        address indexed viewer,
        uint256 fromTimestamp,
        uint256 toTimestamp
    );
    // solhint-enable gas-indexed-events


    /// @notice Emitted when a holder grants a viewer access to a specific transfer
    /// @param holder Address of the holder granting access
    /// @param viewer Address of the viewer receiving access
    /// @param transferId ID of the transfer being authorized
    event HistoricViewTransferIdAuthorized(address indexed holder, address indexed viewer, uint256 indexed transferId);

    /// @notice Emitted when a holder revokes all historic view permissions for a viewer
    /// @param holder Address of the holder revoking access
    /// @param viewer Address of the viewer whose permissions are revoked
    event HistoricViewPermissionsRevoked(address indexed holder, address indexed viewer);

    /// @notice Emitted when a holder revokes a viewer's access to a specific transfer
    /// @param holder Address of the holder revoking access
    /// @param viewer Address of the viewer losing access
    /// @param transferId ID of the transfer being revoked
    event HistoricViewTransferIdRevoked(address indexed holder, address indexed viewer, uint256 indexed transferId);

    /// @notice Emitted when a public key is registered for a viewer address
    /// @param viewer Address of the viewer whose public key is registered
    event PublicKeyRegistered(address indexed viewer);

    /// @notice Emitted when a viewer is changed for a holder
    /// @param holder Address of the holder whose viewer is changed
    /// @param newViewer Address of the new viewer
    event ViewerChanged(address indexed holder, address indexed newViewer);

    // Errors - Publicly relevant
    error InsufficientBalance();
    error InsufficientEth(uint256 required, uint256 available);
    error InvalidPublicKey();
    error InvalidTransferId(uint256 transferId);
    error NoViewerRegisteredForHolder(address holder);
    error PublicKeyIsNotRegistered(address viewer);
    error UserIsNotAuthorizedToDecryptTransfer(address user, uint256 transferId);
    error ValueIsEncrypted();

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

    /// @notice Transfers tokens to another holder
    /// @param to The address of the recipient holder
    /// @param value The TE-encrypted amount of tokens to transfer
    function encryptedTransfer(address to, bytes calldata value) external;

    /// @notice Transfers tokens from one holder to another using allowance
    /// @param from The address of the sender holder
    /// @param to The address of the recipient holder
    /// @param value The TE-encrypted amount of tokens to transfer
    function encryptedTransferFrom(address from, address to, bytes calldata value) external;

    /// @notice Requests decryption of a single historic encrypted transfer payload
    /// @dev Charges callbackFee from msg.sender even if not authorized to decrypt the payload
    /// @param encryptedTransferData TE-encrypted transfer payload emitted by the token
    function requestDecryptHistoricTransfer(bytes calldata encryptedTransferData) external;

    /// @notice Removes all historic view permissions for a viewer for msg.sender's history
    /// @dev Resets time window and clears explicitly authorized transfer IDs
    /// @param viewer Address whose historic view permissions are removed
    /// @return success Always returns true
    function removeHistoricViewAuth(address viewer) external returns (bool success);

    /// @notice Removes one explicitly authorized historic transfer ID for a viewer
    /// @param viewer Address whose transferId authorization is removed
    /// @param transferId Transfer ID to revoke
    /// @return success Always returns true
    function removeHistoricViewTransferId(address viewer, uint256 transferId) external returns (bool success);

    /// @notice Authorizes a viewer to decrypt transfers from msg.sender within a time range
    /// @notice setting fromTimestamp >= toTimestamp means no time range is authorized
    /// @param viewer Address to authorize
    /// @param fromTimestamp Non-inclusive lower bound timestamp
    /// @param toTimestamp Non-inclusive upper bound timestamp
    /// @return success Always returns true
    function authorizeHistoricViewTimeRange(
        address viewer,
        uint256 fromTimestamp,
        uint256 toTimestamp
    ) external returns (bool success);

    /// @notice Authorizes a viewer to decrypt one historic transfer by transfer ID
    /// @param viewer Address to authorize
    /// @param transferId Transfer ID to authorize
    /// @return success Always returns true
    function authorizeHistoricViewTransferId(address viewer, uint256 transferId) external returns (bool success);

    /// @notice Gets the encrypted balance of a holder
    /// @param holder The address of the holder
    /// @return encryptedBalance The encrypted balance of the holder
    function encryptedBalanceOf(address holder) external view returns (bytes memory encryptedBalance);

    /// @notice Gets the ETH balance of a holder
    /// @param holder The address of the holder
    /// @return balance The ETH balance of the holder
    function ethBalanceOf(address holder) external view returns (uint256 balance);
}
