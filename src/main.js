import { keccak256, BrowserProvider } from 'ethers';
import { SIGN_MESSAGE } from './config.js';
import { initWallet, ensureConnected } from './wallet.js';
import {
  getSignerAndWrappedContract,
  fetchSymbol,
  getCachedSymbol,
  checkFunding,
  checkTokenFunding,
  getDepositAmount,
  mintWrapped,
  withdrawWrapped,
  mintToken,
  getConfidentialWrapperAddress,
  getConfidentialTokenAddress,
} from './contract.js';
import {
  deployWrapper,
  getDeployedWrapperAddress,
  getOriginTokenAddress,
  clearDeployedWrapper,
} from './deployWrapper.js';
import {
  deployToken,
  getDeployedTokenAddress,
  clearDeployedToken,
} from './deployToken.js';
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
const deployTokenBtn = document.getElementById('deployTokenBtn');
const tokenNameInput = document.getElementById('tokenName');
const tokenSymbolInput = document.getElementById('tokenSymbol');
const tokenStatus = document.getElementById('tokenStatus');
const tokenAddressDisplay = document.getElementById('tokenAddressDisplay');
const clearTokenBtn = document.getElementById('clearTokenBtn');
const mintTokenBtn = document.getElementById('mintTokenBtn');
const mintAmountInput = document.getElementById('mintAmount');

// Store original button labels
[decryptBtn, registerBtn, depositBtn, transferBtn, deployBtn, wrapBtn, unwrapBtn, deployTokenBtn, mintTokenBtn].forEach((btn) => {
  btn.dataset.label = btn.textContent;
});

// --- Deploy state ---
function showWrapperStatus(address) {
  wrapperAddressDisplay.textContent = address;
  wrapperStatus.style.display = 'flex';
}

function showTokenStatus(address) {
  tokenAddressDisplay.textContent = address;
  tokenStatus.style.display = 'flex';
}

function initDeployState() {
  const addr = getDeployedWrapperAddress();
  if (addr) {
    showWrapperStatus(addr);
    const originToken = getOriginTokenAddress();
    if (originToken) originTokenInput.value = originToken;
  }
  const tokenAddr = getDeployedTokenAddress();
  if (tokenAddr) showTokenStatus(tokenAddr);
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

function checkAllFunding() {
  if (getConfidentialWrapperAddress()) {
    checkFunding(depositInput, fundingWarning, [wrapBtn, transferBtn]);
  }
  if (getConfidentialTokenAddress()) {
    checkTokenFunding(depositInput, fundingWarning, [mintTokenBtn]);
  }
}

modal.subscribeAccount((account) => {
  renderAccount(account);
  if (account && account.isConnected) {
    checkAllFunding();
    fetchSymbol();
  }
});

if (modal.getAccount('eip155')?.isConnected) {
  checkAllFunding();
  fetchSymbol();
}

// --- Decrypt Balance ---
decryptBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  try {
    setButtonLoading(decryptBtn, true, 'Reading...');
    const { signer, contract } = await getSignerAndWrappedContract();
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
    const { signer, contract } = await getSignerAndWrappedContract();
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
    const { signer, contract } = await getSignerAndWrappedContract();
    const address = await signer.getAddress();
    const amount = await getDepositAmount(depositInput.value);

    const tx = await contract.deposit(address, { value: amount });
    setButtonLoading(depositBtn, true, 'Waiting...');
    await tx.wait();

    depositInput.value = '';
    await checkAllFunding();
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
    const { signer } = await getSignerAndWrappedContract();
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
    checkAllFunding();
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
    const { signer, contract } = await getSignerAndWrappedContract();
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

    setButtonLoading(unwrapBtn, true, 'Confirm tx...');
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

// --- Deploy Confidential Token ---
deployTokenBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  const name = tokenNameInput.value.trim();
  const symbol = tokenSymbolInput.value.trim();
  if (!name) {
    tokenNameInput.style.borderColor = '#ef4444';
    tokenNameInput.focus();
    return;
  }
  tokenNameInput.style.borderColor = '';
  if (!symbol) {
    tokenSymbolInput.style.borderColor = '#ef4444';
    tokenSymbolInput.focus();
    return;
  }
  tokenSymbolInput.style.borderColor = '';

  try {
    setButtonLoading(deployTokenBtn, true, 'Confirm tx...');
    const ethersProvider = new BrowserProvider(window.ethereum);
    const signer = await ethersProvider.getSigner();
    const { tokenAddress } = await deployToken(name, symbol, signer, (msg) => {
      deployTokenBtn.textContent = msg;
    });
    showTokenStatus(tokenAddress);
    checkAllFunding();
    setTimeout(() => { deployTokenBtn.textContent = deployTokenBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Deploy token error:', err);
    deployTokenBtn.textContent = 'Deploy failed';
    setTimeout(() => { deployTokenBtn.textContent = deployTokenBtn.dataset.label; }, 3000);
  } finally {
    deployTokenBtn.disabled = false;
  }
});

// --- Clear deployed token ---
clearTokenBtn.addEventListener('click', () => {
  clearDeployedToken();
  tokenStatus.style.display = 'none';
  tokenNameInput.value = '';
  tokenSymbolInput.value = '';
});

// --- Mint Confidential Token ---
mintTokenBtn.addEventListener('click', async () => {
  if (!ensureConnected(modal)) return;

  const amount = mintAmountInput.value.trim();
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    mintAmountInput.style.borderColor = '#ef4444';
    mintAmountInput.focus();
    return;
  }
  mintAmountInput.style.borderColor = '';

  try {
    setButtonLoading(mintTokenBtn, true, 'Confirm tx...');
    await mintToken(amount);
    mintAmountInput.value = '';
    mintTokenBtn.textContent = 'Minted ✓';
    setTimeout(() => { mintTokenBtn.textContent = mintTokenBtn.dataset.label; }, 3000);
  } catch (err) {
    console.error('Mint error:', err);
    mintTokenBtn.textContent = 'Mint failed';
    setTimeout(() => { mintTokenBtn.textContent = mintTokenBtn.dataset.label; }, 3000);
  } finally {
    mintTokenBtn.disabled = false;
  }
});
