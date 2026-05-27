import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { Shield, Phone, Users, Heart, MessageCircle } from 'lucide-react';

interface CrisisSupportProps {
  level: 'yellow' | 'orange' | 'red';
}

export const CrisisSupport: React.FC<CrisisSupportProps> = ({ level }) => {
  const config = {
    yellow: {
      title: 'Men seni tushunaman',
      message: 'Ba\'zan qiyin paytlar bo\'ladi. Men seni tinglashga tayyorman.',
      bgColor: 'from-yellow-50 to-amber-50',
      borderColor: 'border-yellow-200',
    },
    orange: {
      title: 'Sen yolg\'iz emassan',
      message: 'Men senga yordam berishga tayyorman. Keling, ishonchli katta odam bilan gaplashaylik.',
      bgColor: 'from-orange-50 to-yellow-50',
      borderColor: 'border-orange-200',
    },
    red: {
      title: 'Sen muhimsan',
      message: 'Men sening xavfsizligingni o\'ylayman. Keling, hozir senga yordam beradigan odamni topamiz.',
      bgColor: 'from-red-50 to-orange-50',
      borderColor: 'border-red-200',
    },
  };

  const currentConfig = config[level];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentConfig.bgColor} flex items-center justify-center p-6`}>
      <div className="w-full max-w-md space-y-6">
        {/* DUYO Avatar in calm state */}
        <div className="flex justify-center">
          <DuyoAvatar size="xl" state="crisis-support" />
        </div>

        {/* Main Message */}
        <Card className={`p-6 border-2 ${currentConfig.borderColor}`}>
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold">{currentConfig.title}</h2>
            <p className="text-muted-foreground">{currentConfig.message}</p>
          </div>
        </Card>

        {/* Support Options */}
        <div className="space-y-3">
          {level === 'yellow' && (
            <>
              <Button className="w-full h-14 bg-primary" size="lg">
                <MessageCircle className="w-5 h-5 mr-2" />
                DUYO bilan gaplashish
              </Button>
              <Button variant="outline" className="w-full h-14" size="lg">
                <Heart className="w-5 h-5 mr-2" />
                Nafas olish mashqlari
              </Button>
            </>
          )}

          {level === 'orange' && (
            <>
              <Button className="w-full h-14 bg-primary" size="lg">
                <Users className="w-5 h-5 mr-2" />
                Ishonchli kattaga aytish
              </Button>
              <Button variant="outline" className="w-full h-14" size="lg">
                <MessageCircle className="w-5 h-5 mr-2" />
                DUYO bilan gaplashish davom etish
              </Button>
              <Button variant="outline" className="w-full h-14" size="lg">
                <Heart className="w-5 h-5 mr-2" />
                Nafas olish mashqlari
              </Button>
            </>
          )}

          {level === 'red' && (
            <>
              <Button className="w-full h-14 bg-destructive hover:bg-destructive/90" size="lg">
                <Phone className="w-5 h-5 mr-2" />
                Ota-onamga ayt
              </Button>
              <Button className="w-full h-14 bg-primary" size="lg">
                <Users className="w-5 h-5 mr-2" />
                Ishonchli kattaga aytish
              </Button>
              <Button variant="outline" className="w-full h-14" size="lg">
                <Shield className="w-5 h-5 mr-2" />
                Yordam raqamini ko'rsat
              </Button>
            </>
          )}
        </div>

        {/* Help Resources Card */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3 items-start">
            <Shield className="w-6 h-6 text-primary flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Yordam kerakmi?</p>
              <p className="text-muted-foreground">
                Sen xavfsizsan va sen yolg'iz emassan. Doimo yordam olish mumkin.
              </p>
              {level === 'red' && (
                <div className="mt-3 space-y-1">
                  <p className="font-bold">Favqulodda raqamlar:</p>
                  <p>1050 - Psixologik yordam</p>
                  <p>1054 - Bolalar telefoni</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Privacy Note */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Bu suhbat maxfiy saqlanadi va faqat sen xavfsiz bo'lishingni ta'minlash uchun ishlatiladi</p>
        </div>
      </div>
    </div>
  );
};
