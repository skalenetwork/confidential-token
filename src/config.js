export const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME;
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID);
export const CHAIN_RPC = import.meta.env.VITE_CHAIN_RPC;
export const CHAIN_EXPLORER = import.meta.env.VITE_CHAIN_EXPLORER;
export const CONFIDENTIAL_TOKEN_ADDRESS = import.meta.env.VITE_CONFIDENTIAL_TOKEN_ADDRESS;
export const APPKIT_PROJECT_ID = import.meta.env.VITE_APPKIT_PROJECT_ID;

export const SIGN_MESSAGE =
  'Sign this message to derive your SKALE View Key. ' +
  'This will allow the explorer to decrypt and display your private balance locally.';

export const CONTRACT_ABI = [
  'function encryptedBalanceOf(address holder) view returns (bytes encryptedBalance)',
  'function setViewerPublicKey((bytes32 x, bytes32 y) publicKey) payable',
  'function ethBalanceOf(address holder) view returns (uint256 balance)',
  'function callbackFee() view returns (uint256)',
  'function deposit(address receiver) payable',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 value) returns (bool)',
];
