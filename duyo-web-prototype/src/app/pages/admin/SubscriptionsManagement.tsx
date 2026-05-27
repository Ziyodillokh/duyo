import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Crown,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Search,
  Filter,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export const SubscriptionsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const stats = [
    { label: 'Jami obunalar', value: '3,629', change: '+12%', trend: 'up', icon: Users },
    { label: 'Free', value: '2,737', percentage: '75%', icon: Users },
    { label: 'Standard', value: '651', percentage: '18%', icon: Crown },
    { label: 'Premium', value: '241', percentage: '7%', icon: Crown },
    { label: 'MRR', value: '32.8M', change: '+18%', trend: 'up', icon: DollarSign },
    { label: 'Conversion', value: '12.4%', change: '+1.2%', trend: 'up', icon: TrendingUp },
    { label: 'Churn', value: '3.2%', change: '-0.5%', trend: 'up', icon: TrendingDown },
    { label: 'Trial users', value: '156', change: 'Active', trend: 'neutral', icon: Calendar },
  ];

  const activeSubscriptions = [
    { id: 1, user: 'Aziza', plan: 'Standard', price: '29,000', period: 'monthly', startDate: '2026-05-01', nextBilling: '2026-06-01', status: 'active' },
    { id: 2, user: 'Sardor', plan: 'Premium', price: '59,000', period: 'monthly', startDate: '2026-04-15', nextBilling: '2026-05-15', status: 'active' },
    { id: 3, user: 'Malika', plan: 'Standard', price: '290,000', period: 'yearly', startDate: '2026-01-10', nextBilling: '2027-01-10', status: 'active' },
  ];

  const cancelledSubscriptions = [
    { id: 4, user: 'Jasur', plan: 'Standard', cancelDate: '2026-05-20', reason: 'Price', feedback: 'Qimmat' },
    { id: 5, user: 'Dilnoza', plan: 'Premium', cancelDate: '2026-05-18', reason: 'Features', feedback: 'Kerakli funksiya yo\'q' },
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
              Subscriptions
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Payments</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Analytics</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Obunalar boshqaruvi</h1>
                <p className="text-muted-foreground">Obunalar va to'lovlarni kuzatib boring</p>
              </div>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                So'nggi 30 kun
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label} className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    {stat.change && (
                      <div className="flex items-center gap-1">
                        {stat.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : stat.trend === 'down' ? (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        ) : null}
                        <span className={`text-sm ${
                          stat.trend === 'up' ? 'text-success' :
                          stat.trend === 'down' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`}>
                          {stat.change}
                        </span>
                      </div>
                    )}
                    {stat.percentage && (
                      <div className="text-sm text-muted-foreground">{stat.percentage} jami</div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Plan Breakdown */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Rejalar bo'yicha taqsimot</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Free</span>
                    <span className="text-sm text-muted-foreground">2,737 (75%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400" style={{ width: '75%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      Standard
                    </span>
                    <span className="text-sm text-muted-foreground">651 (18%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '18%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <Crown className="w-4 h-4 text-accent" />
                      Premium
                    </span>
                    <span className="text-sm text-muted-foreground">241 (7%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: '7%' }} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Search */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Obuna qidirish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtr
              </Button>
            </div>

            {/* Subscriptions Tabs */}
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Faol obunalar</TabsTrigger>
                <TabsTrigger value="trial">Sinov</TabsTrigger>
                <TabsTrigger value="cancelled">Bekor qilingan</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4 mt-6">
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="p-4">Foydalanuvchi</th>
                          <th className="p-4">Reja</th>
                          <th className="p-4">Narx</th>
                          <th className="p-4">Davr</th>
                          <th className="p-4">Boshlangan</th>
                          <th className="p-4">Keyingi to'lov</th>
                          <th className="p-4">Holat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSubscriptions.map((sub) => (
                          <tr key={sub.id} className="border-b hover:bg-accent/50">
                            <td className="p-4 font-medium">{sub.user}</td>
                            <td className="p-4">
                              <Badge variant={sub.plan === 'Premium' ? 'default' : 'secondary'}>
                                {sub.plan === 'Premium' && <Crown className="w-3 h-3 mr-1" />}
                                {sub.plan}
                              </Badge>
                            </td>
                            <td className="p-4 font-medium">{sub.price} so'm</td>
                            <td className="p-4 text-muted-foreground">
                              {sub.period === 'monthly' ? 'Oylik' : 'Yillik'}
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{sub.startDate}</td>
                            <td className="p-4 text-sm text-muted-foreground">{sub.nextBilling}</td>
                            <td className="p-4">
                              <Badge className="bg-success">Faol</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="cancelled" className="space-y-4 mt-6">
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="p-4">Foydalanuvchi</th>
                          <th className="p-4">Reja</th>
                          <th className="p-4">Bekor qilingan</th>
                          <th className="p-4">Sabab</th>
                          <th className="p-4">Fikr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cancelledSubscriptions.map((sub) => (
                          <tr key={sub.id} className="border-b hover:bg-accent/50">
                            <td className="p-4 font-medium">{sub.user}</td>
                            <td className="p-4">
                              <Badge variant="outline">{sub.plan}</Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{sub.cancelDate}</td>
                            <td className="p-4">
                              <Badge variant="secondary">{sub.reason}</Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">{sub.feedback}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Churn Alert */}
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-yellow-900 mb-1">Churn ogohlantirish</p>
                  <p className="text-yellow-800">
                    So'nggi 7 kunda 23 ta obuna bekor qilindi. Asosiy sabab: narx (14 ta)
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
