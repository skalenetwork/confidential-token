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

pragma solidity ^0.8.24;

import { IBiteSupplicant } from "./bite/IBiteSupplicant.sol";


/// @title IConfidentialToken
/// @author Dmytro Stebaiev
/// @notice Interface of the ConfidentialToken contract
interface IConfidentialToken is IBiteSupplicant {
    /// @notice Sets the address of the EncryptTE precompiled contract
    /// @param newAddress New address of the EncryptTE precompiled contract
    function setEncryptTEAddress(address newAddress) external;

    /// @notice Sets the address of the SubmitCTX precompiled contract
    /// @param newAddress New address of the SubmitCTX precompiled contract
    function setSubmitCTXAddress(address newAddress) external;
}
