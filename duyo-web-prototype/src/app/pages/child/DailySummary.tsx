import React from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import { Star, Clock, MessageCircle, BookOpen, Target, TrendingUp, Moon } from 'lucide-react';

export const DailySummary: React.FC = () => {
  const navigate = useNavigate();

  const summary = {
    date: "26 May, 2026",
    totalXP: 150,
    learningTime: 45,
    messagesCount: 18,
    missionsCompleted: 3,
    missionsTotal: 4,
    streak: 5,
    mood: 'happy' as const,
    highlights: [
      "3 ta she'rni o'qidingiz",
      "Matematikada yangi mavzu o'rgandingiz",
      "5 kunlik seriyangizni davom ettirdingiz",
    ],
    tomorrowSuggestions: [
      "Ingliz tilida 10 daqiqa suhbat",
      "Fizika darsidagi yangi mavzu",
      "Dam olish mashqlari",
    ],
  };

  const stats = [
    { label: 'XP olindi', value: summary.totalXP, icon: Star, color: 'text-accent' },
    { label: "O'rganish", value: `${summary.learningTime} daq`, icon: Clock, color: 'text-primary' },
    { label: 'Suhbatlar', value: summary.messagesCount, icon: MessageCircle, color: 'text-blue-500' },
    { label: 'Missiyalar', value: `${summary.missionsCompleted}/${summary.missionsTotal}`, icon: Target, color: 'text-green-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900">
      <div className="max-w-md mx-auto p-6 space-y-6 pb-24">
        {/* Stars decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="pt-8 text-center text-white relative z-10">
          <Moon className="w-12 h-12 mx-auto mb-4 text-yellow-200" />
          <h1 className="text-2xl font-bold mb-2">Kungi xulosa</h1>
          <p className="text-white/70">{summary.date}</p>
        </div>

        {/* DUYO Avatar */}
        <div className="flex justify-center relative z-10">
          <DuyoAvatar size="xl" state={summary.mood} />
        </div>

        {/* Main Message */}
        <Card className="p-6 text-center relative z-10 bg-white/10 backdrop-blur border-white/20">
          <h2 className="text-xl font-bold text-white mb-2">Ajoyib kun o'tkazding!</h2>
          <p className="text-white/80">
            Bugun juda ko'p narsa o'rgandingiz va yaxshi ish qildingiz.
          </p>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 text-center bg-white/10 backdrop-blur border-white/20">
                <Icon className={`w-8 h-8 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-white/70">{stat.label}</div>
              </Card>
            );
          })}
        </div>

        {/* Highlights */}
        <Card className="p-6 relative z-10 bg-white/10 backdrop-blur border-white/20">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Bugungi yutuqlar
          </h3>
          <div className="space-y-2">
            {summary.highlights.map((highlight, index) => (
              <div key={index} className="flex items-start gap-2 text-white/90">
                <span className="text-green-400 flex-shrink-0">✓</span>
                <span className="text-sm">{highlight}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Streak */}
        <Card className="p-6 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 backdrop-blur border-orange-300/30 relative z-10">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🔥</div>
              <div>
                <div className="font-bold text-lg">{summary.streak} kunlik seriya!</div>
                <div className="text-sm text-white/70">Davom eting!</div>
              </div>
            </div>
            <Badge className="bg-orange-500 text-white border-0">
              Ajoyib!
            </Badge>
          </div>
        </Card>

        {/* Tomorrow Suggestions */}
        <Card className="p-6 relative z-10 bg-white/10 backdrop-blur border-white/20">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-white">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Ertaga tavsiyalar
          </h3>
          <div className="space-y-2">
            {summary.tomorrowSuggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-3 bg-white/5 rounded-lg text-white/90 text-sm"
              >
                {suggestion}
              </div>
            ))}
          </div>
        </Card>

        {/* Good Night Message */}
        <Card className="p-6 text-center relative z-10 bg-indigo-600/30 backdrop-blur border-indigo-300/30">
          <p className="text-white font-medium mb-2">Yaxshi dam oling! 🌙</p>
          <p className="text-sm text-white/70">
            Ertaga yana yangi bilimlar va sarguzashtlar kutmoqda
          </p>
        </Card>

        {/* Action Button */}
        <Button
          className="w-full h-14 relative z-10 bg-white text-primary hover:bg-white/90"
          size="lg"
          onClick={() => navigate('/child/home')}
        >
          Tayyor
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};
