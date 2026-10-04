import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PublishedOccupancy } from './PublishedOccupancy'
afterEach(cleanup)
it('distinguishes an unpublished selection from an empty publication', () => {
  const summary = { session_id: 'session', capacity: 20, publication_version: 0, confirmed_count: 0 }
  const view = render(<PublishedOccupancy summary={summary} />)
  expect(screen.getByText('Sélection non publiée · 20 places')).toBeTruthy()
  expect(screen.queryByRole('progressbar')).toBeNull()
  view.rerender(<PublishedOccupancy summary={{ ...summary, publication_version: 1 }} />)
  expect(screen.getByText('0 confirmés / 20 places')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0')
})
it('shows the published count as an accessible progress value', () => {
  render(<PublishedOccupancy summary={{ session_id: 'session', capacity: 20, publication_version: 2, confirmed_count: 12 }} />)
  expect(screen.getByText('12 confirmés / 20 places')).toBeTruthy()
  const progress = screen.getByRole('progressbar', { name: 'Occupation de la sélection publiée' })
  expect(progress.getAttribute('value')).toBe('12'); expect(progress.getAttribute('max')).toBe('20')
})
