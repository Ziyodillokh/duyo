import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Upload,
  MessageCircle
} from 'lucide-react';

export const StoryEditor: React.FC = () => {
  const navigate = useNavigate();
  const [isPublished, setIsPublished] = useState(false);
  const [chapters, setChapters] = useState([
    { id: 1, title: 'Boshlanish', duration: '3 min' },
    { id: 2, title: 'Kashfiyot', duration: '4 min' },
  ]);

  const addChapter = () => {
    setChapters([...chapters, { id: chapters.length + 1, title: '', duration: '' }]);
  };

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
              Story Editor
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
                  <h1 className="text-3xl font-bold">Ertak muharriri</h1>
                  <p className="text-muted-foreground">Yangi ertak qo'shish yoki tahrirlash</p>
                </div>
              </div>
              <Button>
                <Save className="w-4 h-4 mr-2" />
                Saqlash
              </Button>
            </div>

            {/* Basic Info */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Asosiy ma'lumotlar</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Ertak nomi</Label>
                  <Input placeholder="Masalan: Yulduzlar siri" />
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
                    <Select defaultValue="7-10">
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
                    <Label>XP mukofoti</Label>
                    <Input type="number" defaultValue="50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Qisqa tavsif</Label>
                  <Textarea rows={3} placeholder="Ertak haqida qisqacha..." />
                </div>
              </div>
            </Card>

            {/* Chapters */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Bo'limlar</h3>
                <Button onClick={addChapter} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Bo'lim qo'shish
                </Button>
              </div>
              <div className="space-y-3">
                {chapters.map((chapter, index) => (
                  <div key={chapter.id} className="flex gap-3 items-start p-4 bg-accent/10 rounded-lg">
                    <GripVertical className="w-5 h-5 text-muted-foreground mt-2 cursor-move" />
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input placeholder={`Bo'lim ${index + 1} nomi`} defaultValue={chapter.title} />
                        <Input placeholder="Davomiyligi" defaultValue={chapter.duration} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Upload className="w-4 h-4 mr-2" />
                          Audio yuklash
                        </Button>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Discussion Questions */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">DUYO muhokama savollari</h3>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Savol 1" defaultValue="Bosh qahramon nima qildi?" />
                  <Button size="sm" variant="ghost">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Savol 2" defaultValue="Sizga eng yoqqan qismi?" />
                  <Button size="sm" variant="ghost">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Savol qo'shish
                </Button>
              </div>
            </Card>

            {/* Cover Image */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Muqova rasmi</h3>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Ertak muqovasi (PNG, JPG)
                </p>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Rasm yuklash
                </Button>
              </div>
            </Card>

            {/* Publish */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Nashr qilish</div>
                  <div className="text-sm text-muted-foreground">
                    Ertakni foydalanuvchilarga ko'rsatish
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
  );
};
