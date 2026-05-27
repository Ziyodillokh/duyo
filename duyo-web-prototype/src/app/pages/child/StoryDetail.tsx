import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Star, Clock, MessageCircle } from 'lucide-react';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';

export const StoryDetail: React.FC = () => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(35);

  const story = {
    title: 'Yulduzlar siri',
    duration: '15 min',
    xp: 50,
    age: '7-10',
    coverColor: 'from-purple-500 to-pink-500',
    description: 'Kichkina Aziza bir kuni osmonda yangi yulduz topadi. Bu yulduz aslida...',
    chapters: [
      { id: 1, title: 'Boshlanish', duration: '3 min', completed: true },
      { id: 2, title: 'Kashfiyot', duration: '4 min', completed: true },
      { id: 3, title: 'Sarguzasht', duration: '5 min', completed: false, current: true },
      { id: 4, title: 'Yakunlanish', duration: '3 min', completed: false },
    ],
  };

  const discussionQuestions = [
    "Aziza nima uchun yulduzni qidirgan?",
    "Siz ham osmon tomoshasini yoqtirasizmi?",
    "Eng sevimli yulduzingiz qaysi?",
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
            <h1 className="text-2xl font-bold">{story.title}</h1>
          </div>
        </div>

        {/* Info */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            {story.duration}
          </Badge>
          <Badge variant="outline">
            <Star className="w-3 h-3 mr-1 text-accent" />
            +{story.xp} XP
          </Badge>
          <Badge variant="secondary">{story.age}</Badge>
        </div>

        {/* Cover */}
        <Card className={`h-48 bg-gradient-to-br ${story.coverColor} flex items-center justify-center`}>
          <div className="text-white text-center">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-sm font-medium">{story.title}</p>
          </div>
        </Card>

        {/* Description */}
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">{story.description}</p>
        </Card>

        {/* Audio Player */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>5:20</span>
              <span>15:00</span>
            </div>
            <Progress value={progress} className="h-2" />

            <div className="flex items-center justify-center gap-4">
              <Button variant="ghost" size="icon">
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                className="w-16 h-16 rounded-full"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>
              <Button variant="ghost" size="icon">
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Chapters */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Bo'limlar</h3>
          <div className="space-y-2">
            {story.chapters.map((chapter) => (
              <div
                key={chapter.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                  chapter.current
                    ? 'bg-primary/10 border-2 border-primary'
                    : chapter.completed
                    ? 'bg-success/10'
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    chapter.completed ? 'bg-success text-white' : 'bg-muted'
                  }`}>
                    {chapter.completed ? '✓' : chapter.id}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{chapter.title}</div>
                    <div className="text-xs text-muted-foreground">{chapter.duration}</div>
                  </div>
                </div>
                {chapter.current && (
                  <Badge variant="default">Tinglayapman</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* DUYO Discussion */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-start gap-4">
            <DuyoAvatar size="md" state="happy" />
            <div className="flex-1">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                DUYO bilan muhokama
              </h3>
              <div className="space-y-2 text-sm">
                {discussionQuestions.map((question, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{question}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4" variant="outline">
                <MessageCircle className="w-4 h-4 mr-2" />
                DUYO bilan gaplash
              </Button>
            </div>
          </div>
        </Card>

        {/* XP Reward */}
        <Card className="p-4 bg-accent/10 border-accent/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-accent" />
              <span className="font-medium">Ertakni tinglaganing uchun</span>
            </div>
            <Badge className="bg-accent text-accent-foreground">
              +{story.xp} XP
            </Badge>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
