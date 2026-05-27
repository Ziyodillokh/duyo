import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Search,
  Filter,
  Download,
  Users,
  Crown,
  Clock,
  Shield,
  MoreVertical
} from 'lucide-react';

export const UsersList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const users = [
    { id: 1, name: 'Aziza', age: 12, segment: 'Explorer', subscription: 'Standard', lastActive: '5 min oldin', status: 'active', safety: 'green' },
    { id: 2, name: 'Sardor', age: 15, segment: 'Companion', subscription: 'Premium', lastActive: '12 min oldin', status: 'active', safety: 'green' },
    { id: 3, name: 'Malika', age: 8, segment: 'Junior', subscription: 'Free', lastActive: '25 min oldin', status: 'active', safety: 'green' },
    { id: 4, name: 'Jasur', age: 14, segment: 'Companion', subscription: 'Standard', lastActive: '1 soat oldin', status: 'active', safety: 'yellow' },
    { id: 5, name: 'Dilnoza', age: 10, segment: 'Explorer', subscription: 'Premium', lastActive: '3 soat oldin', status: 'active', safety: 'green' },
  ];

  const stats = [
    { label: 'Jami foydalanuvchilar', value: '4,521', icon: Users, color: 'text-blue-500' },
    { label: 'Faol (bugun)', value: '1,234', icon: Clock, color: 'text-green-500' },
    { label: 'Premium', value: '892', icon: Crown, color: 'text-accent' },
    { label: 'Xavfsizlik tekshiruv', value: '3', icon: Shield, color: 'text-orange-500' },
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
              Users
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer" onClick={() => navigate('/admin/content')}>
              Content
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Crisis Events</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Analytics</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Foydalanuvchilar</h1>
                <p className="text-muted-foreground">Barcha bolalar profillarini boshqaring</p>
              </div>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Card key={stat.label} className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div className="text-3xl font-bold">{stat.value}</div>
                  </Card>
                );
              })}
            </div>

            {/* Search and Filters */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Foydalanuvchi qidirish..."
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

            {/* Users Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-4">ID</th>
                      <th className="p-4">Ism</th>
                      <th className="p-4">Yosh</th>
                      <th className="p-4">Segment</th>
                      <th className="p-4">Obuna</th>
                      <th className="p-4">Oxirgi faollik</th>
                      <th className="p-4">Xavfsizlik</th>
                      <th className="p-4">Amallar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-accent/50 cursor-pointer">
                        <td className="p-4 text-muted-foreground">#{user.id}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-bold">
                              {user.name[0]}
                            </div>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </td>
                        <td className="p-4">{user.age} yosh</td>
                        <td className="p-4">
                          <Badge variant="outline">{user.segment}</Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.subscription === 'Premium' ? 'default' : 'secondary'}>
                            {user.subscription === 'Premium' && <Crown className="w-3 h-3 mr-1" />}
                            {user.subscription}
                          </Badge>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">{user.lastActive}</td>
                        <td className="p-4">
                          <Badge
                            className={
                              user.safety === 'green'
                                ? 'bg-success'
                                : user.safety === 'yellow'
                                ? 'bg-warning'
                                : 'bg-destructive'
                            }
                          >
                            {user.safety === 'green' ? '✓' : '⚠'}
                            {user.safety === 'green' ? ' Xavfsiz' : ' Tekshirish'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Button size="sm" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                5 dan 4,521 ta ko'rsatilmoqda
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Orqaga</Button>
                <Button variant="outline" size="sm">1</Button>
                <Button size="sm">2</Button>
                <Button variant="outline" size="sm">3</Button>
                <Button variant="outline" size="sm">Keyingi</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
