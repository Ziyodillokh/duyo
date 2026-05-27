import React, { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { BottomNav } from '../../components/child/BottomNav';
import { Search, BookOpen, Music, GraduationCap, Globe, Play, Clock, Star } from 'lucide-react';

const poems = [
  { id: 1, title: 'Vatan', author: 'Abdulla Oripov', duration: '3 min', xp: 20, age: '11-13', hasAudio: true },
  { id: 2, title: 'Ona', author: 'Hamid Olimjon', duration: '2 min', xp: 15, age: '7-10', hasAudio: true },
  { id: 3, title: 'Bahor', author: 'Zulfiya', duration: '4 min', xp: 25, age: '11-13', hasAudio: true },
];

const stories = [
  { id: 1, title: 'Yulduzlar siri', duration: '15 min', xp: 50, age: '7-10', hasAudio: true },
  { id: 2, title: 'Kosmos sayohati', duration: '20 min', xp: 75, age: '11-13', hasAudio: true },
];

const lessons = [
  { id: 1, title: 'Matematika: Ko\'paytirish', subject: 'Matematika', age: '7-10', xp: 30 },
  { id: 2, title: 'Ingliz tili: Present Simple', subject: 'Ingliz tili', age: '11-13', xp: 40 },
  { id: 3, title: 'Geografiya: Qit\'alar', subject: 'Geografiya', age: '11-13', xp: 35 },
];

export const ChildLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4">
          <h1 className="text-2xl font-bold mb-4">Kutubxona</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Qidiruv..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="poems" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="poems">She'rlar</TabsTrigger>
            <TabsTrigger value="stories">Ertaklar</TabsTrigger>
            <TabsTrigger value="lessons">Darslar</TabsTrigger>
            <TabsTrigger value="language">Til</TabsTrigger>
          </TabsList>

          <TabsContent value="poems" className="space-y-4 mt-4">
            {poems.map((poem) => (
              <Card key={poem.id} className="p-4 hover:shadow-lg transition-all cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{poem.title}</h3>
                    <p className="text-sm text-muted-foreground">{poem.author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {poem.duration}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Star className="w-3 h-3 mr-1 text-accent" />
                        +{poem.xp} XP
                      </Badge>
                      {poem.hasAudio && (
                        <Play className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="stories" className="space-y-4 mt-4">
            {stories.map((story) => (
              <Card key={story.id} className="p-4 hover:shadow-lg transition-all cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{story.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {story.duration}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Star className="w-3 h-3 mr-1 text-accent" />
                        +{story.xp} XP
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {story.age}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="lessons" className="space-y-4 mt-4">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="p-4 hover:shadow-lg transition-all cursor-pointer">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{lesson.title}</h3>
                    <p className="text-sm text-muted-foreground">{lesson.subject}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Star className="w-3 h-3 mr-1 text-accent" />
                        +{lesson.xp} XP
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {lesson.age}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="language" className="space-y-4 mt-4">
            <Card className="p-6 text-center">
              <Globe className="w-16 h-16 mx-auto text-primary mb-4" />
              <h3 className="font-bold text-lg mb-2">Til o'yinlari</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ingliz, rus va o'zbek tillarini o'rganing
              </p>
              <Button className="w-full">Boshlash</Button>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Privacy note */}
        <Card className="p-4 bg-accent/10 border-accent/30">
          <p className="text-sm text-center text-muted-foreground">
            📚 Barcha kontentlar yoshingizga mos ravishda tanlanadi
          </p>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
