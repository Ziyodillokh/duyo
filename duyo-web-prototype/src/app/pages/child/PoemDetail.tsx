import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, Play, Pause, Mic, Star, Clock } from 'lucide-react';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';

export const PoemDetail: React.FC = () => {
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(false);

  const poem = {
    title: 'Vatan',
    author: 'Abdulla Oripov',
    duration: '3 min',
    xp: 20,
    age: '11-13',
    language: "O'zbek",
    text: `Sen ulug'san, Vatanim, matonatsan, Vatanim,
Shu zaminda tug'ilganim sharafim,
Sen boriki baxtli umr kechirarman,
Chin dildan sevgan ona yurtim.`,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/child/library')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{poem.title}</h1>
            <p className="text-muted-foreground">{poem.author}</p>
          </div>
        </div>

        {/* Info */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            {poem.duration}
          </Badge>
          <Badge variant="outline">
            <Star className="w-3 h-3 mr-1 text-accent" />
            +{poem.xp} XP
          </Badge>
          <Badge variant="secondary">{poem.age}</Badge>
          <Badge variant="secondary">{poem.language}</Badge>
        </div>

        {/* Poem Text */}
        <Card className="p-8">
          <div className="text-center space-y-4">
            <div className="text-lg leading-relaxed whitespace-pre-line">
              {poem.text}
            </div>
          </div>
        </Card>

        {/* Audio Player */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <DuyoAvatar size="md" state={isPlaying ? 'talking' : 'idle'} />
            <div className="flex-1">
              <p className="font-medium">DUYO o'qib beradi</p>
              <div className="h-2 bg-accent/20 rounded-full mt-2">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: isPlaying ? '45%' : '0%' }}
                />
              </div>
            </div>
            <Button
              size="icon"
              variant="default"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>
          </div>
        </Card>

        {/* Practice */}
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="text-center space-y-4">
            <Mic className="w-12 h-12 text-primary mx-auto" />
            <div>
              <h3 className="font-bold text-lg mb-2">Men o'qiyman</h3>
              <p className="text-sm text-muted-foreground">
                She'rni o'qing va DUYO baholaydi
              </p>
            </div>
            <Button className="w-full" size="lg">
              <Mic className="w-4 h-4 mr-2" />
              Mashq boshlash
            </Button>
          </div>
        </Card>

        {/* XP Reward */}
        <Card className="p-4 bg-accent/10 border-accent/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-accent" />
              <span className="font-medium">She'rni o'qish uchun mukofot</span>
            </div>
            <Badge className="bg-accent text-accent-foreground">
              +{poem.xp} XP
            </Badge>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
