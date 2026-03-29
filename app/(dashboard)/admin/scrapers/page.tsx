// @ts-nocheck
'use client';

// Scrapers admin page - batch processing for all scrapers
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { redirect, usePathname } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Play, Loader2, CheckCircle, XCircle, AlertTriangle, Bug, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLastScrapeStats } from "@/hooks/useLastScrapeStats";
import { LastScrapeInfo } from "@/components/admin/LastScrapeInfo";
import { ScraperResultSummary } from "@/components/admin/ScraperResultSummary";

// Syty Król types
interface ScraperResult {
  status: "success" | "partial" | "failed";
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
  results: Array<{ 
    kcal: number; 
    meals: number; 
    price: number | null; 
    matchedBy?: string;
    daysFound?: number;
    error?: string;
  }>;
  executionTimeMs: number;
  error?: string;
  config?: {
    startDate: string;
    numberOfDays: number;
  };
}

interface DebugResult {
  mode: "debug";
  variant: { kcal: number; meals: number; index: number };
  debugInfo?: {
    htmlLength: number;
    title: string | null;
    hasSummaryText: boolean;
    hasLacznieText: boolean;
    textSampleAroundSummary: string | null;
    currencyOccurrences: number;
    priceResult: {
      price: number | null;
      matchedBy: string;
      totalPrice?: number;
      daysFound?: number;
      allCandidates?: number[];
    };
    url: string;
  };
  error?: string;
  url?: string;
  startDate?: string;
  numberOfDays?: number;
  executionTimeMs: number;
}

// 5PD types
interface Scraper5PDResult {
  status: "success" | "partial" | "failed";
  totalVariants: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
  results: Array<{ 
    diet: string;
    kcal: number; 
    price: number | null; 
    status: string;
    error?: string;
  }>;
  executionTimeMs: number;
  error?: string;
}

interface Debug5PDResult {
  mode: "debug";
  diet: string;
  dietIndex: number;
  debugInfo?: {
    htmlLength: number;
    title: string | null;
    dietSectionsFound: string[];
    pricesExtracted: Array<{ diet: string; kcal: number; price: number | null; promoPrice: number | null }>;
    textSample: string | null;
    url: string;
  };
  allDietsFound: number;
  totalPricesFound: number;
  executionTimeMs: number;
  error?: string;
}

// AfterFit types (same structure as 5PD)
type ScraperAfterFitResult = Scraper5PDResult;
type DebugAfterFitResult = Debug5PDResult;

// DOB types (same structure as 5PD)
type ScraperDOBResult = Scraper5PDResult;
type DebugDOBResult = Debug5PDResult;

// FitApetit types
interface ScraperFitApetitResult {
  status: "success" | "partial" | "failed";
  totalVariants: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
  results: Array<{ 
    diet: string;
    packageType: string;
    kcal: number; 
    price: number | null; 
    status: string;
    error?: string;
  }>;
  executionTimeMs: number;
  error?: string;
}

interface DebugFitApetitResult {
  mode: "debug";
  packageIndex: number | string;
  dietName: string;
  debugInfo?: {
    htmlLength: number;
    title: string | null;
    dietSectionsFound: string[];
    packageTypesFound: string[];
    pricesExtracted: Array<{ diet: string; packageType: string; kcal: number; price: number | null; promoPrice: number | null }>;
    textSample: string | null;
    url: string;
  };
  allPackagesFound: number;
  allDietsFound: number;
  totalPricesFound: number;
  executionTimeMs: number;
  error?: string;
}

// BodyChief types
interface ScraperBodyChiefResult {
  success: boolean;
  brand: string;
  dietsProcessed: number;
  pricesExtracted?: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  results: Array<{ 
    diet: string;
    kcal: number;
    price: number | null; 
    status?: string;
    error?: string;
  }>;
  errors?: string[];
  executionTimeMs: number;
  error?: string;
}

interface PriceCandidate {
  price: number;
  method: string;
  text: string;
  visible: boolean;
  priority: number;
}

interface KcalDebugResult {
  kcal: number;
  selectedLabel: string | null;
  priceBefore: string | null;
  priceAfter: string | null;
  candidates: PriceCandidate[];
  chosen: PriceCandidate | null;
}

interface DebugBodyChiefResult {
  mode: "debug";
  dietIndex: number;
  dietName: string;
  dietSlug: string;
  kcalsRequested: number[];
  pricesExtracted: number;
  prices: Array<{ dietName: string; dietSlug: string; kcal: number; dailyPrice: number }>;
  debugData?: Record<string, { kcalResults: KcalDebugResult[]; selectedDiet?: { ok: boolean; selectedText?: string; method?: string } }>;
  scrapeLogs: string[];
  scrapeError: string | null;
  executionTimeMs: number;
  error?: string;
}

// Gastropaczka types
interface ScraperGastropaczkaResult {
  success: boolean;
  packageName: string;
  pricesExtracted: number;
  savedCount: number;
  updatedCount: number;
  skippedCount: number;
  results: Array<{ 
    kcal: number;
    price: number; 
    status: string;
    error?: string;
  }>;
  scrapeLogs?: string[];
  executionTimeMs: number;
  error?: string;
}

interface DebugGastropaczkaResult {
  mode: "debug";
  configIndex: number;
  packageName: string;
  category: string;
  type: string;
  variant: string;
  meals: number;
  pricesExtracted: number;
  prices: Array<{ packageName: string; kcal: number; dailyPrice: number }>;
  debugData?: Record<string, unknown>;
  scrapeLogs: string[];
  scrapeError: string | null;
  executionTimeMs: number;
  error?: string;
}

// Kuchnia Vikinga types (same structure as 5PD)
type ScraperKuchniaVikingaResult = Scraper5PDResult;
type DebugKuchniaVikingaResult = Debug5PDResult;

// Maczfit types (same structure as 5PD)
type ScraperMaczfitResult = Scraper5PDResult;
type DebugMaczfitResult = Debug5PDResult;

// Pomelo types (same structure as 5PD)
type ScraperPomeloResult = Scraper5PDResult;
type DebugPomeloResult = Debug5PDResult;

// Kuchnia Vikinga diet options for debug (IDs match edge function DIET_CONFIGS)
const KUCHNIA_VIKINGA_DIET_OPTIONS = [
  // Wybór menu
  { name: "Basic", index: 0 },
  { name: "Comfort", index: 1 },
  { name: "Supreme", index: 2 },
  { name: "Ladies Vibes", index: 3 },
  { name: "Keto Fusion", index: 4 },
  { name: "Types of Vege", index: 5 },
  // Gotowe diety
  { name: "Standard", index: 6 },
  { name: "Active Pro", index: 7 },
  { name: "Light", index: 8 },
  { name: "Śródziemnomorska", index: 9 },
  { name: "Low Carb & IG", index: 10 },
  { name: "Fish Low Carb & IG", index: 11 },
  { name: "Keto", index: 12 },
  { name: "Hashi Low Gluten & Lactose", index: 13 },
  { name: "Fodmap", index: 14 },
  { name: "Ekonomiczna", index: 15 },
  { name: "Ekonomiczna Wege", index: 16 },
];

// Maczfit diet options for debug (IDs match edge function DIET_CONFIGS)
const MACZFIT_DIET_OPTIONS = [
  { name: "Smart Start", index: 0 },
  { name: "Fit & Slim", index: 1 },
  { name: "Comfort", index: 2 },
  { name: "Vege", index: 3 },
  { name: "Vege & Fish", index: 4 },
  { name: "Wegan", index: 5 },
  { name: "Keto IF", index: 6 },
  { name: "FODMAP", index: 7 },
  { name: "Hypo Hashimoto", index: 8 },
  { name: "Diabetic & Low Sugar", index: 9 },
  { name: "No Lactose & Low Gluten", index: 10 },
  { name: "Just Restaurant", index: 11 },
  { name: "Top Sellers", index: 12 },
  { name: "Everyday", index: 13 },
];

// Pomelo diet options for debug (13 diets on single page)
const POMELO_DIET_OPTIONS = [
  { name: "Redukcyjna", index: 0 },
  { name: "Niski IG", index: 1 },
  { name: "z wyborem menu", index: 2 },
  { name: "Standard", index: 3 },
  { name: "Sport Carbo", index: 4 },
  { name: "Sport Protein z wyborem menu", index: 5 },
  { name: "Low Carb", index: 6 },
  { name: "Fleksitariańska", index: 7 },
  { name: "Wegetariańska", index: 8 },
  { name: "Wege+Fish", index: 9 },
  { name: "Wegańska", index: 10 },
  { name: "Dla kobiet w ciąży", index: 11 },
  { name: "Keto", index: 12 },
];

// Gastropaczka config options for debug
const GASTROPACZKA_CONFIG_OPTIONS = [
  { name: "Wybór Menu Standardowa 5", index: 0 },
  { name: "Wybór Menu Optymalna 4", index: 1 },
  { name: "Wybór Menu Podstawowa 3", index: 2 },
  { name: "Wybór Menu Plus Standardowa 5", index: 3 },
  { name: "Wybór Menu Plus Optymalna 4", index: 4 },
  { name: "Wybór Menu Plus Podstawowa 3", index: 5 },
  { name: "Wybór Menu Sport 5", index: 6 },
  { name: "Wybór Menu Sport 4", index: 7 },
  { name: "Wybór Menu Sport 3", index: 8 },
  { name: "Klasyk Standardowa 5", index: 9 },
  { name: "Klasyk Optymalna 4", index: 10 },
  { name: "Klasyk Sport 5", index: 11 },
  { name: "Wege Standardowa 5", index: 12 },
  { name: "Wege Optymalna 4", index: 13 },
  { name: "Wege z Rybką Standardowa 5", index: 14 },
  { name: "Wege z Rybką Optymalna 4", index: 15 },
  { name: "Zero Rybki Standardowa 5", index: 16 },
  { name: "Zero Rybki Optymalna 4", index: 17 },
  { name: "Balans Standardowa 5", index: 18 },
  { name: "Balans Optymalna 4", index: 19 },
  { name: "Niski IG Standardowa 5", index: 20 },
  { name: "Niski IG Optymalna 4", index: 21 },
  { name: "Niski IG Podstawowa 3", index: 22 },
  { name: "Low Carb & Niski IG Standardowa 5", index: 23 },
  { name: "Low Carb & Niski IG Optymalna 4", index: 24 },
  { name: "Low Carb & Niski IG Podstawowa 3", index: 25 },
  { name: "Keto 4 posiłki", index: 26 },
  { name: "Keto 3 posiłki", index: 27 },
  { name: "Ekonomiczna 4 posiłki", index: 28 },
  { name: "Ekonomiczna 3 posiłki", index: 29 },
];

// BodyChief diet options for debug
const BODYCHIEF_DIET_OPTIONS = [
  { name: "Dieta Protein Plus", index: 0 },
  { name: "Dieta Wybór Menu 3 Posiłki", index: 1 },
  { name: "Dieta Wybór Menu 5 Posiłków", index: 2 },
  { name: "Dieta Standard", index: 3 },
  { name: "Dieta Sport", index: 4 },
  { name: "Dieta Keto", index: 5 },
  { name: "Dieta Low IG", index: 6 },
  { name: "Dieta Low IG Vege", index: 7 },
  { name: "Dieta Vege", index: 8 },
  { name: "Dieta Vege + Fish", index: 9 },
  { name: "Dieta Vegan", index: 10 },
  { name: "Dieta Office Box Standard", index: 11 },
  { name: "Dieta Office Box Vege", index: 12 },
  { name: "Dieta IF Vegan", index: 13 },
  { name: "Dieta IF Lactose & Gluten Free", index: 14 },
  { name: "Dieta Lactose & Gluten Free", index: 15 },
  { name: "Dieta Fit Mammy", index: 16 },
  { name: "Dieta Soft", index: 17 },
  { name: "Dieta Economy Box", index: 18 },
];
// Syty Król variants
const SYTY_KROL_VARIANTS = [
  { kcal: 1350, meals: 5, label: "5 posiłków, 1350 kcal" },
  { kcal: 1500, meals: 5, label: "5 posiłków, 1500 kcal" },
  { kcal: 1900, meals: 5, label: "5 posiłków, 1900 kcal" },
  { kcal: 2450, meals: 5, label: "5 posiłków, 2450 kcal" },
  { kcal: 2800, meals: 5, label: "5 posiłków, 2800 kcal (XXL)" },
  { kcal: 1300, meals: 3, label: "3 posiłki, 1300 kcal" },
  { kcal: 1650, meals: 3, label: "3 posiłki, 1650 kcal" },
  { kcal: 2000, meals: 3, label: "3 posiłki, 2000 kcal" },
];

// 5PD diets for batch (Office Box i Vege Office Box pominięte - nie mają standardowych wartości kcal)
const DIET_5PD_OPTIONS = [
  { name: "Wybór Menu", index: 0 },
  { name: "Fodmap", index: 1 },
  { name: "Standard Plus", index: 2 },
  { name: "Sport", index: 3 },
  { name: "Low Carb", index: 4 },
  { name: "Basic", index: 5 },
  { name: "Keto", index: 6 },
  { name: "Vege", index: 7 },
  { name: "Active", index: 8 },
  { name: "Fit", index: 9 },
  { name: "Hypo-hashimoto", index: 10 },
  { name: "Intermittent Fasting", index: 11 },
  { name: "Intermittent Fasting Vege", index: 12 },
  { name: "Junior", index: 13 },
  { name: "Less Gluten & Lactose Free", index: 14 },
  { name: "Dieta Low IG - Dash & Diabetes", index: 15 },
];

// AfterFit package types for debug
const AFTERFIT_PACKAGE_OPTIONS = [
  { name: "GREEN 10 - Standard", index: 0 },
  { name: "KETO 8 - Standard", index: 1 },
  { name: "MAXI 30 - Standard", index: 2 },
  { name: "MINI 10 - Standard", index: 3 },
  { name: "REGULAR 20 - Standard", index: 4 },
  { name: "SLIM 15 - Standard", index: 5 },
];

// DOB categories for batch (Office, Home i Z Wyborem Menu pominięte - nie mają standardowych wartości kcal, używają S/M/L/XL)
const DOB_CATEGORY_OPTIONS = [
  { name: "Sport", index: 0 },
  { name: "Slim", index: 1 },
  { name: "Keto", index: 2 },
];

// FitApetit package types for debug
const FITAPETIT_PACKAGE_OPTIONS = [
  { name: "GOTOWE DIETY", index: 0 },
  { name: "PAKIET BASIC (10 dań)", index: 1 },
  { name: "PAKIET FIT (25 dań)", index: 2 },
  { name: "PAKIET PRO (35 dań)", index: 3 },
];

// FitApetit diet options
const FITAPETIT_DIET_OPTIONS = [
  "Standard", "Veggie", "Slimfit", "Low IG", "Keto Power", "Low Carb", 
  "Sport", "Vegan", "Dairy Free", "No Fish", "Vegetarian", "Pescovegetarian",
  "Perfect Match", "Dla Kobiet w ciąży", "Dla Mam karmiących", 
  "Gluten&Dairy Free", "Fodmap&Care"
];

export default function Scrapers() {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // Syty Król state
  const [isRunningSK, setIsRunningSK] = useState(false);
  const [isDebuggingSK, setIsDebuggingSK] = useState(false);
  const [lastResultSK, setLastResultSK] = useState<ScraperResult | null>(null);
  const [debugResultSK, setDebugResultSK] = useState<DebugResult | null>(null);
  const [selectedVariantSK, setSelectedVariantSK] = useState("0");
  const [isDebugOpenSK, setIsDebugOpenSK] = useState(false);
  // Batch processing state for Syty Król
  const [batchProgressSK, setBatchProgressSK] = useState<{ current: number; total: number; variantLabel: string } | null>(null);
  const [batchResultsSK, setBatchResultsSK] = useState<Array<{ variantIndex: number; variantLabel: string; success: boolean; price: number | null; savedCount: number; updatedCount: number; error?: string }>>([]);

  // 5PD state
  const [isRunning5PD, setIsRunning5PD] = useState(false);
  const [isDebugging5PD, setIsDebugging5PD] = useState(false);
  const [lastResult5PD, setLastResult5PD] = useState<Scraper5PDResult | null>(null);
  const [debugResult5PD, setDebugResult5PD] = useState<Debug5PDResult | null>(null);
  const [selectedDiet5PD, setSelectedDiet5PD] = useState("0");
  const [isDebugOpen5PD, setIsDebugOpen5PD] = useState(false);
  // Batch processing state for 5PD
  const [batchProgress5PD, setBatchProgress5PD] = useState<{ current: number; total: number; dietName: string } | null>(null);
  const [batchResults5PD, setBatchResults5PD] = useState<Array<{ dietIndex: number; dietName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);

  // AfterFit state
  const [isRunningAF, setIsRunningAF] = useState(false);
  const [isDebuggingAF, setIsDebuggingAF] = useState(false);
  const [lastResultAF, setLastResultAF] = useState<ScraperAfterFitResult | null>(null);
  const [debugResultAF, setDebugResultAF] = useState<DebugAfterFitResult | null>(null);
  const [selectedDietAF, setSelectedDietAF] = useState("0");
  const [isDebugOpenAF, setIsDebugOpenAF] = useState(false);
  // Batch processing state for AfterFit
  const [batchProgressAF, setBatchProgressAF] = useState<{ current: number; total: number; packageName: string } | null>(null);
  const [batchResultsAF, setBatchResultsAF] = useState<Array<{ packageIndex: number; packageName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);

  // DOB state
  const [isRunningDOB, setIsRunningDOB] = useState(false);
  const [isDebuggingDOB, setIsDebuggingDOB] = useState(false);
  const [lastResultDOB, setLastResultDOB] = useState<ScraperDOBResult | null>(null);
  const [debugResultDOB, setDebugResultDOB] = useState<DebugDOBResult | null>(null);
  const [selectedCategoryDOB, setSelectedCategoryDOB] = useState("0");
  const [isDebugOpenDOB, setIsDebugOpenDOB] = useState(false);
  // Batch processing state for DOB
  const [batchProgressDOB, setBatchProgressDOB] = useState<{ current: number; total: number; categoryName: string } | null>(null);
  const [batchResultsDOB, setBatchResultsDOB] = useState<Array<{ categoryIndex: number; categoryName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);

  // FitApetit state
  const [isRunningFA, setIsRunningFA] = useState(false);
  const [isDebuggingFA, setIsDebuggingFA] = useState(false);
  const [lastResultFA, setLastResultFA] = useState<ScraperFitApetitResult | null>(null);
  const [debugResultFA, setDebugResultFA] = useState<DebugFitApetitResult | null>(null);
  const [selectedPackageFA, setSelectedPackageFA] = useState("0");
  const [selectedDietFA, setSelectedDietFA] = useState("Standard");
  const [isDebugOpenFA, setIsDebugOpenFA] = useState(false);
  // Batch processing state for FitApetit
  const [batchProgressFA, setBatchProgressFA] = useState<{ current: number; total: number; packageName: string } | null>(null);
  const [batchResultsFA, setBatchResultsFA] = useState<Array<{ packageIndex: number; packageName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);

  // BodyChief state
  const [isRunningBC, setIsRunningBC] = useState(false);
  const [isDebuggingBC, setIsDebuggingBC] = useState(false);
  const [lastResultBC, setLastResultBC] = useState<ScraperBodyChiefResult | null>(null);
  const [debugResultBC, setDebugResultBC] = useState<DebugBodyChiefResult | null>(null);
  const [selectedDietBC, setSelectedDietBC] = useState("0");
  const [selectedMaxKcalsBC, setSelectedMaxKcalsBC] = useState("2");
  const [isDebugOpenBC, setIsDebugOpenBC] = useState(false);
  // Batch processing state
  const [batchProgressBC, setBatchProgressBC] = useState<{ current: number; total: number; dietName: string } | null>(null);
  const [batchResultsBC, setBatchResultsBC] = useState<Array<{ dietIndex: number; dietName: string; success: boolean; pricesExtracted: number; savedCount: number; updatedCount: number; error?: string }>>([]);

  // Gastropaczka state
  const [isRunningGP, setIsRunningGP] = useState(false);
  const [isDebuggingGP, setIsDebuggingGP] = useState(false);
  const [lastResultGP, setLastResultGP] = useState<ScraperGastropaczkaResult | null>(null);
  const [debugResultGP, setDebugResultGP] = useState<DebugGastropaczkaResult | null>(null);
  const [selectedConfigGP, setSelectedConfigGP] = useState("0");
  const [selectedMaxKcalsGP, setSelectedMaxKcalsGP] = useState("3");
  const [isDebugOpenGP, setIsDebugOpenGP] = useState(false);
  const [batchProgressGP, setBatchProgressGP] = useState<{ current: number; total: number; packageName: string } | null>(null);
  const [batchResultsGP, setBatchResultsGP] = useState<Array<{ configIndex: number; packageName: string; success: boolean; pricesExtracted: number; savedCount: number; updatedCount: number; error?: string }>>([]);

  // Kuchnia Vikinga state
  const [isRunningKV, setIsRunningKV] = useState(false);
  const [isDebuggingKV, setIsDebuggingKV] = useState(false);
  const [lastResultKV, setLastResultKV] = useState<ScraperKuchniaVikingaResult | null>(null);
  const [debugResultKV, setDebugResultKV] = useState<DebugKuchniaVikingaResult | null>(null);
  const [selectedDietKV, setSelectedDietKV] = useState("0");
  const [isDebugOpenKV, setIsDebugOpenKV] = useState(false);
  // Batch processing state for Kuchnia Vikinga
  const [batchProgressKV, setBatchProgressKV] = useState<{ current: number; total: number; dietName: string } | null>(null);
  const [batchResultsKV, setBatchResultsKV] = useState<Array<{ dietIndex: number; dietName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);

  // Maczfit state
  const [isRunningMF, setIsRunningMF] = useState(false);
  const [isDebuggingMF, setIsDebuggingMF] = useState(false);
  const [lastResultMF, setLastResultMF] = useState<ScraperMaczfitResult | null>(null);
  const [debugResultMF, setDebugResultMF] = useState<DebugMaczfitResult | null>(null);
  const [selectedDietMF, setSelectedDietMF] = useState("0");
  const [isDebugOpenMF, setIsDebugOpenMF] = useState(false);
  // Batch processing state for Maczfit
  const [batchProgressMF, setBatchProgressMF] = useState<{ current: number; total: number; dietName: string } | null>(null);
  const [batchResultsMF, setBatchResultsMF] = useState<Array<{ dietIndex: number; dietName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);
  const [shouldCancelMF, setShouldCancelMF] = useState(false);

  // Pomelo state
  const [isRunningPO, setIsRunningPO] = useState(false);
  const [isDebuggingPO, setIsDebuggingPO] = useState(false);
  const [lastResultPO, setLastResultPO] = useState<ScraperPomeloResult | null>(null);
  const [debugResultPO, setDebugResultPO] = useState<DebugPomeloResult | null>(null);
  const [selectedDietPO, setSelectedDietPO] = useState("0");
  const [isDebugOpenPO, setIsDebugOpenPO] = useState(false);
  // Batch processing state for Pomelo
  const [batchProgressPO, setBatchProgressPO] = useState<{ current: number; total: number; dietName: string } | null>(null);
  const [batchResultsPO, setBatchResultsPO] = useState<Array<{ dietIndex: number; dietName: string; success: boolean; savedCount: number; updatedCount: number; error?: string }>>([]);

  const { data: lastScrapeStats, isLoading: isLoadingScrapeStats, refetch: refetchScrapeStats } = useLastScrapeStats();
  const queryClient = useQueryClient();

  // Tylko dla admina
  if (!user || user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    return null;
  }

  // Syty Król batch handler - process one variant at a time to avoid timeout
  const runSytyKrolBatch = async () => {
    setIsRunningSK(true);
    setLastResultSK(null);
    setBatchResultsSK([]);
    
    const totalVariants = SYTY_KROL_VARIANTS.length;
    let totalSaved = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const allResults: ScraperResult['results'] = [];
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalVariants; i++) {
        const variantOption = SYTY_KROL_VARIANTS[i];
        setBatchProgressSK({ current: i + 1, total: totalVariants, variantLabel: variantOption.label });
        
        try {
          // 45 second timeout per variant
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000);
          
          const { data, error } = await supabase.functions.invoke('scrape-sytykrol', {
            body: { singleVariant: i }
          });
          
          clearTimeout(timeoutId);
          
          if (error) throw new Error(error.message);
          
          // Aggregate results
          const result = data as ScraperResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          
          if (result.results) {
            allResults.push(...result.results);
          }
          if (result.errors) {
            allErrors.push(...result.errors);
          }
          
          // Add to batch results
          setBatchResultsSK(prev => [...prev, {
            variantIndex: i,
            variantLabel: variantOption.label,
            success: result.status !== 'failed',
            price: result.results?.[0]?.price ?? null,
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
          
        } catch (variantError) {
          const errorMsg = variantError instanceof Error ? variantError.message : String(variantError);
          allErrors.push(`${variantOption.label}: ${errorMsg}`);
          
          setBatchResultsSK(prev => [...prev, {
            variantIndex: i,
            variantLabel: variantOption.label,
            success: false,
            price: null,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        // Delay between variants (1.5s)
        if (i < totalVariants - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      // Create aggregated result
      const aggregatedResult: ScraperResult = {
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: allResults,
        executionTimeMs: 0
      };
      
      setLastResultSK(aggregatedResult);
      
      if (aggregatedResult.status === 'success') {
        toast.success(`Syty Król: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else if (aggregatedResult.status === 'partial') {
        toast.warning(`Syty Król: Częściowy sukces. Błędy: ${allErrors.length}`);
      } else {
        toast.error(`Syty Król: Wszystkie warianty zakończyły się błędem`);
      }
      
    } catch (error) {
      console.error('Syty Król batch error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningSK(false);
      setBatchProgressSK(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "sytykrol"] });
    }
  };

  const runDebugSK = async () => {
    setIsDebuggingSK(true);
    setDebugResultSK(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-sytykrol', {
        body: { debug: true, variantIndex: parseInt(selectedVariantSK, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultSK(data as DebugResult);
      
      if (data.debugInfo?.priceResult?.price) {
        toast.success(`Debug: ${data.debugInfo.priceResult.price} zł (${data.debugInfo.priceResult.matchedBy})`);
      } else {
        toast.warning(`Debug: nie znaleziono ceny`);
      }
    } catch (error) {
      console.error('Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingSK(false);
    }
  };

  // 5PD batch handler
  const run5PDBatch = async () => {
    setIsRunning5PD(true);
    setLastResult5PD(null);
    setBatchResults5PD([]);
    
    const totalDiets = DIET_5PD_OPTIONS.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalDiets; i++) {
        const dietOption = DIET_5PD_OPTIONS[i];
        setBatchProgress5PD({ current: i + 1, total: totalDiets, dietName: dietOption.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-5pd', {
            body: { singleDiet: i }
          });
          
          if (error) throw new Error(error.message);
          
          const result = data as Scraper5PDResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          if (result.errors) allErrors.push(...result.errors);
          
          setBatchResults5PD(prev => [...prev, {
            dietIndex: i,
            dietName: dietOption.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          allErrors.push(`${dietOption.name}: ${errorMsg}`);
          setBatchResults5PD(prev => [...prev, {
            dietIndex: i,
            dietName: dietOption.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        if (i < totalDiets - 1) await new Promise(r => setTimeout(r, 1500));
      }
      
      setLastResult5PD({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalDiets,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: [],
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`5PD: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`5PD: ${totalDiets - allErrors.length}/${totalDiets} diet OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunning5PD(false);
      setBatchProgress5PD(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "5pd"] });
    }
  };

  const runDebug5PD = async () => {
    setIsDebugging5PD(true);
    setDebugResult5PD(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-5pd', {
        body: { debug: true, dietIndex: parseInt(selectedDiet5PD, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResult5PD(data as Debug5PDResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen dla ${data.diet}`);
      } else {
        toast.warning(`Debug: nie znaleziono cen dla ${data.diet}`);
      }
    } catch (error) {
      console.error('5PD Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebugging5PD(false);
    }
  };

  // AfterFit batch handler
  const runAfterFitBatch = async () => {
    setIsRunningAF(true);
    setLastResultAF(null);
    setBatchResultsAF([]);
    
    const packages = AFTERFIT_PACKAGE_OPTIONS;
    const totalPackages = packages.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalPackages; i++) {
        const pkg = packages[i];
        setBatchProgressAF({ current: i + 1, total: totalPackages, packageName: pkg.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-afterfit', {
            body: { singlePackage: i }
          });
          
          if (error) throw new Error(error.message);
          
          const result = data as ScraperAfterFitResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          if (result.errors) allErrors.push(...result.errors);
          
          setBatchResultsAF(prev => [...prev, {
            packageIndex: i,
            packageName: pkg.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          allErrors.push(`${pkg.name}: ${errorMsg}`);
          setBatchResultsAF(prev => [...prev, {
            packageIndex: i,
            packageName: pkg.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        if (i < totalPackages - 1) await new Promise(r => setTimeout(r, 2000));
      }
      
      setLastResultAF({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalPackages,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: [],
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`AfterFit: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`AfterFit: ${totalPackages - allErrors.length}/${totalPackages} pakietów OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningAF(false);
      setBatchProgressAF(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "afterfit"] });
    }
  };

  const runDebugAF = async () => {
    setIsDebuggingAF(true);
    setDebugResultAF(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-afterfit', {
        body: { debug: true, dietIndex: parseInt(selectedDietAF, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultAF(data as DebugAfterFitResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen`);
      } else {
        toast.warning(`Debug: nie znaleziono cen`);
      }
    } catch (error) {
      console.error('AfterFit Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingAF(false);
    }
  };

  // DOB batch handler
  const runDOBBatch = async () => {
    setIsRunningDOB(true);
    setLastResultDOB(null);
    setBatchResultsDOB([]);
    
    const categories = DOB_CATEGORY_OPTIONS;
    const totalCategories = categories.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    let totalVariantsProcessed = 0;
    const allErrors: string[] = [];
    const allResults: ScraperDOBResult['results'] = [];
    
    try {
      for (let i = 0; i < totalCategories; i++) {
        const cat = categories[i];
        setBatchProgressDOB({ current: i + 1, total: totalCategories, categoryName: cat.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-dob', {
            body: { singleCategory: cat.index }
          });
          
          if (error) throw new Error(error.message);
          
          const result = data as ScraperDOBResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          totalVariantsProcessed += result.totalVariants || 0;
          if (result.errors) allErrors.push(...result.errors);
          if (result.results) allResults.push(...result.results);
          
          setBatchResultsDOB(prev => [...prev, {
            categoryIndex: i,
            categoryName: cat.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          allErrors.push(`${cat.name}: ${errorMsg}`);
          setBatchResultsDOB(prev => [...prev, {
            categoryIndex: i,
            categoryName: cat.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        if (i < totalCategories - 1) await new Promise(r => setTimeout(r, 1500));
      }
      
      setLastResultDOB({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalVariantsProcessed,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: allResults,
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`DOB: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`DOB: ${totalCategories - allErrors.length}/${totalCategories} kategorii OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningDOB(false);
      setBatchProgressDOB(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "dob"] });
    }
  };

  const runDebugDOB = async () => {
    setIsDebuggingDOB(true);
    setDebugResultDOB(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-dob', {
        body: { debug: true, dietIndex: parseInt(selectedCategoryDOB, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultDOB(data as DebugDOBResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen`);
      } else {
        toast.warning(`Debug: nie znaleziono cen`);
      }
    } catch (error) {
      console.error('DOB Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingDOB(false);
    }
  };

  // FitApetit batch handler
  const runFitApetitBatch = async () => {
    setIsRunningFA(true);
    setLastResultFA(null);
    setBatchResultsFA([]);
    
    const packages = FITAPETIT_PACKAGE_OPTIONS;
    const totalPackages = packages.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalPackages; i++) {
        const pkg = packages[i];
        setBatchProgressFA({ current: i + 1, total: totalPackages, packageName: pkg.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-fitapetit', {
            body: { singleConfig: i }
          });
          
          if (error) throw new Error(error.message);
          
          const result = data as ScraperFitApetitResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          if (result.errors) allErrors.push(...result.errors);
          
          setBatchResultsFA(prev => [...prev, {
            packageIndex: i,
            packageName: pkg.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          allErrors.push(`${pkg.name}: ${errorMsg}`);
          setBatchResultsFA(prev => [...prev, {
            packageIndex: i,
            packageName: pkg.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        if (i < totalPackages - 1) await new Promise(r => setTimeout(r, 3000));
      }
      
      setLastResultFA({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalPackages,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: [],
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`FitApetit: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`FitApetit: ${totalPackages - allErrors.length}/${totalPackages} pakietów OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningFA(false);
      setBatchProgressFA(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "fitapetit"] });
    }
  };

  const runDebugFA = async () => {
    setIsDebuggingFA(true);
    setDebugResultFA(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-fitapetit', {
        body: { debug: true, packageIndex: parseInt(selectedPackageFA, 10), dietName: selectedDietFA }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultFA(data as DebugFitApetitResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen`);
      } else {
        toast.warning(`Debug: nie znaleziono cen`);
      }
    } catch (error) {
      console.error('FitApetit Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingFA(false);
    }
  };

  // BodyChief handlers
  const runBodyChiefBatch = async () => {
    setIsRunningBC(true);
    setLastResultBC(null);
    setBatchResultsBC([]);
    
    const totalDiets = BODYCHIEF_DIET_OPTIONS.length;
    let totalSaved = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalPrices = 0;
    const allResults: ScraperBodyChiefResult['results'] = [];
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalDiets; i++) {
        const dietOption = BODYCHIEF_DIET_OPTIONS[i];
        setBatchProgressBC({ current: i + 1, total: totalDiets, dietName: dietOption.name });
        
        try {
          const maxAttempts = 3;
          let attempt = 0;

          // Retry loop for rate limiting
          while (attempt < maxAttempts) {
            attempt++;
            const { data, error } = await supabase.functions.invoke("scrape-bodychief", {
              body: { dietIndex: i },
            });

            const status = (error as any)?.context?.status ?? (error as any)?.status;
            const retryAfterSeconds = (data as any)?.retryAfterSeconds as number | undefined;

            if (!error) {
              if (data.success) {
                totalSaved += data.savedCount || 0;
                totalUpdated += data.updatedCount || 0;
                totalSkipped += data.skippedCount || 0;
                totalPrices += data.pricesExtracted || 0;
                allResults.push(...(data.results || []));

                setBatchResultsBC((prev) => [
                  ...prev,
                  {
                    dietIndex: i,
                    dietName: dietOption.name,
                    success: true,
                    pricesExtracted: data.pricesExtracted || 0,
                    savedCount: data.savedCount || 0,
                    updatedCount: data.updatedCount || 0,
                  },
                ]);
              } else {
                allErrors.push(`${dietOption.name}: ${data.error || "Unknown error"}`);
                setBatchResultsBC((prev) => [
                  ...prev,
                  {
                    dietIndex: i,
                    dietName: dietOption.name,
                    success: false,
                    pricesExtracted: 0,
                    savedCount: 0,
                    updatedCount: 0,
                    error: data.error,
                  },
                ]);
              }
              break;
            }

            // Browserless rate limit (429) -> wait and retry same diet
            if (status === 429 && attempt < maxAttempts) {
              const waitMs = Math.min(60000, (retryAfterSeconds ?? 10) * 1000 * attempt);
              await new Promise((resolve) => setTimeout(resolve, waitMs));
              continue;
            }

            // Non-retriable error (or retries exhausted)
            allErrors.push(`${dietOption.name}: ${error.message}`);
            setBatchResultsBC((prev) => [
              ...prev,
              {
                dietIndex: i,
                dietName: dietOption.name,
                success: false,
                pricesExtracted: 0,
                savedCount: 0,
                updatedCount: 0,
                error: error.message,
              },
            ]);
            break;
          }
        } catch (dietError) {
          const errorMsg = dietError instanceof Error ? dietError.message : "Unknown error";
          allErrors.push(`${dietOption.name}: ${errorMsg}`);
          setBatchResultsBC((prev) => [
            ...prev,
            {
              dietIndex: i,
              dietName: dietOption.name,
              success: false,
              pricesExtracted: 0,
              savedCount: 0,
              updatedCount: 0,
              error: errorMsg,
            },
          ]);
        }
        
        // Delay between requests to avoid Browserless rate limiting (429)
        if (i < totalDiets - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Compile final result
      setLastResultBC({
        success: allErrors.length === 0,
        brand: "BodyChief",
        dietsProcessed: totalDiets,
        pricesExtracted: totalPrices,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        results: allResults,
        errors: allErrors.length > 0 ? allErrors : undefined,
        executionTimeMs: 0, // Batch doesn't track total time the same way
      });
      
      if (allErrors.length === 0) {
        toast.success(`BodyChief Batch: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`BodyChief Batch: Częściowy sukces. ${totalDiets - allErrors.length}/${totalDiets} diet OK`);
      }
    } catch (error) {
      console.error('BodyChief Batch error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningBC(false);
      setBatchProgressBC(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "bodychief"] });
    }
  };

  const runDebugBC = async () => {
    setIsDebuggingBC(true);
    setDebugResultBC(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-bodychief', {
        body: { 
          debug: true, 
          dietIndex: parseInt(selectedDietBC, 10),
          maxKcals: parseInt(selectedMaxKcalsBC, 10)
        }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultBC(data as DebugBodyChiefResult);
      
      const pricesCount = data.pricesExtracted || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen dla ${data.dietName}`);
      } else {
        toast.warning(`Debug: nie znaleziono cen dla ${data.dietName}`);
      }
    } catch (error) {
      console.error('BodyChief Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingBC(false);
    }
  };

  // Gastropaczka handlers
  const runGastropaczkaBatch = async () => {
    setIsRunningGP(true);
    setLastResultGP(null);
    setBatchResultsGP([]);
    
    const totalConfigs = GASTROPACZKA_CONFIG_OPTIONS.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0, totalPrices = 0;
    const allResults: ScraperGastropaczkaResult["results"] = [];
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalConfigs; i++) {
        const config = GASTROPACZKA_CONFIG_OPTIONS[i];
        setBatchProgressGP({ current: i + 1, total: totalConfigs, packageName: config.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-gastropaczka', {
            body: { configIndex: config.index }
          });
          
          if (error) throw new Error(error.message);
          
          setBatchResultsGP(prev => [...prev, {
            configIndex: config.index,
            packageName: config.name,
            success: data.success,
            pricesExtracted: data.pricesExtracted || 0,
            savedCount: data.savedCount || 0,
            updatedCount: data.updatedCount || 0,
            error: data.error
          }]);
          
          if (data.success) {
            totalSaved += data.savedCount || 0;
            totalUpdated += data.updatedCount || 0;
            totalSkipped += data.skippedCount || 0;
            totalPrices += data.pricesExtracted || 0;
            if (data.results) allResults.push(...data.results);
          } else {
            allErrors.push(`${config.name}: ${data.error || 'Unknown error'}`);
          }
        } catch (err) {
          allErrors.push(`${config.name}: ${err instanceof Error ? err.message : String(err)}`);
          setBatchResultsGP(prev => [...prev, {
            configIndex: config.index,
            packageName: config.name,
            success: false,
            pricesExtracted: 0,
            savedCount: 0,
            updatedCount: 0,
            error: err instanceof Error ? err.message : String(err)
          }]);
        }
        
        if (i < totalConfigs - 1) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setLastResultGP({
        success: allErrors.length === 0,
        packageName: "Batch",
        pricesExtracted: totalPrices,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        results: allResults,
        executionTimeMs: 0,
      });
      
      if (allErrors.length === 0) {
        toast.success(`Gastropaczka Batch: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`Gastropaczka Batch: ${totalConfigs - allErrors.length}/${totalConfigs} pakietów OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningGP(false);
      setBatchProgressGP(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "gastropaczka"] });
    }
  };

  const runDebugGP = async () => {
    setIsDebuggingGP(true);
    setDebugResultGP(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-gastropaczka', {
        body: { debug: true, configIndex: parseInt(selectedConfigGP, 10), maxKcals: parseInt(selectedMaxKcalsGP, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultGP(data as DebugGastropaczkaResult);
      
      if (data.pricesExtracted > 0) {
        toast.success(`Debug: znaleziono ${data.pricesExtracted} cen dla ${data.packageName}`);
      } else {
        toast.warning(`Debug: nie znaleziono cen dla ${data.packageName}`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingGP(false);
    }
  };

  // Kuchnia Vikinga batch handler
  const runKuchniaVikingaBatch = async () => {
    setIsRunningKV(true);
    setLastResultKV(null);
    setBatchResultsKV([]);
    
    const diets = KUCHNIA_VIKINGA_DIET_OPTIONS;
    const totalDiets = diets.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalDiets; i++) {
        const diet = diets[i];
        setBatchProgressKV({ current: i + 1, total: totalDiets, dietName: diet.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-kuchnia-vikinga', {
            body: { singleDiet: i }
          });
          
          if (error) throw new Error(error.message);
          
          const result = data as ScraperKuchniaVikingaResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          if (result.errors) allErrors.push(...result.errors);
          
          setBatchResultsKV(prev => [...prev, {
            dietIndex: i,
            dietName: diet.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          allErrors.push(`${diet.name}: ${errorMsg}`);
          setBatchResultsKV(prev => [...prev, {
            dietIndex: i,
            dietName: diet.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        if (i < totalDiets - 1) await new Promise(r => setTimeout(r, 1000));
      }
      
      setLastResultKV({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalDiets,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: [],
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`Kuchnia Vikinga: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`Kuchnia Vikinga: ${totalDiets - allErrors.length}/${totalDiets} diet OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningKV(false);
      setBatchProgressKV(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "kuchnia-vikinga"] });
    }
  };

  const runDebugKV = async () => {
    setIsDebuggingKV(true);
    setDebugResultKV(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-kuchnia-vikinga', {
        body: { debug: true, dietIndex: parseInt(selectedDietKV, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultKV(data as DebugKuchniaVikingaResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen`);
      } else {
        toast.warning(`Debug: nie znaleziono cen`);
      }
    } catch (error) {
      console.error('Kuchnia Vikinga Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingKV(false);
    }
  };

  // Cleanup stuck scrape runs older than 30 minutes
  const cleanupStuckRuns = async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('scrape_runs')
      .update({ 
        status: 'failed', 
        error_message: 'Timeout - automatycznie zakończone',
        finished_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .lt('started_at', thirtyMinutesAgo);
    
    if (error) {
      console.warn('Failed to cleanup stuck runs:', error);
    }
  };

  // Maczfit batch handler with per-diet timeout protection
  const runMaczfitBatch = async () => {
    // Cleanup any stuck runs first
    await cleanupStuckRuns();
    
    setIsRunningMF(true);
    setShouldCancelMF(false);
    setLastResultMF(null);
    setBatchResultsMF([]);
    
    const diets = MACZFIT_DIET_OPTIONS;
    const totalDiets = diets.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    
    // 4 minutes timeout per diet (UI side safety net)
    const DIET_TIMEOUT_MS = 240000;
    
    const invokeDietWithTimeout = async (dietIndex: number): Promise<ScraperMaczfitResult> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`UI timeout after ${DIET_TIMEOUT_MS / 1000}s`));
        }, DIET_TIMEOUT_MS);
        
        supabase.functions.invoke('scrape-maczfit', {
          body: { singleDiet: dietIndex }
        }).then(({ data, error }) => {
          clearTimeout(timeoutId);
          if (error) reject(new Error(error.message));
          else resolve(data as ScraperMaczfitResult);
        }).catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });
    };
    
    try {
      for (let i = 0; i < totalDiets; i++) {
        // Check if user cancelled
        if (shouldCancelMF) {
          toast.info('MaczFit: Anulowano przez użytkownika');
          allErrors.push('Anulowano przez użytkownika');
          break;
        }
        
        const diet = diets[i];
        setBatchProgressMF({ current: i + 1, total: totalDiets, dietName: diet.name });
        
        try {
          const result = await invokeDietWithTimeout(i);
          
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          if (result.errors) allErrors.push(...result.errors);
          
          setBatchResultsMF(prev => [...prev, {
            dietIndex: i,
            dietName: diet.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('Timeout');
          allErrors.push(`${diet.name}: ${errorMsg}`);
          setBatchResultsMF(prev => [...prev, {
            dietIndex: i,
            dietName: diet.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: isTimeout ? `⏱️ Timeout (${DIET_TIMEOUT_MS / 1000}s)` : errorMsg
          }]);
        }
        
        // 2s delay between diets
        if (i < totalDiets - 1) await new Promise(r => setTimeout(r, 2000));
      }
      
      setLastResultMF({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalDiets,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: [],
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`MaczFit: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`MaczFit: ${totalDiets - allErrors.length}/${totalDiets} diet OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningMF(false);
      setBatchProgressMF(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "maczfit"] });
    }
  };

  const runDebugMF = async () => {
    setIsDebuggingMF(true);
    setDebugResultMF(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-maczfit', {
        body: { debug: true, dietIndex: parseInt(selectedDietMF, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultMF(data as DebugMaczfitResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen`);
      } else {
        toast.warning(`Debug: nie znaleziono cen`);
      }
    } catch (error) {
      console.error('MaczFit Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingMF(false);
    }
  };

  // Pomelo batch handler
  const runPomeloBatch = async () => {
    setIsRunningPO(true);
    setLastResultPO(null);
    setBatchResultsPO([]);
    
    const totalDiets = POMELO_DIET_OPTIONS.length;
    let totalSaved = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];
    
    try {
      for (let i = 0; i < totalDiets; i++) {
        const diet = POMELO_DIET_OPTIONS[i];
        setBatchProgressPO({ current: i + 1, total: totalDiets, dietName: diet.name });
        
        try {
          const { data, error } = await supabase.functions.invoke('scrape-pomelo', {
            body: { singleDiet: i }
          });
          
          if (error) throw new Error(error.message);
          
          const result = data as ScraperPomeloResult;
          totalSaved += result.savedCount || 0;
          totalUpdated += result.updatedCount || 0;
          totalSkipped += result.skippedCount || 0;
          if (result.errors) allErrors.push(...result.errors);
          
          setBatchResultsPO(prev => [...prev, {
            dietIndex: i,
            dietName: diet.name,
            success: result.status !== 'failed',
            savedCount: result.savedCount || 0,
            updatedCount: result.updatedCount || 0,
            error: result.error
          }]);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          allErrors.push(`${diet.name}: ${errorMsg}`);
          setBatchResultsPO(prev => [...prev, {
            dietIndex: i,
            dietName: diet.name,
            success: false,
            savedCount: 0,
            updatedCount: 0,
            error: errorMsg
          }]);
        }
        
        // 500ms delay between diets (fast scraper)
        if (i < totalDiets - 1) await new Promise(r => setTimeout(r, 500));
      }
      
      setLastResultPO({
        status: allErrors.length === 0 ? 'success' : (totalSaved > 0 || totalUpdated > 0 ? 'partial' : 'failed'),
        totalVariants: totalDiets,
        savedCount: totalSaved,
        updatedCount: totalUpdated,
        skippedCount: totalSkipped,
        errors: allErrors,
        results: [],
        executionTimeMs: 0
      });
      
      if (allErrors.length === 0) {
        toast.success(`Pomelo: Zapisano ${totalSaved}, zaktualizowano ${totalUpdated}`);
      } else {
        toast.warning(`Pomelo: ${totalDiets - allErrors.length}/${totalDiets} diet OK`);
      }
    } catch (error) {
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsRunningPO(false);
      setBatchProgressPO(null);
      refetchScrapeStats();
      queryClient.invalidateQueries({ queryKey: ["last-scrape-run", "pomelo"] });
    }
  };

  const runDebugPO = async () => {
    setIsDebuggingPO(true);
    setDebugResultPO(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-pomelo', {
        body: { debug: true, dietIndex: parseInt(selectedDietPO, 10) }
      });
      
      if (error) throw new Error(error.message);
      
      setDebugResultPO(data as DebugPomeloResult);
      
      const pricesCount = data.debugInfo?.pricesExtracted?.length || 0;
      if (pricesCount > 0) {
        toast.success(`Debug: znaleziono ${pricesCount} cen`);
      } else {
        toast.warning(`Debug: nie znaleziono cen`);
      }
    } catch (error) {
      console.error('Pomelo Debug error:', error);
      toast.error(`Błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
    } finally {
      setIsDebuggingPO(false);
    }
  };

  // Utility functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'partial': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500">Sukces</Badge>;
      case 'partial': return <Badge className="bg-yellow-500">Częściowy</Badge>;
      case 'failed': return <Badge variant="destructive">Błąd</Badge>;
      default: return null;
    }
  };

  const getMatchBadge = (matchedBy?: string) => {
    switch (matchedBy) {
      case 'per_day': return <Badge className="bg-green-600 text-xs">dziennie</Badge>;
      case 'total_divided': return <Badge className="bg-blue-600 text-xs">suma/dni</Badge>;
      case 'fallback': return <Badge className="bg-yellow-600 text-xs">fallback</Badge>;
      default: return <Badge variant="outline" className="text-xs">brak</Badge>;
    }
  };

  const get5PDStatusBadge = (status: string) => {
    switch (status) {
      case 'saved': return <Badge className="bg-green-600 text-xs">zapisano</Badge>;
      case 'updated': return <Badge className="bg-blue-600 text-xs">zaktualizowano</Badge>;
      case 'skipped': return <Badge className="bg-gray-500 text-xs">pominięto</Badge>;
      case 'no_price': return <Badge variant="destructive" className="text-xs">brak ceny</Badge>;
      case 'no_package': return <Badge variant="destructive" className="text-xs">brak pakietu</Badge>;
      case 'error': return <Badge variant="destructive" className="text-xs">błąd</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-8 px-4">
      {/* Admin nav */}
      <div className="flex gap-2 mb-6">
        {[
          { href: '/admin/discounts', label: 'Rabaty' },
          { href: '/admin/prices', label: 'Ceny' },
          { href: '/admin/reviews', label: 'Opinie' },
          { href: '/admin/scrapers', label: 'Scrapery' },
        ].map(link => (
          <Link key={link.href} href={link.href}>
            <Button variant={pathname === link.href ? 'default' : 'outline'} size="sm">
              {link.label}
            </Button>
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Scrapery</h1>
          <p className="text-muted-foreground">Zarządzanie scraperami danych</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Syty Król Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Syty Król Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z konfiguratora sytykrol.pl (8 wariantów diet)
                </CardDescription>
              </div>
              <Button 
                onClick={runSytyKrolBatch} 
                disabled={isRunningSK || isDebuggingSK}
                className="gap-2"
              >
                {isRunningSK ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 
                    {batchProgressSK ? `${batchProgressSK.current}/${batchProgressSK.total}...` : 'Scrapowanie...'}
                  </>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom batch</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Warianty:</span><span className="ml-2 font-medium">{SYTY_KROL_VARIANTS.length}</span></div>
                <div><span className="text-muted-foreground">Timeout:</span><span className="ml-2 font-medium">60s</span></div>
                <div><span className="text-muted-foreground">Retry:</span><span className="ml-2 font-medium">3x</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.sytykrol?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.sytykrol?.pricesCount || 0}
                scraperName="sytykrol"
                isLoading={isLoadingScrapeStats}
              />

              {/* Batch Progress */}
              {batchProgressSK && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      Przetwarzanie wariantu {batchProgressSK.current}/{batchProgressSK.total}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{batchProgressSK.variantLabel}</p>
                  <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(batchProgressSK.current / batchProgressSK.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Batch Results */}
              {batchResultsSK.length > 0 && !batchProgressSK && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Wyniki batch:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {batchResultsSK.map((result, idx) => (
                      <div 
                        key={idx} 
                        className={`text-xs p-2 rounded border ${
                          result.success 
                            ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                            : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{result.variantLabel}</span>
                          {result.success ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-600" />
                          )}
                        </div>
                        {result.success && result.price && (
                          <span className="text-green-600">{result.price} zł</span>
                        )}
                        {result.error && (
                          <span className="text-red-600 text-xs">{result.error.substring(0, 50)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Debug Section */}
              <Collapsible open={isDebugOpenSK} onOpenChange={setIsDebugOpenSK}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenSK ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center">
                      <Select value={selectedVariantSK} onValueChange={setSelectedVariantSK}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Wybierz wariant" />
                        </SelectTrigger>
                        <SelectContent>
                          {SYTY_KROL_VARIANTS.map((v, idx) => (
                            <SelectItem key={idx} value={String(idx)}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugSK}
                        disabled={isDebuggingSK || isRunningSK}
                        className="gap-2"
                      >
                        {isDebuggingSK ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug (1 wariant)</>
                        )}
                      </Button>
                    </div>

                    {debugResultSK && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Wariant:</span>
                          <span>{debugResultSK.variant.meals} posiłki, {debugResultSK.variant.kcal} kcal</span>
                          <span className="text-muted-foreground">({(debugResultSK.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResultSK.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultSK.error}
                          </div>
                        ) : debugResultSK.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">HTML Length</div>
                                <div className="font-mono">{debugResultSK.debugInfo.htmlLength.toLocaleString()}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Waluta (zł/PLN)</div>
                                <div className="font-mono">{debugResultSK.debugInfo.currencyOccurrences}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Podsumowanie</div>
                                <div className={debugResultSK.debugInfo.hasSummaryText ? "text-green-600" : "text-red-600"}>
                                  {debugResultSK.debugInfo.hasSummaryText ? "✓ Tak" : "✗ Nie"}
                                </div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Łącznie</div>
                                <div className={debugResultSK.debugInfo.hasLacznieText ? "text-green-600" : "text-red-600"}>
                                  {debugResultSK.debugInfo.hasLacznieText ? "✓ Tak" : "✗ Nie"}
                                </div>
                              </div>
                            </div>

                            <div className="bg-background p-3 rounded border">
                              <div className="text-muted-foreground text-xs mb-1">Wynik ekstrakcji ceny</div>
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-bold">
                                  {debugResultSK.debugInfo.priceResult.price 
                                    ? `${debugResultSK.debugInfo.priceResult.price} zł`
                                    : "Brak ceny"}
                                </span>
                                {getMatchBadge(debugResultSK.debugInfo.priceResult.matchedBy)}
                              </div>
                            </div>

                            {debugResultSK.debugInfo.textSampleAroundSummary && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Fragment HTML</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-40 overflow-auto">
                                  {debugResultSK.debugInfo.textSampleAroundSummary}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Results */}
              {lastResultSK && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(lastResultSK.status)}
                      <span className="font-medium">Wynik ostatniego uruchomienia</span>
                    </div>
                    {getStatusBadge(lastResultSK.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded">
                      <div className="text-green-600 dark:text-green-400 font-medium">Zapisane</div>
                      <div className="text-2xl font-bold">{lastResultSK.savedCount}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                      <div className="text-blue-600 dark:text-blue-400 font-medium">Zaktualizowane</div>
                      <div className="text-2xl font-bold">{lastResultSK.updatedCount}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                      <div className="text-gray-600 dark:text-gray-400 font-medium">Pominięte</div>
                      <div className="text-2xl font-bold">{lastResultSK.skippedCount}</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded">
                      <div className="text-orange-600 dark:text-orange-400 font-medium">Czas</div>
                      <div className="text-2xl font-bold">{(lastResultSK.executionTimeMs / 1000).toFixed(1)}s</div>
                    </div>
                  </div>

                  {lastResultSK.results?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Zescrapowane ceny:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {lastResultSK.results.map((r, idx) => (
                          <div key={idx} className={`flex justify-between items-center p-2 rounded text-sm ${r.price ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                            <span>{r.meals} posiłki, {r.kcal} kcal</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{r.price ? `${r.price} zł` : '❌ brak'}</span>
                              {r.matchedBy && getMatchBadge(r.matchedBy)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lastResultSK.errors?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2">Błędy:</h4>
                      <ul className="text-sm text-red-600 space-y-1">
                        {lastResultSK.errors.map((err, idx) => (<li key={idx}>• {err}</li>))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5 Posiłków Dziennie Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  5 Posiłków Dziennie Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen ze strony 5pd.pl/cennik/ (18 diet, ~80 wariantów)
                </CardDescription>
              </div>
              <Button 
                onClick={run5PDBatch} 
                disabled={isRunning5PD || isDebugging5PD}
                className="gap-2"
              >
                {isRunning5PD ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Diety:</span><span className="ml-2 font-medium">18</span></div>
                <div><span className="text-muted-foreground">Warianty:</span><span className="ml-2 font-medium">~80</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">5pd.pl/cennik</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.["5pd"]?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.["5pd"]?.pricesCount || 0}
                scraperName="5pd"
                isLoading={isLoadingScrapeStats}
              />

              {/* Debug Section */}
              <Collapsible open={isDebugOpen5PD} onOpenChange={setIsDebugOpen5PD}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpen5PD ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center">
                      <Select value={selectedDiet5PD} onValueChange={setSelectedDiet5PD}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Wybierz dietę" />
                        </SelectTrigger>
                        <SelectContent>
                          {DIET_5PD_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebug5PD}
                        disabled={isDebugging5PD || isRunning5PD}
                        className="gap-2"
                      >
                        {isDebugging5PD ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug (1 dieta)</>
                        )}
                      </Button>
                    </div>

                    {debugResult5PD && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Dieta:</span>
                          <span>{debugResult5PD.diet}</span>
                          <span className="text-muted-foreground">({(debugResult5PD.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResult5PD.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResult5PD.error}
                          </div>
                        ) : debugResult5PD.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">HTML Length</div>
                                <div className="font-mono">{debugResult5PD.debugInfo.htmlLength.toLocaleString()}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Znalezione diety</div>
                                <div className="font-mono">{debugResult5PD.allDietsFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny (łącznie)</div>
                                <div className="font-mono">{debugResult5PD.totalPricesFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny dla diety</div>
                                <div className="font-mono">{debugResult5PD.debugInfo.pricesExtracted.length}</div>
                              </div>
                            </div>

                            {debugResult5PD.debugInfo.pricesExtracted.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny</div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {debugResult5PD.debugInfo.pricesExtracted.map((p, idx) => (
                                    <div key={idx} className="text-sm flex justify-between items-center bg-muted p-2 rounded">
                                      <span>{p.kcal} kcal</span>
                                      <span className="font-medium">{p.price} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResult5PD.debugInfo.dietSectionsFound.length > 0 && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Sekcje diet w HTML</div>
                                <div className="flex flex-wrap gap-1">
                                  {debugResult5PD.debugInfo.dietSectionsFound.map((d, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">{d}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResult5PD.debugInfo.textSample && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Fragment HTML</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-40 overflow-auto">
                                  {debugResult5PD.debugInfo.textSample}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Results */}
              {lastResult5PD && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResult5PD.status}
                    totalVariants={lastResult5PD.totalVariants}
                    savedCount={lastResult5PD.savedCount}
                    updatedCount={lastResult5PD.updatedCount}
                    skippedCount={lastResult5PD.skippedCount}
                    executionTimeMs={lastResult5PD.executionTimeMs}
                    results={lastResult5PD.results}
                    errors={lastResult5PD.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AfterFit Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AfterFit Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen ze strony afterfit.pl/cennik/ (6 pakietów × warianty)
                </CardDescription>
              </div>
              <Button 
                onClick={runAfterFitBatch} 
                disabled={isRunningAF || isDebuggingAF}
                className="gap-2"
              >
                {isRunningAF ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Pakiety:</span><span className="ml-2 font-medium">6</span></div>
                <div><span className="text-muted-foreground">Warianty:</span><span className="ml-2 font-medium">~36</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">afterfit.pl/cennik</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.afterfit?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.afterfit?.pricesCount || 0}
                scraperName="afterfit"
                isLoading={isLoadingScrapeStats}
              />

              {/* Debug Section */}
              <Collapsible open={isDebugOpenAF} onOpenChange={setIsDebugOpenAF}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenAF ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center">
                      <Select value={selectedDietAF} onValueChange={setSelectedDietAF}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Wybierz pakiet" />
                        </SelectTrigger>
                        <SelectContent>
                          {AFTERFIT_PACKAGE_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugAF}
                        disabled={isDebuggingAF || isRunningAF}
                        className="gap-2"
                      >
                        {isDebuggingAF ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug</>
                        )}
                      </Button>
                    </div>

                    {debugResultAF && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Pakiet:</span>
                          <span>{debugResultAF.diet}</span>
                          <span className="text-muted-foreground">({(debugResultAF.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResultAF.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultAF.error}
                          </div>
                        ) : debugResultAF.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">HTML Length</div>
                                <div className="font-mono">{debugResultAF.debugInfo.htmlLength.toLocaleString()}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Znalezione diety</div>
                                <div className="font-mono">{debugResultAF.allDietsFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny (łącznie)</div>
                                <div className="font-mono">{debugResultAF.totalPricesFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny dla pakietu</div>
                                <div className="font-mono">{debugResultAF.debugInfo.pricesExtracted.length}</div>
                              </div>
                            </div>

                            {debugResultAF.debugInfo.pricesExtracted.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {debugResultAF.debugInfo.pricesExtracted.map((p, idx) => (
                                    <div key={idx} className="text-sm flex justify-between items-center bg-muted p-2 rounded">
                                      <span className="font-medium text-primary">{p.diet}</span>
                                      <span>{p.kcal} kcal</span>
                                      <span className="font-medium">{p.price} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResultAF.debugInfo.textSample && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Fragment HTML</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-40 overflow-auto">
                                  {debugResultAF.debugInfo.textSample}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Results */}
              {lastResultAF && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResultAF.status}
                    totalVariants={lastResultAF.totalVariants}
                    savedCount={lastResultAF.savedCount}
                    updatedCount={lastResultAF.updatedCount}
                    skippedCount={lastResultAF.skippedCount}
                    executionTimeMs={lastResultAF.executionTimeMs}
                    results={lastResultAF.results}
                    errors={lastResultAF.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Diety od Brokuła Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Diety od Brokuła Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen ze strony dietyodbrokula.pl/cennik (~90 wariantów diet)
                </CardDescription>
              </div>
              <Button 
                onClick={runDOBBatch} 
                disabled={isRunningDOB || isDebuggingDOB}
                className="gap-2"
              >
                {isRunningDOB ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Kategorie:</span><span className="ml-2 font-medium">3</span></div>
                <div><span className="text-muted-foreground">Warianty:</span><span className="ml-2 font-medium">~90</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">dietyodbrokula.pl/cennik</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.dob?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.dob?.pricesCount || 0}
                scraperName="dob"
                isLoading={isLoadingScrapeStats}
              />

              {/* Debug Section */}
              <Collapsible open={isDebugOpenDOB} onOpenChange={setIsDebugOpenDOB}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenDOB ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center">
                      <Select value={selectedCategoryDOB} onValueChange={setSelectedCategoryDOB}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Wybierz kategorię" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOB_CATEGORY_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugDOB}
                        disabled={isDebuggingDOB || isRunningDOB}
                        className="gap-2"
                      >
                        {isDebuggingDOB ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug</>
                        )}
                      </Button>
                    </div>

                    {debugResultDOB && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Kategoria:</span>
                          <span>{debugResultDOB.diet}</span>
                          <span className="text-muted-foreground">({(debugResultDOB.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResultDOB.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultDOB.error}
                          </div>
                        ) : debugResultDOB.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">HTML Length</div>
                                <div className="font-mono">{debugResultDOB.debugInfo.htmlLength.toLocaleString()}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Znalezione kategorie</div>
                                <div className="font-mono">{debugResultDOB.allDietsFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny (łącznie)</div>
                                <div className="font-mono">{debugResultDOB.totalPricesFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny dla kategorii</div>
                                <div className="font-mono">{debugResultDOB.debugInfo.pricesExtracted.length}</div>
                              </div>
                            </div>

                            {debugResultDOB.debugInfo.pricesExtracted.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny (pierwsze 15)</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                  {debugResultDOB.debugInfo.pricesExtracted.slice(0, 15).map((p, idx) => (
                                    <div key={idx} className="text-sm flex justify-between items-center bg-muted p-2 rounded">
                                      <span className="font-medium text-primary truncate flex-1">{p.diet}</span>
                                      <span className="ml-2">{p.kcal || '-'} kcal</span>
                                      <span className="font-medium ml-2">{p.price} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResultDOB.debugInfo.textSample && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Fragment HTML</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-40 overflow-auto">
                                  {debugResultDOB.debugInfo.textSample}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Results */}
              {lastResultDOB && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResultDOB.status}
                    totalVariants={lastResultDOB.totalVariants}
                    savedCount={lastResultDOB.savedCount}
                    updatedCount={lastResultDOB.updatedCount}
                    skippedCount={lastResultDOB.skippedCount}
                    executionTimeMs={lastResultDOB.executionTimeMs}
                    results={lastResultDOB.results}
                    errors={lastResultDOB.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* FitApetit Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  FitApetit Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z panelu panel.fitapetit.com.pl (4 pakiety, ~17 diet, ~100+ wariantów)
                </CardDescription>
              </div>
              <Button 
                onClick={runFitApetitBatch} 
                disabled={isRunningFA || isDebuggingFA}
                className="gap-2"
              >
                {isRunningFA ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Pakiety:</span><span className="ml-2 font-medium">4</span></div>
                <div><span className="text-muted-foreground">Diety:</span><span className="ml-2 font-medium">~17</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">panel.fitapetit.com.pl</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.fitapetit?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.fitapetit?.pricesCount || 0}
                scraperName="fitapetit"
                isLoading={isLoadingScrapeStats}
              />

              {/* Debug Section */}
              <Collapsible open={isDebugOpenFA} onOpenChange={setIsDebugOpenFA}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenFA ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={selectedPackageFA} onValueChange={setSelectedPackageFA}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Wybierz pakiet" />
                        </SelectTrigger>
                        <SelectContent>
                          {FITAPETIT_PACKAGE_OPTIONS.map((p) => (
                            <SelectItem key={p.index} value={String(p.index)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedDietFA} onValueChange={setSelectedDietFA}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Wybierz dietę" />
                        </SelectTrigger>
                        <SelectContent>
                          {FITAPETIT_DIET_OPTIONS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugFA}
                        disabled={isDebuggingFA || isRunningFA}
                        className="gap-2"
                      >
                        {isDebuggingFA ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug (1 pakiet + dieta)</>
                        )}
                      </Button>
                    </div>

                    {debugResultFA && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Pakiet:</span>
                          <span>{FITAPETIT_PACKAGE_OPTIONS[parseInt(selectedPackageFA)]?.name || selectedPackageFA}</span>
                          <span className="font-medium">Dieta:</span>
                          <span>{debugResultFA.dietName}</span>
                          <span className="text-muted-foreground">({(debugResultFA.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResultFA.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultFA.error}
                          </div>
                        ) : debugResultFA.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Znalezione pakiety</div>
                                <div className="font-mono">{debugResultFA.allPackagesFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Znalezione diety</div>
                                <div className="font-mono">{debugResultFA.allDietsFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny (łącznie)</div>
                                <div className="font-mono">{debugResultFA.totalPricesFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny dla wyboru</div>
                                <div className="font-mono">{debugResultFA.debugInfo.pricesExtracted.length}</div>
                              </div>
                            </div>

                            {debugResultFA.debugInfo.pricesExtracted.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                  {debugResultFA.debugInfo.pricesExtracted.map((p, idx) => (
                                    <div key={idx} className="text-sm flex justify-between items-center bg-muted p-2 rounded">
                                      <div className="flex flex-col">
                                        <span className="font-medium text-primary">{p.diet}</span>
                                        <span className="text-xs text-muted-foreground">{p.packageType}</span>
                                      </div>
                                      <span>{p.kcal} kcal</span>
                                      <span className="font-medium">{p.price} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResultFA.debugInfo.textSample && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Logi scrapera</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-40 overflow-auto">
                                  {debugResultFA.debugInfo.textSample}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Results */}
              {lastResultFA && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResultFA.status}
                    totalVariants={lastResultFA.totalVariants}
                    savedCount={lastResultFA.savedCount}
                    updatedCount={lastResultFA.updatedCount}
                    skippedCount={lastResultFA.skippedCount}
                    executionTimeMs={lastResultFA.executionTimeMs}
                    results={lastResultFA.results}
                    errors={lastResultFA.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* BodyChief Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Body Chief Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z bodychief.pl/diety (19 diet)
                </CardDescription>
              </div>
              <Button 
                onClick={runBodyChiefBatch} 
                disabled={isRunningBC || isDebuggingBC}
                className="gap-2"
              >
                {isRunningBC ? (
                  batchProgressBC ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> {batchProgressBC.current}/{batchProgressBC.total}: {batchProgressBC.dietName.substring(0, 15)}...</>
                  ) : (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                  )
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom Batch (19 diet)</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Diety:</span><span className="ml-2 font-medium">19</span></div>
                <div><span className="text-muted-foreground">Tryb:</span><span className="ml-2 font-medium">Batch (1 dieta/request)</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">bodychief.pl/zamow-diete</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.bodychief?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.bodychief?.pricesCount || 0}
                scraperName="bodychief"
                isLoading={isLoadingScrapeStats}
              />
              {/* Batch Progress */}
              {batchProgressBC && (
                <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Postęp batch:</span>
                    <span className="text-sm">{batchProgressBC.current} / {batchProgressBC.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                      style={{ width: `${(batchProgressBC.current / batchProgressBC.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Aktualnie: {batchProgressBC.dietName}
                  </div>
                  {batchResultsBC.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      ✓ {batchResultsBC.filter(r => r.success).length} OK | 
                      ✗ {batchResultsBC.filter(r => !r.success).length} błędów
                    </div>
                  )}
                </div>
              )}

              {/* Debug Section */}
              <Collapsible open={isDebugOpenBC} onOpenChange={setIsDebugOpenBC}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenBC ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={selectedDietBC} onValueChange={setSelectedDietBC}>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Wybierz dietę" />
                        </SelectTrigger>
                        <SelectContent>
                          {BODYCHIEF_DIET_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMaxKcalsBC} onValueChange={setSelectedMaxKcalsBC}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Max kcal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 kcal</SelectItem>
                          <SelectItem value="2">2 kcal</SelectItem>
                          <SelectItem value="3">3 kcal</SelectItem>
                          <SelectItem value="4">4 kcal</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugBC}
                        disabled={isDebuggingBC || isRunningBC}
                        className="gap-2"
                      >
                        {isDebuggingBC ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug (1 dieta)</>
                        )}
                      </Button>
                    </div>

                    {debugResultBC && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Dieta:</span>
                          <span>{debugResultBC.dietName}</span>
                          <span className="text-muted-foreground">({debugResultBC.dietSlug})</span>
                          <span className="text-muted-foreground">| {(debugResultBC.executionTimeMs / 1000).toFixed(1)}s</span>
                        </div>

                        {debugResultBC.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultBC.error}
                          </div>
                        ) : (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Żądane kcal</div>
                                <div className="font-mono">{debugResultBC.kcalsRequested?.join(', ') || '-'}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Wyekstrahowane ceny</div>
                                <div className="font-mono text-lg">{debugResultBC.pricesExtracted}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Błąd scrapera</div>
                                <div className={debugResultBC.scrapeError ? "text-red-600" : "text-green-600"}>
                                  {debugResultBC.scrapeError || "✓ Brak"}
                                </div>
                              </div>
                            </div>

                            {/* Per-kcal detailed debug data */}
                            {debugResultBC.debugData && Object.keys(debugResultBC.debugData).length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Szczegóły ekstrakcji per kcal</div>
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                  {Object.entries(debugResultBC.debugData).map(([slug, data]) => (
                                    <div key={slug} className="border rounded p-2">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs text-muted-foreground">{slug}</span>
                                        {data.selectedDiet && (
                                          <Badge variant={data.selectedDiet.ok ? "default" : "destructive"} className="text-xs">
                                            {data.selectedDiet.ok 
                                              ? `Dieta: ${data.selectedDiet.selectedText?.substring(0, 30) || 'OK'}` 
                                              : 'Nie wybrano diety!'}
                                          </Badge>
                                        )}
                                      </div>
                                      {data.kcalResults?.map((kr, idx) => (
                                        <div key={idx} className="bg-muted p-2 rounded mb-2">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium">{kr.kcal} kcal</span>
                                            {kr.selectedLabel && (
                                              <Badge variant="outline" className="text-xs">
                                                Wybrano: {kr.selectedLabel}
                                              </Badge>
                                            )}
                                          </div>
                                          {kr.chosen ? (
                                            <div className="text-sm">
                                              <span className="text-green-600 font-medium">{kr.chosen.price} zł</span>
                                              <span className="text-muted-foreground ml-2">({kr.chosen.method})</span>
                                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                                "{kr.chosen.text}"
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="text-sm text-red-500">Brak ceny</div>
                                          )}
                                          {kr.candidates?.length > 1 && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Pozostali kandydaci: {kr.candidates.slice(1).map(c => `${c.price}zł(${c.method})`).join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResultBC.prices?.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny (podsumowanie)</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                  {debugResultBC.prices.map((p, idx) => (
                                    <div key={idx} className="text-sm flex justify-between items-center bg-green-50 dark:bg-green-950 p-2 rounded">
                                      <span>{p.kcal} kcal</span>
                                      <span className="font-medium text-green-600">{p.dailyPrice} zł/dzień</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {debugResultBC.scrapeLogs?.length > 0 && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Logi scrapera ({debugResultBC.scrapeLogs.length} wpisów)</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-60 overflow-auto">
                                  {debugResultBC.scrapeLogs.join('\n')}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Results */}
              {lastResultBC && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lastResultBC.success ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                      <span className="font-medium">Wynik ostatniego uruchomienia</span>
                    </div>
                    {lastResultBC.success ? <Badge className="bg-green-500">Sukces</Badge> : <Badge variant="destructive">Błąd</Badge>}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded">
                      <div className="text-purple-600 dark:text-purple-400 font-medium">Przetworzono</div>
                      <div className="text-2xl font-bold">{lastResultBC.dietsProcessed}</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded">
                      <div className="text-green-600 dark:text-green-400 font-medium">Zapisane</div>
                      <div className="text-2xl font-bold">{lastResultBC.savedCount}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                      <div className="text-blue-600 dark:text-blue-400 font-medium">Zaktualizowane</div>
                      <div className="text-2xl font-bold">{lastResultBC.updatedCount}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                      <div className="text-gray-600 dark:text-gray-400 font-medium">Pominięte</div>
                      <div className="text-2xl font-bold">{lastResultBC.skippedCount}</div>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded">
                      <div className="text-orange-600 dark:text-orange-400 font-medium">Czas</div>
                      <div className="text-2xl font-bold">{(lastResultBC.executionTimeMs / 1000).toFixed(1)}s</div>
                    </div>
                  </div>

                  {lastResultBC.results?.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Zescrapowane ceny:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                        {lastResultBC.results.map((r, idx) => (
                          <div key={idx} className={`flex justify-between items-center p-2 rounded text-sm ${r.price ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                            <span className="truncate flex-1">{r.diet}</span>
                            <span className="font-medium ml-2">{r.price ? `${r.price} zł` : '❌'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lastResultBC.errors && lastResultBC.errors.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-600 mb-2">Błędy ({lastResultBC.errors.length}):</h4>
                      <ul className="text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
                        {lastResultBC.errors.slice(0, 10).map((err, idx) => (<li key={idx}>• {err}</li>))}
                        {lastResultBC.errors.length > 10 && <li className="text-muted-foreground">... i {lastResultBC.errors.length - 10} więcej</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gastropaczka Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Gastropaczka Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z konfiguratora panel.gastropaczka.pl ({GASTROPACZKA_CONFIG_OPTIONS.length} pakietów)
                </CardDescription>
              </div>
              <Button 
                onClick={runGastropaczkaBatch} 
                disabled={isRunningGP || isDebuggingGP}
                className="gap-2"
              >
                {isRunningGP ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Batch...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom Batch</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Pakiety:</span><span className="ml-2 font-medium">{GASTROPACZKA_CONFIG_OPTIONS.length}</span></div>
                <div><span className="text-muted-foreground">Timeout:</span><span className="ml-2 font-medium">15s</span></div>
                <div><span className="text-muted-foreground">Typ:</span><span className="ml-2 font-medium">SPA</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.gastropaczka?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.gastropaczka?.pricesCount || 0}
                scraperName="gastropaczka"
                isLoading={isLoadingScrapeStats}
              />

              {batchProgressGP && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Postęp batch: {batchProgressGP.current}/{batchProgressGP.total}</span>
                    <span>{Math.round((batchProgressGP.current / batchProgressGP.total) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${(batchProgressGP.current / batchProgressGP.total) * 100}%` }} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Aktualnie: {batchProgressGP.packageName}</div>
                </div>
              )}

              <Collapsible open={isDebugOpenGP} onOpenChange={setIsDebugOpenGP}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenGP ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={selectedConfigGP} onValueChange={setSelectedConfigGP}>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Wybierz pakiet" />
                        </SelectTrigger>
                        <SelectContent>
                          {GASTROPACZKA_CONFIG_OPTIONS.map((c) => (
                            <SelectItem key={c.index} value={String(c.index)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMaxKcalsGP} onValueChange={setSelectedMaxKcalsGP}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Max kcal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 kcal</SelectItem>
                          <SelectItem value="3">3 kcal</SelectItem>
                          <SelectItem value="5">5 kcal</SelectItem>
                          <SelectItem value="99">Wszystkie</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={runDebugGP} disabled={isDebuggingGP || isRunningGP} className="gap-2">
                        {isDebuggingGP ? <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</> : <><Bug className="h-4 w-4" /> Debug</>}
                      </Button>
                    </div>

                    {debugResultGP && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Pakiet:</span>
                          <span>{debugResultGP.packageName}</span>
                          <span className="text-muted-foreground">| {(debugResultGP.executionTimeMs / 1000).toFixed(1)}s</span>
                        </div>
                        {debugResultGP.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600"><strong>Błąd:</strong> {debugResultGP.error}</div>
                        ) : (
                          <div className="grid gap-2">
                            <div className="bg-background p-2 rounded border">
                              <div className="text-muted-foreground text-xs">Wyekstrahowane ceny: {debugResultGP.pricesExtracted}</div>
                              {debugResultGP.prices?.map((p, idx) => (
                                <div key={idx} className="text-sm flex justify-between bg-green-50 dark:bg-green-950 p-2 rounded mt-1">
                                  <span>{p.kcal} kcal</span>
                                  <span className="font-medium text-green-600">{p.dailyPrice} zł/dzień</span>
                                </div>
                              ))}
                            </div>
                            {debugResultGP.scrapeLogs?.length > 0 && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Logi ({debugResultGP.scrapeLogs.length})</div>
                                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded max-h-40 overflow-auto">{debugResultGP.scrapeLogs.join('\n')}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {lastResultGP && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lastResultGP.success ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                      <span className="font-medium">Wynik ostatniego uruchomienia</span>
                    </div>
                    {lastResultGP.success ? <Badge className="bg-green-500">Sukces</Badge> : <Badge variant="destructive">Błąd</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded">
                      <div className="text-green-600 font-medium">Zapisane</div>
                      <div className="text-2xl font-bold">{lastResultGP.savedCount}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
                      <div className="text-blue-600 font-medium">Zaktualizowane</div>
                      <div className="text-2xl font-bold">{lastResultGP.updatedCount}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
                      <div className="text-gray-600 font-medium">Pominięte</div>
                      <div className="text-2xl font-bold">{lastResultGP.skippedCount}</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded">
                      <div className="text-purple-600 font-medium">Ceny</div>
                      <div className="text-2xl font-bold">{lastResultGP.pricesExtracted}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Kuchnia Vikinga Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Kuchnia Vikinga Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z kuchniavikinga.pl/cennik/ ({KUCHNIA_VIKINGA_DIET_OPTIONS.length} diet)
                </CardDescription>
              </div>
              <Button 
                onClick={runKuchniaVikingaBatch} 
                disabled={isRunningKV || isDebuggingKV}
                className="gap-2"
              >
                {isRunningKV ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Diety:</span><span className="ml-2 font-medium">{KUCHNIA_VIKINGA_DIET_OPTIONS.length}</span></div>
                <div><span className="text-muted-foreground">Typ strony:</span><span className="ml-2 font-medium">Statyczna HTML</span></div>
                <div><span className="text-muted-foreground">Metoda:</span><span className="ml-2 font-medium">Fetch + Regex</span></div>
                <div><span className="text-muted-foreground">Kcal:</span><span className="ml-2 font-medium">1200-3000</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.kuchniavikinga?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.kuchniavikinga?.pricesCount || 0}
                scraperName="kuchniavikinga"
                isLoading={isLoadingScrapeStats}
              />

              <Collapsible open={isDebugOpenKV} onOpenChange={setIsDebugOpenKV}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenKV ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={selectedDietKV} onValueChange={setSelectedDietKV}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Wybierz dietę" />
                        </SelectTrigger>
                        <SelectContent>
                          {KUCHNIA_VIKINGA_DIET_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={runDebugKV} disabled={isDebuggingKV || isRunningKV} className="gap-2">
                        {isDebuggingKV ? <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</> : <><Bug className="h-4 w-4" /> Debug</>}
                      </Button>
                    </div>

                    {debugResultKV && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Dieta:</span>
                          <span>{debugResultKV.diet}</span>
                          <span className="text-muted-foreground">| {(debugResultKV.executionTimeMs / 1000).toFixed(1)}s</span>
                        </div>
                        {debugResultKV.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600"><strong>Błąd:</strong> {debugResultKV.error}</div>
                        ) : (
                          <div className="grid gap-2">
                            <div className="bg-background p-2 rounded border">
                              <div className="text-muted-foreground text-xs">
                                HTML: {debugResultKV.debugInfo?.htmlLength} znaków | 
                                Dieta znalezione: {debugResultKV.allDietsFound} | 
                                Ceny: {debugResultKV.totalPricesFound}
                              </div>
                            </div>
                            {debugResultKV.debugInfo?.pricesExtracted?.length > 0 && (
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs mb-1">Wyekstrahowane ceny:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                  {debugResultKV.debugInfo.pricesExtracted.map((p, idx) => (
                                    <div key={idx} className="text-sm flex justify-between bg-green-50 dark:bg-green-950 p-2 rounded">
                                      <span>{p.diet} {p.kcal} kcal</span>
                                      <span className="font-medium text-green-600">{p.price} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {lastResultKV && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResultKV.status}
                    totalVariants={lastResultKV.totalVariants}
                    savedCount={lastResultKV.savedCount}
                    updatedCount={lastResultKV.updatedCount}
                    skippedCount={lastResultKV.skippedCount}
                    executionTimeMs={lastResultKV.executionTimeMs}
                    results={lastResultKV.results}
                    errors={lastResultKV.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MaczFit Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  MaczFit Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z maczfit.pl (14 diet, ~6 wariantów kcal)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={runMaczfitBatch} 
                  disabled={isRunningMF || isDebuggingMF}
                  className="gap-2"
                >
                  {isRunningMF ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                  ) : (
                    <><Play className="h-4 w-4" /> Uruchom</>
                  )}
                </Button>
                {isRunningMF && (
                  <Button 
                    variant="destructive" 
                    size="default"
                    onClick={() => setShouldCancelMF(true)}
                    disabled={shouldCancelMF}
                    className="gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    {shouldCancelMF ? 'Anulowanie...' : 'Anuluj'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Diety:</span><span className="ml-2 font-medium">14</span></div>
                <div><span className="text-muted-foreground">Warianty kcal:</span><span className="ml-2 font-medium">~6/dieta</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">maczfit.pl/sklep/opcje</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Browserless.io</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.maczfit?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.maczfit?.pricesCount || 0}
                scraperName="maczfit"
                isLoading={isLoadingScrapeStats}
              />
              <Collapsible open={isDebugOpenMF} onOpenChange={setIsDebugOpenMF}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenMF ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select value={selectedDietMF} onValueChange={setSelectedDietMF}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Wybierz dietę" />
                        </SelectTrigger>
                        <SelectContent>
                          {MACZFIT_DIET_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugMF}
                        disabled={isDebuggingMF || isRunningMF}
                        className="gap-2"
                      >
                        {isDebuggingMF ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug</>
                        )}
                      </Button>
                    </div>

                    {debugResultMF && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">Dieta:</span>
                          <span>{MACZFIT_DIET_OPTIONS[parseInt(selectedDietMF)]?.name}</span>
                          <span className="text-muted-foreground">({(debugResultMF.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResultMF.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultMF.error}
                          </div>
                        ) : debugResultMF.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Dieta znalezione</div>
                                <div className="font-mono">{debugResultMF.allDietsFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny</div>
                                <div className="font-mono">{debugResultMF.totalPricesFound}</div>
                              </div>
                            </div>

                            {debugResultMF.debugInfo.pricesExtracted?.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                  {debugResultMF.debugInfo.pricesExtracted.map((p: any, idx) => (
                                    <div key={idx} className="text-sm flex justify-between bg-green-50 dark:bg-green-950 p-2 rounded">
                                      <span>{p.diet} {p.kcal} kcal</span>
                                      <span className="font-medium text-green-600">{p.price || p.regularPrice} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {lastResultMF && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResultMF.status}
                    totalVariants={lastResultMF.totalVariants}
                    savedCount={lastResultMF.savedCount}
                    updatedCount={lastResultMF.updatedCount}
                    skippedCount={lastResultMF.skippedCount}
                    executionTimeMs={lastResultMF.executionTimeMs}
                    results={lastResultMF.results}
                    errors={lastResultMF.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pomelo Scraper */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Pomelo Scraper
                </CardTitle>
                <CardDescription>
                  Scraper cen z pomelo.com.pl/cennik (13 diet, ~6-10 wariantów kcal każda)
                </CardDescription>
              </div>
              <Button 
                onClick={runPomeloBatch} 
                disabled={isRunningPO || isDebuggingPO}
                className="gap-2"
              >
                {isRunningPO ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scrapowanie...</>
                ) : (
                  <><Play className="h-4 w-4" /> Uruchom</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Diety:</span><span className="ml-2 font-medium">13</span></div>
                <div><span className="text-muted-foreground">Warianty kcal:</span><span className="ml-2 font-medium">~8 per dieta</span></div>
                <div><span className="text-muted-foreground">Źródło:</span><span className="ml-2 font-medium">pomelo.com.pl/cennik</span></div>
                <div><span className="text-muted-foreground">Narzędzie:</span><span className="ml-2 font-medium">Direct fetch</span></div>
              </div>

              <LastScrapeInfo 
                lastScrapeAt={lastScrapeStats?.pomelo?.lastScrapeAt || null}
                pricesCount={lastScrapeStats?.pomelo?.pricesCount || 0}
                scraperName="pomelo"
                isLoading={isLoadingScrapeStats}
              />

              {/* Batch Progress */}
              {batchProgressPO && (
                <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Przetwarzanie: <strong>{batchProgressPO.dietName}</strong></span>
                    <span>{batchProgressPO.current}/{batchProgressPO.total}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgressPO.current / batchProgressPO.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Batch Results */}
              {batchResultsPO.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {batchResultsPO.map((r) => (
                    <div key={r.dietIndex} className={`p-2 rounded text-sm ${r.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                      <div className="flex items-center justify-between">
                        <span className="truncate">{r.dietName}</span>
                        {r.success ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      </div>
                      {r.success && <div className="text-xs text-muted-foreground mt-1">+{r.savedCount} / ↻{r.updatedCount}</div>}
                      {r.error && <div className="text-xs text-red-600 truncate">{r.error}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Debug Section */}
              <Collapsible open={isDebugOpenPO} onOpenChange={setIsDebugOpenPO}>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4" />
                      <span className="font-medium">Tryb Debug</span>
                    </div>
                    {isDebugOpenPO ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="flex gap-2 items-center">
                      <Select value={selectedDietPO} onValueChange={setSelectedDietPO}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Wybierz dietę" />
                        </SelectTrigger>
                        <SelectContent>
                          {POMELO_DIET_OPTIONS.map((d) => (
                            <SelectItem key={d.index} value={String(d.index)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        onClick={runDebugPO}
                        disabled={isDebuggingPO || isRunningPO}
                        className="gap-2"
                      >
                        {isDebuggingPO ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Debugowanie...</>
                        ) : (
                          <><Bug className="h-4 w-4" /> Debug</>
                        )}
                      </Button>
                    </div>

                    {debugResultPO && (
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Dieta:</span>
                          <span>{debugResultPO.diet}</span>
                          <span className="text-muted-foreground">({(debugResultPO.executionTimeMs / 1000).toFixed(1)}s)</span>
                        </div>

                        {debugResultPO.error ? (
                          <div className="bg-red-50 dark:bg-red-950 p-3 rounded text-red-600">
                            <strong>Błąd:</strong> {debugResultPO.error}
                          </div>
                        ) : debugResultPO.debugInfo && (
                          <div className="grid gap-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">HTML Length</div>
                                <div className="font-mono">{debugResultPO.debugInfo.htmlLength.toLocaleString()}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Znalezione diety</div>
                                <div className="font-mono">{debugResultPO.allDietsFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny (łącznie)</div>
                                <div className="font-mono">{debugResultPO.totalPricesFound}</div>
                              </div>
                              <div className="bg-background p-2 rounded border">
                                <div className="text-muted-foreground text-xs">Ceny dla diety</div>
                                <div className="font-mono">{debugResultPO.debugInfo.pricesExtracted.length}</div>
                              </div>
                            </div>

                            {debugResultPO.debugInfo.pricesExtracted.length > 0 && (
                              <div className="bg-background p-3 rounded border">
                                <div className="text-muted-foreground text-xs mb-2">Wyekstrahowane ceny</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                  {debugResultPO.debugInfo.pricesExtracted.map((p: any, idx: number) => (
                                    <div key={idx} className="text-sm flex justify-between bg-green-50 dark:bg-green-950 p-2 rounded">
                                      <span>{p.diet} {p.kcal} kcal</span>
                                      <span className="font-medium text-green-600">{p.regularPrice || p.price} zł</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {lastResultPO && (
                <div className="border rounded-lg p-4">
                  <ScraperResultSummary
                    status={lastResultPO.status}
                    totalVariants={lastResultPO.totalVariants}
                    savedCount={lastResultPO.savedCount}
                    updatedCount={lastResultPO.updatedCount}
                    skippedCount={lastResultPO.skippedCount}
                    executionTimeMs={lastResultPO.executionTimeMs}
                    results={lastResultPO.results}
                    errors={lastResultPO.errors}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}
