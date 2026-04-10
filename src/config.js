export const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME;
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID);
export const CHAIN_RPC = import.meta.env.VITE_CHAIN_RPC;
export const CHAIN_EXPLORER = import.meta.env.VITE_CHAIN_EXPLORER;
export const APPKIT_PROJECT_ID = import.meta.env.VITE_APPKIT_PROJECT_ID;

export const SIGN_MESSAGE =
  'Sign this message to derive your SKALE View Key. ' +
  'This will allow the explorer to decrypt and display your private balance locally.';
