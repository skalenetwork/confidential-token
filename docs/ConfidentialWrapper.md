# Solidity API

## ConfidentialWrapper

Confidential wrapper that adds confidentiality to an ERC20 token

### WRAPPED_TOKEN

Address of the original token

```solidity
contract IERC20 WRAPPED_TOKEN
```

### requestedMints

Amount of tokens requested to be wrapped

```solidity
mapping(address => uint256) requestedMints
```

**dev:** _Almost always equals to zero
Has non-zero value only before the callback call is made_

### OutdatedMint

```solidity
error OutdatedMint(address to, uint256 value)
```

### constructor

```solidity
constructor(contract IERC20Metadata wrappedTokenAddress, string version_, address initialAuthority) public
```

### release

Releases the wrapped tokens to the caller
Almost never is used and is required only if callback call fails

```solidity
function release(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of tokens to release |

### unwrap

Unwraps the specified amount of confidential tokens into the underlying token

```solidity
function unwrap(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of tokens to unwrap |

### wrap

Wraps the specified amount of the underlying token into confidential tokens

```solidity
function wrap(uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of tokens to wrap |

### _onUpdate

```solidity
function _onUpdate(address from, address to, uint256 value) internal
```

