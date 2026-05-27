import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { Loader2 } from 'lucide-react';

export const SplashScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/language');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <div className="flex flex-col items-center gap-8 animate-in fade-in duration-1000">
        <DuyoAvatar size="xl" state="happy" />
        <h1 className="text-4xl font-bold text-primary">DUYO</h1>
        <p className="text-lg text-muted-foreground">Sening AI Hamrohingiz</p>
        <Loader2 className="w-8 h-8 animate-spin text-primary mt-4" />
      </div>
    </div>
  );
};
