import { expect,test } from '@playwright/test'
import { createMemberFixture,fixtureClient,makeFixtureAdmin,openConfirmation,removeMemberFixture,requestMagicLink } from './helpers/local-supabase.js'
import { createSession,testSessionDate } from './helpers/sessions.js'
import { formatDate } from '../src/lib/dates.js'

test('safe deep links resume after login, preserve history/reload and reject member-only private routes',async({page,browser})=>{
  const admin=await createMemberFixture();const member=await createMemberFixture();makeFixtureAdmin(admin)
  const adminClient=await fixtureClient(admin);let id:string|undefined
  const otherContext=await browser.newContext();const other=await otherContext.newPage()
  try{
    id=await createSession(adminClient,`Navigation ${admin.firstName}`)
    await openConfirmation(page,await requestMagicLink(page,member,`/seances/${id}?tab=transport`));await page.getByRole('button',{name:'Se connecter',exact:true}).click()
    await expect(page).toHaveURL(new RegExp(`/seances/${id}\\?tab=transport$`));await expect(page.getByRole('tab',{name:'Covoiturage',exact:true})).toHaveAttribute('aria-selected','true')
    await page.getByRole('tab',{name:'Participants',exact:true}).click();await expect(page).toHaveURL(new RegExp('tab=participants$'))
    await page.getByRole('button',{name:'Mon profil',exact:true}).click();await expect(page).toHaveURL(/\/profil$/)
    await page.goBack();await expect(page.getByRole('tab',{name:'Participants',exact:true})).toHaveAttribute('aria-selected','true')
    await page.goBack();await expect(page.getByRole('tab',{name:'Covoiturage',exact:true})).toHaveAttribute('aria-selected','true')
    await page.goForward();await page.reload();await expect(page.getByRole('tab',{name:'Participants',exact:true})).toHaveAttribute('aria-selected','true')
    await page.goto(`/seances/${id}?tab=manage`);await expect(page.getByRole('tab',{name:'Ma participation',exact:true})).toHaveAttribute('aria-selected','true')
    await expect(page.getByRole('tab',{name:'Gestion',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Publier la sélection',exact:true})).toHaveCount(0)
    await page.goto('/administration');await expect(page.getByRole('heading',{name:'Les séances',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Gestion des adhérents'})).toHaveCount(0)
    await page.goto('/seances/11111111-1111-4111-8111-111111111111?tab=groups');await expect(page.getByText('Cette séance n’est plus disponible dans le calendrier.')).toBeVisible();await page.getByRole('button',{name:'Retour au calendrier'}).click()
    await expect(page).toHaveURL(/\/seances$/)
    const separate=await createMemberFixture()
    try{
      const link=await requestMagicLink(other,separate,`/seances/${id}?tab=bilan`)
      const context=await browser.newContext();const third=await context.newPage()
      try{await openConfirmation(third,link);await third.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(third).toHaveURL(/\/seances$/);await expect(third.getByRole('heading',{name:'Les séances',exact:true})).toBeVisible()}finally{await context.close()}
    }finally{await removeMemberFixture(separate)}
    await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Se déconnecter',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Connexion à iFosse'})).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('ifosse:return-path'))).toBeNull()
  }finally{if(id)await adminClient.rpc('delete_session',{p_session_id:id});await otherContext.close();await removeMemberFixture(member);await removeMemberFixture(admin)}
})

test('unsaved exits and draft abandonment are explicit, cancellable, focused and preserve publications',async({page})=>{
  await page.setViewportSize({width:1440,height:900})
  const admin=await createMemberFixture();const other=await createMemberFixture();makeFixtureAdmin(admin)
  let client:Awaited<ReturnType<typeof fixtureClient>>|undefined;let id:string|undefined
  try{
    await openConfirmation(page,await requestMagicLink(page,admin));await page.getByRole('button',{name:'Se connecter',exact:true}).click();client=await fixtureClient(admin)
    id=await createSession(client,`Sortie ${admin.firstName}`,1)
    for(const f of [admin,other])expect((await client.rpc('set_session_rsvp',{p_session_id:id,p_member_id:f.memberId,p_rsvp:'yes'})).error).toBeNull()
    expect((await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:admin.memberId,p_state:'selected'})).error).toBeNull();expect((await client.rpc('publish_selection',{p_session_id:id})).error).toBeNull()
    await page.getByRole('button',{name:new RegExp(`séance du ${formatDate(testSessionDate)}`)}).click();await page.getByRole('tab',{name:'Gestion',exact:true}).click()
    const row=page.locator('.management-row').filter({hasText:other.firstName})
    await row.getByRole('combobox',{name:`Sélection de ${other.firstName} Fictif`,exact:true}).selectOption('selected')
    await expect(row.getByRole('alert')).toContainText('capacité de sélection est atteinte')
    await page.getByRole('combobox',{name:`Sélection de ${admin.firstName} Fictif`,exact:true}).selectOption('waiting')
    const discard=page.getByRole('button',{name:'Abandonner le brouillon',exact:true});await discard.click()
    const dialog=page.getByRole('dialog',{name:'Abandonner le brouillon de sélection ?'});await expect(dialog).toContainText('publiée reste inchangée');await page.screenshot({path:'test-results/visual-acceptance/navigation-discard-desktop.png'})
    await dialog.getByRole('button',{name:'Annuler',exact:true}).press('Escape');await expect(dialog).not.toBeVisible();await expect(discard).toBeFocused()
    expect((await client.from('selection_drafts').select('session_id').eq('session_id',id)).data).toHaveLength(1)
    await discard.click();await dialog.getByRole('button',{name:'Confirmer l’abandon',exact:true}).click()
    await expect(page.getByText('Brouillon abandonné.',{exact:true})).toBeVisible();expect((await client.from('selection_publications').select('id').eq('session_id',id)).data).toHaveLength(1)
    expect((await client.rpc('set_draft_palanquee',{p_session_id:id,p_member_id:admin.memberId,p_group_number:1,p_is_leader:false})).error).toBeNull()
    await page.getByRole('tab',{name:'Palanquées',exact:true}).click();await page.getByRole('button',{name:'Abandonner le brouillon des palanquées',exact:true}).click()
    const groups=page.getByRole('dialog',{name:'Abandonner le brouillon des palanquées ?'});await groups.getByRole('button',{name:'Annuler',exact:true}).click()
    expect((await client.from('palanquee_drafts').select('session_id').eq('session_id',id)).data).toHaveLength(1)
    await page.getByRole('button',{name:'Abandonner le brouillon des palanquées',exact:true}).click();await groups.getByRole('button',{name:'Confirmer l’abandon des palanquées'}).click()
    await page.getByRole('button',{name:'Modifier la séance',exact:true}).click();await page.getByLabel('Titre',{exact:true}).fill('Saisie fictive conservée')
    await page.goBack();const warning=page.getByRole('dialog',{name:'Quitter sans enregistrer ?'});await expect(warning).toBeVisible();await warning.getByRole('button',{name:'Rester',exact:true}).click()
    await expect(page.getByLabel('Titre',{exact:true})).toHaveValue('Saisie fictive conservée')
    await page.getByRole('button',{name:'Annuler',exact:true}).click();await warning.getByRole('button',{name:'Rester',exact:true}).click()
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Annuler',exact:true}).click();await expect(warning.getByRole('button',{name:'Rester',exact:true})).toBeFocused()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.screenshot({path:'test-results/visual-acceptance/navigation-unsaved-phone.png'})
    await warning.getByRole('button',{name:'Quitter sans enregistrer',exact:true}).click();await expect(page.getByRole('tab',{name:'Palanquées',exact:true})).toHaveAttribute('aria-selected','true')
    await page.getByRole('tab',{name:'Covoiturage',exact:true}).click();await page.getByRole('button',{name:'Proposer une voiture',exact:true}).click();await page.getByLabel('Point de rendez-vous',{exact:true}).fill('Parking non enregistré')
    await page.getByRole('tab',{name:'Participants',exact:true}).click();await expect(warning).toBeVisible();await warning.getByRole('button',{name:'Rester',exact:true}).click();await expect(page.getByLabel('Point de rendez-vous',{exact:true})).toHaveValue('Parking non enregistré')
    await page.getByRole('tab',{name:'Participants',exact:true}).click();await warning.getByRole('button',{name:'Quitter sans enregistrer',exact:true}).click();await expect(page.getByRole('tab',{name:'Participants',exact:true})).toHaveAttribute('aria-selected','true')
  }finally{if(id&&client)await client.rpc('delete_session',{p_session_id:id});await removeMemberFixture(other);await removeMemberFixture(admin)}
})
