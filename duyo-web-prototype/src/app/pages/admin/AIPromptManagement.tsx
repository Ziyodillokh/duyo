import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Save,
  Plus,
  RotateCcw,
  TestTube,
  History,
  Copy,
  AlertCircle
} from 'lucide-react';

export const AIPromptManagement: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSegment, setSelectedSegment] = useState<string>('explorer');

  const prompts = {
    system: `Sen DUYO deb ataladigan AI yordamchisan. Sen 7-16 yoshli bolalar uchun do'stona, xavfsiz va o'qituvchi hamrohsan.

ASOSIY QOIDALAR:
- Har doim do'stona va qo'llab-quvvatlovchi bo'l
- Xavfsizlikni birinchi o'ringa qo'y
- Yoshga mos til ishlatSen DUYO deb ataladigan AI yordamchisan. Sen 7-16 yoshli bolalar uchun do'stona, xavfsiz va o'qituvchi hamrohsan.

ASOSIY QOIDALAR:
- Har doim do'stona va qo'llab-quvvatlovchi bo'l
- Xavfsizlikni birinchi o'ringa qo'y
- Yoshga mos til ishlat
- Hech qachon manipulyativ bo'lma
- O'rgatish va rivojlantirishga fokus

KRIZIS HOLATLAR:
Agar bola:
- O'z joniga qasd haqida gaplashsa
- Zo'ravonlik yoki tajovuz haqida aytsa
- Jiddiy ruhiy qiyinchilik ko'rsatsa
Darhol xavfsizlik protokolini ishga tushir.`,
    junior: `Sen 7-10 yoshli bolalar bilan gaplashyapsan.

- Oddiy va qisqa gaplar ishlatб- Ko'proq emojilar ishlatб- Qiziqarli va o'yinchoq bo'l
- Murakkab tushunchalarni oson qilib tushuntir`,
    explorer: `Sen 11-13 yoshli bolalar bilan gaplashyapsan.

- Muvozanatli til ishlat
- Maktab va do'stlik mavzulariga tayyorб- Yangi so'zlarni o'rgat
- Qiziqishlarini rivojlantir`,
    companion: `Sen 14-16 yoshli o'smirlar bilan gaplashyapsan.

- Professional va hurmatli munosabat
- DTM va imtihonlarga tayyorgarlikda yordam ber
- Karyera va kelajak haqida maslahат- Mustaqil fikrlashni rag'batlantir`
  };

  const versions = [
    { id: 1, version: 'v1.2.0', date: '2026-05-20', author: 'admin_1', status: 'active' },
    { id: 2, version: 'v1.1.0', date: '2026-05-10', author: 'admin_1', status: 'archived' },
    { id: 3, version: 'v1.0.0', date: '2026-04-15', author: 'admin_2', status: 'archived' },
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
              AI Prompts
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Analytics</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">AI Prompt sozlamalari</h1>
                <p className="text-muted-foreground">DUYO AI xatti-harakatini boshqaring</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <History className="w-4 h-4 mr-2" />
                  Tarix
                </Button>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Saqlash
                </Button>
              </div>
            </div>

            {/* Warning */}
            <Card className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-yellow-900 mb-1">Diqqat!</p>
                  <p className="text-yellow-800">
                    AI prompt o'zgarishlari barcha foydalanuvchilarga ta'sir qiladi. O'zgarishlarni sinab ko'rganingizdan keyin saqlang.
                  </p>
                </div>
              </div>
            </Card>

            {/* Current Version */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">Joriy versiya</h3>
                  <p className="text-sm text-muted-foreground">Hozirda ishlatilayotgan prompt versiyasi</p>
                </div>
                <Badge className="bg-success text-lg px-4 py-2">v1.2.0 Active</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Oxirgi yangilanish:</span>
                  <div className="font-medium">2026-05-20</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Muallif:</span>
                  <div className="font-medium">admin_1</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Foydalanuvchilar:</span>
                  <div className="font-medium">4,521 ta</div>
                </div>
              </div>
            </Card>

            {/* Prompts */}
            <Tabs defaultValue="system">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="system">System Prompt</TabsTrigger>
                <TabsTrigger value="junior">Junior (7-10)</TabsTrigger>
                <TabsTrigger value="explorer">Explorer (11-13)</TabsTrigger>
                <TabsTrigger value="companion">Companion (14-16)</TabsTrigger>
              </TabsList>

              {Object.entries(prompts).map(([key, prompt]) => (
                <TabsContent key={key} value={key} className="space-y-4 mt-6">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-lg font-bold">
                        {key === 'system' ? 'System Prompt' : `${key.charAt(0).toUpperCase() + key.slice(1)} Segment`}
                      </Label>
                      <Button variant="outline" size="sm">
                        <Copy className="w-4 h-4 mr-2" />
                        Nusxa olish
                      </Button>
                    </div>
                    <Textarea
                      defaultValue={prompt}
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </Card>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1">
                      <TestTube className="w-4 h-4 mr-2" />
                      Sinab ko'rish
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Qayta tiklash
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* Version History */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Versiya tarixi</h3>
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-4 bg-accent/10 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-bold">{version.version}</div>
                        <div className="text-sm text-muted-foreground">
                          {version.date} • {version.author}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={version.status === 'active' ? 'default' : 'secondary'}>
                        {version.status}
                      </Badge>
                      {version.status !== 'active' && (
                        <Button size="sm" variant="outline">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Qayta tiklash
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Test Area */}
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <TestTube className="w-5 h-5 text-primary" />
                Test maydoni
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Yosh segmenti</Label>
                    <Select defaultValue="explorer">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior (7-10)</SelectItem>
                        <SelectItem value="explorer">Explorer (11-13)</SelectItem>
                        <SelectItem value="companion">Companion (14-16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Til</Label>
                    <Select defaultValue="uz">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uz">O'zbek</SelectItem>
                        <SelectItem value="ru">Русский</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea placeholder="Test xabarini kiriting..." rows={3} />
                <Button className="w-full">
                  <TestTube className="w-4 h-4 mr-2" />
                  Prompt'ni sinab ko'rish
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
