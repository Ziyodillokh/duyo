import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import { MessageCircle, BookOpen, Music, Sparkles, Star, Heart, Zap, Brain } from 'lucide-react';

export const JuniorHome: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('childName') || 'Do\'st';
    setName(storedName);
  }, []);

  const stats = [
    { icon: Zap, label: 'Energiya', value: 85, color: 'bg-yellow-400', emoji: '⚡' },
    { icon: Brain, label: "O'rganish", value: 70, color: 'bg-blue-400', emoji: '🧠' },
    { icon: Heart, label: 'Quvonch', value: 90, color: 'bg-pink-400', emoji: '💖' },
    { icon: Star, label: "Sog'liq", value: 95, color: 'bg-green-400', emoji: '⭐' },
  ];

  const activities = [
    {
      icon: '🎨',
      title: 'DUYO bilan gaplash',
      color: 'from-purple-400 to-pink-400',
      action: () => navigate('/child/chat')
    },
    {
      icon: '📚',
      title: "She'r o'qish",
      color: 'from-blue-400 to-cyan-400',
      action: () => navigate('/child/library')
    },
    {
      icon: '🎵',
      title: 'Ertak tinglash',
      color: 'from-green-400 to-emerald-400',
      action: () => navigate('/child/library')
    },
    {
      icon: '🎮',
      title: "O'yinlar",
      color: 'from-orange-400 to-red-400',
      action: () => navigate('/child/inventory')
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Greeting with Fun Graphics */}
        <div className="text-center pt-4">
          <div className="text-6xl mb-2">👋</div>
          <h1 className="text-3xl font-bold text-purple-600">Salom, {name}!</h1>
          <p className="text-xl text-purple-500">Bugun nima qilamiz?</p>
        </div>

        {/* DUYO Avatar - Extra Large */}
        <Card className="p-8 bg-gradient-to-br from-white to-purple-50 border-4 border-purple-200">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <DuyoAvatar size="xl" state="happy" />
              <div className="absolute -top-2 -right-2 text-4xl animate-bounce">
                ✨
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600 mb-2">DUYO</p>
              <Badge className="text-lg px-4 py-2 bg-purple-500">
                <Star className="w-4 h-4 mr-2" />
                Level 2
              </Badge>
            </div>
          </div>
        </Card>

        {/* Tamagotchi Stats - Big and Colorful */}
        <Card className="p-6 bg-white border-4 border-pink-200">
          <h3 className="text-xl font-bold text-center mb-4 text-pink-600">
            DUYO'ning holati
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{stat.emoji}</span>
                    <span className="text-sm font-bold">{stat.label}</span>
                  </div>
                  <span className="text-lg font-bold text-purple-600">{stat.value}%</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${stat.color} transition-all duration-500`}
                    style={{ width: `${stat.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Streak - Fun Design */}
        <Card className="p-6 bg-gradient-to-r from-orange-100 to-yellow-100 border-4 border-orange-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-5xl">🔥</div>
              <div>
                <div className="text-3xl font-bold text-orange-600">5 kun!</div>
                <div className="text-sm text-orange-500">Seriya davom etmoqda!</div>
              </div>
            </div>
            <div className="text-4xl">🎉</div>
          </div>
        </Card>

        {/* Today's Mission - Simple */}
        <Card className="p-6 bg-gradient-to-r from-green-100 to-emerald-100 border-4 border-green-300">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🎯</span>
            <h3 className="text-xl font-bold text-green-700">Bugungi vazifa</h3>
          </div>
          <div className="bg-white rounded-2xl p-4 mb-4">
            <p className="text-lg font-medium text-center mb-2">
              DUYO bilan 5 daqiqa gaplash
            </p>
            <div className="flex items-center justify-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              <span className="text-xl font-bold text-yellow-600">+50 XP</span>
            </div>
          </div>
          <Button
            className="w-full h-16 text-xl bg-green-500 hover:bg-green-600"
            size="lg"
            onClick={() => navigate('/child/chat')}
          >
            <Sparkles className="w-6 h-6 mr-2" />
            Boshlash!
          </Button>
        </Card>

        {/* Big Activity Buttons */}
        <div className="grid grid-cols-2 gap-4">
          {activities.map((activity, index) => (
            <Card
              key={index}
              className={`p-6 cursor-pointer hover:scale-105 transition-all bg-gradient-to-br ${activity.color} border-0 shadow-lg`}
              onClick={activity.action}
            >
              <div className="text-center space-y-3">
                <div className="text-6xl">{activity.icon}</div>
                <div className="text-white font-bold text-lg">{activity.title}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* XP Progress - Big and Fun */}
        <Card className="p-6 bg-gradient-to-r from-blue-100 to-indigo-100 border-4 border-blue-300">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-8 h-8 text-yellow-500" />
            <span className="text-2xl font-bold text-blue-700">450 XP</span>
          </div>
          <div className="h-6 bg-white rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: '90%' }} />
          </div>
          <p className="text-center mt-2 text-blue-600 font-bold">
            Keyingi darajaga 50 XP qoldi!
          </p>
        </Card>

        {/* Encouraging Message */}
        <Card className="p-6 bg-gradient-to-r from-pink-100 to-purple-100 border-4 border-pink-300 text-center">
          <div className="text-4xl mb-2">🌟</div>
          <p className="text-xl font-bold text-purple-700">
            Sen ajoyibsan! Davom et!
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
