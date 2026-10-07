import type { ReactNode } from 'react'
import { formatDate } from '../lib/dates'
const paths = {
  waves: 'M3 10c3-3 6-3 9 0s6 3 9 0M3 16c3-3 6-3 9 0s6 3 9 0M15 4h.01',
  calendar: 'M5 3v4m14-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2M7 13h3m4 0h3m-10 4h3',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2',
  users: 'M10 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M20 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0M1 21v-2a6 6 0 0 1 12 0v2m0-5a6 6 0 0 1 10 3v2',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pin: 'M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
} as const
export function Icon({ name }: { name: keyof typeof paths }) { return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg> }
export function Brand() { return <div className="brand"><span className="brand-symbol"><Icon name="waves" /></span><span>i<span className="brand-accent">Fosse</span></span></div> }
export function PageHeading({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <div className="muted">{children}</div>}</div>{actions}</div> }
export function DateTile({ date }: { date: string }) { return <time className="date-tile" dateTime={date} aria-label={formatDate(date)} title={formatDate(date)}><span aria-hidden="true">{new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</span><strong aria-hidden="true">{Number(date.slice(8, 10))}</strong></time> }
