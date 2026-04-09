'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { User, Lock, Building2, Bell, Camera, FileBarChart2, ExternalLink, Copy } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

export default function SettingsPage() {
  const { user } = useAuth()
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Profile
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Security
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Company
  const [companyName, setCompanyName] = useState('')
  const [nip, setNip] = useState('')
  const [street, setStreet] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [savingCompany, setSavingCompany] = useState(false)

  // Preferences
  const [emailNotif, setEmailNotif] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setAvatarUrl(profile.avatar_url || null)
    setCompanyName(profile.company_name || '')
    setNip(profile.nip || '')
    setStreet(profile.street || '')
    setPostalCode(profile.postal_code || '')
    setCity(profile.city || '')
  }, [profile])

  useEffect(() => {
    if (!user) return
    ;(supabase as any)
      .from('review_notification_settings')
      .select('email')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }: any) => {
        if (data?.[0]) setEmailNotif(!!data[0].email)
      })
  }, [user])

  const uploadAvatar = async (file: File) => {
    if (!user) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await (supabase as any).storage
        .from('user-avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = (supabase as any).storage.from('user-avatars').getPublicUrl(path)
      const url = `${publicUrl}?t=${Date.now()}`

      await (supabase as any).from('profiles').update({ avatar_url: url }).eq('user_id', user.id)
      setAvatarUrl(url)
      queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] })
      toast.success('Avatar zaktualizowany')
    } catch (e: any) {
      toast.error(e.message || 'Błąd uploadu')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const saveProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName } })
      await (supabase as any).from('profiles').update({ full_name: fullName }).eq('user_id', user.id)
      queryClient.invalidateQueries({ queryKey: ['user-profile', user.id] })
      toast.success('Profil zapisany')
    } catch (e: any) {
      toast.error(e.message || 'Błąd zapisu')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    if (newPassword.length < 8) { toast.error('Hasło musi mieć min. 8 znaków'); return }
    if (newPassword !== confirmPassword) { toast.error('Hasła nie są zgodne'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      toast.success('Hasło zmienione')
    } catch (e: any) {
      toast.error(e.message || 'Błąd zmiany hasła')
    } finally {
      setSavingPassword(false)
    }
  }

  const saveCompany = async () => {
    if (!user) return
    setSavingCompany(true)
    try {
      await (supabase as any).from('profiles').update({ company_name: companyName, nip, street, postal_code: postalCode, city }).eq('user_id', user.id)
      toast.success('Dane firmy zapisane')
    } catch (e: any) {
      toast.error(e.message || 'Błąd zapisu')
    } finally {
      setSavingCompany(false)
    }
  }

  const savePrefs = async () => {
    if (!user) return
    setSavingPrefs(true)
    try {
      await (supabase as any).from('review_notification_settings').upsert({
        user_id: user.id,
        email: emailNotif,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      toast.success('Preferencje zapisane')
    } catch (e: any) {
      toast.error(e.message || 'Błąd zapisu')
    } finally {
      setSavingPrefs(false)
    }
  }

  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase()

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2 px-4 md:px-0">
      <div>
        <h1 className="text-xl font-semibold">Ustawienia</h1>
        <p className="text-sm text-muted-foreground">Zarządzaj swoim kontem</p>
      </div>

      {/* ── Profil ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                Zmień zdjęcie
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, maks. 2 MB</p>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}
            />
          </div>

          {/* Full name */}
          <div>
            <label className="text-sm font-medium">Imię i nazwisko</label>
            <Input className="mt-1" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jan Kowalski" />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <Input className="mt-1 bg-muted" value={user?.email || ''} readOnly />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Zapisuję...' : 'Zapisz profil'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bezpieczeństwo ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Bezpieczeństwo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Obecne hasło</label>
            <Input className="mt-1" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className="text-sm font-medium">Nowe hasło</label>
            <Input className="mt-1" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="text-sm font-medium">Potwierdź nowe hasło</label>
            <Input
              className={`mt-1 ${confirmPassword && newPassword !== confirmPassword ? 'border-red-400' : ''}`}
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Hasła nie są zgodne</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={savePassword} disabled={savingPassword || !newPassword}>{savingPassword ? 'Zapisuję...' : 'Zmień hasło'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Firma ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Firma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nazwa firmy</label>
            <Input className="mt-1" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Np. Catering Sp. z o.o." />
          </div>
          <div>
            <label className="text-sm font-medium">NIP</label>
            <Input className="mt-1" value={nip} onChange={e => setNip(e.target.value)} placeholder="0000000000" />
          </div>
          <div>
            <label className="text-sm font-medium">Ulica</label>
            <Input className="mt-1" value={street} onChange={e => setStreet(e.target.value)} placeholder="ul. Przykładowa 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Kod pocztowy</label>
              <Input className="mt-1" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="00-000" />
            </div>
            <div>
              <label className="text-sm font-medium">Miasto</label>
              <Input className="mt-1" value={city} onChange={e => setCity(e.target.value)} placeholder="Warszawa" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveCompany} disabled={savingCompany}>{savingCompany ? 'Zapisuję...' : 'Zapisz dane firmy'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Preferencje ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Powiadomienia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Powiadomienia email</p>
              <p className="text-xs text-muted-foreground">Otrzymuj raporty i alerty na email</p>
            </div>
            <button
              onClick={() => setEmailNotif(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotif ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${emailNotif ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex justify-end">
            <Button onClick={savePrefs} disabled={savingPrefs}>{savingPrefs ? 'Zapisuję...' : 'Zapisz preferencje'}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Moje raporty ── */}
      <MyReports userId={user?.id} />
    </div>
  )
}

function MyReports({ userId }: { userId: string | undefined }) {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['my-custom-reports', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('custom_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      return (data || []) as {
        id: string
        title: string
        brand_name: string
        date_from: string
        date_to: string
        created_at: string
      }[]
    },
  })

  const copyLink = async (id: string) => {
    const link = `${window.location.origin}/reports/custom/${id}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link skopiowany do schowka')
    } catch {
      toast.error('Nie udało się skopiować linku')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileBarChart2 className="h-4 w-4" /> Moje raporty
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Brak przypisanych raportów. Administrator może przypisać Ci raport z Generatora Raportów.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const createdAt = (() => {
                try { return new Date(r.created_at).toLocaleDateString('pl-PL') } catch { return '' }
              })()
              return (
                <div key={r.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.brand_name} · {r.date_from} – {r.date_to}
                    </p>
                    {createdAt && (
                      <p className="text-xs text-muted-foreground">Utworzony {createdAt}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/reports/custom/${r.id}`}>
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Otwórz
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => copyLink(r.id)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
