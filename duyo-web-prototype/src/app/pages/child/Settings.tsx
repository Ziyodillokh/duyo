import React from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { BottomNav } from '../../components/child/BottomNav';
import {
  ArrowLeft,
  Globe,
  Bell,
  Mic,
  Shield,
  Users,
  Crown,
  HelpCircle,
  LogOut,
  ChevronRight,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const navigate = useNavigate();

  const settingsSections = [
    {
      title: 'Umumiy',
      items: [
        { icon: Globe, label: "Til", value: "O'zbek", hasArrow: true },
        { icon: Bell, label: 'Bildirishnomalar', toggle: true, enabled: true },
        { icon: Mic, label: 'Ovoz sozlamalari', hasArrow: true },
      ],
    },
    {
      title: 'Xavfsizlik',
      items: [
        { icon: Shield, label: 'Maxfiylik', hasArrow: true },
        { icon: Users, label: 'Ota-ona ulanishi', hasArrow: true, badge: 'Ulangan' },
      ],
    },
    {
      title: 'Obuna',
      items: [
        { icon: Crown, label: 'Obuna rejasi', value: "Do'st", hasArrow: true },
      ],
    },
    {
      title: 'Yordam',
      items: [
        { icon: HelpCircle, label: 'Yordam', hasArrow: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/child/profile')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Sozlamalar</h1>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground px-2">{section.title}</h3>
            <Card className="divide-y">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/10 transition-all"
                    onClick={() => item.hasArrow && navigate('/child/profile')}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {item.value && (
                        <span className="text-sm text-muted-foreground">{item.value}</span>
                      )}
                      {item.toggle !== undefined && (
                        <Switch checked={item.enabled} />
                      )}
                      {item.hasArrow && (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => navigate('/splash')}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Chiqish
        </Button>

        {/* App Info */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>DUYO v1.0.0</p>
          <p className="mt-1">© 2026 DUYO. Barcha huquqlar himoyalangan.</p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
