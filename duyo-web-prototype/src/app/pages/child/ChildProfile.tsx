import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import { Star, Flame, Trophy, Calendar, Settings, Crown, Zap } from 'lucide-react';

export const ChildProfile: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [xp] = useState(450);
  const [level] = useState(2);
  const [streak] = useState(5);

  useEffect(() => {
    const storedName = localStorage.getItem('childName') || 'Do\'st';
    setName(storedName);
  }, []);

  const achievements = [
    { id: 1, name: 'Birinchi kun', icon: '🎉', unlocked: true },
    { id: 2, name: '5 kunlik seriya', icon: '🔥', unlocked: true },
    { id: 3, name: 'She\'r o\'quvchi', icon: '📖', unlocked: true },
    { id: 4, name: '10 kunlik seriya', icon: '🏆', unlocked: false },
    { id: 5, name: 'Birinchi level', icon: '⭐', unlocked: true },
    { id: 6, name: 'DUYO do\'sti', icon: '🤖', unlocked: true },
  ];

  const weeklyActivity = [
    { day: 'Du', active: true, minutes: 25 },
    { day: 'Se', active: true, minutes: 30 },
    { day: 'Cho', active: true, minutes: 20 },
    { day: 'Pa', active: true, minutes: 15 },
    { day: 'Ju', active: true, minutes: 28 },
    { day: 'Sha', active: false, minutes: 0 },
    { day: 'Ya', active: false, minutes: 0 },
  ];

  const levelTitles = ['Tanish', 'Do\'st', 'Sirdosh', 'Hamroh', 'Hamfikr', 'Yulduz'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/child/settings')}
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <DuyoAvatar size="xl" state="happy" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <Badge className="bg-accent text-accent-foreground">
                  <Crown className="w-3 h-3 mr-1" />
                  Level {level}
                </Badge>
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold">{name}</h2>
              <p className="text-muted-foreground">{levelTitles[level - 1]}</p>
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Keyingi daraja: {levelTitles[level]}</span>
                <span className="text-sm text-muted-foreground">{xp} XP</span>
              </div>
              <Progress value={(xp % 500) / 5} className="h-3" />
              <p className="text-xs text-muted-foreground text-right">
                {500 - (xp % 500)} XP qoldi
              </p>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{streak}</div>
            <div className="text-xs text-muted-foreground">Kun seriya</div>
          </Card>
          <Card className="p-4 text-center">
            <Star className="w-8 h-8 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold">{xp}</div>
            <div className="text-xs text-muted-foreground">Jami XP</div>
          </Card>
          <Card className="p-4 text-center">
            <Trophy className="w-8 h-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">6</div>
            <div className="text-xs text-muted-foreground">Yutuqlar</div>
          </Card>
        </div>

        {/* Weekly Activity */}
        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Haftalik faollik
          </h3>
          <div className="flex justify-between gap-2">
            {weeklyActivity.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full h-20 rounded-lg transition-all ${
                    day.active
                      ? 'bg-primary'
                      : 'bg-muted'
                  }`}
                  style={{
                    height: day.active ? `${Math.max(40, (day.minutes / 30) * 80)}px` : '20px',
                  }}
                />
                <span className="text-xs font-medium">{day.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-accent" />
            <span>O'rtacha kunlik: 23 daqiqa</span>
          </div>
        </Card>

        {/* Achievements */}
        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Yutuqlar
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                  achievement.unlocked
                    ? 'bg-accent/20 border-2 border-accent'
                    : 'bg-muted/50 opacity-50'
                }`}
              >
                <div className="text-3xl">{achievement.icon}</div>
                <div className="text-xs text-center font-medium">{achievement.name}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/child/subscription')}
          >
            <Crown className="w-4 h-4 mr-2" />
            Premium'ga o'tish
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
