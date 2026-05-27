import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';

export const ChildName: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  const handleContinue = () => {
    if (name.trim()) {
      localStorage.setItem('childName', name);
      navigate('/age-selection');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <DuyoAvatar size="lg" state="happy" />

        <Card className="w-full p-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Isming nima?</h2>
              <p className="text-muted-foreground">
                Men seni ismingiz bilan chaqirishni xohlayman
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Ismingiz</label>
              <Input
                type="text"
                placeholder="Masalan: Aziza"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                className="text-lg p-6"
                autoFocus
              />
            </div>

            <Button
              onClick={handleContinue}
              disabled={!name.trim()}
              className="w-full h-12"
            >
              Davom etish
            </Button>
          </div>
        </Card>

        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Ismingiz faqat men bilan suhbatlarda ishlatiladi va xavfsiz saqlanadi
        </p>
      </div>
    </div>
  );
};
