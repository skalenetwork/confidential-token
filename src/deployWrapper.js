import { ContractFactory } from 'ethers';
import ConfidentialWrapperArtifact from '../artifacts/ConfidentialWrapper.json';
import AccessManagerArtifact from '../artifacts/AccessManager.json';

const WRAPPER_ADDRESS_KEY = 'confidential_wrapper_address';
const ORIGIN_TOKEN_KEY = 'origin_token_address';

export function getDeployedWrapperAddress() {
  return sessionStorage.getItem(WRAPPER_ADDRESS_KEY);
}

export function getOriginTokenAddress() {
  return sessionStorage.getItem(ORIGIN_TOKEN_KEY);
}

export function clearDeployedWrapper() {
  sessionStorage.removeItem(WRAPPER_ADDRESS_KEY);
  sessionStorage.removeItem(ORIGIN_TOKEN_KEY);
}

export async function deployWrapper(originTokenAddress, signer, onProgress) {
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

  const WrapperFactory = new ContractFactory(
    ConfidentialWrapperArtifact.abi,
    ConfidentialWrapperArtifact.bytecode,
    signer
  );
  onProgress?.('Deploying ConfidentialWrapper...');
  const wrapper = await WrapperFactory.deploy(originTokenAddress, '1', accessManagerAddress);
  onProgress?.('Waiting for ConfidentialWrapper...');
  await wrapper.waitForDeployment();
  const wrapperAddress = await wrapper.getAddress();

  sessionStorage.setItem(WRAPPER_ADDRESS_KEY, wrapperAddress);
  sessionStorage.setItem(ORIGIN_TOKEN_KEY, originTokenAddress);

  return { wrapperAddress, accessManagerAddress };
}


