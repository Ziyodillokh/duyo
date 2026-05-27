import React from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { Moon, Sun } from 'lucide-react';

export const NightMode: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Stars decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* DUYO sleeping */}
        <div className="flex justify-center relative z-10">
          <DuyoAvatar size="xl" state="sleeping" />
        </div>

        {/* Message */}
        <Card className="p-8 text-center relative z-10 bg-card/80 backdrop-blur">
          <Moon className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Dam olish vaqti</h2>
          <Badge variant="secondary" className="mb-4">
            22:00 - 06:00
          </Badge>
          <p className="text-muted-foreground mb-2">
            Men ham dam olyapman. Ertaga davom etamiz.
          </p>
          <p className="text-sm text-muted-foreground">
            Yaxshi uxlang! 😴
          </p>
        </Card>

        {/* Next day preview */}
        <Card className="p-4 bg-accent/10 relative z-10 backdrop-blur">
          <div className="flex items-center justify-center gap-2 text-sm">
            <Sun className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">
              Ertaga 06:00 da qayta ochiladi
            </span>
          </div>
        </Card>

        {/* Emergency note */}
        <div className="text-center text-xs text-white/60 relative z-10">
          <p>Favqulodda yordam kerak bo'lsa, ota-onangizga murojaat qiling</p>
        </div>
      </div>
    </div>
  );
};
