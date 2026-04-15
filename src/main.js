import { keccak256, BrowserProvider } from 'ethers';
import { SIGN_MESSAGE } from './config.js';
import { initWallet, ensureConnected } from './wallet.js';
import {
  getSignerAndContract,
  fetchSymbol,
  getCachedSymbol,
  checkFunding,
  getDepositAmount,
  mintWrapped,
  withdrawWrapped,
} from './contract.js';
import {
  deployWrapper,
  getDeployedWrapperAddress,
  getOriginTokenAddress,
  clearDeployedWrapper,
} from './deployWrapper.js';
import { decryptBalance, deriveViewerKey, encryptTransfer } from './encryption.js';

function setButtonLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = loading ? text : button.dataset.label;
}

document.addEventListener('wheel', () => {
  if (document.activeElement?.type === 'number') {
    document.activeElement.blur();
  }
});

// --- Initialize wallet ---
const modal = initWallet();

// --- DOM elements ---
const connectBtn = document.getElementById('connectBtn');
const balanceDisplay = document.getElementById('balanceDisplay');
const decryptBtn = document.getElementById('decryptBtn');
const registerBtn = document.getElementById('registerBtn');
const depositBtn = document.getElementById('depositBtn');
const depositInput = document.getElementById('depositAmount');
const fundingWarning = document.getElementById('fundingWarning');
const transferBtn = document.getElementById('transferBtn');
const recipientInput = document.getElementById('recipient');
const amountInput = document.getElementById('amount');
const deployBtn = document.getElementById('deployBtn');
const originTokenInput = document.getElementById('originToken');
const wrapperStatus = document.getElementById('wrapperStatus');
const wrapperAddressDisplay = document.getElementById('wrapperAddressDisplay');
const clearWrapperBtn = document.getElementById('clearWrapperBtn');
const wrapBtn = document.getElementById('wrapBtn');
const wrapAmountInput = document.getElementById('wrapAmount');
const unwrapBtn = document.getElementById('unwrapBtn');

// Store original button labels
[decryptBtn, registerBtn, depositBtn, transferBtn, deployBtn, wrapBtn, unwrapBtn].forEach((btn) => {
  btn.dataset.label = btn.textContent;
});

// --- Deploy state ---
function showWrapperStatus(address) {
  wrapperAddressDisplay.textContent = address;
  wrapperStatus.style.display = 'flex';
}

function initDeployState() {
  const addr = getDeployedWrapperAddress();
  if (addr) {
    showWrapperStatus(addr);
    const originToken = getOriginTokenAddress();
    if (originToken) originTokenInput.value = originToken;
  }
}
initDeployState();

// --- Connect button ---
function renderAccount(account) {
  if (account && account.isConnected && account.address) {
    connectBtn.textContent = account.address;
  } else {
    connectBtn.textContent = 'Connect Wallet';
  }
}

connectBtn.addEventListener('click', () => {
  const account = modal.getAccount('eip155');
  if (account && account.isConnected) {
    modal.open({ view: 'Account' });
  } else {
    modal.open();
  }
});

renderAccount(modal.getAccount('eip155'));

modal.subscribeAccount((account) => {
  renderAccount(account);
  if (account && account.isConnected) {
    checkFunding(depositInput, fundingWarning, [wrapBtn, transferBtn]);
    fetchSymbol();
  }
});

if (modal.getAccount('eip155')?.isConnected) {
  checkFunding(depositInput, fundingWarning, [wrapBtn, transferBtn]);
  fetchSymbol();
}

// --- Decrypt Balance ---
decryptBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  try {
    setButtonLoading(decryptBtn, true, 'Reading...');
    const { signer, contract } = await getSignerAndContract();
    const address = await signer.getAddress();

    let encryptedData;
    try {
      encryptedData = await contract.encryptedBalanceOf(address);
    } catch (_) {
      balanceDisplay.textContent = 'Viewer key not registered';
      balanceDisplay.style.color = '#ef4444';
      return;
    }

    setButtonLoading(decryptBtn, true, 'Signing...');
    const signature = await signer.signMessage(SIGN_MESSAGE);
    const derivedPrivateKey = keccak256(signature);

    setButtonLoading(decryptBtn, true, 'Decrypting...');
    const rawBalance = decryptBalance(derivedPrivateKey, encryptedData);
    const symbol = getCachedSymbol();

    balanceDisplay.textContent = rawBalance + ' ' + symbol;
    balanceDisplay.style.color = 'var(--accent-primary)';
  } catch (err) {
    console.error('Decrypt error:', err);
    balanceDisplay.textContent = 'Decryption failed';
    balanceDisplay.style.color = '#ef4444';
  } finally {
    setButtonLoading(decryptBtn, false);
  }
});

// --- Register Viewer Key ---
registerBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  try {
    setButtonLoading(registerBtn, true, 'Signing...');
    const { signer, contract } = await getSignerAndContract();
    const signature = await signer.signMessage(SIGN_MESSAGE);
    const derivedPrivateKey = keccak256(signature);

    const { x, y } = deriveViewerKey(derivedPrivateKey);

    setButtonLoading(registerBtn, true, 'Confirm tx...');
    const tx = await contract.setViewerPublicKey({ x, y }, { value: 0 });

    setButtonLoading(registerBtn, true, 'Waiting...');
    await tx.wait();

    registerBtn.textContent = 'Key Registered ✓';
    setTimeout(() => { registerBtn.textContent = registerBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Register error:', err);
    registerBtn.textContent = 'Registration failed';
    setTimeout(() => { registerBtn.textContent = registerBtn.dataset.label; }, 3000);
  } finally {
    registerBtn.disabled = false;
  }
});

// --- Deposit ETH ---
depositBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  try {
    setButtonLoading(depositBtn, true, 'Confirm tx...');
    const { signer, contract } = await getSignerAndContract();
    const address = await signer.getAddress();
    const amount = await getDepositAmount(depositInput.value);

    const tx = await contract.deposit(address, { value: amount });
    setButtonLoading(depositBtn, true, 'Waiting...');
    await tx.wait();

    depositInput.value = '';
    await checkFunding(depositInput, fundingWarning, [wrapBtn, transferBtn]);
  } catch (err) {
    console.error('Deposit error:', err);
    depositBtn.textContent = 'Deposit failed';
    setTimeout(() => { depositBtn.textContent = depositBtn.dataset.label; }, 3000);
  } finally {
    depositBtn.disabled = false;
    depositBtn.textContent = depositBtn.dataset.label;
  }
});

// --- Send Confidential Transfer ---
transferBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  const recipient = recipientInput.value.trim();
  const amount = amountInput.value.trim();

  if (!recipient || !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
    recipientInput.style.borderColor = '#ef4444';
    recipientInput.focus();
    return;
  }
  recipientInput.style.borderColor = '';

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    amountInput.style.borderColor = '#ef4444';
    amountInput.focus();
    return;
  }
  amountInput.style.borderColor = '';

  try {
    setButtonLoading(transferBtn, true, 'Encrypting...');
    const { signer } = await getSignerAndContract();
    const encryptedTx = await encryptTransfer(recipient, amount);

    setButtonLoading(transferBtn, true, 'Confirm tx...');
    const tx = await signer.sendTransaction(encryptedTx);

    setButtonLoading(transferBtn, true, 'Waiting...');
    await tx.wait();

    recipientInput.value = '';
    amountInput.value = '';
    transferBtn.textContent = 'Transfer Sent ✓';
    setTimeout(() => { transferBtn.textContent = transferBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Transfer error:', err);
    transferBtn.textContent = 'Transfer failed';
    setTimeout(() => { transferBtn.textContent = transferBtn.dataset.label; }, 3000);
  } finally {
    transferBtn.disabled = false;
  }
});

// --- Deploy Wrapper ---
deployBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  const originToken = originTokenInput.value.trim();
  if (!originToken || !/^0x[0-9a-fA-F]{40}$/.test(originToken)) {
    originTokenInput.style.borderColor = '#ef4444';
    originTokenInput.focus();
    return;
  }
  originTokenInput.style.borderColor = '';

  try {
    setButtonLoading(deployBtn, true, 'Confirm tx...');
    const ethersProvider = new BrowserProvider(window.ethereum);
    const signer = await ethersProvider.getSigner();
    const { wrapperAddress } = await deployWrapper(originToken, signer, (msg) => {
      deployBtn.textContent = msg;
    });
    showWrapperStatus(wrapperAddress);
    checkFunding(depositInput, fundingWarning, [wrapBtn, transferBtn]);
    fetchSymbol();
    deployBtn.textContent = 'Deployed ✓';
    setTimeout(() => { deployBtn.textContent = deployBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Deploy error:', err);
    deployBtn.textContent = 'Deploy failed';
    setTimeout(() => { deployBtn.textContent = deployBtn.dataset.label; }, 3000);
  } finally {
    deployBtn.disabled = false;
  }
});

// --- Clear deployed wrapper ---
clearWrapperBtn.addEventListener('click', () => {
  clearDeployedWrapper();
  wrapperStatus.style.display = 'none';
  originTokenInput.value = '';
});

// --- Wrap Tokens ---
wrapBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  const amount = wrapAmountInput.value.trim();
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    wrapAmountInput.style.borderColor = '#ef4444';
    wrapAmountInput.focus();
    return;
  }
  wrapAmountInput.style.borderColor = '';

  try {
    setButtonLoading(wrapBtn, true, 'Confirm approval...');
    await mintWrapped(amount, (msg) => { wrapBtn.textContent = msg; });
    wrapAmountInput.value = '';
    wrapBtn.textContent = 'Wrapped ✓';
    setTimeout(() => { wrapBtn.textContent = wrapBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Wrap error:', err);
    wrapBtn.textContent = 'Wrap failed';
    setTimeout(() => { wrapBtn.textContent = wrapBtn.dataset.label; }, 3000);
  } finally {
    wrapBtn.disabled = false;
  }
});

// --- Unwrap All Tokens ---
unwrapBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  try {
    setButtonLoading(unwrapBtn, true, 'Signing...');
    const { signer, contract } = await getSignerAndContract();
    const userAddress = await signer.getAddress();

    const encryptedData = await contract.encryptedBalanceOf(userAddress);
    const signature = await signer.signMessage(SIGN_MESSAGE);
    const derivedPrivateKey = keccak256(signature);

    setButtonLoading(unwrapBtn, true, 'Decrypting...');
    const rawBalance = decryptBalance(derivedPrivateKey, encryptedData);
    const amount = BigInt(rawBalance);

    if (amount === 0n) {
      unwrapBtn.textContent = 'Nothing to unwrap';
      setTimeout(() => { unwrapBtn.textContent = unwrapBtn.dataset.label; }, 3000);
      return;
    }

    setButtonLoading(unwrapBtn, true, 'Confirm approval...');
    await withdrawWrapped(amount);
    unwrapBtn.textContent = 'Unwrapped ✓';
    setTimeout(() => { unwrapBtn.textContent = unwrapBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Unwrap error:', err);
    unwrapBtn.textContent = 'Unwrap failed';
    setTimeout(() => { unwrapBtn.textContent = unwrapBtn.dataset.label; }, 3000);
  } finally {
    unwrapBtn.disabled = false;
  }
});
