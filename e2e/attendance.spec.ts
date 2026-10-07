import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { formatDate, seasonOf, todayParis } from '../src/lib/dates.js'
const pastDate = new Date(Date.parse(`${todayParis()}T12:00:00Z`) - 2 * 86400000).toISOString().slice(0, 10)
const pastSeason = seasonOf(pastDate)
async function pastSession(client: Awaited<ReturnType<typeof fixtureClient>>, title: string) {
  const result = await client.rpc('save_session', { p_date: pastDate, p_start_time: '21:00', p_end_time: '22:00', p_title: title, p_venue: 'Piscine fictive', p_address: '', p_notes: '', p_capacity: 2, p_registration_open: true, p_school_holiday: false, p_end_time_estimated: false })
  expect(result.error).toBeNull(); return result.data!
}

test('closure serializes with attendance and corrections never bypass a closed bilan', async () => {
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const client = await fixtureClient(admin); const other = await fixtureClient(admin)
  let id: string | undefined
  try {
    id = await pastSession(client, `Bilan concurrent ${admin.firstName}`)
    expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: member.memberId, p_rsvp: 'yes' })).error).toBeNull()
    expect((await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: member.memberId, p_state: 'selected' })).error).toBeNull()
    expect((await client.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    const [attendance, closure] = await Promise.all([
      client.rpc('set_attendance', { p_session_id: id, p_member_id: member.memberId, p_status: 'dived' }),
      other.rpc('close_session_bilan', { p_session_id: id }),
    ])
    expect(attendance.error).toBeNull()
    if (closure.error) { expect(closure.error.code).toBe('22023'); expect((await client.rpc('close_session_bilan', { p_session_id: id })).error).toBeNull() }
    const total = await client.rpc('get_season_counts', { p_start_year: pastSeason })
    expect(total.data?.find(row => row.member_id === member.memberId)?.completed_count).toBe(1)
    expect((await other.rpc('set_attendance', { p_session_id: id, p_member_id: member.memberId, p_status: 'absent' })).error?.code).toBe('22023')
    expect((await client.rpc('reopen_session_bilan', { p_session_id: id })).error).toBeNull()
    const correction = await Promise.all([
      client.rpc('set_attendance', { p_session_id: id, p_member_id: member.memberId, p_status: 'absent' }),
      other.rpc('close_session_bilan', { p_session_id: id }),
    ])
    expect(correction[1].error).toBeNull()
    if (correction[0].error) expect(correction[0].error.code).toBe('22023')
    const stored = await client.from('session_participations').select('attendance_status').eq('session_id', id).eq('member_id', member.memberId).single()
    const finalTotal = await client.rpc('get_season_counts', { p_start_year: pastSeason })
    expect(finalTotal.data?.find(row => row.member_id === member.memberId)?.completed_count).toBe(stored.data?.attendance_status === 'dived' ? 1 : 0)
  } finally {
    if (id) await client.rpc('delete_session', { p_session_id: id })
    await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})

test('admin validates actual attendance and reopens for correction; member sees season history across devices', async ({ page, browser }) => {
  const admin = await createMemberFixture(); const member = await createMemberFixture()
  makeFixtureAdmin(admin)
  const context = await browser.newContext(); const other = await context.newPage()
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined; let id: string | undefined
  try {
    for (const [device, fixture] of [[page, admin], [other, member]] as const) {
      await openConfirmation(device, await requestMagicLink(device, fixture))
      await device.getByRole('button', { name: 'Se connecter', exact: true }).click()
      await expect(device.getByRole('heading', { name: 'Les séances', exact: true })).toBeVisible()
      await device.getByRole('combobox', { name: 'Saison', exact: true }).selectOption(String(pastSeason))
      await device.getByRole('button', { name: 'Passées', exact: true }).click()
    }
    client = await fixtureClient(admin)
    const memberClient = await fixtureClient(member)
    id = await pastSession(client, `Présences ${admin.firstName}`)
    expect((await client.rpc('set_session_rsvp', { p_session_id: id, p_member_id: member.memberId, p_rsvp: 'yes' })).error).toBeNull()
    expect((await client.rpc('set_draft_selection', { p_session_id: id, p_member_id: member.memberId, p_state: 'selected' })).error).toBeNull()
    expect((await client.rpc('publish_selection', { p_session_id: id })).error).toBeNull()
    const privateCounts = await memberClient.rpc('get_season_counts', { p_start_year: pastSeason })
    expect(privateCounts.error).toBeNull(); expect(privateCounts.data).toHaveLength(1)
    expect(privateCounts.data?.[0]?.member_id).toBe(member.memberId)
    const counter = other.getByText('Mes fosses réalisées cette saison', { exact: false })
    await expect(counter).toContainText('0. Seuls')
    for (const device of [page, other]) {
      const button = device.getByRole('button', { name: new RegExp(`séance du ${formatDate(pastDate)}`) })
      await expect(button).toBeVisible({ timeout: 12000 }); await button.click()
      await device.getByRole('tab', { name: 'Bilan', exact: true }).click()
    }
    async function expectCalendarCount(count: number) {
      await other.getByRole('button', { name: 'Toutes les séances', exact: true }).click()
      await expect(counter).toBeVisible()
      await expect(counter).toContainText(`${count}. Seuls`, { timeout: 12000 })
      await other.getByRole('button', { name: new RegExp(`séance du ${formatDate(pastDate)}`) }).click()
      await other.getByRole('tab', { name: 'Bilan', exact: true }).click()
    }
    const attendance = page.getByRole('combobox', { name: `Présence de ${member.firstName} Fictif`, exact: true })
    await attendance.selectOption('dived')
    await expectCalendarCount(0)
    await page.getByRole('button', { name: 'Clôturer le bilan', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la clôture', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Rouvrir le bilan', exact: true })).toBeVisible()
    await expectCalendarCount(1)
    await expect(other.locator('.attendance').getByText('A plongé', { exact: true })).toBeVisible({ timeout: 12000 })
    await expect(other.getByRole('combobox', { name: /Présence de/ })).toHaveCount(0)
    expect((await memberClient.rpc('set_attendance', { p_session_id: id, p_member_id: member.memberId, p_status: 'dived' })).error?.code).toBe('42501')
    await page.getByRole('button', { name: 'Rouvrir le bilan', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la réouverture', exact: true }).click()
    await expect(attendance).toBeEnabled()
    await expectCalendarCount(0)
    await attendance.selectOption('absent')
    await page.getByRole('button', { name: 'Clôturer le bilan', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmer la clôture', exact: true }).click()
    await expect(other.locator('.attendance').getByText('Absent', { exact: true })).toBeVisible({ timeout: 12000 })
    await expectCalendarCount(0)
    await other.getByRole('button', { name: 'Toutes les séances', exact: true }).click()
    await other.getByRole('button', { name: 'Passées', exact: true }).click()
    await expect(other.getByRole('button', { name: new RegExp(`séance du ${formatDate(pastDate)}`) })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    await page.locator('.attendance').screenshot({ path: 'test-results/attendance-mobile.png' })
  } finally {
    if (id && client) await client.rpc('delete_session', { p_session_id: id })
    await context.close(); await removeMemberFixture(member); await removeMemberFixture(admin)
  }
})
