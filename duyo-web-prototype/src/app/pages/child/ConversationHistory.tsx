import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, Search, MessageCircle, Clock, Shield } from 'lucide-react';

interface Conversation {
  id: string;
  date: string;
  preview: string;
  messageCount: number;
  duration: string;
}

export const ConversationHistory: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const conversations: Conversation[] = [
    {
      id: '1',
      date: "Bugun, 14:30",
      preview: "Bugun maktabda qanday o'tdi? Men matematika darsida...",
      messageCount: 12,
      duration: "8 daqiqa",
    },
    {
      id: '2',
      date: "Kecha, 16:45",
      preview: "DUYO, men she'rni yod olishda yordam ber. Vatan she'ri...",
      messageCount: 8,
      duration: "5 daqiqa",
    },
    {
      id: '3',
      date: "Kecha, 10:20",
      preview: "Do'stim bilan bahslashdim. Qanday qilsam to'g'ri...",
      messageCount: 15,
      duration: "12 daqiqa",
    },
    {
      id: '4',
      date: "2 kun oldin",
      preview: "Ingliz tilida savol. 'Present Simple' qanday ishlaydi?",
      messageCount: 10,
      duration: "6 daqiqa",
    },
    {
      id: '5',
      date: "3 kun oldin",
      preview: "Bugun juda charchagandek his qilyapman...",
      messageCount: 20,
      duration: "15 daqiqa",
    },
  ];

  const groupedConversations = {
    "Bugun": conversations.filter(c => c.date.includes("Bugun")),
    "Kecha": conversations.filter(c => c.date.includes("Kecha")),
    "Bu hafta": conversations.filter(c => c.date.includes("kun oldin")),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/child/chat')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Suhbat tarixi</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Suhbatlarni qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Privacy Notice */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3 items-start">
            <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Maxfiylik</p>
              <p className="text-muted-foreground">
                Suhbatlaringiz maxfiy saqlanadi va faqat siz ko'ra olasiz
              </p>
            </div>
          </div>
        </Card>

        {/* Conversations List */}
        <div className="space-y-6">
          {Object.entries(groupedConversations).map(([group, items]) => (
            items.length > 0 && (
              <div key={group} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground px-2">{group}</h3>
                <div className="space-y-3">
                  {items.map((conversation) => (
                    <Card
                      key={conversation.id}
                      className="p-4 cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => navigate('/child/chat')}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-primary" />
                            <span className="text-sm text-muted-foreground">
                              {conversation.date}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {conversation.messageCount} xabar
                          </Badge>
                        </div>
                        <p className="text-sm line-clamp-2">{conversation.preview}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{conversation.duration}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        {/* No Results */}
        {searchQuery && conversations.length === 0 && (
          <Card className="p-12 text-center">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-bold text-lg mb-2">Hech narsa topilmadi</h3>
            <p className="text-sm text-muted-foreground">
              Boshqa kalit so'z bilan qidirib ko'ring
            </p>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
