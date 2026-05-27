import React from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageCircle,
  DollarSign,
  Activity,
  BarChart3,
  Calendar
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();

  const kpis = [
    { label: 'DAU', value: '1,234', change: '+12%', trend: 'up', icon: Users },
    { label: 'MAU', value: '8,567', change: '+8%', trend: 'up', icon: Users },
    { label: 'AI xabarlar', value: '45.2K', change: '+15%', trend: 'up', icon: MessageCircle },
    { label: 'Daromad (oy)', value: '145.2M', change: '+22%', trend: 'up', icon: DollarSign },
    { label: 'Retention D1', value: '76%', change: '+3%', trend: 'up', icon: Activity },
    { label: 'Retention D7', value: '42%', change: '-2%', trend: 'down', icon: Activity },
    { label: 'Conversion', value: '12.4%', change: '+1.2%', trend: 'up', icon: TrendingUp },
    { label: 'Churn', value: '3.2%', change: '-0.5%', trend: 'up', icon: TrendingDown },
  ];

  const retentionData = [
    { day: 'D1', value: 76 },
    { day: 'D7', value: 42 },
    { day: 'D14', value: 28 },
    { day: 'D30', value: 18 },
  ];

  const ageDistribution = [
    { segment: 'Junior (7-10)', users: 1245, percentage: 28 },
    { segment: 'Explorer (11-13)', users: 2156, percentage: 48 },
    { segment: 'Companion (14-16)', users: 1120, percentage: 24 },
  ];

  const languageDistribution = [
    { language: "O'zbek", users: 3521, percentage: 78 },
    { language: 'Русский', users: 723, percentage: 16 },
    { language: 'English', users: 277, percentage: 6 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 min-h-screen bg-card border-r border-border p-6">
          <h2 className="text-2xl font-bold mb-8 text-primary">DUYO Admin</h2>
          <nav className="space-y-2 text-sm">
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
              Dashboard
            </div>
            <div className="py-2 px-3 bg-primary text-primary-foreground rounded-lg font-bold">
              Analytics
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Content</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Users</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
                <p className="text-muted-foreground">To'liq statistika va tahlil</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">So'nggi 30 kun</span>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
              {kpis.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <Card key={kpi.label} className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{kpi.label}</span>
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{kpi.value}</div>
                    <div className="flex items-center gap-1">
                      {kpi.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-destructive" />
                      )}
                      <span className={`text-sm ${kpi.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
                        {kpi.change}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-2 gap-6">
              {/* Retention */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Retention (Ushlash)
                </h3>
                <div className="space-y-3">
                  {retentionData.map((item) => (
                    <div key={item.day} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.day}</span>
                        <span className="text-muted-foreground">{item.value}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Age Distribution */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Yosh bo'yicha taqsimot</h3>
                <div className="space-y-4">
                  {ageDistribution.map((item) => (
                    <div key={item.segment} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{item.segment}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{item.users}</span>
                          <Badge variant="secondary">{item.percentage}%</Badge>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-2 gap-6">
              {/* Language Distribution */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Til bo'yicha taqsimot</h3>
                <div className="space-y-4">
                  {languageDistribution.map((item) => (
                    <div key={item.language} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <span className="text-xl">{item.language === "O'zbek" ? '🇺🇿' : item.language === 'Русский' ? '🇷🇺' : '🇬🇧'}</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.language}</div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-bold">{item.users}</div>
                        <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* AI Usage */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">AI foydalanish</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">Kunlik o'rtacha</div>
                      <div className="text-2xl font-bold">1,507</div>
                    </div>
                    <MessageCircle className="w-10 h-10 text-blue-500" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">O'rtacha javob vaqti</div>
                      <div className="text-2xl font-bold">1.2s</div>
                    </div>
                    <TrendingUp className="w-10 h-10 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">Ovozli suhbatlar</div>
                      <div className="text-2xl font-bold">234</div>
                    </div>
                    <Activity className="w-10 h-10 text-purple-500" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Content Stats */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Kontent ko'rilishi</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-accent/10 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">She'rlar</div>
                  <div className="text-2xl font-bold mb-1">12,456</div>
                  <div className="text-xs text-success">+18% o'sish</div>
                </div>
                <div className="p-4 bg-accent/10 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Ertaklar</div>
                  <div className="text-2xl font-bold mb-1">8,234</div>
                  <div className="text-xs text-success">+12% o'sish</div>
                </div>
                <div className="p-4 bg-accent/10 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Darslar</div>
                  <div className="text-2xl font-bold mb-1">15,678</div>
                  <div className="text-xs text-success">+25% o'sish</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
