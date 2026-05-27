import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineState: React.FC = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* DUYO sleeping */}
        <div className="flex justify-center">
          <DuyoAvatar size="xl" state="sleeping" />
        </div>

        {/* Message */}
        <Card className="p-8 text-center">
          <WifiOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Internet yo'q</h2>
          <p className="text-muted-foreground mb-6">
            Qayta ulanganingizda davom etamiz
          </p>
          <Button onClick={handleRetry} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Qayta urinish
          </Button>
        </Card>

        {/* Cached Content Note */}
        <Card className="p-4 bg-accent/10">
          <p className="text-sm text-center text-muted-foreground">
            💾 Ba'zi keshlangan kontentlar offline rejimda mavjud
          </p>
        </Card>

        {/* Safety Note */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Xavfsizlik tekshiruvi uchun internet kerak</p>
        </div>
      </div>
    </div>
  );
};
