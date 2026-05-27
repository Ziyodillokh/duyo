import React from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { UserRole } from '../../contexts/UserContext';

export const UserTypeSelection: React.FC = () => {
  const navigate = useNavigate();

  const handleSelection = (role: UserRole) => {
    localStorage.setItem('userRole', role);
    if (role === 'child') {
      navigate('/phone-auth');
    } else if (role === 'parent') {
      navigate('/parent/login');
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <DuyoAvatar size="lg" state="happy" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Salom!</h1>
          <p className="text-muted-foreground">Siz kimsiz?</p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <Card
            className="p-8 cursor-pointer hover:border-primary hover:shadow-lg transition-all"
            onClick={() => handleSelection('child')}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="text-6xl">👧🏻</div>
              <span className="text-xl font-medium">Men bola</span>
            </div>
          </Card>

          <Card
            className="p-8 cursor-pointer hover:border-primary hover:shadow-lg transition-all"
            onClick={() => handleSelection('parent')}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="text-6xl">👨‍👩‍👧‍👦</div>
              <span className="text-xl font-medium">Men ota-ona</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
