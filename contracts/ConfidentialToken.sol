// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ConfidentialToken.sol - confidential-token
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

// cspell:words ECIES mixedcase

pragma solidity ^0.8.27;

import {
    AccessManagedUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagedUpgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    ERC20PermitUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { BITE, PublicKey } from "@skalenetwork/bite-solidity/BITE.sol";
import { ConfidentialEIP3009 } from "./eip3009/ConfidentialEIP3009.sol";
import { DecryptionBadFormat, ZeroAddress } from "./errors.sol";
import { HistoricView } from "./HistoricView.sol";
import { IBiteSupplicant, IConfidentialToken } from "./interfaces/IConfidentialToken.sol";


/// @title ConfidentialToken
/// @author Dmytro Stebaiev
/// @author Eduardo Vasques
/// @notice Upgradeable ERC20-like token with encrypted balances
contract ConfidentialToken is
    ERC20PermitUpgradeable,
    ConfidentialEIP3009,
    AccessManagedUpgradeable,
    IConfidentialToken
{
    using Address for address;
    using Address for address payable;
    using Math for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;
    using HistoricView for HistoricView.AuthStorage;

    struct TransferInfo {
        address from;
        address to;
        address spender;
        address gasPayer;
        uint256 submittedBlockNumber;
    }

    uint8 private constant _TRANSFER_ACTION = 0;
    uint8 private constant _HISTORIC_VIEW_ACTION = 1;

    /// @notice Specifies amount of gas token to be sent to pay for callback execution
    uint256 public callbackFee;

    /// @notice Address of the EncryptECIES precompiled contract
    address public encryptECIESAddress;

    /// @notice Address of the EncryptTE precompiled contract
    address public encryptTEAddress;

    /// @notice Mapping of holder addresses to their viewers' addresses
    mapping(address holder => address viewerAddress) public viewerAddresses;

    /// @notice Mapping of addresses to their public keys
    mapping(address accountAddress => PublicKey publicKey) public publicKeys;

    /// @notice Address of the submitCTX precompiled contract
    address public submitCTXAddress;

    /// @notice Version of the contract
    /// @dev Is used to get proper ABI
    string public version;

    /// @notice Mapping of holder addresses to their authorized viewers' settings to decrypt historic transfers
    HistoricView.AuthStorage private _historicViewAuth;

    /// @notice Encrypted with BITE Threshold Key (T_Key) - Used for contract logic
    mapping(address holder => bytes encryptedBalance) private _thresholdBalances;

    /// @notice Encrypted with User's Public Key (U_Key) - Used for local viewing
    mapping(address holder => bytes encryptedBalance) private _userBalances;

    mapping(address holder => uint256 gasToken) private _gasTokenBalance;

    mapping(address holder => uint256 blockNumber) private _lastChanged;

    EnumerableSet.AddressSet private _callbackSenders;

    /// @notice Total supply of the token
    /// @dev Can't reuse totalSupply from ERC20 because the field is private there
    uint256 private _totalSupply;

    /// @notice Internal ID of the next transfer
    uint256 private _transferId;

    // Errors
    error AccessViolation();
    error ActionNotRecognized();
    error InsufficientBalance();
    error InsufficientGasToken(uint256 required, uint256 available);
    error InvalidPublicKey();
    error InvalidSaltForTransactionValue();
    error InvalidTransferId(uint256 transferId);
    error NoViewerRegisteredForHolder(address holder);
    error PublicKeyIsNotRegistered(address viewer);
    error ValueIsEncrypted();
    error ValueWasNotEncryptedCorrectly();
    error WrongPlaintextFormat();

    /// @notice Modifier to check if the user is registered
    /// @param user The address of the user to check
    modifier onlyRegisteredUser(address user) {
        require(_knownPublicKey(user), PublicKeyIsNotRegistered(user));
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    /// @notice Sets up the contract for proxy or direct deployment.
    /// @param proxyMode If true, disables initializers for proxy deployment.
    ///                  If false, initializes the contract directly.
    /// @param name_ Name of the token. Ignored when proxyMode is true.
    /// @param symbol_ Symbol of the token. Ignored when proxyMode is true.
    /// @param version_ Version of the contract. Ignored when proxyMode is true.
    /// @param initialAuthority Address of AccessManager initial authority. Ignored when proxyMode is true.
    constructor(
        bool proxyMode,
        string memory name_,
        string memory symbol_,
        string memory version_,
        address initialAuthority
    ) {
        if (proxyMode) {
            _disableInitializers();
        } else {
            ConfidentialToken.initialize(name_, symbol_, version_, initialAuthority);
        }
    }

    /// @inheritdoc IConfidentialToken
    receive() external payable override {
        fundWithGasToken(msg.sender);
    }


    /// @inheritdoc IBiteSupplicant
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(_callbackSenders.remove(msg.sender), AccessViolation());
        uint8 action = _parseAction(plaintextArguments);
        _handleAction(action, decryptedArguments, plaintextArguments);
    }

    /// @inheritdoc IConfidentialToken
    function encryptedTransfer(address to, bytes calldata value) external override {
        _encryptedTransfer(msg.sender, to, value);
    }

    /// @inheritdoc IConfidentialToken
    function encryptedTransferFrom(
        address from,
        address to,
        bytes calldata value
    ) external override {
        _encryptedTransferFrom(from, to, value);
    }

    /// @inheritdoc IConfidentialToken
    function requestDecryptHistoricTransfer(bytes calldata encryptedTransferData) external override {
        // This function is kept for backward compatibility with older versions of the contract
        requestDecryptHistoricTransferFor(encryptedTransferData, msg.sender);
    }

    /// @inheritdoc IConfidentialToken
    function removeHistoricViewAuth(
        address viewer
    )
        external
        override
        returns (bool success)
    {
        if(_historicViewAuth.revokeAll(msg.sender, viewer)) {
            emit HistoricViewPermissionsRevoked(msg.sender, viewer);
        }
        return true;
    }

    /// @inheritdoc IConfidentialToken
    function removeHistoricViewTimeRange(
        address viewer
    )
        external
        override
        returns (bool success)
    {
        if(_historicViewAuth.revokeTimeRange(msg.sender, viewer)) {
            emit HistoricViewTimeRangeRevoked(msg.sender, viewer);
        }
        return true;
    }

    /// @inheritdoc IConfidentialToken
    function removeHistoricViewTransferId(
        address viewer,
        uint256 transferId
    )
        external
        override
        returns (bool success)
    {
        require(transferId < _transferId, InvalidTransferId(transferId));
        if (_historicViewAuth.revokeTransferId(msg.sender, viewer, transferId)) {
            emit HistoricViewTransferIdRevoked(msg.sender, viewer, transferId);
        }
        return true;
    }

    /// @inheritdoc IConfidentialToken
    function authorizeHistoricViewTimeRange(
        address viewer,
        uint256 fromTimestamp,
        uint256 toTimestamp
    )
        external
        override
        onlyRegisteredUser(viewer)
        returns (bool success)
    {
        _historicViewAuth.authorizeTimeRange(msg.sender, viewer, fromTimestamp, toTimestamp);
        emit HistoricViewTimeRangeAuthorized(msg.sender, viewer, fromTimestamp, toTimestamp);
        return true;
    }

    /// @inheritdoc IConfidentialToken
    function authorizeHistoricViewTransferId(
        address viewer,
        uint256 transferId
    )
        external
        override
        onlyRegisteredUser(viewer)
        returns (bool success)
    {
        require(transferId < _transferId, InvalidTransferId(transferId));
        if(_historicViewAuth.authorizeTransferId(msg.sender, viewer, transferId)) {
            emit HistoricViewTransferIdAuthorized(msg.sender, viewer, transferId);
        }
        return true;
    }

    /// @inheritdoc IConfidentialToken
    function setViewerPublicKey(PublicKey calldata publicKey) external payable override {
        registerPublicKey(publicKey);
        setViewerAddress(_publicKeyToAddress(publicKey));
    }

    /// @inheritdoc IConfidentialToken
    function setCallbackFee(uint256 newFee) external override restricted {
        callbackFee = newFee;
        emit CallbackFeeChanged(newFee);
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
        encryptTEAddress = newAddress;
        emit EncryptTEAddressChanged(newAddress);
    }

    /// @inheritdoc IConfidentialToken
    function retrieveGasToken(uint256 value, address receiver) external override {
        // value is not a constant
        // so no ability to save some gas here
        // solhint-disable gas-strict-inequalities
        require(
            _gasTokenBalance[msg.sender] >= value,
            InsufficientGasToken(value, _gasTokenBalance[msg.sender])
        );
        // solhint-enable gas-strict-inequalities
        _gasTokenBalance[msg.sender] -= value;
        emit GasTokenWithdrawn(receiver, value);
        payable(receiver).sendValue(value);
    }

    /// @inheritdoc IConfidentialToken
    function encryptedBalanceOf(address holder) external view override returns (bytes memory encryptedBalance) {
        require(_viewerIsRegistered(holder), NoViewerRegisteredForHolder(holder));
        return _userBalances[holder];
    }

    /// @inheritdoc IConfidentialToken
    function encryptValue(
        address holder,
        uint256 value
    )
        external
        view
        override
        returns (bytes memory encryptedValue)
    {
        return _encryptTEValueForHolder(holder, value);
    }

    /// @inheritdoc IConfidentialToken
    function gasTokenBalanceOf(address holder) external view override returns (uint256 balance) {
        return _gasTokenBalance[holder];
    }

    ///@inheritdoc IConfidentialToken
    function canDecryptHistoricTransfer(
        address viewer,
        uint256 transferId,
        address from,
        address to,
        uint256 timestamp
    )
        external
        view
        override
        returns (bool canDecrypt)
    {
        return _historicViewAuth.canDecrypt({
            from: from,
            to: to,
            transferId: transferId,
            timestamp: timestamp,
            viewer: viewer
        });
    }

    // Public functions

    /// @notice Initializes the contract for proxy or direct deployment.
    /// @param name_ Name of the token.
    /// @param symbol_ Symbol of the token.
    /// @param version_ Version of the contract.
    /// @param initialAuthority Address of AccessManager initial authority.
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory version_,
        address initialAuthority
    )
        public
        virtual
        override
        initializer
    {
        __ConfidentialToken_init(name_, symbol_, version_, initialAuthority);
    }

    /// @inheritdoc IConfidentialToken
    function requestDecryptHistoricTransferFor(
        bytes calldata encryptedTransferData,
        address historicViewer
    )
        public
        override
        onlyRegisteredUser(historicViewer)
    {
        bytes[] memory encryptedArguments = new bytes[](1);
        encryptedArguments[0] = encryptedTransferData;

        bytes[] memory plaintextArguments = new bytes[](2);
        plaintextArguments[0] = abi.encodePacked(_HISTORIC_VIEW_ACTION);
        plaintextArguments[1] = abi.encodePacked(historicViewer);

        _submitCTX(msg.sender, encryptedArguments, plaintextArguments);
    }

    /// @inheritdoc IConfidentialToken
    function fundWithGasToken(address receiver) public payable override {
        uint256 value = msg.value;
        if (value > 0) {
            _gasTokenBalance[receiver] += value;
            emit GasTokenBalanceToppedUp(msg.sender, receiver, value);
        }
    }

    /// @notice Transfers `value` tokens from `from` to `to` using allowance mechanism.
    /// @dev This function call may return true and revert on callback producing no changes
    /// @param from Address to transfer tokens from
    /// @param to Address to transfer tokens to
    /// @param value Amount of tokens to be transferred
    /// @return result Always returns true
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public virtual override returns (bool result) {
        _transferFrom(from, to, value);
        return true;
    }

    /// @inheritdoc IConfidentialToken
    function registerPublicKey(PublicKey calldata publicKey) public override {
        require(_isValidPublicKey(publicKey), InvalidPublicKey());
        address accountAddress = _publicKeyToAddress(publicKey);
        if (!_knownPublicKey(accountAddress)) {
            publicKeys[accountAddress] = publicKey;
            emit PublicKeyRegistered(accountAddress);
        }
    }

    /// @inheritdoc IConfidentialToken
    function setViewerAddress(address viewer) public override payable onlyRegisteredUser(viewer) {
        fundWithGasToken(msg.sender);
        if(viewerAddresses[msg.sender] != viewer) {
            viewerAddresses[msg.sender] = viewer;
            emit ViewerChanged(msg.sender, viewer);
            _update(msg.sender, msg.sender, 0);
        }
    }

    /// @inheritdoc ERC20Upgradeable
    function totalSupply() public view virtual override returns (uint256 supply) {
        return _totalSupply;
    }

    // If name returned variable
    // compiler gives warning about unused variable
    // solhint-disable gas-named-return-values
    /// @inheritdoc ERC20Upgradeable
    function balanceOf(address) public pure virtual override returns (uint256) {
        revert ValueIsEncrypted();
    }
    // solhint-enable gas-named-return-values

    // Internal functions

    // The OpenZeppelin Upgrades plugin's static analyzer relies on the __ContractName_init naming
    // convention to identify and track which parent contracts have been initialized.
    // slither-disable-start naming-convention
    // solhint-disable-next-line func-name-mixedcase
    function __ConfidentialToken_init(
        string memory name_,
        string memory symbol_,
        string memory version_,
        address initialAuthority
    )
        internal
        onlyInitializing
    {
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __ConfidentialEIP3009_init();
        __AccessManaged_init(initialAuthority);
        __ConfidentialToken_init_unchained(version_);
    }
    // slither-disable-end naming-convention

    // The OpenZeppelin Upgrades plugin's static analyzer relies on the __ContractName_init naming
    // convention to identify and track which parent contracts have been initialized.
    // slither-disable-start naming-convention
    // solhint-disable-next-line func-name-mixedcase
    function __ConfidentialToken_init_unchained(
        string memory version_
    )
        internal
        onlyInitializing
    {
        callbackFee = 1_000 gwei;
        encryptECIESAddress = BITE.ENCRYPT_ECIES_ADDRESS;
        encryptTEAddress = BITE.ENCRYPT_TE_ADDRESS;
        submitCTXAddress = BITE.SUBMIT_CTX_ADDRESS;
        version = version_;
    }
    // slither-disable-end naming-convention

    function _handleAction(
        uint8 action,
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) internal virtual {
        if (action == _TRANSFER_ACTION) { // transfer likely more frequent
            _handleTransferRequest(decryptedArguments, plaintextArguments);
        } else if (action == _HISTORIC_VIEW_ACTION) {
            _handleHistoricViewRequest(decryptedArguments, plaintextArguments);
        } else {
            revert ActionNotRecognized();
        }
    }

    function _handleHistoricViewRequest(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    )
        internal
    {
        require(plaintextArguments[1].length == 20, WrongPlaintextFormat());
        address historicViewer = address(bytes20(plaintextArguments[1]));
        require(_knownPublicKey(historicViewer), PublicKeyIsNotRegistered(historicViewer));

        (address from, address to) = _historicViewAuth.decodeIfAuthorized(
            historicViewer,
            decryptedArguments[0]
        );
        emit ReEncryptedTransfer(
            historicViewer,
            from,
            to,
            BITE.encryptECIES(
                encryptECIESAddress,
                decryptedArguments[0],
                publicKeys[historicViewer]
            )
        );
    }

    function _handleTransferRequest(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    )
        internal
        returns (bool finalized, uint256 value)
    {
        TransferInfo memory transferInfo = abi.decode(plaintextArguments[1], (TransferInfo));

        _validateDecryptedArguments(decryptedArguments, transferInfo.from, transferInfo.to);

        uint256 valueIndex = decryptedArguments.length - 1;
        // The transfer value cipher-text is salted with the address that submitted it: the
        // spender for delegated (transferFrom) flows, otherwise `from` (direct transfer, mint,
        // burn, EIP-3009). This binds the value to its submitter and prevents replaying a third
        // party's stored balance/value cipher-text (CONF-01).
        address expectedSalt = transferInfo.from;
        if (transferInfo.spender != address(0)) {
            expectedSalt = transferInfo.spender;
        }
        value = _decodeAndVerifyBalance(decryptedArguments[valueIndex], expectedSalt);

        (uint256 fromBalance, uint256 toBalance) = _decodeOriginalBalances(decryptedArguments, transferInfo, value);

        bool updatedFrom =
            transferInfo.from != address(0) && _lastChanged[transferInfo.from] > transferInfo.submittedBlockNumber;
        bool updatedTo =
            transferInfo.to != address(0) && _lastChanged[transferInfo.to] > transferInfo.submittedBlockNumber;
        if (updatedFrom || updatedTo) {
            // This MUST be kept always after decoding and verifying Balance (value)
            _reSubmitTransfer(transferInfo, value, plaintextArguments);
            return (false, value);
        }

        _decryptedUpdate({
            from: transferInfo.from,
            to: transferInfo.to,
            fromBalance: fromBalance,
            toBalance: toBalance,
            value: value
        });

        return (true, value);
    }

    function _reSubmitTransfer(
        TransferInfo memory transferInfo,
        uint256 value,
        bytes[] calldata plaintextArguments
    )
        internal
    {
        // The account was changed by another CTX.
        // Decrypted information is outdated.
        // Resending updated encrypted balances to perform the transfer
        emit CTXResubmitted(msg.sender);

        // TODO: will need transporting spender once we have encrypted allowances
        // Encrypted value was already validated on the first CTX. We clear the spender (so the
        // allowance is not spent again) and re-salt the value to `from`, which is the holder the
        // next callback verifies against now that spender == address(0).
        bytes memory encryptedValue = _encryptTEValueForHolder(transferInfo.from, value);
        transferInfo.spender = address(0);
        // End of TODO
        bytes[] memory encryptedArguments = _encryptArguments(transferInfo.from, transferInfo.to, encryptedValue);
        transferInfo.submittedBlockNumber = block.number;
        uint256 numArgs = plaintextArguments.length;
        bytes[] memory updatedPlaintextArguments = new bytes[](numArgs);
        updatedPlaintextArguments[0] = plaintextArguments[0];
        updatedPlaintextArguments[1] = abi.encode(transferInfo);

        for (uint256 i = 2; i < numArgs; ++i) {
            updatedPlaintextArguments[i] = plaintextArguments[i];
        }

        _submitCTX(transferInfo.gasPayer, encryptedArguments, updatedPlaintextArguments);
    }

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
            if (from == to) {
                _setBalance(from, fromBalance);
                _onUpdate(from, to, value);
                return;
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

        _onUpdate(from, to, value);
    }

    function _onUpdate(address from, address to, uint256 value) internal virtual {
        // Emit basic event
        emit Transfer(from, to);

        // Skip emission of historic events for zero value transfers to self
        // They are mostly triggered by changes in view keys
        if (from == to && value == 0) return;

        // Time is required to be used by decryption authorization logic
        // It does not control any critical structural logic like balance or allowance updates
        bytes memory encodedTransfer = HistoricView.encodedTransferData({
            from: from,
            to: to,
            value: value,
            timestamp: block.timestamp, // solhint-disable-line not-rely-on-time
            transferId: _transferId
        });
        // Emit event with TE-encrypted transfer metadata
        emit EncryptedTransfer(_transferId, from, to, BITE.encryptTE(encryptTEAddress, encodedTransfer));
        // Emit event with ECIES-encrypted value readable by the recipient
        if(from != to) {
            if(_viewerIsRegistered(to)) {
                emit TransferValueEncryptedForRecipient(
                    from,
                    to,
                    _transferId,
                    BITE.encryptECIES(encryptECIESAddress, abi.encodePacked(value), _getViewKey(to))
                );
            }
            if(_viewerIsRegistered(from)) {
                emit TransferValueEncryptedForSender(
                    from,
                    to,
                    _transferId,
                    BITE.encryptECIES(encryptECIESAddress, abi.encodePacked(value), _getViewKey(from))
                );
            }
        }
        unchecked{++_transferId;}
    }

    /// @notice Transfers a `value` amount of tokens from `from` to `to`
    /// @notice or alternatively mints (or burns) if `from` (or `to`) is the zero address.
    /// @param from  Address to transfer tokens from
    /// @param to    Address to transfer tokens to
    /// @param value Amount of tokens to be transferred
    function _update(address from, address to, uint256 value) internal virtual override {
        _updateWithGasPayer(from, to, msg.sender, value);
    }

    function _updateWithGasPayer(address from, address to, address gasPayer, uint256 value) internal {
        bytes memory encryptedValue = _encryptTEValueForHolder(from, value);
        _encryptedUpdate({
            from: from,
            to: to,
            spender: address(0),
            gasPayer: gasPayer,
            encryptedValue: encryptedValue
        });
    }

    /// @notice Transfers a `encryptedValue` amount of tokens from `from` to `to`
    /// @notice or alternatively mints (or burns) if `from` (or `to`) is the zero address.
    /// @param from  Address to transfer tokens from
    /// @param to    Address to transfer tokens to
    /// @param spender Address of the spender for transferFrom operations
    /// @param gasPayer Address of the account paying for the gas
    /// @param encryptedValue TE-encrypted amount of tokens to be transferred
    function _encryptedUpdate(
        address from,
        address to,
        address spender,
        address gasPayer,
        bytes memory encryptedValue
    )
        internal
        virtual
    {
        _encryptedUpdateExtended({
            from: from,
            to: to,
            spender: spender,
            gasPayer: gasPayer,
            encryptedValue: encryptedValue,
            action: _TRANSFER_ACTION,
            extraPlaintextArguments: new bytes[](0)
        });
    }

    function _encryptedUpdateExtended(
        address from,
        address to,
        address spender,
        address gasPayer,
        bytes memory encryptedValue,
        uint8 action,
        bytes[] memory extraPlaintextArguments
    )
        internal
        virtual
    {
        // Values should be padded exactly to 64 bytes (abi.encode(address,uint256)) before encrypted with BITE TE
        // slither-disable-next-line incorrect-equality
        require(encryptedValue.length == BITE.TE_RETURN_SIZE_THRESHOLD + 33, ValueWasNotEncryptedCorrectly());
        bytes[] memory encryptedArguments = _encryptArguments(from, to, encryptedValue);
        uint256 extraPlaintextArgumentsLength = extraPlaintextArguments.length;
        bytes[] memory plaintextArguments = new bytes[](2 + extraPlaintextArgumentsLength);
        plaintextArguments[0] = abi.encodePacked(action);

        plaintextArguments[1] = abi.encode(TransferInfo({
            from: from,
            to: to,
            spender: spender,
            gasPayer: gasPayer,
            submittedBlockNumber: block.number
        }));

        for (uint256 i = 0; i < extraPlaintextArgumentsLength; ++i) {
            plaintextArguments[i + 2] = extraPlaintextArguments[i];
        }

        _submitCTX(gasPayer, encryptedArguments, plaintextArguments);
    }

    function _transferFrom(
        address from,
        address to,
        uint256 value
    ) internal virtual {
        _encryptedTransferFrom(from, to, _encryptTEValueForHolder(msg.sender, value));
    }

    function _encryptedTransferFrom(
        address from,
        address to,
        bytes memory value
    ) internal virtual {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _encryptedUpdate({
            from: from,
            to: to,
            spender: msg.sender,
            gasPayer: msg.sender,
            encryptedValue: value
        });
    }

    /// @notice Transfers a `encryptedValue` amount of tokens from `from` to `to`
    /// @param from Address to transfer tokens from
    /// @param to Address to transfer tokens to
    /// @param value TE-encrypted amount of tokens to be transferred
    function _encryptedTransfer(address from, address to, bytes calldata value) internal virtual override {
        if (from == address(0)) {
            revert ERC20InvalidSender(address(0));
        }
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        _encryptedUpdate({
            from: from,
            to: to,
            spender: address(0),
            gasPayer: msg.sender,
            encryptedValue: value
        });
    }

    function _encryptTEValueForHolder(
        address holder,
        uint256 value
    )
        internal
        view
        returns (bytes memory encryptedValue)
    {
        encryptedValue = BITE.encryptTE(
            encryptTEAddress,
            _encodeBalance(holder, value)
        );
    }

    // Private functions

    function _setBalance(address holder, uint256 balance) private {
        _thresholdBalances[holder] = _encryptTEValueForHolder(holder, balance);
        _lastChanged[holder] = block.number;
        if (_viewerIsRegistered(holder)) {
            PublicKey memory viewerPublicKey = _getViewKey(holder);
            _userBalances[holder] = BITE.encryptECIES(
                encryptECIESAddress,
                abi.encodePacked(balance),
                viewerPublicKey
            );
        }
    }

    function _decodeOriginalBalances(
        bytes[] calldata decryptedArguments,
        TransferInfo memory transferInfo,
        uint256 value
    )
        private
        returns (uint256 fromBalance, uint256 toBalance)
    {
        if (transferInfo.from == address(0)) {
            // mint
            toBalance = _decodeAndVerifyBalance(decryptedArguments[0], transferInfo.to);
        } else if (transferInfo.to == address(0)) {
            // burn
            fromBalance = _decodeAndVerifyBalance(decryptedArguments[0], transferInfo.from);
        } else {
            // transfer
            if(transferInfo.spender != address(0)) {
                // Allowances not encrypted
                _spendAllowance(transferInfo.from, transferInfo.spender, value);
            }
            fromBalance = _decodeAndVerifyBalance(decryptedArguments[0], transferInfo.from);
            toBalance = _decodeAndVerifyBalance(decryptedArguments[1], transferInfo.to);
        }
    }

    function _submitCTX(
        address gasPayer,
        bytes[] memory encryptedArguments,
        bytes[] memory plaintextArguments
    )
        private
    {
        // callbackFee is not a constant
        // so no ability to save some gas here
        // solhint-disable gas-strict-inequalities
        require(
            _gasTokenBalance[gasPayer] >= callbackFee,
            InsufficientGasToken(callbackFee, _gasTokenBalance[gasPayer])
        );
        // solhint-enable gas-strict-inequalities
        _gasTokenBalance[gasPayer] -= callbackFee;

        address payable callback = BITE.submitCTX(
            submitCTXAddress,
            callbackFee / tx.gasprice,
            encryptedArguments,
            plaintextArguments
        );
        require(_callbackSenders.add(callback), AccessViolation());
        callback.sendValue(callbackFee);
    }

    function _encryptArguments(
        address from,
        address to,
        bytes memory encryptedValue
    )
        private
        view
        returns (bytes[] memory encryptedArguments)
    {
        bytes memory encryptedFromBalance = bytes("");
        bytes memory encryptedToBalance = bytes("");
        uint256 encryptedArgumentsLength = 0;
        uint256 fromIndex = 0;
        uint256 toIndex = 0;
        if (from != address(0)) {
            encryptedFromBalance = _getEncryptedBalance(from);
            fromIndex = encryptedArgumentsLength;
            ++encryptedArgumentsLength;
        }
        if (to != address(0)) {
            encryptedToBalance = _getEncryptedBalance(to);
            toIndex = encryptedArgumentsLength;
            ++encryptedArgumentsLength;
        }
        uint256 valueIndex = encryptedArgumentsLength;
        ++encryptedArgumentsLength;

        encryptedArguments = new bytes[](encryptedArgumentsLength);
        if (from != address(0)) {
            encryptedArguments[fromIndex] = encryptedFromBalance;
        }
        if (to != address(0)) {
            encryptedArguments[toIndex] = encryptedToBalance;
        }
        encryptedArguments[valueIndex] = encryptedValue;
    }

    function _getEncryptedBalance(address holder) private view returns (bytes memory encryptedBalance) {
        encryptedBalance = _thresholdBalances[holder];
        // This is always correct, as an empty encrypted balance is a zero balance.
        // Empty balances only occur when a holder has never had any transfers before
        // slither-disable-next-line incorrect-equality
        if (encryptedBalance.length == 0) {
            encryptedBalance = _encryptTEValueForHolder(holder, uint256(0));
        }
    }

    function _getViewKey(address holder) private view returns (PublicKey memory viewKey) {
        viewKey = publicKeys[viewerAddresses[holder]];
    }

    function _viewerIsRegistered(address holder) private view returns (bool isRegistered) {
        address viewer = viewerAddresses[holder];
        return viewer != address(0) && _knownPublicKey(viewer);
    }

    /// @notice Checks if a public key is known for a given holder address
    /// @param holder The address of the holder
    /// @return isKnown True if the public key is known, false otherwise
    function _knownPublicKey(address holder) private view returns (bool isKnown) {
        return _isValidPublicKey(publicKeys[holder]);
    }

    function _parseAction(
        bytes[] calldata plaintextArguments
    )
        private
        pure
        returns (uint8 action)
    {
        // All actions require more than 1 plaintext argument in the array
        require(plaintextArguments.length > 1, WrongPlaintextFormat());
        require(plaintextArguments[0].length == 1, WrongPlaintextFormat());
        return uint8(bytes1(plaintextArguments[0]));
    }

    function _isValidPublicKey(PublicKey memory publicKey) private pure returns (bool isValid) {
        return publicKey.x != bytes32(0) || publicKey.y != bytes32(0);
    }

    function _encodeBalance(address holder, uint256 balance) private pure returns (bytes memory encodedBalance) {
        return abi.encode(holder, balance);
    }

    function _decodeBalance(bytes calldata encodedBalance) private pure returns (address holder, uint256 balance) {
        if (encodedBalance.length == 0) {
            return (address(0), 0);
        }
        (address holderAddress, uint256 decodedBalance) = abi.decode(encodedBalance, (address, uint256));
        return (holderAddress, decodedBalance);
    }

    function _decodeAndVerifyBalance(
        bytes calldata encodedBalance,
        address expectedHolder
    )
        private
        pure
        returns (uint256 balance)
    {
        (address holder, uint256 decodedBalance) = _decodeBalance(encodedBalance);
        require(holder == expectedHolder, InvalidSaltForTransactionValue());
        return decodedBalance;
    }

    /**
     * @notice Converts a public key to an Ethereum address
     * @dev Uses keccak256 hash of the concatenated public key components
     * @param publicKey The public key to convert
     * @return accountAddress The derived Ethereum address
     */
    function _publicKeyToAddress(
        PublicKey memory publicKey
    )
        private
        pure
        returns (address accountAddress)
    {
        bytes32 hash = keccak256(abi.encodePacked(publicKey.x, publicKey.y));
        return address(uint160(uint256(hash)));
    }

    function _validateDecryptedArguments(bytes[] calldata decryptedArguments, address from, address to) private pure {
        uint256 valueIndex = 2;
        if (decryptedArguments.length == 2) {
            // mint or burn
            require((from == address(0)) != (to == address(0)), DecryptionBadFormat());
            valueIndex = 1;
        } else if (decryptedArguments.length == 3) {
            // token transfer
            require(
                decryptedArguments[1].length == 64 || decryptedArguments[1].length == 0,
                DecryptionBadFormat()
            );
        } else {
            revert DecryptionBadFormat();
        }
        require(
            decryptedArguments[0].length == 64 || decryptedArguments[0].length == 0,
            DecryptionBadFormat()
        );
        require(
            decryptedArguments[valueIndex].length == 64,
            DecryptionBadFormat()
        );
    }
}
