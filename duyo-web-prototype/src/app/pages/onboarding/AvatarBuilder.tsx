import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { AvatarConfig } from '../../contexts/UserContext';

const bodyShapes = [
  { value: 'spherical' as const, label: 'Sharsimon', emoji: '⚪' },
  { value: 'cubic' as const, label: 'Kubik', emoji: '🟦' },
  { value: 'vertical' as const, label: 'Vertikal', emoji: '⬜' },
];

const colors = [
  '#2563EB',
  '#EF4444',
  '#22C55E',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
  '#14B8A6',
  '#A855F7',
];

const accentColors = [
  '#FFC700',
  '#FFFFFF',
  '#FFD700',
  '#FF69B4',
  '#00CED1',
  '#FF4500',
  '#32CD32',
  '#FF1493',
];

export const AvatarBuilder: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AvatarConfig>({
    bodyShape: 'spherical',
    primaryColor: '#2563EB',
    accentColor: '#FFC700',
    faceStyle: 1,
    accessories: [],
  });

  const handleSave = () => {
    localStorage.setItem('avatarConfig', JSON.stringify(config));
    navigate('/first-conversation');
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start p-6 bg-gradient-to-br from-primary/5 to-accent/10 overflow-auto">
      <div className="w-full max-w-md flex flex-col items-center gap-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">DUYO'ingizni yarating</h2>
          <p className="text-muted-foreground">O'zingizga yoqqan ko'rinishni tanlang</p>
        </div>

        <div className="w-full flex justify-center p-8 bg-gradient-to-br from-white to-accent/20 rounded-3xl shadow-lg">
          <DuyoAvatar
            size="xl"
            state="happy"
            bodyShape={config.bodyShape}
            primaryColor={config.primaryColor}
            accentColor={config.accentColor}
            faceStyle={config.faceStyle}
          />
        </div>

        <Card className="w-full">
          <Tabs defaultValue="body" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="body">Tana</TabsTrigger>
              <TabsTrigger value="color">Rang</TabsTrigger>
              <TabsTrigger value="accent">Aksent</TabsTrigger>
              <TabsTrigger value="face">Yuz</TabsTrigger>
            </TabsList>

            <TabsContent value="body" className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {bodyShapes.map((shape) => (
                  <Card
                    key={shape.value}
                    className={`p-4 cursor-pointer text-center transition-all ${
                      config.bodyShape === shape.value
                        ? 'border-primary border-2 bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setConfig({ ...config, bodyShape: shape.value })}
                  >
                    <div className="text-3xl mb-2">{shape.emoji}</div>
                    <div className="text-xs">{shape.label}</div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="color" className="p-4">
              <div className="grid grid-cols-4 gap-3">
                {colors.map((color) => (
                  <div
                    key={color}
                    className={`w-full aspect-square rounded-full cursor-pointer transition-all ${
                      config.primaryColor === color
                        ? 'ring-4 ring-primary ring-offset-2'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setConfig({ ...config, primaryColor: color })}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="accent" className="p-4">
              <div className="grid grid-cols-4 gap-3">
                {accentColors.map((color) => (
                  <div
                    key={color}
                    className={`w-full aspect-square rounded-full cursor-pointer transition-all ${
                      config.accentColor === color
                        ? 'ring-4 ring-accent ring-offset-2'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setConfig({ ...config, accentColor: color })}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="face" className="p-4">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5].map((style) => (
                  <Card
                    key={style}
                    className={`p-4 cursor-pointer text-center transition-all ${
                      config.faceStyle === style
                        ? 'border-primary border-2 bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setConfig({ ...config, faceStyle: style })}
                  >
                    <div className="text-2xl">😊</div>
                    <div className="text-xs mt-1">Stil {style}</div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <Button onClick={handleSave} className="w-full h-12">
          Mening DUYO'im tayyor
        </Button>
      </div>
    </div>
  );
};
