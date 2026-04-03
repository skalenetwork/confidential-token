import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';
import { CONFIDENTIAL_TOKEN_ADDRESS, CONTRACT_ABI } from './config.js';

export async function getSignerAndContract() {
  const provider = window.ethereum;
  if (!provider) throw new Error('Wallet not connected');
  const ethersProvider = new BrowserProvider(provider);
  const signer = await ethersProvider.getSigner();
  const contract = new Contract(CONFIDENTIAL_TOKEN_ADDRESS, CONTRACT_ABI, signer);
  return { signer, contract };
}

let cachedCallbackFee = null;
let cachedSymbol = null;

export function getCachedSymbol() {
  return cachedSymbol ?? 'CTK';
}

export async function fetchSymbol() {
  try {
    const { contract } = await getSignerAndContract();
    cachedSymbol = await contract.symbol();
  } catch (_) {
    cachedSymbol = 'CTK';
  }
}

export async function checkFunding(depositInput, fundingWarning) {
  try {
    const { signer, contract } = await getSignerAndContract();
    const address = await signer.getAddress();
    const [balance, fee] = await Promise.all([
      contract.ethBalanceOf(address),
      contract.callbackFee(),
    ]);
    cachedCallbackFee = fee;
    depositInput.value = formatUnits(fee * 2n, 18);
    fundingWarning.style.display = balance < fee ? 'block' : 'none';
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
  return fee * 2n;
}
