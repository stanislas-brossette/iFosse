import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('organizer compares a private equal-count swap, filters independently and reconfirms concurrent changes', async ({ page }) => {
  const fixtures = [await createMemberFixture(),await createMemberFixture(),await createMemberFixture()]
  const [admin,alice,bob] = fixtures; makeFixtureAdmin(admin)
  await openConfirmation(page,await requestMagicLink(page,admin));await page.getByRole('button',{name:'Se connecter',exact:true}).click()
  const client = await fixtureClient(admin); const member = await fixtureClient(alice)
  let id:string|undefined
  try {
    id=await createSession(client,`Comparaison ${admin.firstName}`)
    for (const f of [alice,bob]) expect((await client.rpc('set_session_rsvp',{p_session_id:id,p_member_id:f.memberId,p_rsvp:'yes'})).error).toBeNull()
    expect((await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:alice.memberId,p_state:'selected'})).error).toBeNull()
    await expect(page.getByRole('button',{name:new RegExp(`séance du ${formatDate(testSessionDate)}`)})).toBeVisible({timeout:12000})
    await page.getByRole('button',{name:new RegExp(`séance du ${formatDate(testSessionDate)}`)}).click();await page.getByRole('tab',{name:'Gestion',exact:true}).click()
    await expect(page.locator('.management-row')).toHaveCount(2)
    await page.getByRole('button',{name:'Publier la sélection',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Première publication'})).toBeVisible()
    await expect(page.getByRole('region',{name:'Récapitulatif de publication'})).toContainText(`${alice.firstName} Fictif`)
    await page.getByRole('button',{name:'Continuer le brouillon'}).click()
    expect((await client.from('selection_publications').select('id').eq('session_id',id)).data).toEqual([])
    await page.getByRole('button',{name:'Publier la sélection',exact:true}).click();await page.getByRole('button',{name:'Confirmer la publication'}).click()
    await expect(page.getByText('Sélection publiée.',{exact:true})).toBeVisible()
    await page.getByRole('combobox',{name:`Sélection de ${alice.firstName} Fictif`,exact:true}).selectOption('waiting')
    await page.getByRole('combobox',{name:`Sélection de ${bob.firstName} Fictif`,exact:true}).selectOption('selected')
    await page.getByLabel('Rechercher dans la sélection').fill(bob.firstName)
    await expect(page.locator('.management-row')).toHaveCount(1)
    await page.getByRole('button',{name:'Publier la sélection',exact:true}).click()
    const diff=page.getByRole('region',{name:'Récapitulatif de publication'})
    await expect(diff).toContainText('Ajoutés aux confirmés · 1');await expect(diff).toContainText('Retirés des confirmés · 1')
    await expect(diff).toContainText(alice.firstName);await expect(diff).toContainText(bob.firstName)
    expect((await member.rpc('get_selection_publish_preview',{p_session_id:id})).error?.code).toBe('42501')
    expect((await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:bob.memberId,p_state:'waiting'})).error).toBeNull()
    await page.getByRole('button',{name:'Confirmer la publication'}).click()
    await expect(page.getByText('La sélection a changé. Vérifiez le nouveau récapitulatif puis confirmez à nouveau.')).toBeVisible()
    await expect(diff).toContainText('0 retenus /')
    expect((await client.from('selection_publications').select('version').eq('session_id',id)).data).toHaveLength(1)
    await page.getByRole('button',{name:'Continuer le brouillon'}).click();await page.getByRole('button',{name:'Réinitialiser la sélection affichée'}).click()
    await page.getByLabel('CACI à vérifier',{exact:true}).check();await page.getByLabel('Transport à organiser',{exact:true}).check()
    await expect(page.locator('.management-row')).toHaveCount(2)
    await page.getByLabel('Rechercher dans la sélection').fill('personne absente');await expect(page.getByText('Aucune personne ne correspond aux filtres.')).toBeVisible()
    await page.getByRole('button',{name:'Réinitialiser la sélection affichée'}).click();await expect(page.locator('.management-row')).toHaveCount(2)
    await page.setViewportSize({width:390,height:844})
    await expect(page.getByRole('combobox',{name:'Trier la sélection'})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    const preview=(await client.rpc('get_selection_publish_preview',{p_session_id:id})).data as {fingerprint:string}
    const results=await Promise.all([1,2].map(()=>client.rpc('publish_selection_checked',{p_session_id:id!,p_expected_fingerprint:preview.fingerprint})))
    expect(results.filter(r=>!r.error)).toHaveLength(1);expect(results.find(r=>r.error)?.error?.code).toBe('40001')
  } finally {
    if(id) await client.rpc('delete_session',{p_session_id:id})
    for(const f of fixtures.reverse()) await removeMemberFixture(f)
  }
})
