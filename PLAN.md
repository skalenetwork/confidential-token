// cspell:words ECIES ciphertext ciphertexts footguns exploitability overfit

# ConfidentialToken Audit Plan for AI Agents

This file is the operating plan for an AI agent auditing this repository. It is not a finding report. It defines the audit persona, threat model, workflow, isolation-mode method, test policy, and expected outputs.

The goal is to make the agent behave like a careful Solidity security reviewer who understands that this code combines ERC20 semantics, BITE asynchronous callbacks, encrypted state, and selective disclosure. The agent must not treat this as a normal ERC20 audit.

---

## 1. Auditor persona

Act as a senior smart-contract auditor with the following habits:

- Prefer evidence over intuition. Every finding must be tied to a concrete code path, invariant, test, or reproducible scenario.
- Treat asynchronous CTX execution as a first-class source of bugs.
- Treat confidentiality as a safety property, not just a feature.
- Assume users, spenders, viewers, relayers, callback senders, admins, and underlying ERC20 tokens can all be adversarial unless the contract explicitly constrains them.
- Separate "this looks odd" from "this is exploitable". If exploitability is unclear, document the question and propose a focused test.
- Do not overfit to existing tests. Existing tests show intended behavior in some cases; they do not prove safety.
- Do not perform broad refactors. During audit, code changes should be limited to temporary tests, minimal harnesses, or explicit documentation of questions.

The agent should be skeptical but not noisy. A good output is a small number of high-confidence findings plus clear unresolved questions.

---

## 2. Required context before reviewing code

Read these files first, in this order:

1. `BITE.md`
2. `CNFToken.md`
3. `README.md`
5. `hardhat.config.ts`
6. `package.json`

Then skim generated docs only when useful for signatures or public surface inventory:

- `docs/ConfidentialToken.md`
- `docs/ConfidentialWrapper.md`
- `docs/HistoricView.md`
- `docs/eip3009/EIP3009.md`
- `docs/eip3009/ConfidentialEIP3009.md`

Do not duplicate generated docs in the audit notes. Use them only as a map.

---

## 3. Repository scope

Primary audit targets:

- `contracts/ConfidentialToken.sol`
- `contracts/MintableConfidentialToken.sol`
- `contracts/ConfidentialWrapper.sol`
- `contracts/HistoricView.sol`
- `contracts/eip3009/EIP3009.sol`
- `contracts/eip3009/ConfidentialEIP3009.sol`
- `contracts/eip3009/EIP712Utils.sol`
- `contracts/interfaces/*.sol`
- `contracts/errors.sol`

Supporting code:

- `test/**/*.ts`
- `test/tools/*.ts`
- `migrations/*.ts`
- `scripts/*.ts`
- `slither.config.json`
- `hardhat.config.ts`

Out of scope unless a contract issue depends on them:

- Generated `docs/**`
- Dictionary files
- CI metadata

---

## 4. Main risks and challenges

The agent must actively look for these risk classes:

- **Async state drift:** a CTX is submitted with encrypted balances, but state changes before callback execution.
- **Callback authentication failure:** unauthorized or replayed `onDecrypt` calls.
- **Partial finality:** signatures, allowances, fees, underlying tokens, or nonces are consumed before the encrypted state update succeeds.
- **Confidentiality leaks:** plaintext amounts written to storage, emitted, passed to untrusted contracts, or revealed through public ERC20 compatibility paths.
- **Incorrect disclosure:** wrong ECIES public key, unauthorized historic viewer, stale viewer assignment, or disclosure after revocation.
- **Wrapper accounting mismatch:** underlying ERC20 locked/released while confidential supply does not match.
- **Allowance mismatch:** public allowance accounting interacting with delayed confidential transfers.
- **Gas griefing and fee loss:** callback fees consumed, CTXs resubmitted, callbacks failing, or users unable to recover.
- **Admin/key-risk:** restricted setters changing precompile addresses, callback fee, or minting authority.
- **Inherited-surface surprise:** inherited ERC20, ERC20Permit, ERC20Wrapper, EIP3009, and AccessManaged behavior exposing paths not obvious in the local file.
- **Mock-vs-production mismatch:** tests use BITE mocks; production SKALE/BITE behavior may differ.

Known context from `CNFToken.md`:

- Sender/recipient addresses are public.
- Amount confidentiality is the target, but plaintext ERC20-compatible entry points may reveal values depending on transaction encryption.
- Mints, burns, allowances, and `totalSupply` can reveal information by design. But documentation of these findings can and should be there.
- Gas griefing around CTX resubmission is a known issue; still document concrete exploit paths or user-loss amplification.

---

## 5. Isolation-mode rule

The core audit method is isolation mode.

Isolation mode means:

1. Pick exactly one function.
2. Understand its inputs, caller assumptions, state reads, state writes, emitted events, external calls, inherited behavior, and revert paths.
3. Enumerate every execution pattern for that function.
4. Test or reason through each pattern.
5. Only then connect it to cross-function and async flows.

Do not jump directly from a suspicious line to a global conclusion. First complete the function worksheet.

Use this worksheet for every public, external, internal, and overridden function that can affect security:

```text
Function:
File:
Visibility:
Callers:
Inherited/overridden behavior:

Inputs:
- User-controlled:
- Admin-controlled:
- Callback-controlled:
- Derived from encrypted plaintext:

Preconditions:
- Explicit requires:
- Implicit assumptions:
- Required prior state:

State reads:
State writes:
Events:
External calls:
Value transfers:
CTX submission:
Callback dependency:

Execution patterns:
1.
2.
3.

Failure patterns:
1.
2.
3.

Invariants preserved:
Invariants possibly violated:
Questions:
Tests to add:
Finding candidate:
```

The worksheet can live in temporary notes, but any unresolved question or candidate finding must be preserved in the final audit notes.

---

## 6. Function inventory order

Audit in this order so dependencies are understood before high-level flows.

### 6.1 Cryptographic and historical helpers

1. `HistoricView.revokeAll`
2. `HistoricView.revokeTransferId`
3. `HistoricView.revokeTimeRange`
4. `HistoricView.authorizeTimeRange`
5. `HistoricView.authorizeTransferId`
6. `HistoricView.decodeIfAuthorized`
7. `HistoricView.canDecrypt`
8. `HistoricView.encodedTransferData`
9. `HistoricView._isAuthorized`
10. `EIP712Utils.recover`

Focus:

- authorization boundaries
- timestamp range semantics
- participant access
- encoding/decoding shape
- revocation semantics

### 6.2 EIP3009 base

1. `transferWithAuthorization`
2. `receiveWithAuthorization`
3. `cancelAuthorization`
4. `authorizationState`
5. `EIP3009._transferWithAuthorization`

Focus:

- nonce consumption
- signature domain separation
- validity windows
- receive front-running guard
- inherited `_transfer` behavior

### 6.3 Confidential EIP3009

1. `encryptedTransferWithAuthorization`
2. `encryptedReceiveWithAuthorization`
3. `ConfidentialEIP3009._transferWithAuthorization`

Focus:

- hashing `bytes value` in typed data
- nonce consumption before CTX finality
- encrypted vs plaintext authorization differences
- relayer and payee griefing

### 6.4 ConfidentialToken external and public surface

1. `receive`
2. `burn`
3. `onDecrypt`
4. `encryptedTransfer`
5. `encryptedTransferFrom`
6. `requestDecryptHistoricTransfer`
7. `requestDecryptHistoricTransferFor`
8. `removeHistoricViewAuth`
9. `removeHistoricViewTimeRange`
10. `removeHistoricViewTransferId`
11. `authorizeHistoricViewTimeRange`
12. `authorizeHistoricViewTransferId`
13. `setViewerPublicKey`
14. `setCallbackFee`
15. `setSubmitCTXAddress`
16. `setEncryptECIESAddress`
17. `setEncryptTEAddress`
18. `withdraw`
19. `encryptedBalanceOf`
20. `gasTokenBalanceOf`
21. `canDecryptHistoricTransfer`
22. `deposit`
23. `transferFrom`
24. `registerPublicKey`
25. `setViewerAddress`
26. `totalSupply`
27. `balanceOf`

Also trace these inherited public entry points because they are part of the deployed surface:

1. `transfer`
2. `approve`
3. `allowance`
4. `increaseAllowance` / `decreaseAllowance` if present in the inherited OpenZeppelin version
5. `permit`
6. `nonces`
7. `DOMAIN_SEPARATOR`
8. ERC20 metadata functions

Focus for inherited entry points:

- whether they route into overridden `_update`
- whether they reveal plaintext amounts in calldata, logs, return values, or state
- whether they create public allowances that interact badly with async transfer finality
- whether inherited behavior assumes synchronous ERC20 balance updates

Focus:

- exposed call paths
- fee accounting
- access control
- inherited ERC20 behavior
- intentionally reverted plaintext balance
- public metadata leaks

### 6.5 ConfidentialToken internal machinery

1. `_handleHistoricViewRequest`
2. `_handleTransferRequest`
3. `_decryptedUpdate`
4. `_onUpdate`
5. `_update`
6. `_updateWithGasPayer`
7. `_encryptedUpdate`
8. `_transferFrom`
9. `_encryptedTransferFrom`
10. `_encryptedTransfer`
11. `_setBalance`
12. `_encryptArguments`
13. `_getEncryptedBalance`
14. `_getViewKey`
15. `_viewerIsRegistered`
16. `_knownPublicKey`
17. `_isValidPublicKey`
18. `_decodeBalance`
19. `_publicKeyToAddress`
20. `_validateDecryptedArguments`

Focus:

- stale balance detection
- callback resubmission
- balance/supply conservation
- event confidentiality
- viewer key correctness
- malformed decrypted arguments
- zero address mint/burn behavior

### 6.6 MintableConfidentialToken

1. constructor
2. `mint`

Focus:

- restricted access
- zero address handling through inherited `_mint`
- async finality
- supply increase invariants

### 6.7 ConfidentialWrapper

1. constructor
2. `releaseTo`
3. `transferFrom`
4. `depositFor`
5. `withdrawTo`
6. `decimals`
7. `totalSupply`
8. `balanceOf`
9. `_onUpdate`
10. `_update`
11. `_onMint`
12. `_onBurn`

Focus:

- 1:1 backing
- `requestedMints`
- failed mint callback recovery
- withdrawal finality
- arbitrary-account release behavior
- ERC20Wrapper assumptions
- fee-on-transfer or non-standard underlying tokens

---

## 7. Execution-pattern enumeration

For each function, enumerate patterns using this checklist.

Caller patterns:

- holder
- recipient
- spender
- relayer
- registered viewer
- unregistered viewer
- historic viewer
- admin/restricted role
- unauthorized user
- BITE callback sender
- malicious contract
- underlying ERC20 token

Input patterns:

- zero address
- self-transfer
- zero amount
- maximum amount
- amount greater than balance
- valid TE ciphertext
- malformed ciphertext length
- empty decrypted value
- malformed plaintext arguments
- stale encrypted balances
- missing public key
- viewer public key changed between submission and callback
- historic auth revoked between submission and callback
- expired or not-yet-valid authorization
- reused nonce

State patterns:

- no gas token deposited for callback fees
- exact callback fee deposited
- callback fee changed before next operation
- multiple CTXs pending for same account
- multiple CTXs pending for both accounts
- account changed after CTX submission
- callback succeeds
- callback reverts
- callback sender tries replay
- underlying token transfer succeeds
- underlying token transfer fails

Inheritance patterns:

- direct function call
- call through inherited ERC20 function
- call through ERC20Permit allowance path
- call through EIP3009 signed path
- call through wrapper override

If a function has fewer than three patterns, explicitly say why.

---

## 8. Cross-flow analysis after isolation

Only after function-level review, analyze these full flows.

### 8.1 Current balance viewing

Flow:

1. register public key
2. set viewer
3. update holder balance
4. read `encryptedBalanceOf`
5. rotate viewer
6. update holder balance again

Questions:

- Can the old viewer read fresh balances?
- Can a wrong public key receive data?
- Does viewer rotation trigger a CTX and fee charge correctly?
- Can viewer changes grief pending transfers?

### 8.2 Plain transfer

Flow:

1. `transfer(to, value)`
2. `_update`
3. `_updateWithGasPayer`
4. `_encryptedUpdate`
5. `submitCTX`
6. `onDecrypt`
7. `_handleTransferRequest`
8. `_decryptedUpdate`
9. `_onUpdate`

Questions:

- Is value confidentiality preserved only if transaction payload is encrypted?
- Are fees debited from the right party?
- Can stale balances cause unbounded resubmission?
- Are events non-leaking?

### 8.3 Encrypted transfer

Flow:

1. `encryptedTransfer`
2. encrypted value length validation
3. CTX submission
4. callback finality

Questions:

- Can arbitrary bytes cause invalid callback behavior?
- Are malformed ciphertexts rejected early enough?
- Does the sender lose fees on invalid ciphertext?

### 8.4 Allowance transfer

Flow:

1. approve or permit
2. `transferFrom` or `encryptedTransferFrom`
3. allowance spend
4. CTX callback success/failure

Questions:

- Can allowance be consumed even when confidential transfer never finalizes?
- Can spender grief a holder by spending allowance into failing CTXs?
- Are public allowance amounts an intended information leak?

### 8.5 EIP3009 signed transfer

Flow:

1. sign authorization
2. relayer submits
3. nonce consumed
4. CTX submitted
5. callback succeeds/fails

Questions:

- Is nonce consumption before finality acceptable?
- Can a relayer burn a nonce and callback fee without moving tokens?
- Does `encryptedReceiveWithAuthorization` fully protect payee front-running?

### 8.6 Mint

Flow:

1. restricted `mint`
2. CTX submission
3. callback success/failure
4. supply and recipient balance update

Questions:

- Can supply increase without recipient balance increase?
- Can mint be permanently stuck after fee loss?
- Does admin mint reveal amounts by design?

### 8.7 Burn

Flow:

1. `burn`
2. CTX submission
3. callback success/failure
4. supply and holder balance update

Questions:

- Can supply decrease without balance decrease?
- Can failed burn consume fees without effect?
- Can burn be front-run or made stale?

### 8.8 Historic transfer disclosure

Flow:

1. transfer emits TE-encrypted historic payload
2. participant authorizes viewer
3. requester calls decrypt request
4. callback checks authorization
5. event emits ECIES-encrypted payload
6. participant revokes authorization

Questions:

- Is authorization checked at request time or callback time?
- Can revocation between request and callback prevent disclosure?
- Can one participant disclose the full transfer against the other participant's wishes?
- Does time-range authorization use intended inclusive/exclusive bounds?

### 8.9 Wrapper deposit and release

Flow:

1. user approves underlying
2. `depositFor`
3. underlying is locked
4. confidential mint CTX pending
5. callback succeeds or fails
6. optional `releaseTo`

Questions:

- Is the wrapper fully backed during pending mints?
- Can `releaseTo` be used to recover only failed pending deposits?
- Can a user release underlying while a mint later succeeds?
- Are fee-on-transfer underlying tokens safe?

### 8.10 Wrapper withdrawal

Flow:

1. `withdrawTo`
2. confidential burn CTX pending
3. callback succeeds
4. `_onBurn` transfers underlying

Questions:

- Does `withdrawTo(account, value)` release to `account` or to burner?
- Can underlying transfer failure revert the entire callback safely?
- Can wrapper backing become inconsistent?

---

## 9. Test policy for doubts

When the agent finds a question, it must choose one of three actions.

### Action A: Write a focused test

Write a test if the behavior can be reproduced with existing fixtures and mocks in less than roughly 30 minutes.

Good test candidates:

- stale CTX ordering
- callback replay
- allowance consumed before callback failure
- nonce consumed before callback failure
- authorization revoked before historic-view callback
- wrapper `releaseTo` followed by delayed callback
- malformed encrypted value

Test rules:

- Add tests under the existing `test/*.ts` structure.
- Prefer existing helpers in `test/tools/fixtures.ts`, `test/tools/helpers.ts`, and `test/tools/utils.ts`.
- Name tests as behavior statements.
- Keep each test focused on one question.
- Do not change production contracts to make a test pass.
- If a temporary test is only exploratory, mark it clearly or remove it before finalizing unless the user asked to keep it.

### Action B: Document a test for a second agent

Document the high-level test if it needs complex setup, production BITE behavior, or a new harness.

Use this format:

```text
Test idea:
Target finding/question:
Setup:
Steps:
Expected safe behavior:
Potential vulnerable behavior:
Why this matters:
```

### Action C: Resolve by code reasoning

Use code reasoning only if the behavior is deterministic and obvious from the code path. Include the exact path and invariant.

---

## 10. Finding standards

A finding must include:

- title
- severity estimate
- affected files/functions
- root cause
- attack or failure scenario
- impact
- proof or reasoning
- recommended fix
- tests to add or update
- confidence level

Severity guidance:

- **Critical:** direct theft, unauthorized mint, permanent backing insolvency, arbitrary disclosure of confidential amounts, or total system loss.
- **High:** user funds stuck or lost under realistic conditions, supply/backing mismatch, serious authorization bypass, replay, or reliable confidential-data disclosure.
- **Medium:** griefing with meaningful cost to users, denial of operation, fee-drain amplification, stale state causing repeated failures, or policy-breaking disclosure requiring conditions.
- **Low:** confusing semantics, weak validation with limited impact, admin-risk footguns, event/documentation mismatch.
- **Informational:** known tradeoff, documentation gap, test gap, or non-exploitable oddity.

Do not create findings for expected behavior already documented in `BITE.md` or `CNFToken.md` unless the implementation makes the known risk materially worse.

---

## 11. Audit notes format

The audit agent should maintain notes while working. If creating a file, use `AUDIT_NOTES.md` or `AUDIT_FINDINGS.md` unless the user requests another name.

Suggested structure:

```markdown
# Audit Notes

## Baseline

## Function Isolation Worksheets

## Cross-Flow Analysis

## Findings

## Questions for Maintainers

## Test Ideas for Second Iteration
```

Questions should be precise. Bad: "Is this intended?" Good: "Should `encryptedTransferWithAuthorization` consume the nonce even if the later CTX callback reverts because the encrypted value is malformed?"

---

## 12. Static analysis pass

After manual isolation review, run static tools and map warnings back to reviewed functions.

Commands:

```bash
yarn lint
yarn slither
```

For each warning:

- decide whether it is true positive, false positive, or needs investigation
- connect it to an invariant from `CNFToken.md` when possible
- do not report raw tool output as a finding without manual validation

Pay special attention to:

- unchecked external calls
- arbitrary send/transfer behavior
- reentrancy reports in callbacks or wrapper release paths
- timestamp warnings in EIP3009 and historic-view ranges
- dead code or unreachable branches
- storage writes before external calls

---

## 13. Test suite review

Review tests after code isolation, not before, so tests do not anchor the analysis.

For each major invariant in `CNFToken.md`, answer:

- Is there a positive test?
- Is there a negative test?
- Is there a stale/async test?
- Is there a malformed input test?
- Is there an authorization boundary test?

Minimum test gap matrix:

| Area | Positive | Negative | Async/stale | Auth boundary | Malformed |
|---|---|---|---|---|---|
| Transfer | | | | | |
| Encrypted transfer | | | | | |
| Allowance transfer | | | | | |
| EIP3009 | | | | | |
| Mint | | | | | |
| Burn | | | | | |
| Current viewer | | | | | |
| Historic viewer | | | | | |
| Wrapper deposit | | | | | |
| Wrapper withdrawal | | | | | |

If the agent cannot fill a cell, document the gap.

---

## 14. Final audit pass

Before producing final results:

1. Re-read `CNFToken.md`.
2. Re-read `BITE.md` sections on CTX lifecycle, callback authentication, gas accounting, and plaintext leakage.
3. Check that every finding maps to a violated invariant or a clear missing invariant.
4. Check that every unresolved question has a proposed test or maintainer decision.
5. Re-run any targeted tests added during the audit.
6. Remove or clearly mark exploratory code if it should not remain.
7. Keep final output concise and evidence-based.

Final output should lead with findings, then open questions, then test gaps. Do not bury critical issues in a narrative.

---
