import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import { Directory } from './Directory'

HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
afterEach(cleanup)
const member = (id: string, role: Member['role'] = 'member', disabled_at: string | null = null) => ({ id, first_name: id, last_name: 'Fictif', email: `${id}@example.test`, role, disabled_at, caci_expiry_date: null, current_level: 'N2' }) as Member
function setup(role: Member['role'] = 'admin') {
  const people = [member('Camille'), member('Admin', 'admin'), member('Président', 'president'), member('Inactif', 'member', '2026-10-06T12:00:00Z')]
  const query = { select: () => query, order: vi.fn(async () => ({ data: people, error: null })) }
  const invoke = vi.fn(async () => ({ data: { member_id: 'new-member' }, error: null }))
  const client = { from: () => query, functions: { invoke }, rpc: vi.fn(async () => ({ error: null })) } as unknown as SupabaseClient<Database>
  render(<Directory client={client} member={member('Moi', role)} />)
  return { client, invoke }
}
describe('unified member management', () => {
  it('renders each active member once for Admin, with CACI but no lifecycle/role controls', async () => {
    setup(); await screen.findByText('Camille Fictif')
    expect(screen.getAllByRole('heading', { name: 'Gestion des adhérents' })).toHaveLength(1)
    expect(screen.queryByText('Droits administrateur')).toBeNull()
    expect(screen.getAllByText('Camille Fictif')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Ajouter un adhérent' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Transférer la présidence' })).toBeNull()
    expect(screen.queryByText(/Gérer les droits/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Modifier le CACI de Camille Fictif' })).toBeTruthy()
    expect(screen.queryByText('Inactif Fictif')).toBeNull()
  })
  it('searches by email and combines role, CACI and inactive filters', async () => {
    setup(); await screen.findByText('Camille Fictif')
    fireEvent.change(screen.getByLabelText('Rechercher un adhérent'), { target: { value: 'ADMIN@EXAMPLE.TEST' } })
    expect(screen.queryByText('Camille Fictif')).toBeNull(); expect(screen.getByText('Admin Fictif')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'member' } })
    expect(screen.getByText('Aucun adhérent ne correspond à ces critères.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Rechercher un adhérent'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Accès'), { target: { value: 'inactive' } })
    fireEvent.change(screen.getByLabelText('CACI'), { target: { value: 'missing' } })
    expect(screen.getByText('Inactif Fictif')).toBeTruthy(); expect(screen.getByText('Inactif')).toBeTruthy()
  })
  it('gives President creation and per-row actions, without disabling the President row', async () => {
    setup('president'); await screen.findByText('Camille Fictif')
    expect(screen.getAllByText(/Gérer les droits et l’accès/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un adhérent' }))
    expect(screen.getByLabelText('Prénom')).toBeTruthy()
    expect(screen.queryByText('Présidence du club · transfert exceptionnel')).toBeNull()
    expect(screen.queryByLabelText('Mot de passe')).toBeNull()
  })
  it('requires confirmation, keeps a refused lifecycle dialog open and never changes the row', async () => {
    const { client } = setup('president'); await screen.findByText('Camille Fictif')
    fireEvent.click(screen.getAllByRole('button', { name: 'Désactiver' })[0])
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/historiques seront conservés/)).toBeTruthy()
    expect(client.rpc).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Désactiver' })[0])
    vi.mocked(client.rpc).mockResolvedValueOnce({ error: { code: '42501' }, data: null } as never)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Modification refusée'))
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Modification refusée'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getAllByText('Camille Fictif')).toHaveLength(2)
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('set_member_active', { p_member_id: 'Camille', p_active: false })
  })
  it('validates names, normalizes creation, and reuses a stable request id on error/retry', async () => {
    const app = setup('president'); await screen.findByText('Camille Fictif')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un adhérent' }))
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: ' Fictif ' } })
    fireEvent.change(screen.getByLabelText('Email du nouvel adhérent'), { target: { value: ' NEW@example.test ' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Créer l’adhérent' }).closest('form')!)
    expect(screen.getByRole('alert').textContent).toContain('Vérifiez'); expect(app.invoke).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Prénom').getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Nouveau\u0001' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Créer l’adhérent' }).closest('form')!)
    expect(screen.getByLabelText('Prénom').getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
    expect(app.invoke).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: ' Nouveau ' } })
    app.invoke.mockResolvedValueOnce({ data: { code: 'EMAIL_EXISTS' }, error: null } as never)
    fireEvent.submit(screen.getByRole('button', { name: 'Créer l’adhérent' }).closest('form')!)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('déjà utilisée'))
    expect(screen.getByLabelText('Email du nouvel adhérent').getAttribute('aria-invalid')).toBe('true')
    const first = app.invoke.mock.calls[0]
    fireEvent.submit(screen.getByRole('button', { name: 'Créer l’adhérent' }).closest('form')!)
    await waitFor(() => expect(screen.queryByLabelText('Prénom')).toBeNull())
    expect(app.invoke.mock.calls[1]).toEqual(first)
    expect(first).toEqual(['create-member', { body: expect.objectContaining({ first_name: 'Nouveau', last_name: 'Fictif', email: 'new@example.test' }) }])
  })
})
it('resets combined filters to active defaults and retains hidden CACI/creation drafts',async()=>{
 setup('president');await screen.findByText('Camille Fictif')
 fireEvent.click(screen.getByRole('button',{name:'Ajouter un adhérent'}));fireEvent.change(screen.getByLabelText('Prénom'),{target:{value:'Création fictive'}})
 fireEvent.click(screen.getByRole('button',{name:'Modifier le CACI de Camille Fictif'}));fireEvent.change(screen.getByLabelText('Fin de validité CACI'),{target:{value:'2029-10-15'}})
 fireEvent.change(screen.getByLabelText('Rechercher un adhérent'),{target:{value:'Aucun résultat'}});fireEvent.change(screen.getByLabelText('Rôle'),{target:{value:'admin'}});fireEvent.change(screen.getByLabelText('CACI'),{target:{value:'valid'}});fireEvent.change(screen.getByLabelText('Accès'),{target:{value:'inactive'}})
 expect(screen.getByRole('status').textContent).toContain('0 adhérent');expect(screen.getByText('Aucun adhérent ne correspond à ces critères.')).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Réinitialiser les filtres'}))
 expect((screen.getByLabelText('Rechercher un adhérent') as HTMLInputElement).value).toBe('');expect((screen.getByLabelText('Rôle') as HTMLSelectElement).value).toBe('all');expect((screen.getByLabelText('CACI') as HTMLSelectElement).value).toBe('all');expect((screen.getByLabelText('Accès') as HTMLSelectElement).value).toBe('active')
 expect(screen.getByRole('status').textContent).toContain('3 adhérents');expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Création fictive');expect((screen.getByLabelText('Fin de validité CACI') as HTMLInputElement).value).toBe('2029-10-15')
 expect(screen.getByLabelText('Fin de validité CACI').closest('li')!.hidden).toBe(false)
})
