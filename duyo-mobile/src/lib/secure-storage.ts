import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { type StateStorage } from 'zustand/middleware';

// Zustand persist storage adapter backed by expo-secure-store.
// SecureStore is async; Zustand handles that via createJSONStorage.
//
// expo-secure-store is native-only — on web its methods are undefined and every
// call throws, which took down the whole app at startup. Web falls back to
// localStorage. That is NOT equivalent security (localStorage is readable by any
// script on the origin, the Keychain/Keystore is not), so the web target is for
// development preview only; the shipped surfaces are iOS/Android.
const webStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      // Private mode / storage disabled — persistence is best-effort.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Same as above.
    }
  },
};

const nativeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await SecureStore.getItemAsync(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const secureStorage: StateStorage =
  Platform.OS === 'web' ? webStorage : nativeStorage;
