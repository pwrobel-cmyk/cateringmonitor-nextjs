'use client';

import Link from "next/link";
import { Building2, TrendingUp, LogOut, Menu, CreditCard, ClipboardList, Shield, Bot, MessageSquare, Users, Bell, Settings, FileBarChart2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Button } from "@/components/ui/button";
import { useBrandsWithLimit } from "@/hooks/supabase/useBrandsWithLimit";
import { supabase } from "@/lib/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, signOut } = useAuth();
  const { selectedCountry, setSelectedCountry } = useCountry();
  const { data: brands = [] } = useBrandsWithLimit();
  const { data: profile } = useUserProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [urgentCount, setUrgentCount] = useState(0);
  const router = useRouter();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user || fetchedRef.current) return
    fetchedRef.current = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token
      fetch('/api/today-count', token ? { headers: { authorization: `Bearer ${token}` } } : {})
        .then(r => r.json())
        .then(d => setUrgentCount(d.count || 0))
        .catch(() => {})
    })
  }, [user])

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const menu = document.getElementById('user-menu-dropdown');
      if (menu && !menu.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between w-full">
        {/* Logo and Title */}
        <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg flex-shrink-0">
            <TrendingUp className="h-4 w-4 md:h-6 md:w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-bold text-foreground truncate">Monitoring Cen</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Catering Dietetyczny</p>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center space-x-4 flex-shrink-0 w-auto">
          {/* Bell notification */}
          {user && (
            <Link href="/today" className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {urgentCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                  {urgentCount > 9 ? '9+' : urgentCount}
                </span>
              )}
            </Link>
          )}

          {/* Country selector */}
          <div className="flex items-center space-x-3 px-3 py-1.5 bg-muted rounded-lg">
            <button
              onClick={() => setSelectedCountry("Polska")}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded transition-all ${
                selectedCountry === "Polska"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-background"
              }`}
            >
              <span className="text-lg">🇵🇱</span>
              <span className="text-xs font-medium">PL</span>
            </button>
            <button
              onClick={() => setSelectedCountry("Czechy")}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded transition-all ${
                selectedCountry === "Czechy"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-background"
              }`}
            >
              <span className="text-lg">🇨🇿</span>
              <span className="text-xs font-medium">CZ</span>
            </button>
          </div>

          {/* Brand count */}
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>
              {brands.length}{" "}
              {brands.length === 1 ? "Marka" : brands.length > 1 && brands.length < 5 ? "Marki" : "Marek"}
            </span>
          </div>

          {/* User dropdown */}
          {user && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="relative h-10 w-10 rounded-full overflow-hidden"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || user.email || ""} />
                  <AvatarFallback>{profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </button>
              {menuOpen && (
                <div id="user-menu-dropdown" className="absolute right-0 top-12 z-[200] w-56 rounded-lg bg-white border border-gray-200 shadow-lg py-1">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium">{profile?.full_name || "Użytkownik"}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button onClick={() => { router.push('/settings'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                    <Settings className="h-4 w-4" /> Ustawienia
                  </button>
                  <button onClick={() => { router.push('/pricing'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                    <CreditCard className="h-4 w-4" /> Subskrypcja
                  </button>
                  <button onClick={() => { router.push('/backlog'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                    <ClipboardList className="h-4 w-4" /> Backlog zgłoszeń
                  </button>
                  <button onClick={() => { router.push('/settings#raporty'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                    <FileBarChart2 className="h-4 w-4" /> Moje raporty
                  </button>
                  {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <div className="px-3 py-1 flex items-center gap-2 text-xs font-medium text-gray-400">
                        <Shield className="h-3 w-3" /> Admin
                      </div>
                      <button onClick={() => { router.push('/admin/scrapers'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                        <Bot className="h-4 w-4" /> Scrapery
                      </button>
                      <button onClick={() => { router.push('/admin/discounts'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                        <ClipboardList className="h-4 w-4" /> Zarządzanie rabatami
                      </button>
                      <button onClick={() => { router.push('/admin/prices'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                        <CreditCard className="h-4 w-4" /> Import cen
                      </button>
                      <button onClick={() => { router.push('/admin/reviews'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                        <MessageSquare className="h-4 w-4" /> Import opinii
                      </button>
                      <button onClick={() => { router.push('/admin/users'); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50">
                        <Users className="h-4 w-4" /> Użytkownicy
                      </button>
                    </>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { signOut(); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-600">
                    <LogOut className="h-4 w-4" /> Wyloguj
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger className="lg:hidden ml-2 p-2 rounded-md hover:bg-muted transition-colors">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] sm:w-[350px]">
            <div className="flex flex-col space-y-6 mt-6">
              {/* Country Selector */}
              <div>
                <p className="text-sm font-medium mb-3">Wybierz kraj</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { setSelectedCountry("Polska"); setIsOpen(false); }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg flex-1 transition-all ${
                      selectedCountry === "Polska"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <span className="text-lg">🇵🇱</span>
                    <span className="text-sm font-medium">Polska</span>
                  </button>
                  <button
                    onClick={() => { setSelectedCountry("Czechy"); setIsOpen(false); }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg flex-1 transition-all ${
                      selectedCountry === "Czechy"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <span className="text-lg">🇨🇿</span>
                    <span className="text-sm font-medium">Czechy</span>
                  </button>
                </div>
              </div>

              {/* Brand count */}
              <div className="flex items-center space-x-2 text-sm text-muted-foreground px-2">
                <Building2 className="h-4 w-4" />
                <span>
                  {brands.length}{" "}
                  {brands.length === 1 ? "Marka" : brands.length > 1 && brands.length < 5 ? "Marki" : "Marek"} w monitoringu
                </span>
              </div>

              {/* User Actions */}
              {user && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { router.push("/pricing"); setIsOpen(false); }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Subskrypcja
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { router.push("/backlog"); setIsOpen(false); }}
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Backlog zgłoszeń
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => { router.push("/settings#raporty"); setIsOpen(false); }}
                  >
                    <FileBarChart2 className="h-4 w-4 mr-2" />
                    Moje raporty
                  </Button>
                  {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => { router.push("/admin/scrapers"); setIsOpen(false); }}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Scrapery
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => { signOut(); setIsOpen(false); }}
                    className="w-full justify-start"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Wyloguj
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
