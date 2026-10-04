import type { Database } from '../../lib/database.types'
export type CardSummary = Database['public']['Functions']['get_session_card_summaries']['Returns'][number]
export function PublishedOccupancy({ summary }: { summary?: CardSummary }) {
  if (!summary) return <p className="occupancy">Sélection en cours d’actualisation…</p>
  if (!summary.publication_version) return <p className="occupancy">Sélection non publiée · {summary.capacity} places</p>
  return <div className="occupancy"><p>{summary.confirmed_count} confirmés / {summary.capacity} places</p><progress aria-label="Occupation de la sélection publiée" max={summary.capacity} value={summary.confirmed_count} /></div>
}
