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
