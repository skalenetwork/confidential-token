import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import {
  CHAIN_NAME, CHAIN_ID, CHAIN_RPC, CHAIN_EXPLORER, APPKIT_PROJECT_ID,
} from './config.js';

const chainIdHex = '0x' + CHAIN_ID.toString(16);

function patchProvider(provider) {
  if (!provider || provider.__skalePatched) return;
  provider.__skalePatched = true;
  const orig = provider.request.bind(provider);
  provider.request = async (args) => {
    try {
      return await orig(args);
    } catch (err) {
      if (
        (err.code === 4902 || err.code === -32603) &&
        args.method === 'wallet_switchEthereumChain'
      ) {
        console.log('Chain not found, attempting to add SKALE chain to wallet...');
        await orig({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: 'CREDIT', symbol: 'CREDIT', decimals: 18 },
            rpcUrls: [CHAIN_RPC],
            blockExplorerUrls: [CHAIN_EXPLORER],
          }],
        });
        return orig(args);
      }
      throw err;
    }
  };
}

export function initWallet() {
  // Patch providers before AppKit binds
  if (window.ethereum) patchProvider(window.ethereum);
  window.addEventListener('eip6963:announceProvider', (e) => {
    patchProvider(e.detail.provider);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  const skaleChain = {
    id: CHAIN_ID,
    caipNetworkId: `eip155:${CHAIN_ID}`,
    chainNamespace: 'eip155',
    name: CHAIN_NAME,
    nativeCurrency: { name: 'CREDIT', symbol: 'CREDIT', decimals: 18 },
    rpcUrls: { default: { http: [CHAIN_RPC] } },
    blockExplorers: { default: { name: 'Blockscout', url: CHAIN_EXPLORER } },
  };

  const modal = createAppKit({
    adapters: [new EthersAdapter()],
    projectId: APPKIT_PROJECT_ID,
    networks: [skaleChain],
    defaultNetwork: skaleChain,
    metadata: {
      name: 'SKALE Confidential',
      description: 'Confidential Token Manager on SKALE',
      url: window.location.origin,
      icons: [],
    },
  });

  return modal;
}

export function ensureConnected(modal) {
  const account = modal.getAccount('eip155');
  if (!account || !account.isConnected) {
    modal.open();
    return false;
  }
  return true;
}
