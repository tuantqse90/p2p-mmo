import nacl from "tweetnacl";
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from "tweetnacl-util";

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Derive a NaCl keypair from a wallet signature.
 * seed = keccak256(signature) → first 32 bytes as secret key
 */
export function deriveKeyPair(signatureHex: string): KeyPair {
  // Remove 0x prefix
  const sigBytes = hexToBytes(signatureHex.replace("0x", ""));
  // Use first 32 bytes of signature as seed (or hash it)
  const seed = sigBytes.slice(0, 32);
  return nacl.box.keyPair.fromSecretKey(seed);
}

/**
 * Encrypt a message for a recipient using NaCl box.
 */
export function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(plaintext);
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  if (!encrypted) throw new Error("Encryption failed");

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a message from a sender using NaCl box.
 */
export function decryptMessage(
  ciphertextBase64: string,
  nonceBase64: string,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string {
  const ciphertext = decodeBase64(ciphertextBase64);
  const nonce = decodeBase64(nonceBase64);
  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPublicKey,
    recipientSecretKey
  );

  if (!decrypted) throw new Error("Decryption failed");

  return encodeUTF8(decrypted);
}

/**
 * Encrypt a product key for a specific buyer.
 */
export function encryptProductKey(
  productKey: string,
  buyerPublicKey: Uint8Array,
  sellerSecretKey: Uint8Array
): { ciphertext: string; nonce: string } {
  return encryptMessage(productKey, buyerPublicKey, sellerSecretKey);
}

/**
 * Decrypt a product key from seller.
 */
export function decryptProductKey(
  ciphertextBase64: string,
  nonceBase64: string,
  sellerPublicKey: Uint8Array,
  buyerSecretKey: Uint8Array
): string {
  return decryptMessage(
    ciphertextBase64,
    nonceBase64,
    sellerPublicKey,
    buyerSecretKey
  );
}

export function publicKeyToBase64(publicKey: Uint8Array): string {
  return encodeBase64(publicKey);
}

export function base64ToPublicKey(base64: string): Uint8Array {
  return decodeBase64(base64);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
