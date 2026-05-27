import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { AgeSegment } from '../../contexts/UserContext';

export const AgeSelection: React.FC = () => {
  const navigate = useNavigate();
  const [age, setAge] = useState(10);

  const getAgeSegment = (age: number): AgeSegment => {
    if (age >= 7 && age <= 10) return 'junior';
    if (age >= 11 && age <= 13) return 'explorer';
    return 'companion';
  };

  const getSegmentLabel = (age: number) => {
    const segment = getAgeSegment(age);
    if (segment === 'junior') return 'Junior - Ko\'proq vizual va o\'yinlar';
    if (segment === 'explorer') return 'Explorer - Maktab yordam va missiyalar';
    return 'Companion - O\'quv va karyera maslahat';
  };

  const handleContinue = () => {
    localStorage.setItem('childAge', age.toString());
    localStorage.setItem('ageSegment', getAgeSegment(age));
    navigate('/interests-selection');
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <DuyoAvatar size="lg" state="happy" />

        <Card className="w-full p-8">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Necha yoshdasiz?</h2>
              <p className="text-muted-foreground">
                Bu men sizga mos kontentni taqdim etishimga yordam beradi
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setAge(Math.max(7, age - 1))}
                  disabled={age <= 7}
                >
                  -
                </Button>
                <div className="text-6xl font-bold text-primary min-w-[100px] text-center">
                  {age}
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setAge(Math.min(16, age + 1))}
                  disabled={age >= 16}
                >
                  +
                </Button>
              </div>

              <div className="text-center p-4 bg-accent/20 rounded-lg">
                <p className="text-sm font-medium text-foreground">
                  {getSegmentLabel(age)}
                </p>
              </div>
            </div>

            <Button onClick={handleContinue} className="w-full h-12">
              Davom etish
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
