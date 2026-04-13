// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   EIP3009.sol - confidential-token
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

// ----------------------------------------------------------------------------
// This file is a modified version of the original EIP-3009 implementation.
//
// Original Source: https://github.com/CoinbaseStablecoin/eip-3009
// Original Copyright (c) 2018-2020 Coinbase, Inc.
//
// The original code is licensed under the MIT License.
// A copy of the original MIT License is included in this repository at:
// /licenses/LICENSE_COINBASE
// ----------------------------------------------------------------------------

// cspell:words typehash

pragma solidity ^0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

import { EIP712Utils } from "./EIP712Utils.sol";


/// @title EIP3009
/// @author Dmytro Stebaiev
/// @notice ERC20 token with transfer and receive with authorization functionality
abstract contract EIP3009 is ERC20, EIP712 {
    /// @notice typehash for transfer with authorization
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        // This is calculated during compilation time
        // so lengthy strings are not an issue
        // solhint-disable-next-line gas-small-strings
        keccak256("TransferWithAuthorization("
            "address from,"
            "address to,"
            "uint256 value,"
            "uint256 validAfter,"
            "uint256 validBefore,"
            "bytes32 nonce)"
        );

    /// @notice typehash for receiving with authorization
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        // This is calculated during compilation time
        // so lengthy strings are not an issue
        // solhint-disable-next-line gas-small-strings
        keccak256("ReceiveWithAuthorization("
            "address from,"
            "address to,"
            "uint256 value,"
            "uint256 validAfter,"
            "uint256 validBefore,"
            "bytes32 nonce)"
        );

    /// @notice typehash for canceling an authorization
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        // This is calculated during compilation time
        // so lengthy strings are not an issue
        // solhint-disable-next-line gas-small-strings
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");

    /**
     * @dev authorizer address => nonce => state (true = used / false = unused)
     */
    mapping(address authorizer => mapping(bytes32 nonce => bool state)) internal _authorizationStates;

    /// @notice Emitted when an authorization is used
    /// @param authorizer    Authorizer's address
    /// @param nonce         Nonce of the authorization
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    /// @notice Emitted when an authorization is canceled
    /// @param authorizer    Authorizer's address
    /// @param nonce         Nonce of the authorization
    event AuthorizationCanceled(
        address indexed authorizer,
        bytes32 indexed nonce
    );

    error InvalidSignature();
    error AuthorizationIsNotYetValid(uint256 validAfter);
    error AuthorizationIsExpired(uint256 validBefore);
    error AuthorizationUsedError(address authorizer, bytes32 nonce);
    error CallerMustBeThePayee(address caller, address payee);

    /**
     * @notice Execute a transfer with a signed authorization
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _transferWithAuthorization({
            typeHash: TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
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
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(to == msg.sender, CallerMustBeThePayee(msg.sender, to));

        _transferWithAuthorization({
            typeHash: RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
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
     * @notice Attempt to cancel an authorization
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(
            !_authorizationStates[authorizer][nonce],
            AuthorizationUsedError(authorizer, nonce)
        );

        bytes memory data = abi.encode(
            CANCEL_AUTHORIZATION_TYPEHASH,
            authorizer,
            nonce
        );
        require(
            EIP712Utils.recover({
                domainSeparator: _domainSeparatorV4(),
                v: v,
                r: r,
                s: s,
                typeHashAndData: data
            }) == authorizer,
            InvalidSignature()
        );

        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    /**
     * @notice Returns the state of an authorization
     * @dev Nonces are randomly generated 32-byte data unique to the authorizer's
     * address
     * @param authorizer    Authorizer's address
     * @param nonce         Nonce of the authorization
     * @return used True if the nonce is used
     */
    function authorizationState(address authorizer, bytes32 nonce)
        external
        view
        returns (bool used)
    {
        return _authorizationStates[authorizer][nonce];
    }

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
        uint256 value,
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
            value,
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

        _transfer(from, to, value);
    }
}
