# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

### burn

Burns wrapped tokens from the caller and unwraps underlying to
the caller.

```solidity
function burn(uint256 value) external
```

**dev:** _Equivalent to `withdrawTo(msg.sender, value)`.
Finalization is asynchronous and happens in the BITE callback,
therefore the caller must have enough ETH balance in the token contract
to pay `callbackFee`._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | uint256 | The amount of wrapped tokens to burn and unwrap |

### releaseTo

Releases the caller's pending wrapped tokens to `account`.
Only the recipient of a prior `depositFor` (i.e. an address with a
non-zero `requestedMints` entry) can call this; the depositor cannot.

```solidity
function releaseTo(address account, uint256 value) external
```

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to release the underlying tokens to |
| value | uint256 | The amount of tokens to release |

