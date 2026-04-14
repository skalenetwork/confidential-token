import { BrowserProvider, Contract, MaxUint256, formatUnits, parseUnits } from 'ethers';
import ConfidentialWrapperArtifact from '../artifacts/ConfidentialWrapper.json';
import { getOriginTokenAddress } from './deployWrapper.js';

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
];

const DEPOSIT_MULTIPLIER = 10n;

export function getActiveContractAddress() {
  return sessionStorage.getItem('confidential_wrapper_address');
}

export async function getSignerAndContract() {
  const provider = window.ethereum;
  if (!provider) throw new Error('Wallet not connected');
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const contract = new Contract(getActiveContractAddress(), ConfidentialWrapperArtifact.abi, signer);
  return { signer, contract };
}

let cachedCallbackFee = null;
let cachedSymbol = null;

export function getCachedSymbol() {
  return cachedSymbol ?? 'CNF';
}

export async function fetchSymbol() {
  try {
    const { contract } = await getSignerAndContract();
    cachedSymbol = await contract.symbol();
  } catch (_) {
    cachedSymbol = 'CNF';
  }
}

export async function checkFunding(depositInput, fundingWarning, gatedButtons = []) {
  try {
    const { signer, contract } = await getSignerAndContract();
    const address = await signer.getAddress();
    const [balance, fee] = await Promise.all([
      contract.ethBalanceOf(address),
      contract.callbackFee(),
    ]);
    cachedCallbackFee = fee;
    depositInput.value = formatUnits(fee * DEPOSIT_MULTIPLIER, 18);
    const insufficient = balance < fee;
    fundingWarning.style.display = insufficient ? 'block' : 'none';
    gatedButtons.forEach(btn => { btn.disabled = insufficient; });
  } catch (e) {
    console.error('checkFunding error:', e);
  }
}

export async function getDepositAmount(depositInputValue) {
  if (depositInputValue && parseFloat(depositInputValue) > 0) {
    return parseUnits(depositInputValue, 18);
  }
  const { contract } = await getSignerAndContract();
  const fee = cachedCallbackFee ?? (await contract.callbackFee());
  return fee * DEPOSIT_MULTIPLIER;
}

export async function mintWrapped(amount, onProgress) {
  const provider = window.ethereum;
  if (!provider) throw new Error('Wallet not connected');
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const userAddress = await signer.getAddress();
  const wrapperAddress = getActiveContractAddress();
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

export async function withdrawWrapped() {
  const { signer, contract } = await getSignerAndContract();
  const userAddress = await signer.getAddress();
  const tx = await contract.releaseTo(userAddress, MaxUint256);
  await tx.wait();
}
