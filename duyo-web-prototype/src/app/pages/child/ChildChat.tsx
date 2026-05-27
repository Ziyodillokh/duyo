import React, { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import { Send, Mic } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'child' | 'duyo';
  timestamp: Date;
}

export const ChildChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Salom! Men DUYO. Endi birga o\'rganamiz, suhbatlashamiz va o\'samiz. Bugun nima qilmoqchisiz?',
      sender: 'duyo',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [dailyLimit] = useState({ used: 18, total: 30 });

  const suggestedReplies = [
    'Boshlaymiz',
    "Menga she'r o'qib ber",
    "Bugungi missiyani ko'rsat",
    'Men bilan gaplash',
  ];

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'child',
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate DUYO response
    setTimeout(() => {
      const duyoResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Bu ajoyib savol! Men sizga yordam berishga tayyorman. 😊',
        sender: 'duyo',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, duyoResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSuggestedReply = (reply: string) => {
    setInputText(reply);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-primary/5 to-accent/10">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 pt-safe">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <DuyoAvatar size="sm" state="happy" />
          <div className="flex-1">
            <div className="font-bold">DUYO</div>
            <div className="text-xs text-muted-foreground">Har doim online</div>
          </div>
          <Badge variant="outline" className="text-xs">
            {dailyLimit.used}/{dailyLimit.total} suhbat
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 max-w-md mx-auto w-full">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'child' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.sender === 'child'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border'
                }`}
              >
                <p>{message.text}</p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestedReplies.map((reply) => (
                <Badge
                  key={reply}
                  variant="outline"
                  className="px-4 py-2 cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleSuggestedReply(reply)}
                >
                  {reply}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-16 left-0 right-0 bg-card border-t border-border p-4 pb-safe">
        <div className="max-w-md mx-auto flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Xabar yozing..."
            className="flex-1"
          />
          <Button size="icon" variant="ghost">
            <Mic className="w-5 h-5" />
          </Button>
          <Button size="icon" onClick={handleSend}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
