'use client';

import Link from "next/link";
import { Building2, TrendingUp, LogOut, Menu, CreditCard, ClipboardList, Shield, Bot, MessageSquare } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCountry } from "@/contexts/CountryContext";
import { Button } from "@/components/ui/button";
import { useBrandsWithLimit } from "@/hooks/supabase/useBrandsWithLimit";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, signOut } = useAuth();
  const { selectedCountry, setSelectedCountry } = useCountry();
  const { data: brands = [] } = useBrandsWithLimit();
  const { data: profile } = useUserProfile();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <header className="bg-card border-b border-border px-4 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Logo and Title */}
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg flex-shrink-0">
            <TrendingUp className="h-4 w-4 md:h-6 md:w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-bold text-foreground truncate">Monitoring Cen</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Catering Dietetyczny</p>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center space-x-4 flex-shrink-0 min-w-fit">
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
            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-10 w-10 rounded-full inline-flex items-center justify-center bg-muted hover:bg-muted/80 transition-colors text-sm font-semibold cursor-pointer border-0 p-0 outline-none">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || user.email || ""} />
                  <AvatarFallback>{profile?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{profile?.full_name || "Użytkownik"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/pricing')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Subskrypcja</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/backlog')}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  <span>Backlog zgłoszeń</span>
                </DropdownMenuItem>
                {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => router.push('/admin/scrapers')}>
                      <Bot className="mr-2 h-4 w-4" />
                      <span>Scrapery</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/admin/discounts')}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      <span>Zarządzanie rabatami</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/admin/prices')}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Import cen</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/admin/reviews')}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      <span>Import opinii</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Wyloguj</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
