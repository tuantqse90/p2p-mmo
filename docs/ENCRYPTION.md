# Encryption & Privacy

## Overview

The platform implements multiple layers of encryption to ensure user privacy. The server never has access to plaintext sensitive data. All cryptographic operations for user data happen client-side.

## Encryption Layers

```
Layer 1: Wallet Authentication
  └─ Sign message → derive NaCl keypair

Layer 2: Product Data Encryption
  └─ AES symmetric key → encrypted with buyer's public key after payment

Layer 3: E2E Messaging
  └─ NaCl box (x25519-xsalsa20-poly1305) → server relays ciphertext only

Layer 4: Dispute Evidence
  └─ Shared key (buyer + seller + arbitrator) → encrypted before IPFS upload
```

## Layer 1: Key Derivation from Wallet

Users derive a NaCl keypair from their wallet signature. This keypair is used for all encryption operations on the platform.

### Process

```
1. User connects wallet (MetaMask, WalletConnect, etc.)
2. Frontend generates auth message:
   message = "P2P-Auth-{timestamp}-{nonce}"
3. User signs message with wallet private key
4. Derive encryption keypair:
   seed = keccak256(signature)
   secretKey = seed[0:32]           // First 32 bytes
   keypair = nacl.box.keyPair.fromSecretKey(secretKey)
5. Public key sent to server and stored in user_profiles.public_key
6. Secret key exists ONLY in client memory (never transmitted)
```

### Implementation (Client-Side)

```typescript
import nacl from 'tweetnacl';
import { keccak256, toBytes } from 'viem';

async function deriveEncryptionKeypair(
  walletClient: WalletClient,
  message: string
): Promise<nacl.BoxKeyPair> {
  // Sign the auth message with wallet
  const signature = await walletClient.signMessage({ message });

  // Derive seed from signature
  const seed = keccak256(toBytes(signature));

  // Create NaCl keypair from first 32 bytes of seed
  const secretKey = new Uint8Array(Buffer.from(seed.slice(2), 'hex').slice(0, 32));
  const keypair = nacl.box.keyPair.fromSecretKey(secretKey);

  return keypair;
}
```

### Security Properties

- Deterministic: Same wallet + same message = same keypair (allows recovery)
- Non-extractable: Cannot derive wallet private key from NaCl keypair
- Wallet-bound: Only the wallet owner can produce the correct signature

---

## Layer 2: Product Data Encryption

Digital products are encrypted with a symmetric key. After payment, the key is shared with the buyer using asymmetric encryption.

### Encryption Flow

```
SELLER (listing product):
1. Generate random AES-256 key: productKey = crypto.getRandomValues(32)
2. Encrypt product data: encryptedProduct = AES-GCM(productKey, productData)
3. Compute hash: productHash = SHA-256(productData)
4. Store encryptedProduct (off-chain or IPFS)
5. List on marketplace with productHash for integrity verification

BUYER (after payment confirmed):
1. Seller encrypts productKey for buyer:
   encryptedKey = nacl.box(productKey, nonce, buyerPublicKey, sellerSecretKey)
2. Seller sends encryptedKey via API (POST /orders/:id/deliver)

BUYER (receiving product):
1. Decrypt the key:
   productKey = nacl.box.open(encryptedKey, nonce, sellerPublicKey, buyerSecretKey)
2. Decrypt product: productData = AES-GCM.decrypt(productKey, encryptedProduct)
3. Verify integrity: SHA-256(productData) == productHash (from contract)
4. If valid → buyerConfirmReceived()
5. If invalid → openDispute()
```

### Implementation

```typescript
// Seller: Encrypt product key for buyer
function encryptProductKeyForBuyer(
  productKey: Uint8Array,        // 32-byte AES key
  buyerPublicKey: Uint8Array,    // Buyer's NaCl public key
  sellerSecretKey: Uint8Array    // Seller's NaCl secret key
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(productKey, nonce, buyerPublicKey, sellerSecretKey);

  return {
    ciphertext: Buffer.from(encrypted).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  };
}

// Buyer: Decrypt product key
function decryptProductKey(
  ciphertext: string,
  nonce: string,
  sellerPublicKey: Uint8Array,
  buyerSecretKey: Uint8Array
): Uint8Array | null {
  const encrypted = Buffer.from(ciphertext, 'base64');
  const nonceBytes = Buffer.from(nonce, 'base64');

  return nacl.box.open(
    new Uint8Array(encrypted),
    new Uint8Array(nonceBytes),
    sellerPublicKey,
    buyerSecretKey
  );
}
```

---

## Layer 3: End-to-End Messaging

All messages between buyer and seller are end-to-end encrypted using NaCl box. The server stores and relays only ciphertext.

### Encryption Scheme

**Algorithm**: NaCl box = x25519-xsalsa20-poly1305
- **Key exchange**: X25519 (Curve25519 Diffie-Hellman)
- **Encryption**: XSalsa20 stream cipher
- **Authentication**: Poly1305 MAC

### Message Flow

```
Sender                          Server                         Receiver
  │                               │                               │
  │  Encrypt with:                │                               │
  │  nacl.box(                    │                               │
  │    message,                   │                               │
  │    nonce,                     │                               │
  │    receiverPublicKey,         │                               │
  │    senderSecretKey            │                               │
  │  )                            │                               │
  │                               │                               │
  │  POST /messages               │                               │
  │  { ciphertext, nonce }        │                               │
  │──────────────────────────────>│  Store ciphertext + nonce     │
  │                               │  (CANNOT decrypt)             │
  │                               │                               │
  │                               │  WebSocket: new_message       │
  │                               │──────────────────────────────>│
  │                               │                               │
  │                               │  GET /messages                │
  │                               │<──────────────────────────────│
  │                               │  { ciphertext, nonce }        │
  │                               │──────────────────────────────>│
  │                               │                               │
  │                               │         Decrypt with:         │
  │                               │         nacl.box.open(        │
  │                               │           ciphertext,         │
  │                               │           nonce,              │
  │                               │           senderPublicKey,    │
  │                               │           receiverSecretKey   │
  │                               │         )                     │
```

### Implementation

```typescript
function encryptMessage(
  plaintext: string,
  receiverPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const messageBytes = new TextEncoder().encode(plaintext);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(messageBytes, nonce, receiverPublicKey, senderSecretKey);

  return {
    ciphertext: Buffer.from(encrypted).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  };
}

function decryptMessage(
  ciphertext: string,
  nonce: string,
  senderPublicKey: Uint8Array,
  receiverSecretKey: Uint8Array
): string | null {
  const encrypted = Buffer.from(ciphertext, 'base64');
  const nonceBytes = Buffer.from(nonce, 'base64');
  const decrypted = nacl.box.open(
    new Uint8Array(encrypted),
    new Uint8Array(nonceBytes),
    senderPublicKey,
    receiverSecretKey
  );

  if (!decrypted) return null;
  return new TextDecoder().decode(decrypted);
}
```

### Group Messages (with Arbitrator)

When a dispute is opened, the arbitrator joins the conversation. Messages must be readable by all three parties.

**Approach**: Sender encrypts the message separately for each recipient:

```typescript
function encryptGroupMessage(
  plaintext: string,
  recipients: { publicKey: Uint8Array; wallet: string }[],
  senderSecretKey: Uint8Array
): { wallet: string; ciphertext: string; nonce: string }[] {
  return recipients.map(({ publicKey, wallet }) => {
    const { ciphertext, nonce } = encryptMessage(plaintext, publicKey, senderSecretKey);
    return { wallet, ciphertext, nonce };
  });
}
```

---

## Layer 4: Dispute Evidence Encryption

Evidence files are encrypted before uploading to IPFS, ensuring only involved parties can access them.

### Evidence Encryption Flow

```
1. Submitter encrypts evidence with a random symmetric key
2. Symmetric key is encrypted for each party (buyer, seller, arbitrator)
3. Encrypted evidence + encrypted keys uploaded to IPFS
4. IPFS hash stored on-chain and in database

IPFS payload structure:
{
  "encrypted_data": "base64...",        // AES-GCM encrypted evidence
  "iv": "base64...",                    // AES initialization vector
  "keys": {
    "0xBuyer...": "base64...",          // Symmetric key encrypted for buyer
    "0xSeller...": "base64...",         // Symmetric key encrypted for seller
    "0xArbitrator...": "base64..."      // Symmetric key encrypted for arbitrator
  }
}
```

### Implementation

```typescript
async function encryptEvidence(
  evidenceData: ArrayBuffer,
  parties: { wallet: string; publicKey: Uint8Array }[],
  senderSecretKey: Uint8Array
): Promise<{ ipfsPayload: object }> {
  // Generate random AES key
  const aesKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt evidence with AES-GCM
  const cryptoKey = await crypto.subtle.importKey('raw', aesKey, 'AES-GCM', false, ['encrypt']);
  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, evidenceData);

  // Encrypt AES key for each party
  const keys: Record<string, { ciphertext: string; nonce: string }> = {};
  for (const party of parties) {
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const encryptedKey = nacl.box(aesKey, nonce, party.publicKey, senderSecretKey);
    keys[party.wallet] = {
      ciphertext: Buffer.from(encryptedKey).toString('base64'),
      nonce: Buffer.from(nonce).toString('base64'),
    };
  }

  return {
    ipfsPayload: {
      encrypted_data: Buffer.from(encryptedData).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      keys,
    },
  };
}
```

---

## Data the Server NEVER Stores

| Data Type | Storage | Access |
|-----------|---------|--------|
| Wallet private keys | User's wallet only | User only |
| NaCl secret keys | Client memory only | User only |
| Plaintext messages | Never stored | Sender & receiver only |
| Plaintext product data | Never on server | Buyer & seller only |
| Plaintext evidence | Never on server | Buyer, seller, arbitrator only |
| Email addresses | Never collected | N/A |
| Phone numbers | Never collected | N/A |
| Real names | Never collected | N/A |
| IP addresses | Not logged | N/A |

## Data the Server DOES Store

| Data Type | Purpose | Encrypted? |
|-----------|---------|-----------|
| Wallet addresses | Identity, transaction matching | No (public on-chain) |
| NaCl public keys | Enable E2E encryption | No (public by design) |
| Message ciphertext + nonce | Relay to recipient | Yes (E2E) |
| Product title/description preview | Marketplace browsing | No (public listing) |
| Order metadata | Transaction tracking | No (mirrors on-chain) |
| Evidence IPFS hashes | Reference to encrypted evidence | Yes (content on IPFS is encrypted) |
| Display names | Optional user profile | No |

## Key Recovery

If a user clears browser data, they can recover their encryption keypair by:

1. Connecting the same wallet
2. Signing the same auth message format
3. The deterministic derivation produces the same keypair

**Important**: If the wallet is compromised, all encrypted data associated with that wallet's keypair is also compromised. Users should treat wallet security as encryption security.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Server compromise | E2E encryption — server has no plaintext data |
| Database leak | Only ciphertext and public keys stored |
| Man-in-the-middle | NaCl box provides authenticated encryption |
| Replay attacks | Unique nonce per message |
| Key compromise (wallet) | Limited to that user's data only |
| IPFS data exposure | All IPFS data encrypted before upload |
| Metadata analysis | Minimal metadata stored; no IP logging |
