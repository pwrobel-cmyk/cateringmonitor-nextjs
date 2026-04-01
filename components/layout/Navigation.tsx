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
  Search,
  Brain,
  Camera,
  Menu,
  Image,
  ChevronDown,
  TrendingUp,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navigation = [
  { name: "Przegląd", href: "/dashboard", icon: Home },
  { name: "Porównywarka", href: "/compare", icon: ArrowLeftRight },
  { name: "Pakiety & Diety", href: "/packages", icon: Package },
  { name: "Rabaty", href: "/discounts", icon: Percent },
  { name: "Opinie", href: "/reviews", icon: MessageSquare },
  { name: "Raporty", href: "/reports", icon: BarChart3 },
  { name: "Screenshots", href: "/screenshots", icon: Camera },
];

const infografikiSubItems = [
  { name: "Infografiki", href: "/infografiki", icon: Image },
  { name: "Trends", href: "/trends", icon: TrendingUp },
];

const seoSubItems = [
  { name: "SEO", href: "/seo", icon: Search },
  { name: "SEO LLM", href: "/seo-llm", icon: Brain },
];

function NavDropdown({
  label,
  icon: Icon,
  items,
  isActive,
}: {
  label: string;
  icon: React.ElementType;
  items: { name: string; href: string; icon: React.ElementType }[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center space-x-2 px-3 py-3 md:py-4 border-b-2 text-xs md:text-sm font-medium transition-colors whitespace-nowrap",
          isActive
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-[100] mt-1 min-w-36 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  itemActive && "bg-accent text-accent-foreground"
                )}
              >
                <ItemIcon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [infografikiExpanded, setInfografikiExpanded] = useState(false);
  const pathname = usePathname();

  const isSeoActive = pathname === "/seo" || pathname === "/seo-llm" || !!pathname?.startsWith("/seo/");
  const isInfografikiActive = pathname === "/infografiki" || pathname === "/trends";

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
              </Link>
            );
          })}

          <NavDropdown
            label="Infografiki"
            icon={Image}
            items={infografikiSubItems}
            isActive={isInfografikiActive}
          />

          <NavDropdown
            label="SEO"
            icon={Search}
            items={seoSubItems}
            isActive={isSeoActive}
          />
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

              {/* SEO Collapsible */}
              <Collapsible open={seoExpanded || isSeoActive} onOpenChange={setSeoExpanded}>
                <CollapsibleTrigger
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full",
                    isSeoActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Search className="h-5 w-5" />
                  <span className="flex-1 text-left">SEO</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      (seoExpanded || isSeoActive) && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 mt-1 space-y-1">
                    {seoSubItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || !!pathname?.startsWith(item.href + "/");
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
