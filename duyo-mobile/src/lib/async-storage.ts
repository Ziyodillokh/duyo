import AsyncStorage from '@react-native-async-storage/async-storage';
import { type StateStorage } from 'zustand/middleware';

// Zustand persist adapter for non-sensitive state (preferences, UI flags).
// For tokens or PII use src/lib/secure-storage.ts instead.
export const asyncStorage: StateStorage = {
  getItem: async (name) => (await AsyncStorage.getItem(name)) ?? null,
  setItem: async (name, value) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    await AsyncStorage.removeItem(name);
  },
};
