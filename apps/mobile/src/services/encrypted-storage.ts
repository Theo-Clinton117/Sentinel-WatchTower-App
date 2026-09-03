import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

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
const keyCache = new Map<string, Promise<Crypto.AESEncryptionKey>>();

function keyName(namespace: string) {
  return `${KEY_PREFIX}:${namespace}`;
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
        return await Crypto.AESEncryptionKey.import(stored, 'base64');
      } catch {
        await SecureStore.deleteItemAsync(cacheKey);
      }
    }

    const generated = await Crypto.AESEncryptionKey.generate();
    const encoded = await generated.encoded('base64');
    await SecureStore.setItemAsync(cacheKey, encoded, SECURE_OPTIONS);
    return generated;
  })();

  keyCache.set(cacheKey, promise);
  return promise;
}

async function encryptString(namespace: string, plaintext: string) {
  const key = await loadOrCreateKey(namespace);
  const sealed = await Crypto.aesEncryptAsync(encoder.encode(plaintext), key);
  return sealed.combined('base64');
}

async function decryptString(namespace: string, ciphertext: string) {
  const key = await loadOrCreateKey(namespace);
  const sealed = Crypto.AESSealedData.fromCombined(ciphertext);
  const bytes = await Crypto.aesDecryptAsync(sealed, key, { output: 'bytes' });
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
