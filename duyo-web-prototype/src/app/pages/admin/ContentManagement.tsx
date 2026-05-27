import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Search,
  Plus,
  BookOpen,
  Music,
  GraduationCap,
  Edit,
  Trash2,
  Eye,
  Filter,
  Download,
  Upload
} from 'lucide-react';

export const ContentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const poems = [
    { id: 1, title: 'Vatan', author: 'Abdulla Oripov', language: 'uz', age: '11-13', audio: true, published: true },
    { id: 2, title: 'Ona', author: 'Hamid Olimjon', language: 'uz', age: '7-10', audio: true, published: true },
    { id: 3, title: 'Bahor', author: 'Zulfiya', language: 'uz', age: '11-13', audio: false, published: false },
  ];

  const stories = [
    { id: 1, title: 'Yulduzlar siri', language: 'uz', age: '7-10', chapters: 4, audio: true, published: true },
    { id: 2, title: 'Kosmos sayohati', language: 'uz', age: '11-13', chapters: 5, audio: true, published: true },
    { id: 3, title: 'Do\'stlik haqida', language: 'ru', age: '7-10', chapters: 3, audio: false, published: false },
  ];

  const lessons = [
    { id: 1, title: 'Matematika: Ko\'paytirish', subject: 'Matematika', age: '7-10', views: 234, published: true },
    { id: 2, title: 'Ingliz tili: Present Simple', subject: 'Ingliz tili', age: '11-13', views: 456, published: true },
    { id: 3, title: 'Fizika: Mexanika', subject: 'Fizika', age: '14-16', views: 123, published: false },
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
              Content Management
            </div>
            <div className="py-2 px-3 hover:bg-accent rounded-lg cursor-pointer">Users</div>
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
                <h1 className="text-3xl font-bold">Kontent boshqaruvi</h1>
                <p className="text-muted-foreground">She'rlar, ertaklar va darslarni boshqaring</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Jami she'rlar</span>
                  <BookOpen className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-3xl font-bold">{poems.length}</div>
                <div className="text-xs text-muted-foreground mt-1">2 nashr qilingan</div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Jami ertaklar</span>
                  <Music className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-3xl font-bold">{stories.length}</div>
                <div className="text-xs text-muted-foreground mt-1">2 nashr qilingan</div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Jami darslar</span>
                  <GraduationCap className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-3xl font-bold">{lessons.length}</div>
                <div className="text-xs text-muted-foreground mt-1">2 nashr qilingan</div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Audio fayllari</span>
                  <Music className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-3xl font-bold">5</div>
                <div className="text-xs text-muted-foreground mt-1">Audio bilan</div>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Kontent qidirish..."
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

            {/* Content Tabs */}
            <Tabs defaultValue="poems">
              <TabsList>
                <TabsTrigger value="poems">She'rlar</TabsTrigger>
                <TabsTrigger value="stories">Ertaklar</TabsTrigger>
                <TabsTrigger value="lessons">Darslar</TabsTrigger>
              </TabsList>

              <TabsContent value="poems" className="space-y-4 mt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">She'rlar ro'yxati</h3>
                  <Button onClick={() => navigate('/admin/poem/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yangi she'r
                  </Button>
                </div>
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="p-4">Sarlavha</th>
                          <th className="p-4">Muallif</th>
                          <th className="p-4">Til</th>
                          <th className="p-4">Yosh</th>
                          <th className="p-4">Audio</th>
                          <th className="p-4">Holat</th>
                          <th className="p-4">Amallar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poems.map((poem) => (
                          <tr key={poem.id} className="border-b hover:bg-accent/50">
                            <td className="p-4 font-medium">{poem.title}</td>
                            <td className="p-4 text-muted-foreground">{poem.author}</td>
                            <td className="p-4">
                              <Badge variant="outline">{poem.language}</Badge>
                            </td>
                            <td className="p-4">
                              <Badge variant="secondary">{poem.age}</Badge>
                            </td>
                            <td className="p-4">
                              {poem.audio ? (
                                <Badge className="bg-success">✓ Audio</Badge>
                              ) : (
                                <Badge variant="outline">Audio yo'q</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              {poem.published ? (
                                <Badge className="bg-success">Nashr qilingan</Badge>
                              ) : (
                                <Badge variant="secondary">Qoralama</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="stories" className="space-y-4 mt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Ertaklar ro'yxati</h3>
                  <Button onClick={() => navigate('/admin/story/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Yangi ertak
                  </Button>
                </div>
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="p-4">Sarlavha</th>
                          <th className="p-4">Til</th>
                          <th className="p-4">Yosh</th>
                          <th className="p-4">Bo'limlar</th>
                          <th className="p-4">Audio</th>
                          <th className="p-4">Holat</th>
                          <th className="p-4">Amallar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stories.map((story) => (
                          <tr key={story.id} className="border-b hover:bg-accent/50">
                            <td className="p-4 font-medium">{story.title}</td>
                            <td className="p-4">
                              <Badge variant="outline">{story.language}</Badge>
                            </td>
                            <td className="p-4">
                              <Badge variant="secondary">{story.age}</Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">{story.chapters} ta</td>
                            <td className="p-4">
                              {story.audio ? (
                                <Badge className="bg-success">✓ Audio</Badge>
                              ) : (
                                <Badge variant="outline">Audio yo'q</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              {story.published ? (
                                <Badge className="bg-success">Nashr qilingan</Badge>
                              ) : (
                                <Badge variant="secondary">Qoralama</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="lessons" className="space-y-4 mt-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Darslar ro'yxati</h3>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Yangi dars
                  </Button>
                </div>
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="p-4">Sarlavha</th>
                          <th className="p-4">Fan</th>
                          <th className="p-4">Yosh</th>
                          <th className="p-4">Ko'rishlar</th>
                          <th className="p-4">Holat</th>
                          <th className="p-4">Amallar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lessons.map((lesson) => (
                          <tr key={lesson.id} className="border-b hover:bg-accent/50">
                            <td className="p-4 font-medium">{lesson.title}</td>
                            <td className="p-4">
                              <Badge variant="outline">{lesson.subject}</Badge>
                            </td>
                            <td className="p-4">
                              <Badge variant="secondary">{lesson.age}</Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">{lesson.views}</td>
                            <td className="p-4">
                              {lesson.published ? (
                                <Badge className="bg-success">Nashr qilingan</Badge>
                              ) : (
                                <Badge variant="secondary">Qoralama</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};
