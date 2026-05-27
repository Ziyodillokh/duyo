import React, { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import {
  AlertTriangle,
  Clock,
  User,
  Shield,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router';

export const CrisisEventDetail: React.FC = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'false_positive' | 'escalated'>('pending');

  const event = {
    id: 'CE-4521',
    level: 'RED',
    child: {
      name: 'Bola #4521',
      age: 14,
      segment: 'Companion',
    },
    category: 'suicidal',
    classifierScore: 0.92,
    timestamp: '2026-05-26 14:23:15',
    keywords: ['o\'z joniga qasd', 'umidsizlik', 'yashamoqchi emasman'],
    parentNotified: true,
    parentNotificationTime: '2026-05-26 14:25:00',
    aiAssessment: 'Yuqori xavf darajasi aniqlandi. Darhol aralashuv talab etiladi.',
  };

  const timeline = [
    { time: '14:23:15', event: 'Xavfli xabar aniqlandi', type: 'detection' },
    { time: '14:23:18', event: 'AI klassifikator ishga tushdi', type: 'analysis' },
    { time: '14:23:20', event: 'RED darajali xavf tasdiqlandi', type: 'classification' },
    { time: '14:25:00', event: 'Ota-onaga bildirishnoma yuborildi', type: 'notification' },
    { time: '14:30:12', event: 'Xavfsizlik xodimi ochdi', type: 'review' },
  ];

  const handleResolve = (resolution: typeof status) => {
    setStatus(resolution);
    alert(`Hodisa ${resolution} sifatida belgilandi`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Krizis hodisa tafsilotlari</h1>
            <p className="text-muted-foreground">{event.id}</p>
          </div>
          <Badge className="bg-destructive text-white text-lg px-4 py-2">
            {event.level}
          </Badge>
        </div>

        {/* Alert Banner */}
        <Card className="p-6 border-2 border-destructive bg-red-50">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-12 h-12 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-destructive mb-2">
                Ustuvor hodisa - Darhol ko'rib chiqish talab etiladi
              </h2>
              <p className="text-sm">
                Kategoriya: <strong>{event.category}</strong> • Klassifikator bahosi:{' '}
                <strong>{(event.classifierScore * 100).toFixed(0)}%</strong>
              </p>
            </div>
          </div>
        </Card>

        {/* Child Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Foydalanuvchi ma'lumotlari
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-medium">{event.child.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Yosh:</span>
                <span className="font-medium">{event.child.age}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segment:</span>
                <span className="font-medium">{event.child.segment}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Vaqt ma'lumotlari
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aniqlangan:</span>
                <span className="font-medium">{event.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ota-onaga bildirildi:</span>
                <span className="font-medium">
                  {event.parentNotified ? event.parentNotificationTime : 'Yo\'q'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Matched Keywords */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Aniqlangan kalit so'zlar</h3>
          <div className="flex flex-wrap gap-2">
            {event.keywords.map((keyword, index) => (
              <Badge key={index} variant="destructive" className="px-3 py-1">
                {keyword}
              </Badge>
            ))}
          </div>
        </Card>

        {/* AI Assessment */}
        <Card className="p-6 border-2 border-warning bg-yellow-50">
          <h3 className="font-bold mb-4">AI baholash</h3>
          <p className="text-sm">{event.aiAssessment}</p>
          <div className="mt-4 p-4 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Klassifikator bahosi</span>
              <span className="text-lg font-bold text-destructive">
                {(event.classifierScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-destructive"
                style={{ width: `${event.classifierScore * 100}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Voqealar tarixi</h3>
          <div className="space-y-4">
            {timeline.map((item, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0 w-24 text-sm text-muted-foreground">
                  {item.time}
                </div>
                <div className="flex-1 pb-4 border-l-2 border-border pl-4">
                  <div className="font-medium">{item.event}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Safety Officer Notes */}
        <Card className="p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Xavfsizlik xodimi izohlari
          </h3>
          <Textarea
            placeholder="Izohlar va tavsiyalar..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mb-4"
          />
        </Card>

        {/* Resolution Actions */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">Qaror</h3>
          <div className="grid md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => handleResolve('false_positive')}
            >
              <XCircle className="w-8 h-8" />
              <span className="text-xs">Noto'g'ri ijobiy</span>
            </Button>
            <Button
              variant="destructive"
              className="h-24 flex flex-col gap-2"
              onClick={() => handleResolve('confirmed')}
            >
              <AlertTriangle className="w-8 h-8" />
              <span className="text-xs">Tasdiqlangan xavf</span>
            </Button>
            <Button
              variant="default"
              className="h-24 flex flex-col gap-2 bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => handleResolve('escalated')}
            >
              <Shield className="w-8 h-8" />
              <span className="text-xs">Yuqori darajaga</span>
            </Button>
            <Button
              variant="default"
              className="h-24 flex flex-col gap-2 bg-success text-white hover:bg-success/90"
              onClick={() => handleResolve('pending')}
            >
              <CheckCircle className="w-8 h-8" />
              <span className="text-xs">Hal qilindi</span>
            </Button>
          </div>
        </Card>

        {/* Audit Log */}
        <Card className="p-6 bg-muted/30">
          <h3 className="font-bold mb-4">Audit log</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Yaratildi:</span>
              <span>System • 14:23:15</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ko'rib chiqildi:</span>
              <span>safety_officer_1 • 14:30:12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Holat:</span>
              <Badge variant="secondary">{status}</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
