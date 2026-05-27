import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, Search, BookOpen, Calculator, Globe, Atom, FlaskConical, Leaf, Clock, Map } from 'lucide-react';

const subjects = [
  { id: 'math', name: 'Matematika', icon: Calculator, color: 'from-blue-500 to-cyan-500', topics: 12 },
  { id: 'uzbek', name: 'Ona tili', icon: BookOpen, color: 'from-green-500 to-emerald-500', topics: 8 },
  { id: 'english', name: 'Ingliz tili', icon: Globe, color: 'from-purple-500 to-pink-500', topics: 15 },
  { id: 'physics', name: 'Fizika', icon: Atom, color: 'from-orange-500 to-red-500', topics: 10 },
  { id: 'chemistry', name: 'Kimyo', icon: FlaskConical, color: 'from-yellow-500 to-orange-500', topics: 9 },
  { id: 'biology', name: 'Biologiya', icon: Leaf, color: 'from-green-600 to-teal-500', topics: 11 },
  { id: 'history', name: 'Tarix', icon: Clock, color: 'from-amber-600 to-yellow-600', topics: 14 },
  { id: 'geography', name: 'Geografiya', icon: Map, color: 'from-blue-600 to-indigo-500', topics: 13 },
];

export const LessonHelp: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const recentQuestions = [
    "Pythagoras teoremasi qanday ishlaydi?",
    "Present Simple va Present Continuous farqi?",
    "Fotosintez jarayonini tushuntiring",
  ];

  if (selectedSubject) {
    const subject = subjects.find(s => s.id === selectedSubject);
    const Icon = subject?.icon || BookOpen;

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
        <div className="max-w-md mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="pt-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedSubject(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">{subject?.name}</h1>
          </div>

          {/* Ask Question */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">Savol bering</h3>
            <Input
              placeholder={`${subject?.name} bo'yicha savolingizni yozing...`}
              className="mb-4"
            />
            <Button className="w-full">
              <BookOpen className="w-4 h-4 mr-2" />
              DUYO'dan yordam so'rash
            </Button>
          </Card>

          {/* Popular Topics */}
          <Card className="p-6">
            <h3 className="font-bold mb-4">Mashhur mavzular</h3>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="p-3 bg-accent/10 rounded-lg hover:bg-accent/20 cursor-pointer transition-all"
                >
                  <div className="font-medium text-sm">Mavzu {i + 1}</div>
                  <div className="text-xs text-muted-foreground">12 ta savol</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/child/library')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Dars yordami</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Savolingizni yozing..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Recent Questions */}
        {recentQuestions.length > 0 && (
          <Card className="p-6">
            <h3 className="font-bold mb-4">Oxirgi savollar</h3>
            <div className="space-y-2">
              {recentQuestions.map((question, index) => (
                <div
                  key={index}
                  className="p-3 bg-accent/10 rounded-lg hover:bg-accent/20 cursor-pointer transition-all"
                >
                  <p className="text-sm">{question}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Subjects Grid */}
        <div>
          <h3 className="font-bold mb-4">Fanlar</h3>
          <div className="grid grid-cols-2 gap-3">
            {subjects.map((subject) => {
              const Icon = subject.icon;
              return (
                <Card
                  key={subject.id}
                  className="p-6 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setSelectedSubject(subject.id)}
                >
                  <div
                    className={`w-12 h-12 bg-gradient-to-br ${subject.color} rounded-lg flex items-center justify-center mb-3`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold mb-1">{subject.name}</h4>
                  <p className="text-xs text-muted-foreground">{subject.topics} ta mavzu</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <Card className="p-4 bg-accent/10 border-accent/30">
          <p className="text-sm text-center">
            💡 DUYO sizga darslaringizda yordam beradi va tushuntirib beradi
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
