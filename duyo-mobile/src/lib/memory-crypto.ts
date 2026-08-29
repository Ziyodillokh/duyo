import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * AES-256-GCM for the on-device personal-memory database (memory-db.ts).
 *
 * The master key is generated once per device install with the OS CSPRNG
 * (expo-crypto → iOS SecRandomCopyBytes / Android SecureRandom) and lives
 * ONLY in expo-secure-store — the same iOS Keychain / Android Keystore
 * already used for auth tokens (see secure-storage.ts). It never appears in
 * source code, never leaves the device, and is never sent in a request body.
 *
 * Deliberately does NOT use @noble/ciphers' own `randomBytes()` — that
 * reads `globalThis.crypto.getRandomValues`, which React Native's Hermes
 * does not provide on native builds without an extra polyfill. Every random
 * byte here comes from expo-crypto instead, so no polyfill is needed and
 * randomness genuinely comes from the OS, not a JS PRNG.
 *
 * Storage format for a ciphertext string is `${nonceHex}:${ciphertextHex}`
 * (hex, not base64 — avoids pulling in a base64 dependency for values this
 * short). GCM's authentication tag is part of the ciphertext, so a flipped
 * byte or a wrong key makes `decryptText` throw rather than return garbage.
 *
 * Deliberately talks to expo-secure-store DIRECTLY rather than through
 * `@/lib/secure-storage`. That adapter is a zustand StateStorage: its
 * `getItem` catches every error and returns null, which is right for a
 * cache of auth tokens (worst case: the user logs in again) and CATASTROPHIC
 * here. A Keychain read that fails transiently — a restored backup where the
 * SQLite file came back but the Keychain item did not, a first read before
 * the device is unlocked — would look identical to "no key yet", so this
 * would mint a fresh key, overwrite the real one, and permanently destroy
 * every memory the child had. A read error must propagate, not be papered
 * over; only a genuine `null` (no item stored) may create a key.
 */

const KEY_STORAGE_NAME = 'duyo.memory.master_key.v1';
const KEY_BYTES = 32; // AES-256

/**
 * Thrown when the key is gone but encrypted rows are still there.
 *
 * That combination has exactly one meaning: the ciphertext can never be
 * read again. AES-256-GCM with a lost key is not a recoverable state, so
 * the only thing left to decide is whether the child is TOLD. Minting a
 * fresh key here would hide it — the app would look empty and healthy
 * while their notebook sat one table away, unreadable forever.
 */
export class MemoryKeyLostError extends Error {
  constructor(public readonly rows: number) {
    super(`Memory key missing while ${rows} encrypted rows remain`);
    this.name = 'MemoryKeyLostError';
  }
}

/**
 * Asks whether any encrypted row exists. Injected by memory-db rather than
 * imported, because memory-db already imports THIS module — importing back
 * would close a cycle that Metro resolves by handing one side an undefined
 * binding, and it would do so exactly at first-key-load.
 */
let ciphertextExists: (() => Promise<number>) | null = null;

export function registerCiphertextProbe(fn: () => Promise<number>): void {
  ciphertextExists = fn;
}

let cachedKeyPromise: Promise<Uint8Array> | null = null;

/** Forget the cached key so the next call re-reads. Used after the
 *  key-loss recovery has cleared the orphaned rows, so the very next
 *  request mints the fresh key that is now safe to make. */
export function forgetCachedKey(): void {
  cachedKeyPromise = null;
}

/** Web has no Keychain — see secure-storage.ts on why web is preview-only. */
const isWeb = Platform.OS === 'web';

async function readStoredKeyHex(): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(KEY_STORAGE_NAME) ?? null;
  }
  // No try/catch on purpose — see the module docstring. A throw here means
  // "could not read", which must never be mistaken for "nothing stored".
  return (await SecureStore.getItemAsync(KEY_STORAGE_NAME)) ?? null;
}

async function writeKeyHex(hex: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(KEY_STORAGE_NAME, hex);
    return;
  }
  await SecureStore.setItemAsync(KEY_STORAGE_NAME, hex);
}

async function loadOrCreateMasterKey(): Promise<Uint8Array> {
  const existingHex = await readStoredKeyHex();
  if (existingHex) {
    return hexToBytes(existingHex);
  }

  // The docstring above promises that only a genuine "nothing stored" may
  // create a key, and that a read ERROR propagates instead. On Android it
  // cannot keep that promise: expo-secure-store RETURNS NULL rather than
  // throwing when the Keystore entry is gone or undecryptable —
  // SecureStoreModule.kt does it in three separate places, including
  // KeyPermanentlyInvalidatedException, which does not even clear the
  // stale prefs entry, so the state repeats on every launch.
  //
  // Null is therefore ambiguous, and the only thing that disambiguates it
  // is the data itself: no key AND no rows is a first run; no key WITH
  // rows is key loss.
  const rows = ciphertextExists ? await ciphertextExists() : 0;
  if (rows > 0) {
    throw new MemoryKeyLostError(rows);
  }

  const fresh = await Crypto.getRandomBytesAsync(KEY_BYTES);
  // Written BEFORE it is used to encrypt anything: if the write fails, the
  // throw propagates and no row is ever encrypted under a key that was not
  // durably stored.
  await writeKeyHex(bytesToHex(fresh));
  return fresh;
}

/**
 * Cached across calls within one app session; re-read from Keychain/Keystore
 * on cold start. A failed load is NOT cached — the rejected promise is
 * cleared so the next call retries, rather than one unlucky read at launch
 * making memory unreadable for the whole session.
 */
function getMasterKey(): Promise<Uint8Array> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = loadOrCreateMasterKey().catch((err) => {
      cachedKeyPromise = null;
      throw err;
    });
  }
  return cachedKeyPromise;
}

export async function encryptText(plaintext: string): Promise<string> {
  const key = await getMasterKey();
  const nonce = await Crypto.getRandomBytesAsync(gcm.nonceLength);
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return `${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;
}

export async function decryptText(stored: string): Promise<string> {
  const key = await getMasterKey();
  const sep = stored.indexOf(':');
  if (sep < 0) {
    throw new Error('memory-crypto: malformed ciphertext (no nonce separator)');
  }
  const nonce = hexToBytes(stored.slice(0, sep));
  const ciphertext = hexToBytes(stored.slice(sep + 1));
  const plaintext = gcm(key, nonce).decrypt(ciphertext);
  return bytesToUtf8(plaintext);
}
