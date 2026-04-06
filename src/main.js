import { keccak256 } from 'ethers';
import { SIGN_MESSAGE } from './config.js';
import { initWallet, ensureConnected } from './wallet.js';
import {
  getSignerAndContract,
  fetchSymbol,
  getCachedSymbol,
  checkFunding,
  getDepositAmount,
} from './contract.js';
import { decryptBalance, deriveViewerKey, encryptTransfer } from './encryption.js';
import { setButtonLoading } from './ui.js';

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

// Store original button labels
[decryptBtn, registerBtn, depositBtn, transferBtn].forEach((btn) => {
  btn.dataset.label = btn.textContent;
});

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
