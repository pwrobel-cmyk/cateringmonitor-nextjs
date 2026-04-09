'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ArrowLeftRight,
  Package,
  Percent,
  Home,
  MessageSquare,
  Camera,
  Menu,
  Image,
  ChevronDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navigation: { name: string; href: string; icon: any; beta?: boolean }[] = [
  { name: "Przegląd", href: "/dashboard", icon: Home },
  { name: "Porównywarka", href: "/compare", icon: ArrowLeftRight },
  { name: "Pakiety & Diety", href: "/packages", icon: Package },
  { name: "Rabaty", href: "/discounts", icon: Percent },
  { name: "Opinie", href: "/reviews", icon: MessageSquare },
  { name: "Raporty", href: "/reports", icon: BarChart3 },
  { name: "Screenshots", href: "/screenshots", icon: Camera },
  { name: "Review Manager", href: "/review-manager", icon: MessageSquare, beta: true },
];

const infografikiSubItems = [
  { name: "Infografiki", href: "/infografiki", icon: Image },
  { name: "Trends", href: "/trends", icon: TrendingUp },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [infografikiExpanded, setInfografikiExpanded] = useState(false);
  const pathname = usePathname();

  const isInfografikiActive = pathname === "/infografiki" || pathname === "/trends";
  const isAdminSection = pathname.startsWith("/admin");

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:block bg-card border-b border-border px-4 md:px-6 overflow-visible">
        <div className="flex space-x-2 lg:space-x-4 overflow-x-auto overflow-y-visible">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-2 px-3 py-3 md:py-4 border-b-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
                {item.beta && (
                  <span className="bg-primary/20 text-primary px-1 py-0.5 rounded font-medium ml-1" style={{ fontSize: '9px' }}>BETA</span>
                )}
              </Link>
            );
          })}

          <Link
            href="/infografiki"
            className={cn(
              "flex items-center space-x-2 px-3 py-3 md:py-4 border-b-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
              isInfografikiActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Image className="h-4 w-4" />
            <span>Infografiki</span>
          </Link>

          {isAdminSection && (
            <>
              <div className="w-px h-6 bg-border self-center mx-1 flex-shrink-0" />
              {[
                { name: "Użytkownicy", href: "/admin/users", icon: Users },
              ].map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-3 md:py-4 border-b-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-card border-b border-border px-4 py-2">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger className="w-full flex items-center justify-center gap-2 border border-input bg-background px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-muted transition-colors">
            <Menu className="h-4 w-4" />
            Menu
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px]">
            <div className="flex flex-col space-y-1 mt-6">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{item.name}</span>
                    {item.beta && (
                      <span className="bg-primary/20 text-primary px-1 py-0.5 rounded font-medium" style={{ fontSize: '9px' }}>BETA</span>
                    )}
                  </Link>
                );
              })}

              {/* Infografiki Collapsible */}
              <Collapsible
                open={infografikiExpanded || isInfografikiActive}
                onOpenChange={setInfografikiExpanded}
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full",
                    isInfografikiActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Image className="h-5 w-5" />
                  <span className="flex-1 text-left">Infografiki</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      (infografikiExpanded || isInfografikiActive) && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 mt-1 space-y-1">
                    {infografikiSubItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
