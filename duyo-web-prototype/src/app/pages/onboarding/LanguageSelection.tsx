import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';

type Language = 'uz' | 'ru' | 'en';

export const LanguageSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('uz');

  const languages = [
    { code: 'uz' as Language, label: "O'zbek", flag: '🇺🇿' },
    { code: 'ru' as Language, label: 'Русский', flag: '🇷🇺' },
    { code: 'en' as Language, label: 'English', flag: '🇬🇧' },
  ];

  const handleContinue = () => {
    localStorage.setItem('language', selectedLanguage);
    navigate('/user-type');
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <DuyoAvatar size="lg" state="happy" />
        <h1 className="text-2xl font-bold text-foreground">Tilni tanlang</h1>

        <div className="w-full flex flex-col gap-3">
          {languages.map((lang) => (
            <Card
              key={lang.code}
              className={`p-6 cursor-pointer transition-all ${
                selectedLanguage === lang.code
                  ? 'border-primary border-2 shadow-lg bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedLanguage(lang.code)}
            >
              <div className="flex items-center gap-4">
                <span className="text-4xl">{lang.flag}</span>
                <span className="text-xl font-medium">{lang.label}</span>
              </div>
            </Card>
          ))}
        </div>

        <Button
          onClick={handleContinue}
          className="w-full h-14 text-lg"
          size="lg"
        >
          Davom etish
        </Button>
      </div>
    </div>
  );
};
