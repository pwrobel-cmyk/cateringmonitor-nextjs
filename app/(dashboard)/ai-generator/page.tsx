'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ImageIcon, VideoIcon, Upload, Sparkles, Loader2, Download,
  Trash2, X, ChevronDown, Maximize2,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Models ───────────────────────────────────────────────────────────────────

const IMAGE_MODELS = [
  { id: 'fal-ai/flux/schnell', name: 'FLUX Schnell', desc: 'Szybki, dobra jakość', badge: 'Szybki' },
  { id: 'fal-ai/flux/dev', name: 'FLUX Dev', desc: 'Lepsza jakość, wolniejszy', badge: 'Jakość' },
  { id: 'fal-ai/stable-diffusion-v3-medium', name: 'SD 3 Medium', desc: 'Stabilny, realistyczny', badge: 'Jakość' },
  { id: 'fal-ai/recraft-v3', name: 'Recraft V3', desc: 'Design i ilustracje', badge: 'Pro' },
]

const VIDEO_MODELS = [
  { id: 'fal-ai/kling-video/v1.6/standard/text-to-video', name: 'Kling 1.6 Standard', desc: '5s, dobra jakość', badge: 'Szybki' },
  { id: 'fal-ai/kling-video/v1.6/pro/text-to-video', name: 'Kling 1.6 Pro', desc: '5s, wysoka jakość', badge: 'Pro' },
  { id: 'fal-ai/minimax-video/image-to-video', name: 'MiniMax Image→Video', desc: 'Animuj zdjęcie', badge: 'Jakość' },
  { id: 'fal-ai/wan-t2v-v1.3', name: 'Wan T2V 1.3', desc: 'Cinematyczne video', badge: 'Pro' },
]

const IMAGE_PROMPTS = [
  'Świeże warzywa i owoce na białym tle, fotografia produktowa, profesjonalne oświetlenie studyjne',
  'Zdrowy lunch box z kolorowymi warzywami, widok z góry, naturalne oświetlenie',
  'Chef przygotowuje sałatkę w nowoczesnej kuchni, ciepłe oświetlenie, bokeh',
  'Pudełko cateringowe otwarte, pełne świeżego jedzenia, apetyczne, wysoka jakość',
]

const VIDEO_PROMPTS = [
  'Chef przygotowuje zdrowy posiłek w nowoczesnej kuchni, ciepłe oświetlenie, slow motion',
  'Kurier dostarcza pudełko z cateringiem, uśmiech, słoneczny dzień, cinematyczne',
  'Talerz ze świeżym jedzeniem pojawia się na stole, reveal animation, apetyczne',
  'Widok z góry: układanie składników na talerzu, płynna kamera, naturalne barwy',
]

const BADGE_COLORS: Record<string, string> = {
  Szybki: 'bg-green-100 text-green-700',
  Jakość: 'bg-blue-100 text-blue-700',
  Pro: 'bg-purple-100 text-purple-700',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string
  type: 'image' | 'video'
  url: string
  prompt: string
  model?: string
  source: 'uploaded' | 'generated'
  storage_path: string
  created_at: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIGeneratorPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('generate')

  // Generator state
  const [genType, setGenType] = useState<'image' | 'video'>('image')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0].id)
  const [referenceAsset, setReferenceAsset] = useState<Asset | null>(null)
  const [generating, setGenerating] = useState(false)
  const [lastResult, setLastResult] = useState<Asset | null>(null)
  const [showLibraryPicker, setShowLibraryPicker] = useState(false)
  const [uploadingRef, setUploadingRef] = useState(false)

  // Assets
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Library/Kreacje filters
  const [libFilter, setLibFilter] = useState<'all' | 'image' | 'video'>('all')
  const [kreFilter, setKreFilter] = useState<'all' | 'image' | 'video'>('all')

  // Full preview modal
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const refFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (user) loadAssets() }, [user])

  async function loadAssets() {
    setLoadingAssets(true)
    const { data } = await (supabase as any)
      .from('ai_assets')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
    setAllAssets(data || [])
    setLoadingAssets(false)
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  async function generate() {
    if (!prompt.trim()) { toast.error('Wpisz prompt'); return }
    setGenerating(true)
    setLastResult(null)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type: genType,
          model: selectedModel,
          userId: user?.id,
          referenceUrls: referenceAsset ? [referenceAsset.url] : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Błąd generowania'); return }
      setLastResult(data.asset)
      toast.success(`${genType === 'image' ? 'Zdjęcie' : 'Video'} wygenerowane!`)
      loadAssets()
    } catch {
      toast.error('Błąd połączenia')
    } finally {
      setGenerating(false)
    }
  }

  async function generateVariant() {
    if (!lastResult) return
    setLastResult(null)
    generate()
  }

  // ── Upload helpers ─────────────────────────────────────────────────────────

  async function uploadAsset(file: File, asRef = false): Promise<Asset | null> {
    if (!user) return null
    const ext = file.name.split('.').pop()
    const filename = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('ai-assets').upload(filename, file, { upsert: false })
    if (error) { toast.error('Błąd uploadu'); return null }
    const { data: { publicUrl } } = supabase.storage.from('ai-assets').getPublicUrl(filename)
    const assetType: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image'
    const { data: asset } = await (supabase as any).from('ai_assets').insert({
      user_id: user.id,
      type: assetType,
      url: publicUrl,
      storage_path: filename,
      source: 'uploaded',
      prompt: file.name,
    }).select().single()
    toast.success(asRef ? 'Ustawiono jako materiał bazowy' : 'Plik dodany do biblioteki')
    loadAssets()
    return asset || null
  }

  async function handleLibUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await uploadAsset(file)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingRef(true)
    const asset = await uploadAsset(file, true)
    if (asset) setReferenceAsset(asset)
    setUploadingRef(false)
    if (refFileInputRef.current) refFileInputRef.current.value = ''
  }

  async function deleteAsset(asset: Asset) {
    await supabase.storage.from('ai-assets').remove([asset.storage_path])
    await (supabase as any).from('ai_assets').delete().eq('id', asset.id)
    if (referenceAsset?.id === asset.id) setReferenceAsset(null)
    if (lastResult?.id === asset.id) setLastResult(null)
    if (previewAsset?.id === asset.id) setPreviewAsset(null)
    toast.success('Usunięto')
    loadAssets()
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const uploaded = allAssets.filter(a => a.source === 'uploaded')
  const generated = allAssets.filter(a => a.source === 'generated')
  const models = genType === 'image' ? IMAGE_MODELS : VIDEO_MODELS
  const prompts = genType === 'image' ? IMAGE_PROMPTS : VIDEO_PROMPTS

  const libFiltered = libFilter === 'all' ? uploaded : uploaded.filter(a => a.type === libFilter)
  const kreFiltered = kreFilter === 'all' ? generated : generated.filter(a => a.type === kreFilter)

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Library picker modal ───────────────────────────────────────────────────

  function LibraryPicker() {
    return (
      <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-white border rounded-xl shadow-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Wybierz z biblioteki</span>
          <button onClick={() => setShowLibraryPicker(false)}><X className="h-4 w-4" /></button>
        </div>
        {allAssets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Brak assetów</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
            {allAssets.map(a => (
              <button
                key={a.id}
                onClick={() => { setReferenceAsset(a); setShowLibraryPicker(false) }}
                className="aspect-square rounded overflow-hidden border hover:border-primary transition-colors"
              >
                {a.type === 'image'
                  ? <img src={a.url} alt="" className="w-full h-full object-cover" />
                  : <video src={a.url} className="w-full h-full object-cover" />}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
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
          <TabsTrigger value="generate"><Sparkles className="h-4 w-4 mr-1.5" />Generator</TabsTrigger>
          <TabsTrigger value="library"><Upload className="h-4 w-4 mr-1.5" />Biblioteka ({uploaded.length})</TabsTrigger>
          <TabsTrigger value="kreacje"><ImageIcon className="h-4 w-4 mr-1.5" />Kreacje ({generated.length})</TabsTrigger>
        </TabsList>

        {/* ══════════════ GENERATOR ══════════════ */}
        <TabsContent value="generate" className="mt-6 space-y-5">

          {/* Typ */}
          <div className="flex gap-3">
            <button
              onClick={() => { setGenType('image'); setSelectedModel(IMAGE_MODELS[0].id); setLastResult(null) }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${genType === 'image' ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border hover:border-primary/40 hover:bg-muted'}`}
            >
              <ImageIcon className="h-5 w-5" /> Zdjęcie
            </button>
            <button
              onClick={() => { setGenType('video'); setSelectedModel(VIDEO_MODELS[0].id); setLastResult(null) }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${genType === 'video' ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border hover:border-primary/40 hover:bg-muted'}`}
            >
              <VideoIcon className="h-5 w-5" /> Video
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 space-y-5">

              {/* Materiał bazowy */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Materiał bazowy <span className="text-muted-foreground font-normal">(opcjonalnie)</span></p>
                {referenceAsset ? (
                  <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                    <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0">
                      {referenceAsset.type === 'image'
                        ? <img src={referenceAsset.url} alt="" className="w-full h-full object-cover" />
                        : <video src={referenceAsset.url} className="w-full h-full object-cover" />}
                    </div>
                    <p className="text-xs text-muted-foreground flex-1 line-clamp-2">{referenceAsset.prompt}</p>
                    <button onClick={() => setReferenceAsset(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 relative">
                    <button
                      onClick={() => setShowLibraryPicker(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
                    >
                      <ImageIcon className="h-4 w-4" /> Z biblioteki <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => refFileInputRef.current?.click()}
                      disabled={uploadingRef}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {uploadingRef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Z dysku
                    </button>
                    <input ref={refFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleRefUpload} />
                    {showLibraryPicker && <LibraryPicker />}
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Prompt</p>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={genType === 'image' ? 'Opisz zdjęcie które chcesz wygenerować...' : 'Opisz video które chcesz wygenerować...'}
                  className="w-full min-h-[100px] p-3 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex flex-wrap gap-1.5">
                  {prompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(p)}
                      className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/80 border transition-colors text-left truncate max-w-[200px]"
                      title={p}
                    >
                      {p.slice(0, 40)}…
                    </button>
                  ))}
                </div>
              </div>

              {/* Generuj button */}
              <Button onClick={generate} disabled={generating || !prompt.trim()} className="w-full h-11 text-base font-semibold">
                {generating ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Generuję… może potrwać do 30s</>
                ) : (
                  <><Sparkles className="h-5 w-5 mr-2" />Generuj {genType === 'image' ? 'zdjęcie' : 'video'}</>
                )}
              </Button>

              {/* Wynik */}
              {lastResult && (
                <div className="space-y-3 border rounded-xl p-4 bg-muted/20">
                  <p className="text-sm font-medium text-green-700">✓ Wygenerowano pomyślnie</p>
                  <div className="rounded-lg overflow-hidden">
                    {lastResult.type === 'image'
                      ? <img src={lastResult.url} alt={lastResult.prompt} className="w-full rounded-lg" />
                      : <video src={lastResult.url} controls className="w-full rounded-lg" />}
                  </div>
                  <div className="flex gap-2">
                    <a href={lastResult.url} download target="_blank" rel="noreferrer" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-1.5" />Pobierz
                      </Button>
                    </a>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setActiveTab('kreacje') }}>
                      <ImageIcon className="h-4 w-4 mr-1.5" />Kreacje
                    </Button>
                    <Button size="sm" variant="outline" onClick={generateVariant} disabled={generating}>
                      <Sparkles className="h-4 w-4 mr-1.5" />Wariant
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Model */}
            <div className="lg:col-span-2 space-y-2">
              <p className="text-sm font-medium">Model</p>
              <div className="grid grid-cols-1 gap-2">
                {models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`text-left p-3 rounded-lg border text-sm transition-colors ${selectedModel === m.id ? 'border-primary bg-primary/5' : 'hover:bg-muted border-border'}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium">{m.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${BADGE_COLORS[m.badge]}`}>{m.badge}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════ BIBLIOTEKA ══════════════ */}
        <TabsContent value="library" className="mt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1">
              {(['all', 'image', 'video'] as const).map(f => (
                <button key={f} onClick={() => setLibFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${libFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
                  {f === 'all' ? 'Wszystkie' : f === 'image' ? 'Zdjęcia' : 'Video'}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium cursor-pointer hover:bg-muted transition-colors">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Wgraj plik
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" disabled={uploading} onChange={handleLibUpload} />
            </label>
          </div>

          {loadingAssets ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : libFiltered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Upload className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Brak materiałów w bibliotece</p>
              <p className="text-sm">Wgraj zdjęcia lub video jako bazę do generowania.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {libFiltered.map(a => (
                <div key={a.id} className="rounded-xl overflow-hidden border bg-card group">
                  <div className="aspect-square bg-muted relative">
                    {a.type === 'image'
                      ? <img src={a.url} alt={a.prompt} className="w-full h-full object-cover" />
                      : <video src={a.url} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium line-clamp-1">{a.prompt}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(a.created_at)}</p>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7"
                        onClick={() => { setReferenceAsset(a); setActiveTab('generate'); toast.success('Ustawiono jako materiał bazowy') }}>
                        Użyj w generatorze
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteAsset(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════════════ KREACJE ══════════════ */}
        <TabsContent value="kreacje" className="mt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1">
              {(['all', 'image', 'video'] as const).map(f => (
                <button key={f} onClick={() => setKreFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${kreFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>
                  {f === 'all' ? 'Wszystkie' : f === 'image' ? 'Zdjęcia' : 'Video'}
                </button>
              ))}
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{generated.filter(a => a.type === 'image').length} zdjęć</Badge>
              <Badge variant="outline">{generated.filter(a => a.type === 'video').length} video</Badge>
            </div>
          </div>

          {loadingAssets ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : kreFiltered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Brak kreacji</p>
              <p className="text-sm">Wygeneruj pierwsze zdjęcie lub video w zakładce Generator.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {kreFiltered.map(a => (
                <div key={a.id} className="rounded-xl overflow-hidden border bg-card group">
                  <div className="aspect-video bg-muted relative cursor-pointer" onClick={() => setPreviewAsset(a)}>
                    {a.type === 'image'
                      ? <img src={a.url} alt={a.prompt} className="w-full h-full object-cover" />
                      : <video src={a.url} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.prompt?.slice(0, 60)}{(a.prompt?.length ?? 0) > 60 ? '…' : ''}</p>
                    {a.model && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{a.model.split('/').pop()}</p>}
                    <div className="flex gap-1 mt-2">
                      <a href={a.url} download target="_blank" rel="noreferrer" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full text-xs h-7">
                          <Download className="h-3 w-3 mr-1" />Pobierz
                        </Button>
                      </a>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => deleteAsset(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════════ PREVIEW MODAL ══════════════ */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-black">
              {previewAsset.type === 'image'
                ? <img src={previewAsset.url} alt={previewAsset.prompt} className="w-full max-h-[60vh] object-contain" />
                : <video src={previewAsset.url} controls className="w-full max-h-[60vh]" />}
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Prompt</p>
                <p className="text-sm">{previewAsset.prompt}</p>
              </div>
              {previewAsset.model && (
                <p className="text-xs text-muted-foreground">Model: {previewAsset.model}</p>
              )}
              <div className="flex gap-2 pt-1">
                <a href={previewAsset.url} download target="_blank" rel="noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full"><Download className="h-4 w-4 mr-2" />Pobierz</Button>
                </a>
                <Button variant="outline" className="flex-1" onClick={() => {
                  setReferenceAsset(previewAsset)
                  setPrompt(previewAsset.prompt)
                  setPreviewAsset(null)
                  setActiveTab('generate')
                  toast.success('Ustawiono jako materiał bazowy')
                }}>
                  <Sparkles className="h-4 w-4 mr-2" />Użyj jako bazę
                </Button>
                <Button variant="ghost" onClick={() => setPreviewAsset(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
