import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, Target, Star, Clock, MessageCircle, BookOpen, Check, Trophy } from 'lucide-react';

interface Mission {
  id: string;
  title: string;
  description: string;
  xp: number;
  completed: boolean;
  progress: number;
  total: number;
  icon: any;
  category: string;
}

export const DailyMission: React.FC = () => {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([
    {
      id: '1',
      title: '5 daqiqa inglizcha gaplash',
      description: 'DUYO bilan ingliz tilida suhbat qiling',
      xp: 50,
      completed: false,
      progress: 0,
      total: 5,
      icon: MessageCircle,
      category: 'Til',
    },
    {
      id: '2',
      title: 'Bitta she\'r o\'qi',
      description: 'Kutubxonadan she\'r tanlang va o\'qing',
      xp: 30,
      completed: true,
      progress: 1,
      total: 1,
      icon: BookOpen,
      category: 'O\'qish',
    },
    {
      id: '3',
      title: 'Matematika savolini yech',
      description: '3 ta matematika savoliga javob bering',
      xp: 40,
      completed: false,
      progress: 1,
      total: 3,
      icon: Target,
      category: 'O\'rganish',
    },
    {
      id: '4',
      title: '10 daqiqa dam ol',
      description: 'Nafas olish mashqlarini bajaring',
      xp: 20,
      completed: false,
      progress: 0,
      total: 1,
      icon: Star,
      category: 'Sog\'liq',
    },
  ]);

  const totalXP = missions.reduce((sum, m) => sum + m.xp, 0);
  const earnedXP = missions.filter(m => m.completed).reduce((sum, m) => sum + m.xp, 0);
  const completedCount = missions.filter(m => m.completed).length;
  const allCompleted = missions.every(m => m.completed);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/child/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Bugungi missiyalar</h1>
            <p className="text-sm text-muted-foreground">
              {completedCount} / {missions.length} bajarildi
            </p>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Jami XP</div>
              <div className="text-3xl font-bold">
                {earnedXP} <span className="text-lg text-muted-foreground">/ {totalXP}</span>
              </div>
            </div>
            <Trophy className="w-12 h-12 text-accent" />
          </div>
          <Progress value={(earnedXP / totalXP) * 100} className="h-3" />
        </Card>

        {/* All Completed Celebration */}
        {allCompleted && (
          <Card className="p-6 bg-gradient-to-r from-success/20 to-emerald-100 border-success">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold mb-2">Ajoyib!</h3>
              <p className="text-muted-foreground mb-4">
                Barcha bugungi missiyalarni bajardingiz!
              </p>
              <Badge className="bg-success text-white">
                +{totalXP} XP olindi
              </Badge>
            </div>
          </Card>
        )}

        {/* Missions List */}
        <div className="space-y-3">
          {missions.map((mission) => {
            const Icon = mission.icon;
            return (
              <Card
                key={mission.id}
                className={`p-6 transition-all ${
                  mission.completed
                    ? 'bg-success/5 border-success/30'
                    : 'hover:shadow-lg cursor-pointer'
                }`}
              >
                <div className="flex gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      mission.completed
                        ? 'bg-success text-white'
                        : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {mission.completed ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold">{mission.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {mission.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        <Star className="w-3 h-3 mr-1 text-accent" />
                        +{mission.xp}
                      </Badge>
                    </div>

                    {!mission.completed && mission.progress > 0 && (
                      <div className="space-y-1">
                        <Progress
                          value={(mission.progress / mission.total) * 100}
                          className="h-2"
                        />
                        <div className="text-xs text-muted-foreground text-right">
                          {mission.progress} / {mission.total}
                        </div>
                      </div>
                    )}

                    {mission.completed && (
                      <Badge variant="secondary" className="bg-success/20 text-success mt-2">
                        ✓ Bajarildi
                      </Badge>
                    )}

                    {!mission.completed && (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          // Navigate based on mission type
                          if (mission.category === 'Til') {
                            navigate('/child/chat');
                          } else if (mission.category === "O'qish") {
                            navigate('/child/library');
                          }
                        }}
                      >
                        Boshlash
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Daily Streak Bonus */}
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🔥</div>
            <div className="flex-1">
              <div className="font-bold">Bonus: 5 kunlik seriya!</div>
              <div className="text-sm text-muted-foreground">
                Barcha missiyalarni bajarsangiz +20 XP bonus
              </div>
            </div>
          </div>
        </Card>

        {/* Timer */}
        <Card className="p-4 bg-accent/10">
          <div className="flex items-center justify-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Yangi missiyalar 18 soatdan keyin
            </span>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
