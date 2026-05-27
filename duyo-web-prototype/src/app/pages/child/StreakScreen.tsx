import React from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BottomNav } from '../../components/child/BottomNav';
import { Flame, Star, Trophy, ArrowLeft } from 'lucide-react';

export const StreakScreen: React.FC = () => {
  const navigate = useNavigate();
  const currentStreak = 5;
  const longestStreak = 12;

  const milestones = [
    { days: 3, reached: true, reward: '50 XP', icon: '🔥' },
    { days: 7, reached: false, reward: '100 XP + Badge', icon: '⭐' },
    { days: 14, reached: false, reward: '200 XP + Aksessuar', icon: '🎁' },
    { days: 30, reached: false, reward: '500 XP + Premium Badge', icon: '👑' },
    { days: 100, reached: false, reward: '1000 XP + Maxsus Avatar', icon: '🏆' },
    { days: 365, reached: false, reward: '5000 XP + Yulduz Unvon', icon: '🌟' },
  ];

  const calendar = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    active: i < currentStreak,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/child/profile')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Seriya</h1>
        </div>

        {/* Current Streak */}
        <Card className="p-8 bg-gradient-to-br from-orange-100 to-yellow-100 border-orange-300">
          <div className="text-center">
            <Flame className="w-20 h-20 text-orange-500 mx-auto mb-4 animate-pulse" />
            <div className="text-6xl font-bold text-orange-600 mb-2">{currentStreak}</div>
            <p className="text-xl font-medium text-orange-700">kunlik seriya!</p>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-6 text-center">
            <Trophy className="w-8 h-8 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold">{longestStreak}</div>
            <div className="text-sm text-muted-foreground">Eng uzun seriya</div>
          </Card>
          <Card className="p-6 text-center">
            <Star className="w-8 h-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">3</div>
            <div className="text-sm text-muted-foreground">Milestone erishildi</div>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">So'nggi 30 kun</h3>
          <div className="grid grid-cols-7 gap-2">
            {calendar.map((day) => (
              <div
                key={day.day}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium ${
                  day.active
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {day.active ? '🔥' : day.day}
              </div>
            ))}
          </div>
        </Card>

        {/* Milestones */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Milestonelar</h3>
          <div className="space-y-3">
            {milestones.map((milestone) => (
              <div
                key={milestone.days}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  milestone.reached
                    ? 'bg-success/10 border-2 border-success'
                    : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{milestone.icon}</div>
                  <div>
                    <div className="font-bold">{milestone.days} kun</div>
                    <div className="text-sm text-muted-foreground">{milestone.reward}</div>
                  </div>
                </div>
                {milestone.reached ? (
                  <Badge variant="secondary" className="bg-success text-white">
                    ✓
                  </Badge>
                ) : (
                  <Badge variant="outline">Qulflangan</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Motivation */}
        <Card className="p-6 bg-accent/10 border-accent/30">
          <div className="text-center">
            <p className="font-medium mb-2">Hechqisi yo'q, yana boshlaymiz!</p>
            <p className="text-sm text-muted-foreground">
              Seriya uzilsa ham hech qanday jazo yo'q. Muhimi - davom etish.
            </p>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
