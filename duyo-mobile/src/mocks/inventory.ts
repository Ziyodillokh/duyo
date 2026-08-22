// Static inventory mock for Bosqich B beta.
// Real inventory + purchases backend in Faza 1.

export type InventoryCategory = 'hats' | 'glasses' | 'antennas' | 'backgrounds';

export interface InventoryItem {
  id: string;
  category: InventoryCategory;
  name: string;
  emoji: string;
  price?: number; // undefined = owned
  isPremium?: boolean; // gold border
  occasion?: string; // e.g. "Yangi yil", "Navro'z"
}

export interface InventoryCategoryMeta {
  key: InventoryCategory;
  emoji: string;
  label: string;
}

export const INVENTORY_CATEGORIES: readonly InventoryCategoryMeta[] = [
  { key: 'hats', emoji: '🎩', label: 'Shlyapalar' },
  { key: 'glasses', emoji: '👓', label: "Ko'zoynaklar" },
  { key: 'antennas', emoji: '📡', label: 'Antennalar' },
  { key: 'backgrounds', emoji: '🎨', label: 'Fonlar' },
];

export const MOCK_BALANCE = 350;

export const INVENTORY_ITEMS: readonly InventoryItem[] = [
  // Hats
  { id: 'h-red', category: 'hats', name: 'Qizil shlyapa', emoji: '🎩' },
  { id: 'h-blue', category: 'hats', name: "Ko'k shlyapa", emoji: '🎩', price: 100 },
  {
    id: 'h-star',
    category: 'hats',
    name: 'Yulduzli shlyapa',
    emoji: '✨',
    price: 200,
    occasion: 'Yangi yil',
  },
  // Glasses
  {
    id: 'g-black',
    category: 'glasses',
    name: "Qora ko'zoynak",
    emoji: '🕶',
  },
  {
    id: 'g-red',
    category: 'glasses',
    name: "Qizil ko'zoynak",
    emoji: '👓',
    price: 150,
  },
  {
    id: 'g-premium',
    category: 'glasses',
    name: "Premium ko'zoynak",
    emoji: '👓',
    price: 300,
    isPremium: true,
  },
  // Antennas
  { id: 'a-star', category: 'antennas', name: 'Yulduz antenna', emoji: '⭐' },
  {
    id: 'a-flowers',
    category: 'antennas',
    name: 'Gullar antenna',
    emoji: '🌸',
    price: 120,
    occasion: "Navro'z",
  },
  // Backgrounds
  {
    id: 'b-space',
    category: 'backgrounds',
    name: 'Kosmos fon',
    emoji: '🌌',
    price: 250,
  },
  {
    id: 'b-stars',
    category: 'backgrounds',
    name: 'Yulduzlar foni',
    emoji: '✨',
  },
];

export function isOwned(item: InventoryItem): boolean {
  return item.price === undefined;
}

export function itemsByCategory(
  category: InventoryCategory | null,
): InventoryItem[] {
  if (category === null) return [...INVENTORY_ITEMS];
  return INVENTORY_ITEMS.filter((i) => i.category === category);
}
