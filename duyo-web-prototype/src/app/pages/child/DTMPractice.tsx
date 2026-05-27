import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, GraduationCap, Target, Clock, TrendingUp, Award, BookOpen } from 'lucide-react';

export const DTMPractice: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const subjects = [
    { id: 'math', name: 'Matematika', progress: 65, questionsCompleted: 124, total: 200 },
    { id: 'mother-tongue', name: 'Ona tili', progress: 45, questionsCompleted: 90, total: 200 },
    { id: 'history', name: "O'zbekiston tarixi", progress: 30, questionsCompleted: 60, total: 200 },
  ];

  const stats = [
    { label: "Jami ball", value: "18.5", icon: Target, color: "text-primary" },
    { label: "O'rtacha", value: "6.2", icon: TrendingUp, color: "text-success" },
    { label: "Topshiriqlar", value: "274", icon: BookOpen, color: "text-accent" },
  ];

  const recentTests = [
    { date: "Bugun", subject: "Matematika", score: 7.2, total: 10, time: "25 min" },
    { date: "Kecha", subject: "Ona tili", score: 6.8, total: 10, time: "22 min" },
    { date: "2 kun oldin", subject: "Tarix", score: 5.5, total: 10, time: "18 min" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/child/library')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">DTM Tayyorgarlik</h1>
            <p className="text-sm text-muted-foreground">Imtihonga tayyorgarlik</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4 text-center">
                <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </Card>
            );
          })}
        </div>

        {/* Subjects */}
        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Fanlar
          </h3>
          <div className="space-y-4">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="p-4 bg-accent/10 rounded-lg hover:bg-accent/20 cursor-pointer transition-all"
                onClick={() => setSelectedSubject(subject.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{subject.name}</span>
                  <Badge variant="outline">
                    {subject.questionsCompleted}/{subject.total}
                  </Badge>
                </div>
                <Progress value={subject.progress} className="h-2" />
                <div className="text-xs text-muted-foreground text-right mt-1">
                  {subject.progress}% bajarildi
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Practice Modes */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-6 cursor-pointer hover:shadow-lg transition-all text-center">
            <Target className="w-12 h-12 text-primary mx-auto mb-3" />
            <h4 className="font-bold mb-2">Mashq rejimi</h4>
            <p className="text-xs text-muted-foreground">Vaqtsiz mashq qilish</p>
          </Card>
          <Card className="p-6 cursor-pointer hover:shadow-lg transition-all text-center">
            <Clock className="w-12 h-12 text-accent mx-auto mb-3" />
            <h4 className="font-bold mb-2">Test rejimi</h4>
            <p className="text-xs text-muted-foreground">Vaqt bilan test</p>
          </Card>
        </div>

        {/* Recent Tests */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Oxirgi testlar</h3>
          <div className="space-y-3">
            {recentTests.map((test, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-accent/10 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{test.subject}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <span>{test.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {test.time}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-primary">
                    {test.score}
                  </div>
                  <div className="text-xs text-muted-foreground">/{test.total}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Tips */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex gap-3">
            <Award className="w-8 h-8 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-bold mb-2">DUYO maslahat</h4>
              <p className="text-sm text-muted-foreground">
                Har kuni 30 daqiqa mashq qilish eng yaxshi natija beradi. Keling, bugun matematikadan boshlaylik!
              </p>
            </div>
          </div>
        </Card>

        {/* Start Practice */}
        <Button className="w-full h-14" size="lg">
          <Target className="w-5 h-5 mr-2" />
          Mashqni boshlash
        </Button>
      </div>

      <BottomNav />
    </div>
  );
};
