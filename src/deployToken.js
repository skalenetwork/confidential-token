import { ContractFactory } from 'ethers';
import ConfidentialTokenArtifact from '../artifacts/ConfidentialToken.json';
import AccessManagerArtifact from '../artifacts/AccessManager.json';

const TOKEN_ADDRESS_KEY = 'confidential_token_address';

export function getDeployedTokenAddress() {
  return sessionStorage.getItem(TOKEN_ADDRESS_KEY);
}

export function clearDeployedToken() {
  sessionStorage.removeItem(TOKEN_ADDRESS_KEY);
}

export async function deployToken(name, symbol, signer, onProgress) {
  const AccessManagerFactory = new ContractFactory(
    AccessManagerArtifact.abi,
    AccessManagerArtifact.bytecode,
    signer
  );
  onProgress?.('Deploying AccessManager...');
  const accessManager = await AccessManagerFactory.deploy(await signer.getAddress());
  onProgress?.('Waiting for AccessManager...');
  await accessManager.waitForDeployment();
  const accessManagerAddress = await accessManager.getAddress();

  const TokenFactory = new ContractFactory(
    ConfidentialTokenArtifact.abi,
    ConfidentialTokenArtifact.bytecode,
    signer
  );
  onProgress?.('Deploying ConfidentialToken...');
  const token = await TokenFactory.deploy(name, symbol, '1', accessManagerAddress);
  onProgress?.('Waiting for ConfidentialToken...');
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  sessionStorage.setItem(TOKEN_ADDRESS_KEY, tokenAddress);

  return { tokenAddress, accessManagerAddress };
}
