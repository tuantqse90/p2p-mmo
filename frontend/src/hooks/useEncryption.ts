"use client";

import { useCallback } from "react";
import { decodeBase64 } from "tweetnacl-util";
import { useAuthStore } from "@/stores/authStore";
import {
  encryptMessage,
  decryptMessage,
  base64ToPublicKey,
} from "@/lib/encryption";

export function useEncryption() {
  const { encryptionPublicKey, encryptionSecretKey } = useAuthStore();

  const encrypt = useCallback(
    (plaintext: string, recipientPublicKeyBase64: string) => {
      if (!encryptionSecretKey) throw new Error("Not authenticated");
      const secretKey = decodeBase64(encryptionSecretKey);
      const recipientKey = base64ToPublicKey(recipientPublicKeyBase64);
      return encryptMessage(plaintext, recipientKey, secretKey);
    },
    [encryptionSecretKey]
  );

  const decrypt = useCallback(
    (
      ciphertext: string,
      nonce: string,
      senderPublicKeyBase64: string
    ): string => {
      if (!encryptionSecretKey) throw new Error("Not authenticated");
      const secretKey = decodeBase64(encryptionSecretKey);
      const senderKey = base64ToPublicKey(senderPublicKeyBase64);
      return decryptMessage(ciphertext, nonce, senderKey, secretKey);
    },
    [encryptionSecretKey]
  );

  return {
    encrypt,
    decrypt,
    publicKey: encryptionPublicKey,
    hasKeys: !!encryptionSecretKey,
  };
}
