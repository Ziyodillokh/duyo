import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Home, MessageCircle, Library, User, Package } from 'lucide-react';
import { cn } from '../../lib/utils';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Bosh sahifa', path: '/child/home' },
    { icon: MessageCircle, label: 'Suhbat', path: '/child/chat' },
    { icon: Library, label: 'Kutubxona', path: '/child/library' },
    { icon: User, label: 'Profil', path: '/child/profile' },
    { icon: Package, label: 'Inventar', path: '/child/inventory' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-all',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('w-6 h-6', isActive && 'scale-110')} />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
