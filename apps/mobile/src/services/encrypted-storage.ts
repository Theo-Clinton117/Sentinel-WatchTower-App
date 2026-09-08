import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { gcm } from '@noble/ciphers/aes.js';
import { fromByteArray, toByteArray } from 'base64-js';

type StringStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type EncryptedStorageOptions = {
  namespace: string;
  storage: StringStorage;
};

const KEY_PREFIX = 'sentinel-encrypted-storage-key';
const SECURE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyCache = new Map<string, Promise<Uint8Array>>();

function keyName(namespace: string) {
  return `${KEY_PREFIX}-${namespace}`;
}

async function loadOrCreateKey(namespace: string) {
  const cacheKey = keyName(namespace);
  const cached = keyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const stored = await SecureStore.getItemAsync(cacheKey);
    if (stored) {
      try {
        return toByteArray(stored);
      } catch {
        await SecureStore.deleteItemAsync(cacheKey);
      }
    }

    const generated = await Crypto.getRandomBytesAsync(32);
    await SecureStore.setItemAsync(cacheKey, fromByteArray(generated), SECURE_OPTIONS);
    return generated;
  })();

  keyCache.set(cacheKey, promise);
  return promise;
}

async function encryptString(namespace: string, plaintext: string) {
  const key = await loadOrCreateKey(namespace);
  const nonce = await Crypto.getRandomBytesAsync(12);
  const ciphertext = gcm(key, nonce).encrypt(encoder.encode(plaintext));
  return `v1.${fromByteArray(nonce)}.${fromByteArray(ciphertext)}`;
}

async function decryptString(namespace: string, ciphertext: string) {
  const key = await loadOrCreateKey(namespace);
  const [version, nonceEncoded, ciphertextEncoded] = ciphertext.split('.');
  if (version !== 'v1' || !nonceEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted storage envelope');
  }
  const bytes = gcm(key, toByteArray(nonceEncoded)).decrypt(toByteArray(ciphertextEncoded));
  return decoder.decode(bytes);
}

export function createEncryptedStorage({ namespace, storage }: EncryptedStorageOptions): StringStorage {
  return {
    async getItem(key: string) {
      const value = await storage.getItem(key);
      if (!value) {
        return null;
      }

      try {
        return await decryptString(namespace, value);
      } catch {
        await storage.removeItem(key);
        return null;
      }
    },
    async setItem(key: string, value: string) {
      const encrypted = await encryptString(namespace, value);
      await storage.setItem(key, encrypted);
    },
    async removeItem(key: string) {
      await storage.removeItem(key);
    },
  };
}

export async function getEncryptedItem(
  storage: StringStorage,
  namespace: string,
  key: string,
) {
  const value = await storage.getItem(key);
  if (!value) {
    return null;
  }

  try {
    return await decryptString(namespace, value);
  } catch {
    await storage.removeItem(key);
    return null;
  }
}

export async function setEncryptedItem(
  storage: StringStorage,
  namespace: string,
  key: string,
  value: string,
) {
  const encrypted = await encryptString(namespace, value);
  await storage.setItem(key, encrypted);
}

export async function removeEncryptedItem(storage: StringStorage, key: string) {
  await storage.removeItem(key);
}
