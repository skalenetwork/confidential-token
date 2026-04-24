import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';
import ConfidentialWrapperArtifact from '../artifacts/ConfidentialWrapper.json';
import ConfidentialTokenArtifact from '../artifacts/ConfidentialToken.json';
import { getOriginTokenAddress } from './deployWrapper.js';

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
];

const DEPOSIT_MULTIPLIER = 10n;

export function getConfidentialWrapperAddress() {
  return sessionStorage.getItem('confidential_wrapper_address');
}

export function getConfidentialTokenAddress() {
  return sessionStorage.getItem('confidential_token_address');
}

export async function getSignerAndWrappedContract() {
  const provider = window.ethereum;
  if (!provider) throw new Error('Wallet not connected');
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const contract = new Contract(getConfidentialWrapperAddress(), ConfidentialWrapperArtifact.abi, signer);
  return { signer, contract };
}

export async function getSignerAndTokenContract() {
  const provider = window.ethereum;
  if (!provider) throw new Error('Wallet not connected');
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const contract = new Contract(getConfidentialTokenAddress(), ConfidentialTokenArtifact.abi, signer);
  return { signer, contract };
}

let cachedCallbackFee = null;
let cachedSymbol = null;

export function getCachedSymbol() {
  return cachedSymbol ?? 'CNF';
}

export async function fetchSymbol() {
  try {
    const { contract } = await getSignerAndWrappedContract();
    cachedSymbol = await contract.symbol();
  } catch (_) {
    cachedSymbol = 'CNF';
  }
}

async function runFundingCheck(getContractFn, depositInput, fundingWarning, gatedButtons) {
  const { signer, contract } = await getContractFn();
  const address = await signer.getAddress();
  const [balance, fee] = await Promise.all([
    contract.ethBalanceOf(address),
    contract.callbackFee(),
  ]);
  cachedCallbackFee = fee;
  depositInput.value = formatUnits(fee * DEPOSIT_MULTIPLIER, 18);
  const insufficient = balance < fee;
  if (insufficient) fundingWarning.style.display = 'block';
  gatedButtons.forEach(btn => { btn.disabled = insufficient; });
  return insufficient;
}

export async function checkFunding(depositInput, fundingWarning, gatedButtons = []) {
  try {
    const insufficient = await runFundingCheck(getSignerAndWrappedContract, depositInput, fundingWarning, gatedButtons);
    if (!insufficient) fundingWarning.style.display = 'none';
  } catch (e) {
    console.error('checkFunding error:', e);
  }
}

export async function checkTokenFunding(depositInput, fundingWarning, gatedButtons = []) {
  try {
    const insufficient = await runFundingCheck(getSignerAndTokenContract, depositInput, fundingWarning, gatedButtons);
    if (!insufficient) fundingWarning.style.display = 'none';
  } catch (e) {
    console.error('checkTokenFunding error:', e);
  }
}

export async function getDepositAmount(depositInputValue) {
  if (depositInputValue && parseFloat(depositInputValue) > 0) {
    return parseUnits(depositInputValue, 18);
  }
  if (cachedCallbackFee) return cachedCallbackFee * DEPOSIT_MULTIPLIER;
  const getContract = getConfidentialWrapperAddress() ? getSignerAndWrappedContract : getSignerAndTokenContract;
  const { contract } = await getContract();
  const fee = await contract.callbackFee();
  cachedCallbackFee = fee;
  return fee * DEPOSIT_MULTIPLIER;
}

export async function mintWrapped(amount, onProgress) {
  const provider = window.ethereum;
  if (!provider) throw new Error('Wallet not connected');
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const userAddress = await signer.getAddress();
  const wrapperAddress = getConfidentialWrapperAddress();
  const originTokenAddress = getOriginTokenAddress();
  if (!originTokenAddress)
    throw new Error('Origin token address not set');

  const originToken = new Contract(originTokenAddress, ERC20_APPROVE_ABI, signer);
  const approveTx = await originToken.approve(wrapperAddress, amount);
  onProgress?.('Mining approval...');
  await approveTx.wait();

  const wrapper = new Contract(wrapperAddress, ConfidentialWrapperArtifact.abi, signer);
  onProgress?.('Confirm wrap tx...');
  const depositTx = await wrapper.depositFor(userAddress, amount);
  onProgress?.('Wrapping...');
  await depositTx.wait();
}

export async function withdrawWrapped(amount) {
  const { signer, contract } = await getSignerAndWrappedContract();
  const userAddress = await signer.getAddress();
  const tx = await contract.withdrawTo(userAddress, amount);
  await tx.wait();
}

export async function mintToken(amount) {
  const { signer, contract } = await getSignerAndTokenContract();
  const userAddress = await signer.getAddress();
  const parsedAmount = parseUnits(amount.toString(), 18);
  const tx = await contract.mint(userAddress, parsedAmount);
  await tx.wait();
}
