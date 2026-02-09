<!-- cspell:words ECIES analyser -->
# Confidential Token

<div align="center">

[![License](https://img.shields.io/github/license/skalenetwork/confidential-token.svg)](LICENSE)
[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/skale)
[![Build Status](https://github.com/skalenetwork/confidential-token/actions/workflows/test.yml/badge.svg)](https://github.com/skalenetwork/confidential-token/actions)
[![codecov](https://codecov.io/gh/skalenetwork/confidential-token/branch/develop/graph/badge.svg)](https://codecov.io/gh/skalenetwork/confidential-token)

<p> An ERC20 private token for SKALE chains with BITE protocol</p>
</div>

## Introduction

A sophisticated implementation of ERC20 tokens with encrypted balances on the SKALE network. This repository provides smart contracts that enable private token transfers and balance confidentiality using encryption integrated with SKALE's encryption precompiles and BITE consensus protocol.

Confidential Token implements privacy-preserving token functionality while maintaining compatibility with the ERC2612 (and ERC20 consequently) standard. Balances are encrypted using SKALE's cryptographic precompiles, allowing users to securely hold and transfer tokens without revealing their balance amounts on the public blockchain.

### Key Features

- **Encrypted Balances**: Token balances are encrypted and stored on-chain, visible only to authorized viewers
- **ERC20 Compatibility**: Contract inherits from ERC20 standard with additional privacy features
- **EIP3009 Support**: Transfer With Authorization via signed messages
- **ERC-2612 (Permit) Support**: Approvals via signed permit messages (ERC20Permit)
- **Token Wrapping**: Convert any standard ERC20 token into a confidential token
- **Minting Capability**: Optional minting functionality for managing token supply
- **Access Control**: OpenZeppelin AccessManager integration for fine-grained permissions
- **SKALE Integration**: Requires SKALE's precompiled contracts and BITE protocol for threshold encryption and secure computations.

## Core Contracts

#### [ConfidentialToken.sol](contracts/ConfidentialToken.sol)
The main contract implementing the confidential token functionality. It extends ERC20 with encrypted balance management and implements EIP-3009 and ERC-2612 (ERC20Permit).

**Key Features:**
- Encrypted balance storage (dual encryption: BITE Threshold Key for logic, User Public Key for viewing)
- Public key registration and management
- Callback fee configuration for confidential operations (transfers and view key changes)
- Supports depositing gas token to pay for confidential operations
- EIP-3009 support for transfers with authorizations via signed messages.
- ERC-2616 support for permits that change authorization amounts
- Integration with SKALE's precompiled contracts and BITE protocol (Phase 2)

**Core Functions:**
- `setViewerPublicKey(publicKey)`: Registers a public key in the system and assigns it as the sender's view key. Same result of calling `registerPublicKey` + `setViewerAddress`
- `registerPublicKey(publicKey)`: Register a public key in the contract
- `setViewerAddress(viewer)`: Associate a viewer address with the caller's account (payable so you can deposit gas token)
- `deposit(receiver)`: Deposit gas token to fund callback executions
- `withdraw(amount, receiver)`: Withdraw gas token previously deposited
- `burn(amount)`: Burn tokens from the caller's balance
- `encryptedBalanceOf(holder)`: Get the encrypted balance representation (must be decrypted off-chain)
- `ethBalanceOf(holder)`: Get the gas token balance for callback funding

**EIP-3009 Authorization Functions:**
- `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature)`: Transfer tokens using a signed authorization message.
- `receiveWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature)`: Receive tokens via signed authorization.
- `cancelAuthorization(authorizer, nonce, signature)`: Cancel a previously signed authorization nonce
- `authorizationState(authorizer, nonce)`: Check if an authorization nonce has been used or revoked

**ERC-2612 Permit Functions:**
- `permit(owner, spender, value, deadline, v, r, s)`: Approve via signed message (ERC20Permit)

#### [ConfidentialWrapper.sol](contracts/ConfidentialWrapper.sol)
Wraps an existing ERC20 token to add confidentiality features.

**Functionality:**
- Converts standard ERC20 tokens into confidential tokens
- Maintains 1:1 ratio with wrapped tokens
- Implements `depositFor()` and `withdrawTo()` for wrapping/unwrapping
- Includes safety mechanisms for failed callback scenarios

**Main Functions:**
- `depositFor(account, value)`: Wrap underlying tokens to receive confidential tokens
- `withdrawTo(account, value)`: Unwrap confidential tokens to recover underlying tokens
- `releaseTo(account, value)`: Emergency release mechanism if callbacks fail

#### [MintableConfidentialToken.sol](contracts/MintableConfidentialToken.sol)
Extends ConfidentialToken with minting capabilities for token supply management.

**Functionality:**
- Controlled minting by authorized addresses
- Uses OpenZeppelin AccessManager for access control
- Inherits all ConfidentialToken and EIP-3009 capabilities

#### [Precompiled.sol](contracts/Precompiled.sol)
Library for interacting with SKALE's precompiled contracts.

**Supported Precompiles:**
- `EncryptECIES` (address on SKALE 0x1C): ECIES encryption.
- `EncryptTE` (address on SKALE 0x1D): Threshold encryption.
- `SubmitCTX` (address on SKALE 0x1B): Submit conditional transactions for execution by BITE protocol.

**Key Functions:**
- `submitCTX()`: Submit an conditional transaction for secure computation
- `encryptECIES()`: Encrypt data with ECIES algorithm - receives both data and a publicKey
- `encryptTE()`: Encrypt data with current BITE threshold encryption key - can only be decrypted by consensus participants

## Testing

Comprehensive test suites covering all functionality. Note that this repository uses hardhat framework for testing. Since hardhat does not use SKALE consensus mechanism and also the precompiled contracts, some mock contracts were created to implement this functionality.

In a SKALE chain, callback functions (Conditional transactions) are executed automatically in the block right after they're executed. In tests, we must manually call bite.sendCallback() to execute the next Callback transaction in the queue. You should use [BiteMock](contracts/test/BiteMock.sol) to mimic BITE protocol functionality.

## Deployment

To deploy tokens, the following env. variables are always required:

```bash
ENDPOINT="http://endpoit.to.network" # this should be the endpoint to the SKALE chain you are deploying to
PRIVATE_KEY="0x..." # The private key of the account that will pay for deployment costs
OWNER="0xAddress"   # The address of the account that should be the final owner of the new token. If not set, defaults to the address of PRIVATE_KEY (i.e. the deployer)
```

### [migrations/deployMintable.ts](migrations/deployMintable.ts)
Deployment script for MintableConfidentialToken.

Requires extra `.env` variables:
```bash
SYMBOL=".."  # the token Symbol
NAME=".."    # The token name
```

**Deploys:**
- AccessManager: Controls permissions
- MintableConfidentialToken: Main token contract

**Usage:**
```bash
yarn hardhat run migrations/deployMintable.ts --network custom
```

**Features:**
- Automatic contract verification
- Address storage to JSON for reference

### [migrations/deployWrapper.ts](migrations/deployWrapper.ts)
Deployment script for ConfidentialWrapper.

Requires extra `.env` variable:
```bash
ORIGIN_TOKEN="0xAddress" # The address of the ERC20 to wrap
```

**Deploys:**
- AccessManager: Controls permissions
- ConfidentialWrapper: Wraps existing ERC20 token

**Usage:**
```bash
yarn hardhat run migrations/deployWrapper.ts --network custom
```

## Getting Started

### Prerequisites

- Node.js 20+ (22 or 24 recommended)

### First steps

```bash
# Clone the repository
git clone --recurse-submodules <repository-url>
cd confidential-token

# Install dependencies
yarn install

# Compile contracts
yarn compile

# Run static checks
yarn lint && yarn cspell

# Run test suite (it's fairly quick)
yarn test

```

Look into package.json for other useful scripts.

You may want to install the latest version `slither-analyser` for more in-depth analysis, as we use it in the CI. For that you should have python installed and you may install slither via `pip` with:
```bash
pip install slither-analyzer
```


### Documentation

```bash
# Generate smart-contract documentation
yarn docgen
```

This generates markdown documentation in the `docs/` directory based on NatSpec comments. You can also find the already generated docs there for more detailed functionality of each function.

## Support

For issues, questions, or contributions, please open an issue on the repository or contact the SKALE Labs team. Read https://blog.skale.space/security for more details.

## References & Useful Links

- [SKALE Network Documentation](https://docs.skale.network/)
- [BITE V2 Protocol Documentation](https://forum.skale.network/t/bite-phase-2-extended-architecture-specification/737)
- [EIP-20: Ethereum token standard](https://eips.ethereum.org/EIPS/eip-20)
- [EIP-2612: Permit extension for ERC-20](https://eips.ethereum.org/EIPS/eip-2612)
- [EIP-3009: Transfer and receive with authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)

## License

AGPL-3.0-only

This project is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for full terms.
