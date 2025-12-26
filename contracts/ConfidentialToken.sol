// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfidentialToken.sol - confidential-token
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

import { AccessManaged } from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import { EIP3009 } from "./eip3009/EIP3009.sol";

import { ZeroAddress } from "./errors.sol";
import { IBiteSupplicant } from "./interfaces/bite/IBiteSupplicant.sol";
import { IConfidentialToken } from "./interfaces/IConfidentialToken.sol";
import { Precompiled } from "./Precompiled.sol";
import { PublicKey } from "./types.sol";


/// @title ConfidentialToken
/// @author Dmytro Stebaiev
/// @notice ERC20-like token with encrypted balances
contract ConfidentialToken is EIP3009, ERC20Permit, AccessManaged, IConfidentialToken {
    using Address for address;
    using Address for address payable;
    using Math for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // TODO: add default addresses for precompiled contracts

    /// @notice Address of the EncryptECIES precompiled contract
    address public encryptECIESAddress;

    /// @notice Address of the EncryptTE precompiled contract
    address public encryptTEaddress;

    /// @notice Mapping of holder addresses to their public keys
    mapping(address holder => PublicKey publicKey) public publicKeys;

    /// @notice Address of the submitCTX precompiled contract
    address public submitCTXAddress;

    /// @notice Version of the contract
    /// @dev Is used to get proper ABI
    string public version;

    /// @notice Encrypted with BITE Threshold Key (T_Key) - Used for contract logic
    mapping(address holder => bytes encryptedBalance) private _thresholdBalances;

    /// @notice Encrypted with User's Public Key (U_Key) - Used for local viewing
    mapping(address holder => bytes encryptedBalance) private _userBalances;

    EnumerableSet.AddressSet private _callbackSenders;

    /// @notice Total supply of the token
    /// @dev Can't reuse totalSupply from ERC20 because the field is private there
    uint256 private _totalSupply;

    /// @notice Emitted when tokens are transferred, including mints and burns
    event Transferred();

    /// @notice Emitted when SubmitCTX precompiled contract address is changed
    /// @param newAddress New address of the SubmitCTX precompiled contract
    event SubmitCTXAddressChanged(address indexed newAddress);

    /// @notice Emitted when EncryptECIES precompiled contract address is changed
    /// @param newAddress New address of the EncryptECIES precompiled contract
    event EncryptECIESAddressChanged(address indexed newAddress);

    /// @notice Emitted when EncryptTE precompiled contract address is changed
    /// @param newAddress New address of the EncryptTE precompiled contract
    event EncryptTEAddressChanged(address indexed newAddress);

    /// @notice Emitted when a public key is registered
    /// @param holder Address of the holder whose public key is registered
    event PublicKeyRegistered(address indexed holder);

    error ValueIsEncrypted();
    error AccessViolation();
    error DecryptionBadFormat();
    error InsufficientBalance();

    /// @notice Sets the values for {name} and {symbol}.
    /// @param name_     Name of the token
    /// @param symbol_   Symbol of the token
    /// @param version_  Version of the contract
    /// @param initialAuthority Address of AccessManager initial authority
    constructor(
        string memory name_,
        string memory symbol_,
        string memory version_,
        address initialAuthority
    )
        ERC20(name_, symbol_)
        ERC20Permit(name_)
        AccessManaged(initialAuthority)
    {
        version = version_;
    }

    /// @inheritdoc IConfidentialToken
    function mint(address to, uint256 amount) external payable override restricted {
        _mint(to, amount);
    }

    /// @inheritdoc IBiteSupplicant
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(_callbackSenders.remove(msg.sender), AccessViolation());
        (address from, address to, uint256 value) = abi.decode(
            plaintextArguments[0],
            (address, address, uint256)
        );
        if (decryptedArguments.length == 1) {
            // mint or burn
            require((from == address(0)) != (to == address(0)), DecryptionBadFormat());
        } else if (decryptedArguments.length == 2) {
            // token transfer
            require(
                decryptedArguments[1].length == 32 || decryptedArguments[1].length == 0,
                DecryptionBadFormat()
            );
        } else {
            revert DecryptionBadFormat();
        }
        require(
            decryptedArguments[0].length == 32 || decryptedArguments[0].length == 0,
            DecryptionBadFormat()
        );

        uint256 fromBalance = 0;
        uint256 toBalance = 0;
        if (from == address(0)) {
            // mint
            toBalance = _decodeBalance(decryptedArguments[0]);
        } else if (to == address(0)) {
            // burn
            fromBalance = _decodeBalance(decryptedArguments[0]);
        } else {
            // transfer
            fromBalance = _decodeBalance(decryptedArguments[0]);
            toBalance = _decodeBalance(decryptedArguments[1]);
        }

        _decryptedUpdate({
            from: from,
            to: to,
            fromBalance: fromBalance,
            toBalance: toBalance,
            value: value
        });
    }

    /// @inheritdoc IConfidentialToken
    function registerPublicKey(PublicKey calldata publicKey) external override restricted {
        address holder = _publicKeyToAddress(publicKey);
        if (!_knownPublicKey(holder)) {
            publicKeys[holder] = publicKey;
            emit PublicKeyRegistered(holder);
        }
    }

    /// @inheritdoc IConfidentialToken
    function setSubmitCTXAddress(address newAddress) external override restricted {
        require(newAddress != address(0), ZeroAddress());
        submitCTXAddress = newAddress;
        emit SubmitCTXAddressChanged(newAddress);
    }

    /// @inheritdoc IConfidentialToken
    function setEncryptECIESAddress(address newAddress) external override restricted {
        require(newAddress != address(0), ZeroAddress());
        encryptECIESAddress = newAddress;
        emit EncryptECIESAddressChanged(newAddress);
    }

    /// @inheritdoc IConfidentialToken
    function setEncryptTEAddress(address newAddress) external override restricted {
        require(newAddress != address(0), ZeroAddress());
        encryptTEaddress = newAddress;
        emit EncryptTEAddressChanged(newAddress);
    }

    /// @inheritdoc IConfidentialToken
    function encryptedBalanceOf(address holder) external view override returns (bytes memory encryptedBalance) {
        return _userBalances[holder];
    }

    // Public functions

    /// @inheritdoc ERC20
    function totalSupply() public view override returns (uint256 supply) {
        return _totalSupply;
    }

    // If name returned variable
    // compiler gives warning about unused variable
    // solhint-disable gas-named-return-values
    /// @inheritdoc ERC20
    function balanceOf(address) public pure override returns (uint256) {
        revert ValueIsEncrypted();
    }
    // solhint-disable-enable gas-named-return-values

    // Internal functions

    /// @notice Internal function to handle decrypted balance updates
    /// @dev Alternative implementation of _update function from ERC20
    /// @param from          Address to transfer tokens from
    /// @param to            Address to transfer tokens to
    /// @param fromBalance   Decrypted balance of the `from` address
    /// @param toBalance     Decrypted balance of the `to` address
    /// @param value         Amount of tokens to be transferred
    function _decryptedUpdate(
        address from,
        address to,
        uint256 fromBalance,
        uint256 toBalance,
        uint256 value
    )
        internal
    {
        uint256 updatedFromBalance = fromBalance;
        uint256 updatedToBalance = toBalance;

        if (from == address(0)) {
            _totalSupply += value;
        } else {
            if (fromBalance < value) {
                revert InsufficientBalance();
            }
            updatedFromBalance = fromBalance - value;
        }

        if (to == address(0)) {
            _totalSupply -= value;
        } else {
            updatedToBalance = toBalance + value;
        }

        _setBalance(from, updatedFromBalance);
        _setBalance(to, updatedToBalance);

        emit Transferred();
    }

    /// @notice Transfers a `value` amount of tokens from `from` to `to`
    /// @notice or alternatively mints (or burns) if `from` (or `to`) is the zero address.
    /// @param from  Address to transfer tokens from
    /// @param to    Address to transfer tokens to
    /// @param value Amount of tokens to be transferred
    function _update(address from, address to, uint256 value) internal override {
        bytes memory encryptedFromBalance = bytes("");
        bytes memory encryptedToBalance = bytes("");
        uint256 encryptedArgumentsLength = 0;
        uint256 fromIndex = 0;
        uint256 toIndex = 0;
        if (from != address(0)) {
            encryptedFromBalance = _thresholdBalances[from];
            fromIndex = encryptedArgumentsLength;
            ++encryptedArgumentsLength;
        }
        if (to != address(0)) {
            encryptedToBalance = _thresholdBalances[to];
            toIndex = encryptedArgumentsLength;
            ++encryptedArgumentsLength;
        }

        bytes[] memory encryptedArguments = new bytes[](encryptedArgumentsLength);
        if (from != address(0)) {
            encryptedArguments[fromIndex] = encryptedFromBalance;
        }
        if (to != address(0)) {
            encryptedArguments[toIndex] = encryptedToBalance;
        }

        bytes[] memory plaintextArguments = new bytes[](1);
        plaintextArguments[0] = abi.encode(from, to, value);

        address payable callback = Precompiled.submitCTX(
            submitCTXAddress,
            msg.value / tx.gasprice,
            encryptedArguments,
            plaintextArguments
        );

        require(_callbackSenders.add(callback), AccessViolation());

        callback.sendValue(msg.value);
    }

    // Private functions

    function _setBalance(address holder, uint256 balance) private {
        if (balance > 0) {
            _thresholdBalances[holder] = Precompiled.encryptTE(encryptTEaddress, abi.encode(balance));

            if (_knownPublicKey(holder)) {
                PublicKey memory holderPublicKey = publicKeys[holder];
                _userBalances[holder] = Precompiled.encryptECIES(
                    encryptTEaddress,
                    abi.encode(balance),
                    holderPublicKey
                );
            }
        } else {
            delete _thresholdBalances[holder];
            delete _userBalances[holder];
        }
    }

    /// @notice Checks if a public key is known for a given holder address
    /// @param holder The address of the holder
    /// @return True if the public key is known, false otherwise
    function _knownPublicKey(address holder) private view returns (bool) {
        return publicKeys[holder].x != bytes32(0) || publicKeys[holder].y != bytes32(0);
    }

    function _decodeBalance(bytes calldata encodedBalance) private pure returns (uint256 balance) {
        if (encodedBalance.length == 0) {
            return 0;
        }
        return uint256(bytes32(encodedBalance));
    }

    /**
     * @notice Converts a public key to an Ethereum address
     * @dev Uses keccak256 hash of the concatenated public key components
     * @param publicKey The public key to convert
     * @return nodeAddress The derived Ethereum address
     */
    function _publicKeyToAddress(
        PublicKey memory publicKey
    )
        private
        pure
        returns (address nodeAddress)
    {
        bytes32 hash = keccak256(abi.encodePacked(publicKey.x, publicKey.y));
        return address(uint160(uint256(hash)));
    }
}
