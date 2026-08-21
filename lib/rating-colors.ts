/**
 * Shared rating → color mapping for heatmap cells.
 * Used by RankingReport and RatingHistoryHeatmap.
 */
export function ratingColor(v: number): { bg: string; text: string } {
  if (v >= 4.5) return { bg: '#1D9E75', text: '#fff' }
  if (v >= 4.0) return { bg: '#639922', text: '#fff' }
  if (v >= 3.5) return { bg: '#BA7517', text: '#fff' }
  if (v >= 3.0) return { bg: '#D85A30', text: '#fff' }
  return { bg: '#A32D2D', text: '#fff' }
}

export function formatMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  const names = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
  return names[parseInt(month) - 1] + ' ' + year.slice(2)
}
