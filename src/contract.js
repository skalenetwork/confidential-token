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
