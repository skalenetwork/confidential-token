// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfidentialEIP3009.sol - confidential-token
 *   Copyright (C) 2025-Present SKALE Labs
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

// ----------------------------------------------------------------------------
// This file extends the original EIP-3009 implementation with BITE functionality for SKALE chains.
// ----------------------------------------------------------------------------

// cspell:words typehash mixedcase

pragma solidity ^0.8.27;

import { EIP3009, EIP712Utils } from "./EIP3009.sol";


/// @title EIP3009 upgradeable extension for ConfidentialToken
/// @author Eduardo Vasques
/// @notice Extension of EIP3009 with encrypted value parameter for SKALE chains using BITE
abstract contract ConfidentialEIP3009 is EIP3009 {

    /// @notice typehash for transfer with authorization with encrypted value
    bytes32 public constant ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        // This is calculated during compilation time
        // so lengthy strings are not an issue
        // solhint-disable-next-line gas-small-strings
        keccak256("TransferWithAuthorization("
            "address from,"
            "address to,"
            "bytes value,"
            "uint256 validAfter,"
            "uint256 validBefore,"
            "bytes32 nonce)"
        );

    /// @notice typehash for receiving with authorization with encrypted value
    bytes32 public constant ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        // This is calculated during compilation time
        // so lengthy strings are not an issue
        // solhint-disable-next-line gas-small-strings
        keccak256("ReceiveWithAuthorization("
            "address from,"
            "address to,"
            "bytes value,"
            "uint256 validAfter,"
            "uint256 validBefore,"
            "bytes32 nonce)"
        );


    /**
     * @notice Execute a transfer with a signed authorization
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred (TE-encrypted)
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function encryptedTransferWithAuthorization(
        address from,
        address to,
        bytes calldata value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _transferWithAuthorization({
            typeHash: ENCRYPTED_TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from: from,
            to: to,
            value: value,
            validAfter: validAfter,
            validBefore: validBefore,
            nonce: nonce,
            v: v,
            r: r,
            s: s
        });
    }

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address matches
     * the caller of this function to prevent front-running attacks. (See security
     * considerations)
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred (TE-encrypted)
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function encryptedReceiveWithAuthorization(
        address from,
        address to,
        bytes calldata value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(to == msg.sender, CallerMustBeThePayee(msg.sender, to));

        _transferWithAuthorization({
            typeHash: ENCRYPTED_RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
            from: from,
            to: to,
            value: value,
            validAfter: validAfter,
            validBefore: validBefore,
            nonce: nonce,
            v: v,
            r: r,
            s: s
        });
    }

    // The OpenZeppelin Upgrades plugin's static analyzer relies on the __ContractName_init naming
    // convention to identify and track which parent contracts have been initialized.
    // slither-disable-start naming-convention
    // solhint-disable-next-line func-name-mixedcase
    function __ConfidentialEIP3009_init() internal onlyInitializing {
        __EIP3009_init();
    }
    // slither-disable-end naming-convention

    /// @notice Internal function to execute transfer with authorization
    /// @param typeHash      Type hash of the authorization
    /// @param from          Payer's address (Authorizer)
    /// @param to            Payee's address
    /// @param value         Amount to be transferred
    /// @param validAfter    The time after which this is valid (unix time)
    /// @param validBefore   The time before which this is valid (unix time)
    /// @param nonce         Unique nonce
    /// @param v             v of the signature
    /// @param r             r of the signature
    /// @param s             s of the signature
    function _transferWithAuthorization(
        bytes32 typeHash,
        address from,
        address to,
        bytes calldata value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        // Time specific logic is used
        // to implement EIP-3009
        // solhint-disable not-rely-on-time
        // slither-disable-start timestamp
        require(block.timestamp > validAfter, AuthorizationIsNotYetValid(validAfter));
        require(block.timestamp < validBefore, AuthorizationIsExpired(validBefore));
        // solhint-enable not-rely-on-time
        // slither-disable-end timestamp
        require(!_authorizationStates[from][nonce], AuthorizationUsedError(from, nonce));

        bytes memory data = abi.encode(
            typeHash,
            from,
            to,
            keccak256(value),
            validAfter,
            validBefore,
            nonce
        );
        require(
            EIP712Utils.recover({
                domainSeparator: _domainSeparatorV4(),
                v: v,
                r: r,
                s: s,
                typeHashAndData: data
            }) == from,
            InvalidSignature()
        );

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _encryptedTransfer(from, to, value);
    }

    function _encryptedTransfer(address from, address to, bytes calldata value) internal virtual;
}
