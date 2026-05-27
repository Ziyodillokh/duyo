import React from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Users,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Activity,
  Clock,
  Zap,
  Shield,
  Crown,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const stats = [
    { label: 'DAU', value: '1,234', icon: Users, color: 'text-blue-500' },
    { label: 'MAU', value: '8,567', icon: Users, color: 'text-green-500' },
    { label: 'Faol bolalar', value: '4,521', icon: Activity, color: 'text-purple-500' },
    { label: 'Faol ota-onalar', value: '3,890', icon: Users, color: 'text-orange-500' },
    { label: 'AI xabarlar (bugun)', value: '12,456', icon: MessageCircle, color: 'text-primary' },
    { label: 'Krizis hodisalar', value: '3', icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Free → Paid', value: '12.4%', icon: TrendingUp, color: 'text-success' },
    { label: 'Daromad (oy)', value: '145.2M', icon: DollarSign, color: 'text-accent' },
  ];

  const crisisEvents = [
    { id: 1, level: 'RED', child: 'Bola #4521', age: 14, category: 'suicidal', time: '10 daq oldin', reviewed: false },
    { id: 2, level: 'ORANGE', child: 'Bola #3421', age: 13, category: 'self-harm', time: '1 soat oldin', reviewed: true },
    { id: 3, level: 'YELLOW', child: 'Bola #2341', age: 11, category: 'severe distress', time: '3 soat oldin', reviewed: true },
  ];

  const recentUsers = [
    { id: 1, name: 'Aziza', age: 12, segment: 'Explorer', subscription: 'Standard', lastActive: '5 min oldin' },
    { id: 2, name: 'Sardor', age: 15, segment: 'Companion', subscription: 'Premium', lastActive: '12 min oldin' },
    { id: 3, name: 'Malika', age: 8, segment: 'Junior', subscription: 'Free', lastActive: '25 min oldin' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Sidebar placeholder (in a real app this would be a component) */}
      <div className="flex">
        <div className="w-64 min-h-screen bg-card border-r border-border p-6">
          <h2 className="text-2xl font-bold mb-8 text-primary">DUYO Admin</h2>
          <nav className="space-y-2 text-sm">
            <div className="font-bold py-2 px-3 bg-primary text-primary-foreground rounded-lg">
              Dashboard
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Users</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Children</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Conversations</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer text-destructive font-bold">
              Crisis Events
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Content</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">AI Prompts</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Subscriptions</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Analytics</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card key={index} className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </Card>
              );
            })}
          </div>

          {/* Crisis Events - Priority Section */}
          <Card className="p-6 mb-8 border-2 border-destructive">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                Krizis hodisalar (ustuvor)
              </h2>
              <Badge variant="destructive" className="text-lg px-4 py-1">
                3 ta yangi
              </Badge>
            </div>
            <div className="space-y-3">
              {crisisEvents.map((event) => (
                <div
                  key={event.id}
                  className={`p-4 rounded-lg border-2 ${
                    event.level === 'RED'
                      ? 'bg-red-50 border-red-500'
                      : event.level === 'ORANGE'
                      ? 'bg-orange-50 border-orange-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge
                        className={`${
                          event.level === 'RED'
                            ? 'bg-destructive'
                            : event.level === 'ORANGE'
                            ? 'bg-orange-500'
                            : 'bg-warning'
                        } text-white`}
                      >
                        {event.level}
                      </Badge>
                      <div>
                        <div className="font-bold">{event.child}</div>
                        <div className="text-sm text-muted-foreground">
                          {event.age} yosh • {event.category}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {event.time}
                      </div>
                      {event.reviewed ? (
                        <Badge variant="secondary" className="bg-success text-white">
                          ✓ Ko'rib chiqilgan
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Ko'rib chiqilmagan</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Users */}
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Oxirgi faol foydalanuvchilar
            </h2>
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-accent/10 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold">
                      {user.name[0]}
                    </div>
                    <div>
                      <div className="font-bold">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.age} yosh • {user.segment}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">
                      {user.subscription === 'Premium' && <Crown className="w-3 h-3 mr-1" />}
                      {user.subscription}
                    </Badge>
                    <div className="text-sm text-muted-foreground">{user.lastActive}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* System Health */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">AI xizmat</span>
                <Shield className="w-5 h-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-success">Aktiv</div>
              <div className="text-xs text-muted-foreground mt-1">P95: 234ms</div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Xato darajasi</span>
                <Zap className="w-5 h-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-success">0.02%</div>
              <div className="text-xs text-muted-foreground mt-1">So'nggi 24 soat</div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Uptime</span>
                <Activity className="w-5 h-5 text-success" />
              </div>
              <div className="text-2xl font-bold text-success">99.98%</div>
              <div className="text-xs text-muted-foreground mt-1">So'nggi 30 kun</div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
