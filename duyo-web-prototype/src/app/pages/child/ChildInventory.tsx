import React, { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { BottomNav } from '../../components/child/BottomNav';
import { Star, Lock, Crown, Sparkles } from 'lucide-react';

interface InventoryItem {
  id: number;
  name: string;
  type: 'hat' | 'glasses' | 'antenna' | 'background';
  price: number;
  owned: boolean;
  seasonal?: string;
  premium?: boolean;
}

const items: InventoryItem[] = [
  { id: 1, name: 'Qizil shlyapa', type: 'hat', price: 100, owned: true },
  { id: 2, name: 'Ko\'k shlyapa', type: 'hat', price: 100, owned: false },
  { id: 3, name: 'Yulduzli shlyapa', type: 'hat', price: 200, owned: false, seasonal: 'Yangi yil' },
  { id: 4, name: 'Qora ko\'zoynak', type: 'glasses', price: 150, owned: true },
  { id: 5, name: 'Qizil ko\'zoynak', type: 'glasses', price: 150, owned: false },
  { id: 6, name: 'Premium ko\'zoynak', type: 'glasses', price: 300, owned: false, premium: true },
  { id: 7, name: 'Yulduz antenna', type: 'antenna', price: 80, owned: true },
  { id: 8, name: 'Gullar antenna', type: 'antenna', price: 120, owned: false, seasonal: 'Navro\'z' },
  { id: 9, name: 'Kosmos fon', type: 'background', price: 250, owned: false },
  { id: 10, name: 'Yulduzlar foni', type: 'background', price: 200, owned: true },
];

export const ChildInventory: React.FC = () => {
  const [coins] = useState(350);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const filterItems = (type: string) => {
    if (type === 'all') return items;
    return items.filter(item => item.type === type);
  };

  const handlePurchase = (item: InventoryItem) => {
    if (coins >= item.price && !item.owned) {
      // Simulate purchase
      alert(`${item.name} sotib olindi!`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4">
          <h1 className="text-2xl font-bold">Inventar</h1>
          <Card className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Balansim</div>
                  <div className="text-2xl font-bold">{coins}</div>
                </div>
              </div>
              <Button variant="outline">
                <Sparkles className="w-4 h-4 mr-2" />
                Ball olish
              </Button>
            </div>
          </Card>
        </div>

        {/* Items Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all">Barchasi</TabsTrigger>
            <TabsTrigger value="hat">🎩</TabsTrigger>
            <TabsTrigger value="glasses">👓</TabsTrigger>
            <TabsTrigger value="antenna">📡</TabsTrigger>
            <TabsTrigger value="background">🎨</TabsTrigger>
          </TabsList>

          {['all', 'hat', 'glasses', 'antenna', 'background'].map((tabValue) => (
            <TabsContent key={tabValue} value={tabValue} className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                {filterItems(tabValue).map((item) => (
                  <Card
                    key={item.id}
                    className={`p-4 cursor-pointer transition-all ${
                      item.owned
                        ? 'border-2 border-success bg-success/5'
                        : item.premium
                        ? 'border-2 border-accent bg-accent/5'
                        : 'hover:shadow-lg'
                    }`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="aspect-square bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg mb-2 flex items-center justify-center">
                      {item.owned ? (
                        <div className="text-4xl">✓</div>
                      ) : item.premium ? (
                        <Crown className="w-8 h-8 text-accent" />
                      ) : (
                        <Lock className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <h4 className="font-medium text-sm text-center mb-1">{item.name}</h4>
                    <div className="flex items-center justify-center gap-1">
                      {item.owned ? (
                        <Badge variant="secondary" className="text-xs">
                          Egallangan
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          {item.price}
                        </Badge>
                      )}
                    </div>
                    {item.seasonal && (
                      <div className="text-xs text-center text-muted-foreground mt-1">
                        {item.seasonal}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Selected Item Detail */}
        {selectedItem && (
          <Card className="p-6 border-2 border-primary">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">{selectedItem.name}</h3>
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                  {selectedItem.owned ? (
                    <div className="text-6xl">✓</div>
                  ) : (
                    <Lock className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              </div>

              {!selectedItem.owned && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-accent/10 rounded-lg">
                    <span>Narx:</span>
                    <div className="flex items-center gap-1 font-bold">
                      <Star className="w-4 h-4 text-accent" />
                      {selectedItem.price}
                    </div>
                  </div>

                  {selectedItem.premium ? (
                    <Button className="w-full" variant="default">
                      <Crown className="w-4 h-4 mr-2" />
                      Premium kerak
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handlePurchase(selectedItem)}
                      disabled={coins < selectedItem.price}
                    >
                      {coins >= selectedItem.price ? 'Sotib olish' : 'Yetarli ball yo\'q'}
                    </Button>
                  )}
                </div>
              )}

              {selectedItem.owned && (
                <Button className="w-full" variant="secondary">
                  Taqib ko'rish
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSelectedItem(null)}
              >
                Yopish
              </Button>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
