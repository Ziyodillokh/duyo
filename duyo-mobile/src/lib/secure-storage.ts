import * as SecureStore from 'expo-secure-store';
import { type StateStorage } from 'zustand/middleware';

// Zustand persist storage adapter backed by expo-secure-store.
// SecureStore is async; Zustand handles that via createJSONStorage.
export const secureStorage: StateStorage = {
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
