import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { BottomNav } from '../../components/child/BottomNav';
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, Crown } from 'lucide-react';

export const VoiceChat: React.FC = () => {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isPremium] = useState(false);

  const handleToggleMic = () => {
    if (!isPremium) {
      return;
    }
    setIsListening(!isListening);
    if (!isListening) {
      // Simulate listening
      setTimeout(() => {
        setTranscript("Salom DUYO! Men bugun maktabda matematika darsini o'tkazib yubordim...");
        setIsListening(false);
        // Simulate DUYO speaking
        setTimeout(() => {
          setIsSpeaking(true);
          setTimeout(() => {
            setIsSpeaking(false);
          }, 3000);
        }, 500);
      }, 2000);
    }
  };

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
        <div className="max-w-md mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="pt-4 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/child/chat')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Ovozli suhbat</h1>
          </div>

          {/* Premium Required */}
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="p-8 text-center max-w-sm">
              <Crown className="w-20 h-20 text-accent mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-4">Premium kerak</h2>
              <p className="text-muted-foreground mb-6">
                Ovozli suhbat funksiyasi faqat Premium obunada mavjud
              </p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate('/child/subscription')}
              >
                <Crown className="w-4 h-4 mr-2" />
                Premium'ga o'tish
              </Button>
            </Card>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/child/chat')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Ovozli suhbat</h1>
          </div>
          <Badge className="bg-accent text-accent-foreground">
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
        </div>

        {/* DUYO Avatar - Large */}
        <div className="flex justify-center py-8">
          <div className="relative">
            <DuyoAvatar
              size="xl"
              state={isSpeaking ? 'talking' : isListening ? 'listening' : 'idle'}
            />
            {isSpeaking && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 20 + 10}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <Card className="p-6 text-center">
          {isListening && (
            <div className="space-y-2">
              <Mic className="w-12 h-12 text-primary mx-auto animate-pulse" />
              <p className="font-bold text-lg">Tinglamoqdaman...</p>
              <p className="text-sm text-muted-foreground">Gaplashishni boshlang</p>
            </div>
          )}
          {isSpeaking && (
            <div className="space-y-2">
              <Volume2 className="w-12 h-12 text-accent mx-auto animate-pulse" />
              <p className="font-bold text-lg">DUYO gaplashmoqda...</p>
            </div>
          )}
          {!isListening && !isSpeaking && (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Mikrofonni bosing va gaplashni boshlang
              </p>
            </div>
          )}
        </Card>

        {/* Transcript */}
        {transcript && (
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Mic className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Siz:</p>
                <p>{transcript}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Microphone Button */}
        <div className="flex justify-center py-8">
          <button
            onClick={handleToggleMic}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${
              isListening
                ? 'bg-destructive shadow-lg shadow-destructive/50 animate-pulse'
                : 'bg-primary shadow-lg shadow-primary/50 hover:scale-105'
            }`}
          >
            {isListening ? (
              <MicOff className="w-12 h-12 text-white" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>
        </div>

        {/* Instructions */}
        <Card className="p-4 bg-accent/10 border-accent/30">
          <div className="space-y-2 text-sm text-center">
            <p className="font-medium">💡 Maslahat:</p>
            <p className="text-muted-foreground">
              Tiniq va sekin gaplashishga harakat qiling. DUYO sizni yaxshiroq tushunadi.
            </p>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
