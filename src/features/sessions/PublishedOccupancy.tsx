import type { Database } from '../../lib/database.types'
// Supabase's generated function types omit SQL-returned nullability.
type Projection = Database['public']['Functions']['get_session_card_summaries']['Returns'][number]
export type CardSummary = Omit<Projection, 'my_payment_status'> & { my_payment_status: Projection['my_payment_status'] | null }
export function PublishedOccupancy({ summary }: { summary?: Pick<CardSummary, 'session_id' | 'capacity' | 'publication_version' | 'confirmed_count'> }) {
  if (!summary) return <p className="occupancy">Sélection en cours d’actualisation…</p>
  if (!summary.publication_version) return <p className="occupancy">Sélection non publiée · {summary.capacity} places</p>
  return <div className="occupancy"><p>{summary.confirmed_count} confirmés / {summary.capacity} places</p><progress aria-label="Occupation de la sélection publiée" max={summary.capacity} value={summary.confirmed_count} /></div>
}
