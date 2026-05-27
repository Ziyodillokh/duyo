import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import {
  ArrowLeft,
  Save,
  Upload,
  Play,
  Eye,
  Trash2
} from 'lucide-react';

export const PoemEditor: React.FC = () => {
  const navigate = useNavigate();
  const [isPublished, setIsPublished] = useState(false);
  const [audioFile, setAudioFile] = useState<string | null>(null);

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
              Poem Editor
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer" onClick={() => navigate('/admin/content')}>
              Content
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin/content')}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">She'r muharriri</h1>
                  <p className="text-muted-foreground">Yangi she'r qo'shish yoki tahrirlash</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Ko'rib chiqish
                </Button>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Saqlash
                </Button>
              </div>
            </div>

            {/* Form */}
            <div className="grid gap-6">
              {/* Basic Info */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Asosiy ma'lumotlar</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>She'r nomi</Label>
                      <Input placeholder="Masalan: Vatan" />
                    </div>
                    <div className="space-y-2">
                      <Label>Muallif</Label>
                      <Input placeholder="Masalan: Abdulla Oripov" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
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
                    <div className="space-y-2">
                      <Label>Yosh guruhi</Label>
                      <Select defaultValue="11-13">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7-10">7-10 (Junior)</SelectItem>
                          <SelectItem value="11-13">11-13 (Explorer)</SelectItem>
                          <SelectItem value="14-16">14-16 (Companion)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Davomiyligi (daqiqa)</Label>
                      <Input type="number" placeholder="3" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Content */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">She'r matni</h3>
                <Textarea
                  placeholder="She'r matnini kiriting..."
                  rows={12}
                  className="font-serif"
                />
              </Card>

              {/* Audio */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Audio fayl</h3>
                <div className="space-y-4">
                  {!audioFile ? (
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Audio faylni yuklang (MP3, WAV)
                      </p>
                      <Button variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Faylni tanlash
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Play className="w-8 h-8 text-primary" />
                        <div>
                          <div className="font-medium">audio_vatan.mp3</div>
                          <div className="text-sm text-muted-foreground">2.5 MB • 3:24</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Metadata */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Qo'shimcha ma'lumotlar</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Teglar</Label>
                    <Input placeholder="vatan, she'r, klassik (vergul bilan ajrating)" />
                  </div>
                  <div className="space-y-2">
                    <Label>XP mukofoti</Label>
                    <Input type="number" defaultValue="20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Litsenziya ma'lumotlari</Label>
                    <Textarea rows={3} placeholder="Mualliflik huquqi va litsenziya ma'lumotlari" />
                  </div>
                </div>
              </Card>

              {/* Publish Settings */}
              <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">Nashr sozlamalari</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Nashr qilish</div>
                    <div className="text-sm text-muted-foreground">
                      She'rni foydalanuvchilarga ko'rsatish
                    </div>
                  </div>
                  <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                </div>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => navigate('/admin/content')}>
                  Bekor qilish
                </Button>
                <Button className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Saqlash
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
