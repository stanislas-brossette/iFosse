import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('participant sorting uses registration/publication, survives navigation, and fits 390px', async ({ page }) => {
  const fixtures = [await createMemberFixture(), await createMemberFixture(), await createMemberFixture()]
  const [admin, second, third] = fixtures
  makeFixtureAdmin(admin)
  let client: Awaited<ReturnType<typeof fixtureClient>> | undefined
  let id: string | undefined
  try {
    await openConfirmation(page, await requestMagicLink(page, admin))
    await page.getByRole('button',{name:'Se connecter',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Les séances',exact:true})).toBeVisible()
    client = await fixtureClient(admin)
    for (const [index, fixture] of fixtures.entries()) {
      const ownClient = await fixtureClient(fixture)
      expect((await ownClient.rpc('update_own_profile', { p_first_name: ['Anne','Bob','Camille'][index], p_last_name:['Zulu','Alpha','Milieu'][index], p_current_level:['N3','N1','N2'][index], p_preparing_level:'', p_phone:'', p_has_usual_car:false, p_usual_meeting_point:'', p_usual_passenger_seats:3 })).error).toBeNull()
    }
    id = await createSession(client, `Tri ${admin.firstName}`, 20)
    for (const fixture of fixtures) expect((await client.rpc('set_session_rsvp',{p_session_id:id,p_member_id:fixture.memberId,p_rsvp:'yes'})).error).toBeNull()
    await page.getByRole('button',{name:`Voir la séance du ${formatDate(testSessionDate)}`}).click()
    await page.getByRole('tab',{name:'Participants',exact:true}).click()
    const rows=page.locator('.participant-selection .member-list > li')
    const names=async()=>Promise.all((await rows.all()).map(async row=>(await row.locator('span').first().textContent())?.split(' · ')[0]))
    await expect(rows).toHaveCount(3)
    expect(await names()).toEqual(['Anne Zulu','Bob Alpha','Camille Milieu'])
    const sort=page.getByRole('combobox',{name:'Trier par'})
    await expect(sort).toHaveValue('registration')
    await sort.selectOption('name'); expect(await names()).toEqual(['Bob Alpha','Camille Milieu','Anne Zulu'])
    await page.getByRole('button',{name:'Ordre croissant : passer à l’ordre décroissant'}).click()
    expect(await names()).toEqual(['Anne Zulu','Camille Milieu','Bob Alpha'])
    await page.getByRole('tab',{name:'Covoiturage',exact:true}).click()
    await page.getByRole('tab',{name:'Participants',exact:true}).click()
    await expect(sort).toHaveValue('name')
    await expect(page.getByRole('button',{name:'Ordre décroissant : passer à l’ordre croissant'})).toBeVisible()
    await sort.selectOption('level'); expect(await names()).toEqual(['Bob Alpha','Camille Milieu','Anne Zulu'])
    expect((await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:third.memberId,p_state:'selected'})).error).toBeNull()
    expect((await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:second.memberId,p_state:'declined'})).error).toBeNull()
    await sort.selectOption('selection')
    expect(await names()).toEqual(['Anne Zulu','Bob Alpha','Camille Milieu']) // private draft is not a sorting source
    expect((await client.rpc('publish_selection',{p_session_id:id})).error).toBeNull()
    await expect(rows.first()).toContainText('Camille Milieu',{timeout:12000})
    expect(await names()).toEqual(['Camille Milieu','Anne Zulu','Bob Alpha'])
    await page.getByRole('button',{name:'Ordre croissant : passer à l’ordre décroissant'}).click()
    expect(await names()).toEqual(['Bob Alpha','Anne Zulu','Camille Milieu'])
    await page.screenshot({path:'test-results/visual-acceptance/participant-sort-desktop.png',fullPage:true})
    await page.setViewportSize({width:390,height:844})
    await expect(sort).toBeVisible()
    await expect(page.getByRole('button',{name:'Ordre décroissant : passer à l’ordre croissant'})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    await page.screenshot({path:'test-results/visual-acceptance/participant-sort-phone.png',fullPage:true})
  } finally {
    if (id && client) await client.rpc('delete_session',{p_session_id:id})
    for (const fixture of fixtures.reverse()) await removeMemberFixture(fixture)
  }
})
