import { ec as EC } from 'elliptic';
import CryptoJS from 'crypto-js';
import { Buffer } from 'buffer';
import { Interface } from 'ethers';
import { BITE } from '@skalenetwork/bite';
import { CHAIN_RPC, CONFIDENTIAL_TOKEN_ADDRESS, CONTRACT_ABI } from './config.js';

const ec = new EC('secp256k1');

export function decryptBalance(secretKey, encryptedDataHex) {
  const cleanSecretKey = secretKey.startsWith('0x') ? secretKey.slice(2) : secretKey;
  const cleanEncryptedData = encryptedDataHex.startsWith('0x')
    ? encryptedDataHex.slice(2)
    : encryptedDataHex;

  const encryptedDataBuffer = Buffer.from(cleanEncryptedData, 'hex');
  const iv = encryptedDataBuffer.subarray(0, 16);
  const ephemeralPublicKey = encryptedDataBuffer.subarray(16, 16 + 33);
  const ciphertext = encryptedDataBuffer.subarray(16 + 33);

  const key = ec.keyFromPrivate(cleanSecretKey, 'hex');
  const sharedSecretPoint = key.derive(
    ec.keyFromPublic(ephemeralPublicKey).getPublic()
  );
  const sharedSecret = Buffer.from(sharedSecretPoint.toArray('be', 32));

  const sharedSecretWA = CryptoJS.enc.Hex.parse(sharedSecret.toString('hex'));
  const encryptionKey = CryptoJS.SHA256(sharedSecretWA);

  const ciphertextWA = CryptoJS.enc.Hex.parse(ciphertext.toString('hex'));
  const ivWA = CryptoJS.enc.Hex.parse(iv.toString('hex'));

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: ciphertextWA },
    encryptionKey,
    { iv: ivWA, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
  );

  try {
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    if (decryptedString) {
      const maybeHex = decryptedString.startsWith('0x')
        ? decryptedString.slice(2)
        : decryptedString;
      const isHex = /^[0-9a-fA-F]*$/.test(maybeHex) && maybeHex.length % 2 === 0;
      if (isHex) {
        if (decryptedString.startsWith('0x')) {
          return BigInt(decryptedString).toString();
        }
        return decryptedString;
      }
    }
  } catch (_) {
    // fall through to hex path
  }

  const decryptedHex = decrypted.toString(CryptoJS.enc.Hex);
  return BigInt('0x' + decryptedHex).toString();
}
