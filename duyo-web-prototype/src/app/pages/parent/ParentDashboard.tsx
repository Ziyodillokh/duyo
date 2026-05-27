import React from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  Activity,
  Clock,
  TrendingUp,
  Shield,
  MessageCircle,
  BookOpen,
  Star,
  AlertCircle,
  Settings,
  Crown,
} from 'lucide-react';
import { useNavigate } from 'react-router';

export const ParentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const childData = {
    name: 'Aziza',
    age: 12,
    subscription: 'Do\'st',
    daysActive: 8,
    avgDailyTime: 23,
    totalUsage: 184,
    moodTrend: 'positive',
    safetyStatus: 'green',
  };

  const topics = [
    { name: 'Maktab', percentage: 35 },
    { name: 'Do\'stlar', percentage: 25 },
    { name: 'Hobbi', percentage: 20 },
    { name: 'O\'rganish', percentage: 15 },
    { name: 'Boshqa', percentage: 5 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div>
            <h1 className="text-3xl font-bold">Ota-ona paneli</h1>
            <p className="text-muted-foreground">10 kunlik hisobot</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate('/parent/settings')}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Child Info */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {childData.name[0]}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{childData.name}</h2>
                <p className="text-muted-foreground">{childData.age} yosh</p>
              </div>
            </div>
            <Badge variant="secondary" className="px-4 py-2">
              <Crown className="w-4 h-4 mr-2" />
              {childData.subscription}
            </Badge>
          </div>
        </Card>

        {/* Safety Status */}
        <Card className="p-6 border-2 border-success bg-success/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="w-12 h-12 text-success" />
              <div>
                <h3 className="text-xl font-bold">Xavfsizlik holati: Yaxshi</h3>
                <p className="text-sm text-muted-foreground">
                  Hech qanday tashvish alomat topilmadi
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-success text-white">
              ✓ Xavfsiz
            </Badge>
          </div>
        </Card>

        {/* Activity Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-8 h-8 text-primary" />
              <div className="text-sm text-muted-foreground">Faol kunlar</div>
            </div>
            <div className="text-3xl font-bold">{childData.daysActive}/10</div>
            <Progress value={(childData.daysActive / 10) * 100} className="mt-2" />
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-8 h-8 text-primary" />
              <div className="text-sm text-muted-foreground">O'rtacha kunlik</div>
            </div>
            <div className="text-3xl font-bold">{childData.avgDailyTime} daq</div>
            <p className="text-sm text-success mt-2">Sog'lom darajada</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-primary" />
              <div className="text-sm text-muted-foreground">Jami foydalanish</div>
            </div>
            <div className="text-3xl font-bold">{childData.totalUsage} daq</div>
            <p className="text-sm text-muted-foreground mt-2">So'nggi 10 kun</p>
          </Card>
        </div>

        {/* Mood Trend */}
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Kayfiyat tendensiyasi
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-16 bg-gradient-to-r from-green-500 via-yellow-500 to-green-500 rounded-lg relative">
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold">
                Ijobiy kayfiyat
              </div>
            </div>
            <Badge variant="secondary" className="bg-success text-white">
              😊 Yaxshi
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            So'nggi 10 kunda kayfiyat asosan ijobiy bo'lgan
          </p>
        </Card>

        {/* Topics Discussed */}
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Muhokama qilingan mavzular
          </h3>
          <div className="space-y-3">
            {topics.map((topic) => (
              <div key={topic.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{topic.name}</span>
                  <span className="text-sm text-muted-foreground">{topic.percentage}%</span>
                </div>
                <Progress value={topic.percentage} />
              </div>
            ))}
          </div>
        </Card>

        {/* Learning Progress */}
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent" />
            O'rganish jarayoni
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-accent/10 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">XP olindi</div>
              <div className="text-2xl font-bold">450 XP</div>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">O'qilgan she'rlar</div>
              <div className="text-2xl font-bold">12 dona</div>
            </div>
            <div className="p-4 bg-success/10 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Bajarligan topshiriqlar</div>
              <div className="text-2xl font-bold">8 ta</div>
            </div>
            <div className="p-4 bg-orange-100 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Seriya</div>
              <div className="text-2xl font-bold">5 kun</div>
            </div>
          </div>
        </Card>

        {/* Stress Indicators */}
        <Card className="p-6 bg-accent/5">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            Stress ko'rsatkichlari
          </h3>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Hech qanday stress yoki tashvish belgilari aniqlanmadi
            </p>
            <Badge variant="secondary" className="mt-3 bg-success text-white">
              ✓ Barcha yaxshi
            </Badge>
          </div>
        </Card>

        {/* Privacy Notice */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <Shield className="w-8 h-8 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-bold mb-2">Maxfiylik haqida</h4>
              <p className="text-sm text-muted-foreground">
                Farzandingizning suhbatlari maxfiy saqlanadi. Siz faqat umumiy xulosa va
                statistikalarni ko'rasiz. To'liq suhbat matni xavfsizlik protokoli bo'yicha
                kerak bo'lgandagina ko'rsatiladi.
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-4">
          <Button variant="outline" className="h-14">
            <MessageCircle className="w-5 h-5 mr-2" />
            Farzandimga qo'ng'iroq qilish
          </Button>
          <Button variant="outline" className="h-14">
            <Settings className="w-5 h-5 mr-2" />
            Sozlamalar
          </Button>
        </div>
      </div>
    </div>
  );
};
