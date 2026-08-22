/**
 * Diet type classification from package names.
 * Regex-based, no AI needed — covers 97% of packages.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyDiet(packageName: string): string[] {
  const n = normalize(packageName);
  const tags: string[] = [];

  if (/keto/.test(n)) tags.push("Keto");
  if (/intermittent|(?:^|[\s-])if(?:[\s-]|$)/.test(n)) tags.push("IF");

  if (/vegan|wegansk|wegan\b/.test(n)) tags.push("Wegańska");
  else if (/(?:vege|wege).*fish|fish.*(?:vege|wege)|pescata|pesco|(?:wege|vege).*ryb|ryb.*(?:wege|vege)/.test(n)) tags.push("Vege+Fish");
  else if (/\bvege\b|\bwege\b|veggie|vegetarian|wegetariansk|mniej miesa|no meat|fleksitariansk/.test(n)) tags.push("Vege");

  if (/low ig|niski\w*\s+ig|niski indeks|insulinoopornosc|(?:^|[\s-])dash(?:[\s-]|$)|diabeti|diabetyk/.test(n)) tags.push("Low IG");
  if (/low carb|niskoweglowodan|less carb/.test(n)) tags.push("Low Carb");
  if (/gluten|laktoz|lactose|bez nabial|dairy free/.test(n)) tags.push("Bez glutenu/laktozy");
  if (/hashi/.test(n)) tags.push("Hashimoto");
  if (/sport|(?:^|[\s-])active|atlety|high protein|super active|protein plus|protein active|aktywn|wysokobialkow/.test(n)) tags.push("Sport");
  if (/office|lunch|na etacie|home office/.test(n)) tags.push("Office/Lunch");
  if (/fodmap/.test(n)) tags.push("FODMAP");
  if (/ciaz|mammy|(?:^|[\s-])mum(?:[\s-]|$)|karmi|mom2be|ladies|junior|dzieciec|dla mam\b|menopau/.test(n)) tags.push("Ciąża/Mamy");
  if (/detox|detoks|sokov|sokow|clearing/.test(n)) tags.push("Detox");
  if (/(?:^|[\s-])slim|redukcyj|odchudza|fit.*slim|slim.*fit|niskokaloryc/.test(n)) tags.push("Slim/Redukcyjna");
  if (/wybor.*menu|menu.*wybor|\bwm\b|do wyboru|z wyborem|(?:^|[\s-])select[\s-]/.test(n)) tags.push("Wybór menu");
  if (/srodziemnomors/.test(n)) tags.push("Śródziemnomorska");
  if (/lekkostraw|(?:^|[\s-])soft(?:[\s-]|$)|senior/.test(n)) tags.push("Lekkostrawna");
  if (/sirt/.test(n)) tags.push("Sirtuinowa");
  if (/mikrobiom|wrazliwe jelita|jelit/.test(n)) tags.push("Mikrobiom");
  if (/eliminacyj/.test(n)) tags.push("Eliminacyjna");
  if (/bez ryb|no fish|zero ryb/.test(n)) tags.push("Bez ryb");
  if (/summer|letni|winter|zimow/.test(n)) tags.push("Sezonowa");
  if (/no sweets|bez cukru|bez slodz/.test(n)) tags.push("Bez cukru");
  if (/odpornos/.test(n)) tags.push("Odporność");
  if (/longevity/.test(n)) tags.push("Longevity");

  // Standard — fallback only when no specific diet matched
  if (
    tags.length === 0 &&
    /standard|klasycz|klasyk|basic|everyday|comfort|optimal|domow|zbilansow|ekonom|balans|dobry start|economy|smart|optymaln|regular|\bmini\b|\bmaxi\b|\bgreen\b|\bplus\b|\bfit\b|\bsuper\b/.test(n)
  )
    tags.push("Standard");

  if (tags.length === 0) tags.push("Inne");
  return tags;
}

export function isTestPackage(name: string): boolean {
  return /test/i.test(name);
}

export const DIET_TYPES = [
  "Standard", "Keto", "Vege", "Wegańska", "Vege+Fish", "Low IG", "Low Carb",
  "Bez glutenu/laktozy", "Hashimoto", "Sport", "Office/Lunch", "IF", "FODMAP",
  "Ciąża/Mamy", "Detox", "Slim/Redukcyjna", "Wybór menu", "Śródziemnomorska",
  "Lekkostrawna", "Sirtuinowa", "Mikrobiom", "Eliminacyjna", "Bez ryb",
  "Sezonowa", "Bez cukru", "Odporność", "Longevity", "Inne",
] as const;

export type DietType = (typeof DIET_TYPES)[number];

// Kcal buckets for matrix (readable groups from raw kcal_ranges)
export const KCAL_BUCKETS = [1000, 1200, 1500, 1750, 2000, 2500, 3000, 3500] as const;
export type KcalBucket = (typeof KCAL_BUCKETS)[number];

export function toKcalBucket(kcalFrom: number, kcalTo: number): KcalBucket {
  const mid = (kcalFrom + kcalTo) / 2;
  let closest: KcalBucket = KCAL_BUCKETS[0];
  for (const b of KCAL_BUCKETS) {
    if (Math.abs(mid - b) < Math.abs(mid - closest)) closest = b;
  }
  return closest;
}

export function kcalBucketLabel(bucket: KcalBucket): string {
  if (bucket === 3500) return "3500+";
  return `${bucket}`;
}
