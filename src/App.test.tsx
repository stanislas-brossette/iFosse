import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('renders the accessible French application shell', () => {
  render(<App />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Les séances du club APSAP')
  expect(screen.getByRole('status')).toBeDefined()
})
