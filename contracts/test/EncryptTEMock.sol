// SPDX-License-Identifier: AGPL-3.0-only

/*
    EncryptTEMock.sol - confidential-token
    Copyright (C) 2025-Present SKALE Labs
    @author Dmytro Stebaiev

    confidential-token is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    confidential-token is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with confidential-token.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity ^0.8.24;

import { BiteMock } from "./BiteMock.sol";
import { PrecompiledMock } from "./PrecompiledMock.sol";


/// @title EncryptTEMock
/// @author Dmytro Stebaiev
/// @notice Mock contract for the EncryptTE precompiled contract
contract EncryptTEMock is PrecompiledMock {
    /// @notice Instance of the BiteMock contract
    BiteMock public bite;

    /// @notice Constructor for the EncryptTEMock contract
    /// @param biteAddress Address of the BiteMock contract
    constructor(BiteMock biteAddress) {
        bite = biteAddress;
    }

    /// @notice Internal function to simulate encryption
    /// @param data The calldata passed to the precompiled contract
    /// @return result The encrypted result
    function _call(bytes calldata data) internal view override returns (bytes memory result) {
        return bite.encrypt(data);
    }
}
