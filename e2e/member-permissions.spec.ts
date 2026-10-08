import { expect, test } from '@playwright/test'
import { formatDate } from '../src/lib/dates.js'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'

test('admin to member switch removes private UI and regular member API cannot edit CACI or browse profiles', async ({ page }) => {
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  try {
    makeFixtureAdmin(admin)
    await openConfirmation(page, await requestMagicLink(page, admin)); await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    const a = await fixtureClient(admin)
    expect((await a.rpc('set_member_caci', { p_member_id: member.memberId, p_expiry_date: '2027-12-31' })).error).toBeNull()
    await page.getByRole('button', { name: 'Administration', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gestion des adhérents' })).toBeVisible()
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click()
    await page.getByRole('dialog', { name: 'Se déconnecter ?' }).getByRole('button', { name: 'Se déconnecter', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gestion des adhérents' })).toHaveCount(0)
    await openConfirmation(page, await requestMagicLink(page, member)); await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    const m = await fixtureClient(member)
    await expect(page.getByRole('button', { name: 'Administration', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Gestion des adhérents' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    await expect(page.getByText(`valable jusqu’au ${formatDate('2027-12-31')}`, { exact: false })).toBeVisible()
    await expect(page.getByLabel('Fin de validité CACI')).toHaveCount(0)
    for (const id of [member.memberId, admin.memberId]) {
      expect((await m.rpc('set_member_caci', { p_member_id: id, p_expiry_date: '2030-01-01' })).error?.code).toBe('42501')
      expect((await m.rpc('set_member_caci_if_current', { p_member_id: id, p_expiry_date: '2030-01-01' })).error?.code).toBe('42501')
    }
    expect((await m.from('members').select('id')).data).toEqual([{ id: member.memberId }])
    expect((await m.from('members').select('*').eq('id', admin.memberId)).data).toEqual([])
  } finally { await removeMemberFixture(member); await removeMemberFixture(admin) }
})

test('CACI editor refreshes untouched input and rejects unseen concurrent changes without losing unsaved input', async ({ page }) => {
  const admin = await createMemberFixture()
  try {
    makeFixtureAdmin(admin)
    await openConfirmation(page, await requestMagicLink(page, admin)); await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
    const a = await fixtureClient(admin)
    await page.getByRole('button', { name: 'Mon profil', exact: true }).click()
    const date = page.getByLabel('Fin de validité CACI')
    expect((await a.rpc('set_member_caci', { p_member_id: admin.memberId, p_expiry_date: '2028-12-31' })).error).toBeNull()
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(date).toHaveValue('2028-12-31')
    await date.fill('2029-12-31')
    expect((await a.rpc('set_member_caci', { p_member_id: admin.memberId, p_expiry_date: '2030-12-31' })).error).toBeNull()
    // No refresh: write races the editor's original value and must fail in SQL.
    await page.getByRole('button', { name: 'Enregistrer le CACI', exact: true }).click()
    await expect(page.getByText('Le CACI a été modifié ailleurs.', { exact: false })).toBeVisible()
    await expect(date).toHaveValue('2029-12-31')
    expect((await a.from('members').select('caci_expiry_date').eq('id', admin.memberId).single()).data?.caci_expiry_date).toBe('2030-12-31')
    await page.getByRole('button', { name: 'Recharger la date enregistrée', exact: true }).click()
    await expect(date).toHaveValue('2030-12-31')
  } finally { await removeMemberFixture(admin) }
})
