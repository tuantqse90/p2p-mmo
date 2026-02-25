import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import {
  deriveKeyPair,
  encryptMessage,
  decryptMessage,
  encryptProductKey,
  decryptProductKey,
  publicKeyToBase64,
  base64ToPublicKey,
} from "./encryption";

describe("deriveKeyPair", () => {
  it("derives a keypair from a hex signature", () => {
    const sigHex = "ab".repeat(32) + "cd".repeat(33); // 65 bytes like eth sig
    const kp = deriveKeyPair(sigHex);

    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.secretKey.length).toBe(32);
  });

  it("handles 0x prefix", () => {
    const sigHex = "0x" + "ab".repeat(32) + "cd".repeat(33);
    const kp = deriveKeyPair(sigHex);
    expect(kp.publicKey.length).toBe(32);
  });

  it("same signature produces same keypair", () => {
    const sig = "ff".repeat(65);
    const kp1 = deriveKeyPair(sig);
    const kp2 = deriveKeyPair(sig);
    expect(encodeBase64(kp1.publicKey)).toBe(encodeBase64(kp2.publicKey));
    expect(encodeBase64(kp1.secretKey)).toBe(encodeBase64(kp2.secretKey));
  });

  it("different signatures produce different keypairs", () => {
    const kp1 = deriveKeyPair("aa".repeat(65));
    const kp2 = deriveKeyPair("bb".repeat(65));
    expect(encodeBase64(kp1.publicKey)).not.toBe(encodeBase64(kp2.publicKey));
  });
});

describe("encryptMessage / decryptMessage", () => {
  const alice = nacl.box.keyPair();
  const bob = nacl.box.keyPair();

  it("encrypts and decrypts a message", () => {
    const plaintext = "Hello, Bob!";
    const { ciphertext, nonce } = encryptMessage(
      plaintext,
      bob.publicKey,
      alice.secretKey
    );

    expect(ciphertext).toBeTruthy();
    expect(nonce).toBeTruthy();

    const decrypted = decryptMessage(
      ciphertext,
      nonce,
      alice.publicKey,
      bob.secretKey
    );
    expect(decrypted).toBe(plaintext);
  });

  it("handles unicode text", () => {
    const plaintext = "Xin chào! 你好 🌍🔐";
    const { ciphertext, nonce } = encryptMessage(
      plaintext,
      bob.publicKey,
      alice.secretKey
    );

    const decrypted = decryptMessage(
      ciphertext,
      nonce,
      alice.publicKey,
      bob.secretKey
    );
    expect(decrypted).toBe(plaintext);
  });

  it("handles empty string", () => {
    const { ciphertext, nonce } = encryptMessage(
      "",
      bob.publicKey,
      alice.secretKey
    );
    const decrypted = decryptMessage(
      ciphertext,
      nonce,
      alice.publicKey,
      bob.secretKey
    );
    expect(decrypted).toBe("");
  });

  it("handles long text", () => {
    const plaintext = "A".repeat(10000);
    const { ciphertext, nonce } = encryptMessage(
      plaintext,
      bob.publicKey,
      alice.secretKey
    );
    const decrypted = decryptMessage(
      ciphertext,
      nonce,
      alice.publicKey,
      bob.secretKey
    );
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", () => {
    const eve = nacl.box.keyPair();
    const { ciphertext, nonce } = encryptMessage(
      "secret",
      bob.publicKey,
      alice.secretKey
    );

    expect(() =>
      decryptMessage(ciphertext, nonce, alice.publicKey, eve.secretKey)
    ).toThrow("Decryption failed");
  });

  it("fails to decrypt with tampered ciphertext", () => {
    const { ciphertext, nonce } = encryptMessage(
      "secret",
      bob.publicKey,
      alice.secretKey
    );

    // Tamper with ciphertext
    const tampered =
      encodeBase64(new Uint8Array(32).fill(0xFF));

    expect(() =>
      decryptMessage(tampered, nonce, alice.publicKey, bob.secretKey)
    ).toThrow("Decryption failed");
  });

  it("produces different ciphertexts for same plaintext (random nonce)", () => {
    const { ciphertext: c1 } = encryptMessage(
      "same",
      bob.publicKey,
      alice.secretKey
    );
    const { ciphertext: c2 } = encryptMessage(
      "same",
      bob.publicKey,
      alice.secretKey
    );
    expect(c1).not.toBe(c2);
  });
});

describe("encryptProductKey / decryptProductKey", () => {
  const seller = nacl.box.keyPair();
  const buyer = nacl.box.keyPair();

  it("encrypts and decrypts a product key", () => {
    const key = "super-secret-product-download-key-abc123";
    const { ciphertext, nonce } = encryptProductKey(
      key,
      buyer.publicKey,
      seller.secretKey
    );

    const decrypted = decryptProductKey(
      ciphertext,
      nonce,
      seller.publicKey,
      buyer.secretKey
    );
    expect(decrypted).toBe(key);
  });
});

describe("publicKeyToBase64 / base64ToPublicKey", () => {
  it("round-trips a public key", () => {
    const kp = nacl.box.keyPair();
    const b64 = publicKeyToBase64(kp.publicKey);
    const restored = base64ToPublicKey(b64);
    expect(encodeBase64(restored)).toBe(encodeBase64(kp.publicKey));
  });

  it("base64 output is a string", () => {
    const kp = nacl.box.keyPair();
    const b64 = publicKeyToBase64(kp.publicKey);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBeGreaterThan(0);
  });
});
