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
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard
} from 'lucide-react';

export const PaymentsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const stats = [
    { label: 'Jami daromad (oy)', value: '145.2M', change: '+22%', icon: DollarSign },
    { label: 'Muvaffaqiyatli', value: '892', percentage: '96%', icon: CheckCircle },
    { label: 'Xato', value: '34', percentage: '4%', icon: XCircle },
    { label: 'Kutilmoqda', value: '12', icon: Clock },
  ];

  const paymentMethods = [
    { name: 'Click', transactions: 456, revenue: '62.4M', percentage: 43 },
    { name: 'Payme', transactions: 312, revenue: '45.8M', percentage: 32 },
    { name: 'Uzcard', transactions: 89, revenue: '18.2M', percentage: 13 },
    { name: 'Humo', transactions: 23, revenue: '9.8M', percentage: 7 },
    { name: 'Visa/MC', transactions: 12, revenue: '9.0M', percentage: 6 },
  ];

  const recentPayments = [
    { id: 'PAY-1234', user: 'Aziza', amount: '29,000', method: 'Click', plan: 'Standard', date: '2026-05-26 14:23', status: 'success' },
    { id: 'PAY-1235', user: 'Sardor', amount: '59,000', method: 'Payme', plan: 'Premium', date: '2026-05-26 14:15', status: 'success' },
    { id: 'PAY-1236', user: 'Malika', amount: '29,000', method: 'Uzcard', plan: 'Standard', date: '2026-05-26 13:45', status: 'failed' },
    { id: 'PAY-1237', user: 'Jasur', amount: '290,000', method: 'Click', plan: 'Standard (yearly)', date: '2026-05-26 12:30', status: 'success' },
    { id: 'PAY-1238', user: 'Dilnoza', amount: '59,000', method: 'Visa/MC', plan: 'Premium', date: '2026-05-26 11:20', status: 'pending' },
  ];

  const failedPayments = [
    { id: 'PAY-1236', user: 'Malika', amount: '29,000', method: 'Uzcard', reason: 'Insufficient funds', date: '2026-05-26 13:45' },
    { id: 'PAY-1220', user: 'Kamol', amount: '59,000', method: 'Payme', reason: 'Card expired', date: '2026-05-25 18:30' },
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
              Payments
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Subscriptions</div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Analytics</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">To'lovlar paneli</h1>
                <p className="text-muted-foreground">To'lovlar va tranzaksiyalar</p>
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
                      <Icon className={`w-5 h-5 ${
                        stat.icon === CheckCircle ? 'text-success' :
                        stat.icon === XCircle ? 'text-destructive' :
                        stat.icon === Clock ? 'text-warning' :
                        'text-primary'
                      }`} />
                    </div>
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    {stat.change && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-success" />
                        <span className="text-sm text-success">{stat.change}</span>
                      </div>
                    )}
                    {stat.percentage && (
                      <div className="text-sm text-muted-foreground">{stat.percentage} jami</div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Payment Methods */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">To'lov usullari bo'yicha</h3>
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div key={method.name} className="flex items-center gap-4">
                    <div className="w-32 font-medium">{method.name}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">
                          {method.transactions} ta • {method.revenue} so'm
                        </span>
                        <span className="text-sm font-medium">{method.percentage}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Search */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="To'lov qidirish (ID, foydalanuvchi)..."
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

            {/* Recent Payments */}
            <Card>
              <div className="p-6 border-b">
                <h3 className="font-bold text-lg">Oxirgi to'lovlar</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-4">ID</th>
                      <th className="p-4">Foydalanuvchi</th>
                      <th className="p-4">Summa</th>
                      <th className="p-4">Usul</th>
                      <th className="p-4">Reja</th>
                      <th className="p-4">Sana</th>
                      <th className="p-4">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-accent/50">
                        <td className="p-4 font-mono text-sm text-muted-foreground">{payment.id}</td>
                        <td className="p-4 font-medium">{payment.user}</td>
                        <td className="p-4 font-bold">{payment.amount} so'm</td>
                        <td className="p-4">
                          <Badge variant="outline">
                            <CreditCard className="w-3 h-3 mr-1" />
                            {payment.method}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{payment.plan}</td>
                        <td className="p-4 text-sm text-muted-foreground">{payment.date}</td>
                        <td className="p-4">
                          <Badge
                            className={
                              payment.status === 'success'
                                ? 'bg-success'
                                : payment.status === 'failed'
                                ? 'bg-destructive'
                                : 'bg-warning'
                            }
                          >
                            {payment.status === 'success' ? (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Muvaffaqiyatli</>
                            ) : payment.status === 'failed' ? (
                              <><XCircle className="w-3 h-3 mr-1" /> Xato</>
                            ) : (
                              <><Clock className="w-3 h-3 mr-1" /> Kutilmoqda</>
                            )}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Failed Payments Alert */}
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-900 mb-3">Xatolar</p>
                  <div className="space-y-2">
                    {failedPayments.map((payment) => (
                      <div key={payment.id} className="text-sm bg-white p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{payment.user} • {payment.amount} so'm</span>
                          <Badge variant="outline">{payment.method}</Badge>
                        </div>
                        <div className="text-red-700">Sabab: {payment.reason}</div>
                        <div className="text-muted-foreground">{payment.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
