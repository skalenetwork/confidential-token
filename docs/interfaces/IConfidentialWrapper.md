# Solidity API

## IConfidentialWrapper

Interface of ConfidentialWrapper that adds confidentiality to an ERC20 token

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

### cancelWithdrawTo

Cancels a pending withdrawal initiated by `withdrawTo`.

```solidity
function cancelWithdrawTo() external
```

**dev:** _Required only when the burn CTX never finalizes (e.g. resubmission
     chain reverts) and the caller needs to issue a fresh `withdrawTo`.
     If the original burn callback later fires with no new matching
     pending burn, it reverts on `OutdatedBurn` and the cnf burn rolls
     back. If the caller re-issues a new burn for the same `value`
     before that callback executes, the old callback may match and
     finalize the new pending burn._

