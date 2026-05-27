import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { AgeSegment } from '../../contexts/UserContext';

const interestsByAge = {
  junior: [
    'Rasm chizish',
    'Hayvonlar',
    'Ertaklar',
    'Kosmos',
    'Super qahramonlar',
    "O'yinlar",
    'Musiqa',
    'Tabiat',
  ],
  explorer: [
    'Sport',
    'Kitob',
    'Fan',
    'Ijod',
    "Do'stlar",
    'Musiqa',
    "O'yinlar",
    'Kosmos',
    "Til o'rganish",
  ],
  companion: [
    'Kasb tanlash',
    'Kitob',
    'Musiqa',
    'Dizayn',
    'Kod yozish',
    'Ingliz tili',
    'DTM',
    'IELTS',
    'Ijodiyot',
    'Matematika',
    'Fizika',
    'Kimyo',
    'Biologiya',
    'Geometriya',
    'Tarix',
    'Geografiya',
  ],
};

export const InterestsSelection: React.FC = () => {
  const navigate = useNavigate();
  const [ageSegment, setAgeSegment] = useState<AgeSegment>('explorer');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    const segment = (localStorage.getItem('ageSegment') as AgeSegment) || 'explorer';
    setAgeSegment(segment);
  }, []);

  const interests = interestsByAge[ageSegment];

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleContinue = () => {
    localStorage.setItem('interests', JSON.stringify(selectedInterests));
    navigate('/avatar-builder');
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start p-6 bg-gradient-to-br from-primary/5 to-accent/10 overflow-auto">
      <div className="w-full max-w-md flex flex-col items-center gap-8 py-8">
        <DuyoAvatar size="lg" state="happy" />

        <Card className="w-full p-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Sizni nima qiziqtiradi?</h2>
              <p className="text-muted-foreground">Kamida 3 ta tanlang</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {interests.map((interest) => (
                <Badge
                  key={interest}
                  variant={selectedInterests.includes(interest) ? 'default' : 'outline'}
                  className={`px-6 py-3 text-sm cursor-pointer transition-all ${
                    selectedInterests.includes(interest)
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:border-primary'
                  }`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Badge>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground">
              {selectedInterests.length} ta tanlandi
            </div>

            <Button
              onClick={handleContinue}
              disabled={selectedInterests.length < 3}
              className="w-full h-12"
            >
              Davom etish
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
