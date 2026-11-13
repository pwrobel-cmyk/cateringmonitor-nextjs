// Model retencji i cen (CateringBrain v1).
// Czysta logika bez zależności od Supabase/React — da się ją testować w Node.
//
// Co model liczy:
//  A) Model aspektów: regresja logistyczna trenowana na opiniach całego rynku.
//     y = opinia negatywna (ocena <= 2), cechy = wzmianki o aspektach.
//     Daje wagi rynkowe oraz "nadwyżkę negatywów" marki względem normy rynku.
//  B) Model cenowy: event study typu difference-in-differences.
//     Dla każdej zmiany ceny porównuje udział negatywnych opinii marki
//     przed/po ze zmianą na reszcie rynku w tym samym oknie, a potem dopasowuje
//     prostą regresję: zmiana udziału negatywów ~ % zmiany ceny.
//  C) Kalkulator wartości: czysta arytmetyka na liczbach podanych przez klienta.
//
// Czego model NIE liczy: związku między opiniami a odejściami klientów.
// Do tego potrzebne są dane o zamówieniach cateringu, których tu nie ma.

export interface ReviewRow {
  brand_id: string;
  rating: number | null;
  content: string | null;
  review_date: string; // ISO (YYYY-MM-DD lub pełny timestamp)
}

export interface PriceChangeRow {
  brand_id: string;
  change_percent: number;
  change_date: string; // YYYY-MM-DD
}

export const ASPECTS: Record<string, string[]> = {
  smak: ["smak", "smaczn", "pyszn", "niedobr", "mdł", "bez wyrazu"],
  dostawa: ["dostaw", "kurier", "spóźn", "opóźn", "nie dotar", "dowóz", "dowoz"],
  cena: ["cen", "drogi", "drogo", "tani", "kosztuj", "podwyż"],
  jakość: ["jakoś", "jakos"],
  świeżość: ["śwież", "swiez", "zepsut", "spleśn", "nieśwież", "kwaśn", "skisł"],
  porcje: ["porcj", "mało jedzenia", "głodn", "wielkość", "gramatur"],
  pomyłki: ["pomył", "brakował", "brak posiłk", "zamiast", "nie ten", "błędn", "bledn"],
  obsługa: ["obsług", "obslug", "kontakt", "infolini", "reklamacj", "biuro obsługi"],
  opakowanie: ["opakowan", "pudełk", "pudelk", "rozlan", "foli", "uszkodz"],
};

export const ASPECT_KEYS = Object.keys(ASPECTS);

const DAY_MS = 86_400_000;

function toTime(d: string): number {
  return new Date(d.length === 10 ? d + "T00:00:00Z" : d).getTime();
}

export function detectAspects(content: string | null): boolean[] {
  const text = (content || "").toLowerCase();
  return ASPECT_KEYS.map((k) => ASPECTS[k].some((kw) => text.includes(kw)));
}

function sigmoid(z: number): number {
  if (z > 30) return 1;
  if (z < -30) return 0;
  return 1 / (1 + Math.exp(-z));
}

// ---------------------------------------------------------------------------
// A) Model aspektów
// ---------------------------------------------------------------------------

export interface AspectModel {
  intercept: number;
  weights: number[]; // w kolejności ASPECT_KEYS
  trainedOn: number; // liczba opinii użytych do treningu
  baseNegativeRate: number; // udział negatywów w zbiorze treningowym
}

interface Sample {
  x: boolean[];
  y: number;
}

function toSamples(reviews: ReviewRow[]): Sample[] {
  const out: Sample[] = [];
  for (const r of reviews) {
    if (r.rating === null || r.rating === undefined) continue;
    if (!r.content || r.content.trim().length < 3) continue;
    out.push({ x: detectAspects(r.content), y: r.rating <= 2 ? 1 : 0 });
  }
  return out;
}

/** Regresja logistyczna z regularyzacją L2, pełny gradient. */
export function trainAspectModel(
  reviews: ReviewRow[],
  opts: { iterations?: number; learningRate?: number; l2?: number } = {}
): AspectModel | null {
  const samples = toSamples(reviews);
  const n = samples.length;
  if (n < 200) return null; // za mało danych, żeby wagi cokolwiek znaczyły

  const iterations = opts.iterations ?? 400;
  const lr = opts.learningRate ?? 0.5;
  const l2 = opts.l2 ?? 0.001;
  const k = ASPECT_KEYS.length;

  const base = samples.reduce((s, r) => s + r.y, 0) / n;
  const clamped = Math.min(Math.max(base, 1e-4), 1 - 1e-4);
  let b = Math.log(clamped / (1 - clamped));
  const w = new Array<number>(k).fill(0);

  for (let it = 0; it < iterations; it++) {
    let gb = 0;
    const gw = new Array<number>(k).fill(0);
    for (const s of samples) {
      let z = b;
      for (let j = 0; j < k; j++) if (s.x[j]) z += w[j];
      const err = sigmoid(z) - s.y;
      gb += err;
      for (let j = 0; j < k; j++) if (s.x[j]) gw[j] += err;
    }
    b -= (lr * gb) / n;
    for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
  }

  return { intercept: b, weights: w, trainedOn: n, baseNegativeRate: base };
}

export function predictNegative(model: AspectModel, x: boolean[]): number {
  let z = model.intercept;
  for (let j = 0; j < x.length; j++) if (x[j]) z += model.weights[j];
  return sigmoid(z);
}

export interface AspectDriver {
  aspect: string;
  mentions: number; // opinie marki ze wzmianką
  negatives: number; // w tym negatywne
  brandNegRate: number; // 0..1
  marketNegRate: number; // 0..1, reszta rynku
  excessNegatives: number; // negatywy ponad normę rynku (może być < 0)
  marketOddsRatio: number; // exp(waga) z modelu rynkowego
  trendPp: number | null; // zmiana udziału negatywów: ostatnie 90 dni vs poprzednie 90 (pp)
}

export interface BrandDiagnosis {
  reviewsUsed: number;
  negatives: number;
  negativeRate: number;
  expectedNegatives: number | null; // wg modelu rynkowego, dla miksu tematów tej marki
  drivers: AspectDriver[]; // posortowane malejąco po excessNegatives
}

export function diagnoseBrand(
  brandId: string,
  reviews: ReviewRow[],
  model: AspectModel | null,
  now: number = Date.now()
): BrandDiagnosis {
  const k = ASPECT_KEYS.length;
  const brandMent = new Array<number>(k).fill(0);
  const brandNeg = new Array<number>(k).fill(0);
  const mktMent = new Array<number>(k).fill(0);
  const mktNeg = new Array<number>(k).fill(0);
  const recentMent = new Array<number>(k).fill(0);
  const recentNeg = new Array<number>(k).fill(0);
  const prevMent = new Array<number>(k).fill(0);
  const prevNeg = new Array<number>(k).fill(0);

  let used = 0;
  let negatives = 0;
  let expected = 0;

  for (const r of reviews) {
    if (r.rating === null || r.rating === undefined) continue;
    if (!r.content || r.content.trim().length < 3) continue;
    const x = detectAspects(r.content);
    const neg = r.rating <= 2 ? 1 : 0;
    const own = r.brand_id === brandId;

    if (own) {
      used++;
      negatives += neg;
      if (model) expected += predictNegative(model, x);
      const age = (now - toTime(r.review_date)) / DAY_MS;
      for (let j = 0; j < k; j++) {
        if (!x[j]) continue;
        brandMent[j]++;
        brandNeg[j] += neg;
        if (age >= 0 && age < 90) {
          recentMent[j]++;
          recentNeg[j] += neg;
        } else if (age >= 90 && age < 180) {
          prevMent[j]++;
          prevNeg[j] += neg;
        }
      }
    } else {
      for (let j = 0; j < k; j++) {
        if (!x[j]) continue;
        mktMent[j]++;
        mktNeg[j] += neg;
      }
    }
  }

  const drivers: AspectDriver[] = ASPECT_KEYS.map((aspect, j) => {
    const brandRate = brandMent[j] > 0 ? brandNeg[j] / brandMent[j] : 0;
    const marketRate = mktMent[j] > 0 ? mktNeg[j] / mktMent[j] : 0;
    const trend =
      recentMent[j] >= 10 && prevMent[j] >= 10
        ? (recentNeg[j] / recentMent[j] - prevNeg[j] / prevMent[j]) * 100
        : null;
    return {
      aspect,
      mentions: brandMent[j],
      negatives: brandNeg[j],
      brandNegRate: brandRate,
      marketNegRate: marketRate,
      excessNegatives: brandMent[j] * (brandRate - marketRate),
      marketOddsRatio: model ? Math.exp(model.weights[j]) : 1,
      trendPp: trend,
    };
  }).sort((a, b) => b.excessNegatives - a.excessNegatives);

  return {
    reviewsUsed: used,
    negatives,
    negativeRate: used > 0 ? negatives / used : 0,
    expectedNegatives: model ? expected : null,
    drivers,
  };
}

// ---------------------------------------------------------------------------
// B) Model cenowy (event study, difference-in-differences)
// ---------------------------------------------------------------------------

export interface PriceEvent {
  brandId: string;
  date: string;
  changePercent: number; // mediana po pakietach z tego dnia
  brandBefore: number; // udział negatywów marki, okno przed
  brandAfter: number;
  marketBefore: number;
  marketAfter: number;
  did: number; // (after-before marki) - (after-before rynku), w pp
  nBefore: number;
  nAfter: number;
}

export interface PriceModel {
  events: PriceEvent[];
  n: number;
  slope: number | null; // pp udziału negatywów na 1% zmiany ceny
  intercept: number | null;
  slopeStdErr: number | null;
  r2: number | null;
  reliability: "brak" | "niska" | "średnia" | "wysoka";
  windowDays: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function buildPriceModel(
  reviews: ReviewRow[],
  priceChanges: PriceChangeRow[],
  opts: { windowDays?: number; minReviews?: number; minAbsChange?: number } = {}
): PriceModel {
  const windowDays = opts.windowDays ?? 60;
  const minReviews = opts.minReviews ?? 10;
  const minAbsChange = opts.minAbsChange ?? 1;
  const win = windowDays * DAY_MS;

  // Indeks opinii: per marka posortowane po czasie + cały rynek.
  const rated = reviews
    .filter((r) => r.rating !== null && r.rating !== undefined)
    .map((r) => ({ b: r.brand_id, t: toTime(r.review_date), neg: (r.rating as number) <= 2 ? 1 : 0 }))
    .filter((r) => Number.isFinite(r.t));

  const byBrand = new Map<string, { t: number; neg: number }[]>();
  for (const r of rated) {
    if (!byBrand.has(r.b)) byBrand.set(r.b, []);
    byBrand.get(r.b)!.push({ t: r.t, neg: r.neg });
  }

  function share(rows: { t: number; neg: number }[], from: number, to: number) {
    let n = 0;
    let neg = 0;
    for (const r of rows) {
      if (r.t >= from && r.t < to) {
        n++;
        neg += r.neg;
      }
    }
    return { n, neg };
  }

  // Grupowanie zmian: marka + dzień -> mediana % zmiany.
  const grouped = new Map<string, number[]>();
  for (const p of priceChanges) {
    if (!Number.isFinite(p.change_percent) || !p.change_date) continue;
    const key = `${p.brand_id}|${p.change_date.slice(0, 10)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p.change_percent);
  }

  const events: PriceEvent[] = [];
  for (const [key, pcts] of grouped) {
    const [brandId, date] = key.split("|");
    const changePercent = median(pcts);
    if (Math.abs(changePercent) < minAbsChange) continue;
    const own = byBrand.get(brandId);
    if (!own) continue;
    const t0 = toTime(date);

    const before = share(own, t0 - win, t0);
    const after = share(own, t0, t0 + win);
    if (before.n < minReviews || after.n < minReviews) continue;

    let mbN = 0, mbNeg = 0, maN = 0, maNeg = 0;
    for (const [b, rows] of byBrand) {
      if (b === brandId) continue;
      const x = share(rows, t0 - win, t0);
      const y = share(rows, t0, t0 + win);
      mbN += x.n; mbNeg += x.neg; maN += y.n; maNeg += y.neg;
    }
    if (mbN < minReviews || maN < minReviews) continue;

    const brandBefore = before.neg / before.n;
    const brandAfter = after.neg / after.n;
    const marketBefore = mbNeg / mbN;
    const marketAfter = maNeg / maN;

    events.push({
      brandId,
      date,
      changePercent,
      brandBefore,
      brandAfter,
      marketBefore,
      marketAfter,
      did: ((brandAfter - brandBefore) - (marketAfter - marketBefore)) * 100,
      nBefore: before.n,
      nAfter: after.n,
    });
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  const n = events.length;
  let slope: number | null = null;
  let intercept: number | null = null;
  let slopeStdErr: number | null = null;
  let r2: number | null = null;

  if (n >= 5) {
    const mx = events.reduce((s, e) => s + e.changePercent, 0) / n;
    const my = events.reduce((s, e) => s + e.did, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (const e of events) {
      sxx += (e.changePercent - mx) ** 2;
      sxy += (e.changePercent - mx) * (e.did - my);
      syy += (e.did - my) ** 2;
    }
    if (sxx > 0) {
      slope = sxy / sxx;
      intercept = my - slope * mx;
      let sse = 0;
      for (const e of events) sse += (e.did - (intercept + slope * e.changePercent)) ** 2;
      slopeStdErr = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : null;
      r2 = syy > 0 ? 1 - sse / syy : null;
    }
  }

  let reliability: PriceModel["reliability"] = "brak";
  if (slope !== null) reliability = n >= 60 ? "wysoka" : n >= 25 ? "średnia" : "niska";

  return { events, n, slope, intercept, slopeStdErr, r2, reliability, windowDays };
}

export function predictPriceEffect(model: PriceModel, changePercent: number) {
  if (model.slope === null || model.intercept === null) return null;
  const point = model.intercept + model.slope * changePercent;
  const half = model.slopeStdErr !== null ? 1.96 * model.slopeStdErr * Math.abs(changePercent) : null;
  return { pointPp: point, lowPp: half !== null ? point - half : null, highPp: half !== null ? point + half : null };
}

// ---------------------------------------------------------------------------
// C) Kalkulator wartości (arytmetyka na danych klienta)
// ---------------------------------------------------------------------------

export interface ValueInputs {
  activeCustomers: number;
  revenuePerCustomer: number; // zł / mies.
  marginPct: number; // 0..100
  churnPct: number; // 0..100, miesięcznie
}

export function computeValue(v: ValueInputs) {
  const churn = v.churnPct / 100;
  const margin = v.marginPct / 100;
  const lifetimeMonths = churn > 0 ? 1 / churn : 0;
  const monthlyRevenue = v.activeCustomers * v.revenuePerCustomer;
  const profitPerSavedCustomer = v.revenuePerCustomer * margin * lifetimeMonths;
  return {
    lifetimeMonths,
    monthlyRevenue,
    monthlyProfit: monthlyRevenue * margin,
    profitPerSavedCustomer,
    // 1 pp churnu mniej = 1% aktywnych klientów zostaje
    valueOfOnePpChurn: v.activeCustomers * 0.01 * profitPerSavedCustomer,
    // +1% ceny przy niezmienionym wolumenie trafia w całości do zysku
    valueOfOnePctPrice: monthlyRevenue * 0.01,
  };
}

// ---------------------------------------------------------------------------
// D) Raport dla właściciela: co się psuje, gdzie przegrywa, w czym wygrywa
// ---------------------------------------------------------------------------

export interface ReviewExample {
  date: string;
  rating: number;
  text: string;
}

export interface OwnerTopic {
  aspect: string;
  mentions: number;
  negatives: number;
  brandPer100: number; // negatywnych na 100 opinii o temacie
  marketPer100: number;
  rank: number | null; // 1 = najmniej negatywów wśród marek z wystarczającą liczbą wzmianek
  rankedBrands: number;
  recentPer100: number | null; // ostatnie 90 dni
  previousPer100: number | null; // poprzednie 90 dni
  recentNegatives: number; // negatywne z ostatnich 90 dni
  examples: ReviewExample[]; // najnowsze negatywne opinie o temacie
}

export interface OwnerReport {
  reviewsUsed: number;
  brandPer100: number;
  marketPer100: number;
  overallRank: number | null;
  overallRankedBrands: number;
  worsening: OwnerTopic[]; // rośnie udział negatywów w ostatnich 90 dniach
  losing: OwnerTopic[]; // gorzej niż rynek
  strengths: OwnerTopic[]; // wyraźnie lepiej niż rynek
  all: OwnerTopic[];
}

const MIN_RANK_MENTIONS = 20;

function clip(text: string, max = 240): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

export function buildOwnerReport(
  brandId: string,
  reviews: ReviewRow[],
  now: number = Date.now()
): OwnerReport {
  const k = ASPECT_KEYS.length;
  // per marka: [wzmianki, negatywy] na temat + ogółem
  const per = new Map<string, { m: number[]; n: number[]; total: number; neg: number }>();
  const recentM = new Array<number>(k).fill(0);
  const recentN = new Array<number>(k).fill(0);
  const prevM = new Array<number>(k).fill(0);
  const prevN = new Array<number>(k).fill(0);
  const examples: ReviewExample[][] = ASPECT_KEYS.map(() => []);

  for (const r of reviews) {
    if (r.rating === null || r.rating === undefined) continue;
    if (!r.content || r.content.trim().length < 3) continue;
    const x = detectAspects(r.content);
    const neg = r.rating <= 2 ? 1 : 0;
    let b = per.get(r.brand_id);
    if (!b) {
      b = { m: new Array<number>(k).fill(0), n: new Array<number>(k).fill(0), total: 0, neg: 0 };
      per.set(r.brand_id, b);
    }
    b.total++;
    b.neg += neg;
    const own = r.brand_id === brandId;
    const age = own ? (now - toTime(r.review_date)) / DAY_MS : 0;
    for (let j = 0; j < k; j++) {
      if (!x[j]) continue;
      b.m[j]++;
      b.n[j] += neg;
      if (!own) continue;
      if (age >= 0 && age < 90) { recentM[j]++; recentN[j] += neg; }
      else if (age >= 90 && age < 180) { prevM[j]++; prevN[j] += neg; }
      if (neg) examples[j].push({ date: r.review_date.slice(0, 10), rating: r.rating, text: clip(r.content) });
    }
  }

  const own = per.get(brandId) ?? { m: new Array<number>(k).fill(0), n: new Array<number>(k).fill(0), total: 0, neg: 0 };

  let mktTotal = 0, mktNeg = 0;
  const overallRates: { id: string; rate: number }[] = [];
  for (const [id, b] of per) {
    if (id !== brandId) { mktTotal += b.total; mktNeg += b.neg; }
    if (b.total >= 50) overallRates.push({ id, rate: b.neg / b.total });
  }
  overallRates.sort((a, b) => a.rate - b.rate);
  const overallIdx = overallRates.findIndex((r) => r.id === brandId);

  const all: OwnerTopic[] = ASPECT_KEYS.map((aspect, j) => {
    let mM = 0, mN = 0;
    const rates: { id: string; rate: number }[] = [];
    for (const [id, b] of per) {
      if (id !== brandId) { mM += b.m[j]; mN += b.n[j]; }
      if (b.m[j] >= MIN_RANK_MENTIONS) rates.push({ id, rate: b.n[j] / b.m[j] });
    }
    rates.sort((a, b) => a.rate - b.rate);
    const idx = rates.findIndex((r) => r.id === brandId);
    examples[j].sort((a, b) => (a.date < b.date ? 1 : -1));
    return {
      aspect,
      mentions: own.m[j],
      negatives: own.n[j],
      brandPer100: own.m[j] > 0 ? (own.n[j] / own.m[j]) * 100 : 0,
      marketPer100: mM > 0 ? (mN / mM) * 100 : 0,
      rank: idx >= 0 ? idx + 1 : null,
      rankedBrands: rates.length,
      recentPer100: recentM[j] >= 10 ? (recentN[j] / recentM[j]) * 100 : null,
      previousPer100: prevM[j] >= 10 ? (prevN[j] / prevM[j]) * 100 : null,
      recentNegatives: recentN[j],
      examples: examples[j].slice(0, 3),
    };
  });

  const worsening = all
    .filter((t) => t.recentPer100 !== null && t.previousPer100 !== null && t.recentPer100 - t.previousPer100 >= 3 && t.recentNegatives >= 3)
    .sort((a, b) => (b.recentPer100! - b.previousPer100!) - (a.recentPer100! - a.previousPer100!));
  const worseningSet = new Set(worsening.map((t) => t.aspect));
  const losing = all
    .filter((t) => !worseningSet.has(t.aspect) && t.mentions >= MIN_RANK_MENTIONS && t.negatives >= 5 && t.brandPer100 - t.marketPer100 >= 3)
    .sort((a, b) => (b.brandPer100 - b.marketPer100) - (a.brandPer100 - a.marketPer100));
  const strengths = all
    .filter((t) => !worseningSet.has(t.aspect) && t.mentions >= 30 && t.marketPer100 - t.brandPer100 >= 5)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (b.marketPer100 - b.brandPer100) - (a.marketPer100 - a.brandPer100));

  return {
    reviewsUsed: own.total,
    brandPer100: own.total > 0 ? (own.neg / own.total) * 100 : 0,
    marketPer100: mktTotal > 0 ? (mktNeg / mktTotal) * 100 : 0,
    overallRank: overallIdx >= 0 ? overallIdx + 1 : null,
    overallRankedBrands: overallRates.length,
    worsening,
    losing,
    strengths,
    all,
  };
}

// ---------------------------------------------------------------------------
// E) Pozycja cenowa: cena marki vs cena, jaką rynek bierze za podobną jakość
// ---------------------------------------------------------------------------
//
// Oferty grupujemy w segmenty (typ diety + kaloryczność). W każdym segmencie
// log(cena) = efekt segmentu + beta * jakość marki. Jakość = udział negatywnych
// opinii marki (na 100). Beta uczymy na całym rynku; gdy nie jest istotna
// statystycznie, przyjmujemy 0 i porównujemy do średniej segmentu.

export interface ActiveOffer {
  brandName: string;
  packageName: string;
  segment: string; // np. "Standard"
  kcal: number; // koszyk kaloryczności
  price: number; // zł / dzień
}

export interface OfferPosition {
  packageName: string;
  segment: string;
  kcal: number;
  price: number;
  expectedPrice: number; // cena rynku dla jakości tej marki
  gap: number; // expectedPrice - price (zł/dzień); > 0 = marka tańsza niż rynek
  gapPct: number; // gap / price * 100
  competitors: number; // liczba innych marek w segmencie
  cheapest: { brandName: string; price: number };
  priciest: { brandName: string; price: number };
}

export interface PricePosition {
  offers: OfferPosition[]; // posortowane malejąco po gap
  compared: number;
  skipped: number; // oferty bez co najmniej 3 konkurentów w segmencie
  avgGapPct: number | null; // średnia po ofertach; > 0 = taniej niż rynek
  qualityPremiumPct: number | null; // o ile % wyższa cena przy 10 pkt mniej negatywów; null = rynek nie wycenia
  qualityPremiumTrusted: boolean;
  marketOffers: number; // ile obserwacji (marka x segment) użyto do nauki
}

export function brandQuality(reviews: ReviewRow[], minReviews = 50): Map<string, number> {
  const acc = new Map<string, { n: number; neg: number }>();
  for (const r of reviews) {
    if (r.rating === null || r.rating === undefined) continue;
    let a = acc.get(r.brand_id);
    if (!a) { a = { n: 0, neg: 0 }; acc.set(r.brand_id, a); }
    a.n++;
    if (r.rating <= 2) a.neg++;
  }
  const out = new Map<string, number>();
  for (const [id, a] of acc) if (a.n >= minReviews) out.set(id, (a.neg / a.n) * 100);
  return out;
}

export function buildPricePosition(
  brandName: string,
  offers: ActiveOffer[],
  negPer100ByBrand: Map<string, number> // klucz: nazwa marki
): PricePosition {
  // segment -> marka -> mediana log(ceny)
  const cells = new Map<string, Map<string, number[]>>();
  for (const o of offers) {
    if (!(o.price > 0)) continue;
    const key = `${o.segment}|${o.kcal}`;
    if (!cells.has(key)) cells.set(key, new Map());
    const c = cells.get(key)!;
    if (!c.has(o.brandName)) c.set(o.brandName, []);
    c.get(o.brandName)!.push(Math.log(o.price));
  }
  const cellBrand = new Map<string, Map<string, number>>();
  for (const [key, c] of cells) {
    const m = new Map<string, number>();
    for (const [b, xs] of c) m.set(b, median(xs));
    cellBrand.set(key, m);
  }

  // Nauka beta: odchylenia od średniej segmentu (segmenty z >= 4 markami o znanej jakości).
  let sxx = 0, sxy = 0, syy = 0, nObs = 0, nCells = 0;
  for (const m of cellBrand.values()) {
    const pts: { q: number; lp: number }[] = [];
    for (const [b, lp] of m) {
      const q = negPer100ByBrand.get(b);
      if (q !== undefined) pts.push({ q, lp });
    }
    if (pts.length < 4) continue;
    const mq = pts.reduce((s, p) => s + p.q, 0) / pts.length;
    const mp = pts.reduce((s, p) => s + p.lp, 0) / pts.length;
    for (const p of pts) {
      sxx += (p.q - mq) ** 2;
      sxy += (p.q - mq) * (p.lp - mp);
      syy += (p.lp - mp) ** 2;
    }
    nObs += pts.length;
    nCells++;
  }
  let beta = 0;
  let trusted = false;
  let premium: number | null = null;
  const dof = nObs - nCells - 1;
  if (sxx > 0 && dof >= 10) {
    const b = sxy / sxx;
    const sse = syy - b * sxy;
    const se = Math.sqrt(Math.max(sse, 0) / dof / sxx);
    trusted = se > 0 && Math.abs(b / se) >= 2;
    if (trusted) {
      beta = b;
      premium = (Math.exp(-10 * b) - 1) * 100; // 10 pkt mniej negatywów
    }
  }

  const ownQ = negPer100ByBrand.get(brandName);
  const out: OfferPosition[] = [];
  let skipped = 0;

  for (const o of offers) {
    if (o.brandName !== brandName || !(o.price > 0)) continue;
    const m = cellBrand.get(`${o.segment}|${o.kcal}`)!;
    const others = [...m.entries()].filter(([b]) => b !== brandName);
    if (others.length < 3) { skipped++; continue; }

    const meanLp = others.reduce((s, [, lp]) => s + lp, 0) / others.length;
    let adj = 0;
    if (beta !== 0 && ownQ !== undefined) {
      const qs = others.map(([b]) => negPer100ByBrand.get(b)).filter((q): q is number => q !== undefined);
      if (qs.length >= 3) adj = beta * (ownQ - qs.reduce((s, q) => s + q, 0) / qs.length);
    }
    const expectedPrice = Math.exp(meanLp + adj);
    const sorted = others.map(([b, lp]) => ({ brandName: b, price: Math.exp(lp) })).sort((a, b) => a.price - b.price);

    out.push({
      packageName: o.packageName,
      segment: o.segment,
      kcal: o.kcal,
      price: o.price,
      expectedPrice,
      gap: expectedPrice - o.price,
      gapPct: ((expectedPrice - o.price) / o.price) * 100,
      competitors: others.length,
      cheapest: sorted[0],
      priciest: sorted[sorted.length - 1],
    });
  }

  out.sort((a, b) => b.gap - a.gap);

  return {
    offers: out,
    compared: out.length,
    skipped,
    avgGapPct: out.length ? out.reduce((s, o) => s + o.gapPct, 0) / out.length : null,
    qualityPremiumPct: premium,
    qualityPremiumTrusted: trusted,
    marketOffers: nObs,
  };
}
