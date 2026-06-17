// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IConfidentialToken.sol - confidential-token
 *   Copyright (C) 2025-Present SKALE Labs
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

// cspell:words ECIES

pragma solidity ^0.8.27;

import { PublicKey } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";


/// @title IConfidentialToken
/// @author Dmytro Stebaiev
/// @author Eduardo Vasques
/// @notice Interface of the ConfidentialToken contract
interface IConfidentialToken is IBiteSupplicant {

    /// @notice Emitted when callback fee is changed
    /// @param newFee New callback fee
    event CallbackFeeChanged(uint256 indexed newFee);

    /// @notice Emitted when a CTX is resubmitted due to outdated decrypted information
    /// @param callbackSender Address of the CTX sender that triggered the resubmission
    event CTXResubmitted(address indexed callbackSender);

    /// @notice Emitted when gas token balance is topped up
    /// @param sender Address of the sender
    /// @param receiver Address of the receiver
    /// @param value Amount of gas token topped up
    event GasTokenBalanceToppedUp(address indexed sender, address indexed receiver, uint256 indexed value);

    /// @notice Emitted when gas token is withdrawn
    /// @param receiver Address of the receiver
    /// @param value Amount of gas token withdrawn
    event GasTokenWithdrawn(address indexed receiver, uint256 indexed value);

    /// @notice Emitted when tokens (value omitted) are moved from one account (`from`) to another (`to`)
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

    /// @notice Emitted when a transfer event is decrypted for a viewer.
    /// @param viewer The account who paid and had rights for the decryption of the transfer event.
    /// @param from Address of the sender.
    /// @param to Address of the recipient.
    /// @param encryptedTransfer ECIES-encrypted transfer data for `viewer`.
    event ReEncryptedTransfer(
        address indexed viewer,
        address indexed from,
        address indexed to,
        bytes encryptedTransfer
    );

    /// @notice Emitted when a holder revokes all historic view permissions for a viewer.
    /// @param holder Address of the holder revoking access.
    /// @param viewer Address of the viewer whose permissions are revoked.
    event HistoricViewPermissionsRevoked(address indexed holder, address indexed viewer);

    /// @notice Emitted when a holder revokes a viewer's access to a specific transfer.
    /// @param holder Address of the holder revoking access.
    /// @param viewer Address of the viewer losing access.
    /// @param transferId ID of the transfer being revoked.
    event HistoricViewTransferIdRevoked(address indexed holder, address indexed viewer, uint256 indexed transferId);

    /// @notice Emitted when a holder grants a viewer access to a specific transfer.
    /// @param holder Address of the holder granting access.
    /// @param viewer Address of the viewer receiving access.
    /// @param transferId ID of the transfer being authorized.
    event HistoricViewTransferIdAuthorized(address indexed holder, address indexed viewer, uint256 indexed transferId);

    // Irrelevant to index any of the next parameters here
    // solhint-disable gas-indexed-events
    /// @notice Emitted when a holder grants a viewer access to transfers within a time range.
    /// @param holder Address of the holder granting access.
    /// @param viewer Address of the viewer receiving access.
    /// @param fromTimestamp Inclusive lower bound of the authorized time range.
    /// @param toTimestamp Non-inclusive upper bound of the authorized time range.
    event HistoricViewTimeRangeAuthorized(
        address indexed holder,
        address indexed viewer,
        uint256 fromTimestamp,
        uint256 toTimestamp
    );
    // solhint-enable gas-indexed-events

    /// @notice Emitted when a holder revokes a viewer's access to transfers within a time range.
    /// @param holder Address of the holder revoking access.
    /// @param viewer Address of the viewer losing access.
    event HistoricViewTimeRangeRevoked(address indexed holder, address indexed viewer);

    /// @notice Emitted during a transfer when the recipient has viewer registered
    /// @dev Emitted automatically at transfer time — no explicit request or fee required
    /// @param from Address of the sender
    /// @param to Address of the recipient — also the holder of the decryption key
    /// @param transferId ID of the transfer
    /// @param encryptedValue ECIES-Encrypted transfer value for `to` viewer's Public Key
    event TransferValueEncryptedForRecipient(
        address indexed from,
        address indexed to,
        uint256 indexed transferId,
        bytes encryptedValue
    );

    /// @notice Emitted during a transfer when the sender has a viewer registered
    /// @dev Emitted automatically at transfer time — no explicit request or fee required
    /// @param from Address of the sender
    /// @param to Address of the recipient — also the holder of the decryption key
    /// @param transferId ID of the transfer
    /// @param encryptedValue ECIES-Encrypted transfer value for `from` viewer's Public Key
    event TransferValueEncryptedForSender(
        address indexed from,
        address indexed to,
        uint256 indexed transferId,
        bytes encryptedValue
    );

    /// @notice Emitted when a public key is registered for a viewer address
    /// @param viewer Address of the viewer whose public key is registered
    event PublicKeyRegistered(address indexed viewer);

    /// @notice Emitted when a viewer is changed for a holder
    /// @param holder Address of the holder whose viewer is changed
    /// @param newViewer Address of the new viewer
    event ViewerChanged(address indexed holder, address indexed newViewer);

    /// @notice Allows the contract to receive gas token to pay for callback execution
    receive() external payable;

    /// @notice Initializes the contract for proxy deployment.
    /// @param name_ Name of the token.
    /// @param symbol_ Symbol of the token.
    /// @param version_ Version of the contract.
    /// @param initialAuthority Address of AccessManager initial authority.
    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata version_,
        address initialAuthority
    ) external;

    /// @notice Deposits gas token to any holder balance
    /// @param receiver The address of the receiver holder
    function fundWithGasToken(address receiver) external payable;

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

    /// @notice Sets amount of gas token to be sent to pay for callback execution
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

    /// @notice Withdraws gas token from the caller's balance
    /// @param amount Amount of gas token to withdraw
    /// @param receiver Address to send the withdrawn gas token to
    function retrieveGasToken(uint256 amount, address receiver) external;

    /// @notice Transfers tokens to another holder
    /// @param to The address of the recipient holder
    /// @param value The TE-encrypted amount of tokens to transfer
    function encryptedTransfer(address to, bytes calldata value) external;

    /// @notice Transfers tokens from one holder to another using allowance
    /// @param from The address of the sender holder
    /// @param to The address of the recipient holder
    /// @param value The TE-encrypted amount of tokens to transfer
    function encryptedTransferFrom(address from, address to, bytes calldata value) external;

    /// @notice Requests decryption of a single historic encrypted transfer payload with msg.sender as the viewer
    /// @dev Charges callbackFee from msg.sender even if not authorized to decrypt the payload
    /// @param encryptedTransferData TE-encrypted transfer payload emitted by the token
    function requestDecryptHistoricTransfer(bytes calldata encryptedTransferData) external;

    /// @notice Requests decryption of a single historic encrypted transfer payload
    /// @dev Charges callbackFee from msg.sender even if not authorized to decrypt the payload
    /// @param encryptedTransferData TE-encrypted transfer payload emitted by the token
    /// @param historicViewer Address of the viewer who will receive the decrypted transfer event if authorized
    function requestDecryptHistoricTransferFor(bytes calldata encryptedTransferData, address historicViewer) external;

    /// @notice Removes all historic view permissions for a viewer for msg.sender's history
    /// @dev Resets time window and clears explicitly authorized transfer IDs
    /// @param viewer Address whose historic view permissions are removed
    /// @return success Always returns true
    function removeHistoricViewAuth(address viewer) external returns (bool success);


    /// @notice Removes the time range authorization for a viewer
    /// @param viewer Address whose time range authorization is removed
    /// @return success Always returns true
    function removeHistoricViewTimeRange(address viewer) external returns (bool success);

    /// @notice Removes one explicitly authorized historic transfer ID for a viewer
    /// @param viewer Address whose transferId authorization is removed
    /// @param transferId Transfer ID to revoke
    /// @return success Always returns true
    function removeHistoricViewTransferId(address viewer, uint256 transferId) external returns (bool success);

    /// @notice Authorizes a viewer to decrypt transfers from msg.sender within a time range
    /// @dev Allows only fromTimestamp < toTimestamp
    /// @param viewer Address to authorize
    /// @param fromTimestamp Inclusive lower bound timestamp
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

    /// @notice Checks if a viewer is authorized to decrypt a historic transfer
    /// @dev The transfer content is made up, and viewer may have access through time range or transfer ID
    /// @param viewer Address of the viewer requesting decryption
    /// @param transferId ID of the transfer to check authorization for
    /// @param from Address of the sender of the transfer
    /// @param to Address of the recipient of the transfer
    /// @param timestamp Timestamp of the transfer
    /// @return canDecrypt True if the viewer is authorized to decrypt the transfer, false otherwise
    function canDecryptHistoricTransfer(
        address viewer,
        uint256 transferId,
        address from,
        address to,
        uint256 timestamp
    ) external view returns (bool canDecrypt);

    /// @notice Gets the encrypted balance of a holder
    /// @param holder The address of the holder
    /// @return encryptedBalance The encrypted balance of the holder
    function encryptedBalanceOf(address holder) external view returns (bytes memory encryptedBalance);

    /// @notice Encrypts `value` for `holder` using Threshold Encryption
    /// @dev Produces a cipher-text suitable for use in `encryptedTransfer` and `encryptedTransferFrom`.
    ///      The cipher-text binds `holder` as the salt — only a transaction submitted by `holder`
    ///      (or by a spender in `encryptedTransferFrom`) will pass the on-callback salt check.
    /// @param holder The address used as the encryption salt; must match the submitter at callback time
    /// @param value The plaintext token amount to encrypt
    /// @return encryptedValue TE-encrypted bytes ready to pass to `encryptedTransfer` or `encryptedTransferFrom`
    function encryptValue(address holder, uint256 value) external view returns (bytes memory encryptedValue);

    /// @notice Gets the gas token balance of a holder
    /// @param holder The address of the holder
    /// @return balance The gas token balance of the holder
    function gasTokenBalanceOf(address holder) external view returns (uint256 balance);
}
