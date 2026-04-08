'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageIcon, VideoIcon, Upload, Sparkles, Loader2, Download, Trash2, Library } from 'lucide-react'
import { toast } from 'sonner'

const IMAGE_MODELS = [
  { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell', desc: 'Szybki, dobra jakość' },
  { id: 'fal-ai/flux/dev', name: 'FLUX Dev', desc: 'Lepsza jakość, wolniejszy' },
  { id: 'fal-ai/stable-diffusion-v3-medium', name: 'SD 3 Medium', desc: 'Stabilny, realistyczny' },
  { id: 'fal-ai/recraft-v3', name: 'Recraft V3', desc: 'Design i ilustracje' },
]

const VIDEO_MODELS = [
  { id: 'fal-ai/kling-video/v1.6/standard/text-to-video', name: 'Kling 1.6 Standard', desc: '5s, dobra jakość' },
  { id: 'fal-ai/kling-video/v1.6/pro/text-to-video', name: 'Kling 1.6 Pro', desc: '5s, wysoka jakość' },
  { id: 'fal-ai/minimax-video/image-to-video', name: 'MiniMax Image→Video', desc: 'Animuj zdjęcie' },
]

export default function AIGeneratorPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('generate')
  const [type, setType] = useState<'image' | 'video'>('image')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id)
  const [referenceAssets, setReferenceAssets] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [assets, setAssets] = useState<any[]>([])
  const [libraryAssets, setLibraryAssets] = useState<any[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (user) loadAssets()
  }, [user])

  async function loadAssets() {
    setLoadingAssets(true)
    const { data } = await (supabase as any)
      .from('ai_assets')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
    setAssets(data || [])
    setLibraryAssets((data || []).filter((a: any) => a.source === 'uploaded'))
    setLoadingAssets(false)
  }

  async function generate() {
    if (!prompt.trim()) { toast.error('Wpisz prompt'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type,
          model: selectedModel,
          userId: user?.id,
          referenceUrls: referenceAssets,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Błąd generowania'); return }
      toast.success(`${type === 'image' ? 'Zdjęcie' : 'Video'} wygenerowane!`)
      loadAssets()
      setActiveTab('library')
    } catch {
      toast.error('Błąd połączenia')
    } finally {
      setGenerating(false)
    }
  }

  async function uploadFile(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filename = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('ai-assets').upload(filename, file, { upsert: false })
      if (error) { toast.error('Błąd uploadu'); return }
      const { data: { publicUrl } } = supabase.storage.from('ai-assets').getPublicUrl(filename)
      const assetType = file.type.startsWith('video') ? 'video' : 'image'
      await (supabase as any).from('ai_assets').insert({
        user_id: user.id,
        type: assetType,
        url: publicUrl,
        storage_path: filename,
        source: 'uploaded',
        prompt: file.name,
      })
      toast.success('Plik dodany do biblioteki')
      loadAssets()
    } finally {
      setUploading(false)
    }
  }

  async function deleteAsset(asset: any) {
    await supabase.storage.from('ai-assets').remove([asset.storage_path])
    await (supabase as any).from('ai_assets').delete().eq('id', asset.id)
    toast.success('Usunięto')
    loadAssets()
  }

  function toggleReference(url: string) {
    setReferenceAssets(prev =>
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    )
  }

  const models = type === 'image' ? IMAGE_MODELS : VIDEO_MODELS

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Generator AI
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generuj zdjęcia i video przez fal.ai · Zarządzaj biblioteką assetów
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate">
            <Sparkles className="h-4 w-4 mr-2" />Generator
          </TabsTrigger>
          <TabsTrigger value="library">
            <Library className="h-4 w-4 mr-2" />Biblioteka ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />Wgraj własne
          </TabsTrigger>
        </TabsList>

        {/* ── Generator ── */}
        <TabsContent value="generate" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Typ i model</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setType('image'); setSelectedModel(IMAGE_MODELS[0].id) }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'image' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                    >
                      <ImageIcon className="h-4 w-4" /> Zdjęcie
                    </button>
                    <button
                      onClick={() => { setType('video'); setSelectedModel(VIDEO_MODELS[0].id) }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${type === 'video' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                    >
                      <VideoIcon className="h-4 w-4" /> Video
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {models.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`text-left p-3 rounded-lg border text-sm transition-colors ${selectedModel === m.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                      >
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Prompt</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={type === 'image'
                      ? 'Np. Świeże warzywa na białym tle, fotografia produktowa, profesjonalne oświetlenie...'
                      : 'Np. Chef przygotowuje zdrowy posiłek w nowoczesnej kuchni, ciepłe oświetlenie...'}
                    className="w-full min-h-[120px] p-3 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full">
                    {generating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generuję {type === 'video' ? '(może potrwać ~30s)' : ''}…</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Generuj {type === 'image' ? 'zdjęcie' : 'video'}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader><CardTitle className="text-base">Materiały referencyjne</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">Wybierz z biblioteki jako inspirację lub bazę</p>
                  {libraryAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Brak materiałów w bibliotece.<br />Wgraj własne w zakładce &quot;Wgraj własne&quot;.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {libraryAssets.map(a => (
                        <button
                          key={a.id}
                          onClick={() => toggleReference(a.url)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${referenceAssets.includes(a.url) ? 'border-primary' : 'border-transparent'}`}
                        >
                          {a.type === 'image' ? (
                            <img src={a.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <video src={a.url} className="w-full h-full object-cover" />
                          )}
                          {referenceAssets.includes(a.url) && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-xs">✓</div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Biblioteka ── */}
        <TabsContent value="library" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Wszystkie assety ({assets.length})</h2>
            <div className="flex gap-2">
              <Badge variant="outline">{assets.filter(a => a.type === 'image').length} zdjęć</Badge>
              <Badge variant="outline">{assets.filter(a => a.type === 'video').length} video</Badge>
            </div>
          </div>
          {loadingAssets ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Brak assetów. Wygeneruj pierwsze zdjęcie lub video.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {assets.map(a => (
                <div key={a.id} className="rounded-lg overflow-hidden border bg-card">
                  <div className="aspect-video bg-muted">
                    {a.type === 'image' ? (
                      <img src={a.url} alt={a.prompt || ''} className="w-full h-full object-cover" />
                    ) : (
                      <video src={a.url} className="w-full h-full object-cover" controls />
                    )}
                  </div>
                  <div className="p-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{a.type === 'image' ? 'Zdjęcie' : 'Video'}</Badge>
                      <Badge variant="secondary" className="text-xs">{a.source === 'generated' ? 'AI' : 'Upload'}</Badge>
                    </div>
                    {a.prompt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.prompt}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      <a href={a.url} download target="_blank" rel="noreferrer" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-7">
                          <Download className="h-3 w-3 mr-1" />Pobierz
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => deleteAsset(a)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Upload ── */}
        <TabsContent value="upload" className="mt-4">
          <Card className="max-w-lg mx-auto">
            <CardHeader><CardTitle className="text-base">Wgraj własne materiały</CardTitle></CardHeader>
            <CardContent>
              <label className="block border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Kliknij lub przeciągnij plik</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, MP4 do 50MB</p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile(file)
                  }}
                />
              </label>
              {uploading && (
                <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Wgrywanie…
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
