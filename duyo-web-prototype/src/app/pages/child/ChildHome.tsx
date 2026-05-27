import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import { MessageCircle, Target, BookOpen, GraduationCap, Star, Zap, Heart, Brain } from 'lucide-react';
import { JuniorHome } from './JuniorHome';
import { CompanionHome } from './CompanionHome';
import type { AgeSegment } from '../../contexts/UserContext';

export const ChildHome: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [xp, setXp] = useState(450);
  const [level, setLevel] = useState(2);
  const [streak, setStreak] = useState(5);
  const [ageSegment, setAgeSegment] = useState<AgeSegment>('explorer');

  useEffect(() => {
    const storedName = localStorage.getItem('childName') || 'Do\'st';
    const storedSegment = (localStorage.getItem('ageSegment') as AgeSegment) || 'explorer';
    setName(storedName);
    setAgeSegment(storedSegment);
  }, []);

  // Route to age-specific home
  if (ageSegment === 'junior') {
    return <JuniorHome />;
  }

  if (ageSegment === 'companion') {
    return <CompanionHome />;
  }

  // Default: Explorer Home (current implementation)

  const levelProgress = (xp % 500) / 5;
  const stats = [
    { icon: Zap, label: 'Energiya', value: 85, color: 'text-yellow-500' },
    { icon: Brain, label: "O'rganish", value: 70, color: 'text-blue-500' },
    { icon: Heart, label: 'Quvonch', value: 90, color: 'text-pink-500' },
    { icon: Star, label: "Sog'liq", value: 95, color: 'text-green-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Greeting */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold">Salom, {name}!</h1>
          <p className="text-muted-foreground">Bugun ajoyib kunni boshlaymiz</p>
        </div>

        {/* DUYO Avatar with Stats */}
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4">
            <DuyoAvatar size="xl" state="happy" />

            {/* Tamagotchi Stats */}
            <div className="grid grid-cols-2 gap-4 w-full mt-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                      <Progress value={stat.value} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* XP and Level */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-accent" />
              <span className="font-medium">Do'st • Level {level}</span>
            </div>
            <div className="text-sm text-muted-foreground">{xp} XP</div>
          </div>
          <Progress value={levelProgress} className="h-3" />
          <div className="text-xs text-muted-foreground text-right mt-1">
            {500 - (xp % 500)} XP keyingi darajaga
          </div>
        </Card>

        {/* Streak */}
        <Card className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🔥</div>
              <div>
                <div className="font-bold text-lg">{streak} kunlik seriya!</div>
                <div className="text-sm text-muted-foreground">Davom eting!</div>
              </div>
            </div>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              Ajoyib!
            </Badge>
          </div>
        </Card>

        {/* Today's Mission */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Bugungi missiya</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
              <span className="text-sm">5 daqiqa inglizcha gaplash</span>
              <Badge variant="outline">+50 XP</Badge>
            </div>
            <Button className="w-full" onClick={() => navigate('/child/chat')}>
              Boshlash
            </Button>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="p-6 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/child/chat')}
          >
            <MessageCircle className="w-8 h-8 text-primary mb-2" />
            <div className="font-medium">DUYO bilan gaplash</div>
          </Card>
          <Card
            className="p-6 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/child/library')}
          >
            <BookOpen className="w-8 h-8 text-primary mb-2" />
            <div className="font-medium">She'r o'qish</div>
          </Card>
          <Card
            className="p-6 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/child/library')}
          >
            <GraduationCap className="w-8 h-8 text-primary mb-2" />
            <div className="font-medium">Dars yordami</div>
          </Card>
          <Card
            className="p-6 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigate('/child/inventory')}
          >
            <Star className="w-8 h-8 text-accent mb-2" />
            <div className="font-medium">Inventar</div>
          </Card>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
