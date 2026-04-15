import { ContractFactory } from 'ethers';
import ConfidentialWrapperArtifact from '../artifacts/ConfidentialWrapper.json';
import AccessManagerArtifact from '../artifacts/AccessManager.json';

export function getDeployedWrapperAddress() {
  return sessionStorage.getItem('confidential_wrapper_address');
}

export function getOriginTokenAddress() {
  return sessionStorage.getItem('origin_token_address');
}

export function clearDeployedWrapper() {
  sessionStorage.removeItem('confidential_wrapper_address');
  sessionStorage.removeItem('origin_token_address');
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

  sessionStorage.setItem('confidential_wrapper_address', wrapperAddress);
  sessionStorage.setItem('origin_token_address', originTokenAddress);

  return { wrapperAddress, accessManagerAddress };
}


