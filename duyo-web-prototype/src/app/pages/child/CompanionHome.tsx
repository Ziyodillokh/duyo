import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import {
  Target,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Clock,
  Calendar,
  BarChart3,
  Award,
  Focus,
  Brain,
  Briefcase,
  Globe,
} from 'lucide-react';

export const CompanionHome: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('childName') || 'Do\'st';
    setName(storedName);
  }, []);

  const stats = [
    { label: 'DTM ball', value: '18.5', icon: Target, color: 'text-blue-600' },
    { label: 'IELTS', value: '6.0', icon: Globe, color: 'text-green-600' },
    { label: 'Fokus', value: '85%', icon: Focus, color: 'text-purple-600' },
    { label: 'Streak', value: '5', icon: TrendingUp, color: 'text-orange-600' },
  ];

  const todayGoals = [
    { id: 1, title: 'DTM Matematika - 10 savol', completed: 3, total: 10, subject: 'DTM' },
    { id: 2, title: 'IELTS Reading mashq', completed: 0, total: 1, subject: 'IELTS' },
    { id: 3, title: 'Fizika - Mexanika', completed: 1, total: 1, subject: 'Fan' },
  ];

  const studyFocus = [
    { subject: 'DTM Tayyorgarlik', hours: 2.5, icon: Target, color: 'bg-blue-500' },
    { subject: 'IELTS Practice', hours: 1.5, icon: Globe, color: 'bg-green-500' },
    { subject: 'Kasb tanlash', hours: 1.0, icon: Briefcase, color: 'bg-purple-500' },
  ];

  const quickActions = [
    {
      icon: Target,
      label: 'DTM Practice',
      description: 'Imtihon tayyorligi',
      color: 'from-blue-500 to-blue-600',
      action: () => navigate('/child/dtm-practice')
    },
    {
      icon: Globe,
      label: 'IELTS',
      description: 'Ingliz tili',
      color: 'from-green-500 to-green-600',
      action: () => navigate('/child/library')
    },
    {
      icon: GraduationCap,
      label: 'Dars yordami',
      description: 'Fanlar bo\'yicha',
      color: 'from-purple-500 to-purple-600',
      action: () => navigate('/child/lesson-help')
    },
    {
      icon: Briefcase,
      label: 'Karyera',
      description: 'Kasb tanlash',
      color: 'from-orange-500 to-orange-600',
      action: () => navigate('/child/chat')
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-20">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header - Clean and Professional */}
        <div className="pt-4">
          <h1 className="text-2xl font-bold text-slate-800">Salom, {name}</h1>
          <p className="text-slate-600">Bugun maqsadlaringizga erishamiz</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 text-center hover:shadow-md transition-all">
                <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                <div className="text-xs text-slate-600">{stat.label}</div>
              </Card>
            );
          })}
        </div>

        {/* DUYO - Compact */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <DuyoAvatar size="md" state="happy" />
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">DUYO Maslahat</h3>
              <p className="text-sm text-slate-600">
                Matematikada yuqori natija ko'rsatyapsiz. Bugun fizikaga e'tibor bering - bu DTM'da kuchli ball beradi.
              </p>
            </div>
          </div>
        </Card>

        {/* Today's Goals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Bugungi maqsadlar
            </h3>
            <span className="text-sm text-slate-600">1/3 bajarildi</span>
          </div>
          <div className="space-y-3">
            {todayGoals.map((goal) => (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{goal.title}</div>
                    <Badge variant="outline" className="text-xs mt-1">
                      {goal.subject}
                    </Badge>
                  </div>
                  <span className="text-sm text-slate-600">
                    {goal.completed}/{goal.total}
                  </span>
                </div>
                <Progress value={(goal.completed / goal.total) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </Card>

        {/* Study Focus This Week */}
        <Card className="p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Bu haftadagi fokus
          </h3>
          <div className="space-y-3">
            {studyFocus.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.subject} className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.subject}</div>
                    <div className="text-xs text-slate-600">{item.hours} soat</div>
                  </div>
                  <div className="w-24">
                    <Progress value={(item.hours / 3) * 100} className="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick Actions - Grid */}
        <div className="grid grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.label}
                className="p-6 cursor-pointer hover:shadow-lg transition-all"
                onClick={action.action}
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold mb-1">{action.label}</h4>
                <p className="text-xs text-slate-600">{action.description}</p>
              </Card>
            );
          })}
        </div>

        {/* Focus Timer */}
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-10 h-10 text-purple-600" />
              <div>
                <h4 className="font-bold">Fokus rejimi</h4>
                <p className="text-sm text-slate-600">25 daqiqa to'xtovsiz o'qish</p>
              </div>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700">
              Boshlash
            </Button>
          </div>
        </Card>

        {/* Weekly Progress */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Haftalik progress
            </h3>
            <Badge className="bg-green-600 text-white">
              <Award className="w-3 h-3 mr-1" />
              Yaxshi
            </Badge>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'].map((day, index) => (
              <div key={day} className="text-center">
                <div
                  className={`w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium mb-1 ${
                    index < 5
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {index < 5 ? '✓' : ''}
                </div>
                <span className="text-xs text-slate-600">{day}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Motivational Quote */}
        <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-center">
          <Brain className="w-10 h-10 text-blue-600 mx-auto mb-3" />
          <p className="font-medium text-slate-800 mb-1">
            "Maqsadga erishish yo'lida har bir qadam muhim"
          </p>
          <p className="text-sm text-slate-600">Davom eting, siz ajoyib ishlamoqdasiz!</p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
