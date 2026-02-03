# Solidity API

## ConfidentialWrapper

Confidential wrapper that adds confidentiality to an ERC20 token

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
constructor(contract IERC20Metadata underlyingToken, string version_, address initialAuthority) public
```

### releaseTo

Releases the wrapped tokens to the caller
Almost never is used and is required only if callback call fails

```solidity
function releaseTo(address account, uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to release tokens to |
| value | uint256 | The amount of tokens to release |

### depositFor

```solidity
function depositFor(address account, uint256 value) public returns (bool success)
```

**dev:** _Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens._

### withdrawTo

```solidity
function withdrawTo(address account, uint256 value) public returns (bool success)
```

**dev:** _Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens._

### decimals

```solidity
function decimals() public view returns (uint8 decimalsValue)
```

### totalSupply

```solidity
function totalSupply() public view returns (uint256 supply)
```

**dev:** _Returns the value of tokens in existence._

### balanceOf

```solidity
function balanceOf(address account) public pure returns (uint256 balance)
```

**dev:** _Returns the value of tokens owned by `account`._

### _onUpdate

```solidity
function _onUpdate(address from, address to, uint256 value) internal
```

### _update

```solidity
function _update(address from, address to, uint256 value) internal
```

