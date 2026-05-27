import React from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { Clock, Crown, MessageCircle, BookOpen, Zap } from 'lucide-react';

export const DailyLimitReached: React.FC = () => {
  const navigate = useNavigate();

  const timeUntilReset = "6 soat 24 daqiqa";
  const currentPlan = "Do'st";
  const usedMessages = 30;
  const totalMessages = 30;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* DUYO Avatar */}
        <div className="flex justify-center">
          <DuyoAvatar size="xl" state="sleeping" />
        </div>

        {/* Main Message */}
        <Card className="p-8 text-center">
          <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Kunlik limit tugadi</h2>
          <p className="text-muted-foreground mb-4">
            Bugungi AI suhbatlaringiz tugadi. Men biroz dam olaman va ertaga davom etamiz!
          </p>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {usedMessages} / {totalMessages} suhbat
          </Badge>
        </Card>

        {/* Timer */}
        <Card className="p-6 bg-accent/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Yangi limitlar</div>
              <div className="text-xl font-bold">{timeUntilReset}</div>
            </div>
            <Zap className="w-10 h-10 text-accent" />
          </div>
        </Card>

        {/* Current Plan */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Joriy reja</div>
              <div className="font-bold text-lg">{currentPlan}</div>
            </div>
            <Badge variant="outline">Oylik</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            ✓ 30 ta AI suhbat/kun
          </div>
        </Card>

        {/* Upgrade to Premium */}
        <Card className="p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <div className="flex gap-4 items-start">
            <Crown className="w-12 h-12 text-accent flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold mb-2">Premium'ga o'ting</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Hamroh rejasida kuniga 200 ta AI suhbat va ko'plab qo'shimcha imkoniyatlar
              </p>
              <Button
                className="w-full"
                onClick={() => navigate('/child/subscription')}
              >
                <Crown className="w-4 h-4 mr-2" />
                Premium haqida
              </Button>
            </div>
          </div>
        </Card>

        {/* Alternative Activities */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Bu orada:</h3>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => navigate('/child/library')}
            >
              <BookOpen className="w-5 h-5 mr-3 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-medium">Kutubxonaga boring</div>
                <div className="text-xs text-muted-foreground">She'rlar va ertaklar tinglaб</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => navigate('/child/inventory')}
            >
              <Crown className="w-5 h-5 mr-3 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-medium">Inventarni ko'ring</div>
                <div className="text-xs text-muted-foreground">Yangi aksessuarlar sotib oling</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => navigate('/child/profile')}
            >
              <Zap className="w-5 h-5 mr-3 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="font-medium">Yutuqlaringizni ko'ring</div>
                <div className="text-xs text-muted-foreground">Seriya va darajalaringiz</div>
              </div>
            </Button>
          </div>
        </Card>

        {/* Back to Home */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/child/home')}
        >
          Bosh sahifaga qaytish
        </Button>
      </div>
    </div>
  );
};
