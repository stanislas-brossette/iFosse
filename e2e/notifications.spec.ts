import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { anonymousClient, createMemberFixture, fixtureClient, makeFixtureAdmin, openConfirmation, removeMemberFixture, requestMagicLink } from './helpers/local-supabase.js'
import { createSession, removeSession } from './helpers/sessions.js'

function enableLocalInbox(enabled:boolean) {
  anonymousClient() // Existing helper rejects any non-local Supabase before SQL.
  execFileSync('docker',['exec','supabase_db_ifosse','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update public.app_notification_settings set enabled=${enabled?'true':'false'} where singleton;`],{stdio:['ignore','pipe','pipe']})
}
test('private inbox works on desktop/mobile, respects unsaved forms and keeps read state after reload',async({page})=>{
  const admin=await createMemberFixture(), member=await createMemberFixture()
  makeFixtureAdmin(admin)
  const client=await fixtureClient(admin)
  let sessionId:string|undefined
  try {
    enableLocalInbox(true)
    await openConfirmation(page,await requestMagicLink(page,member))
    await page.getByRole('button',{name:'Se connecter',exact:true}).click()
    sessionId=await createSession(client,'Fosse fictive — notifications',20)
    expect((await client.rpc('set_session_rsvp',{p_session_id:sessionId,p_member_id:member.memberId,p_rsvp:'yes'})).error).toBeNull()
    expect((await client.rpc('set_draft_selection',{p_session_id:sessionId,p_member_id:member.memberId,p_state:'selected'})).error).toBeNull()
    expect((await client.rpc('publish_selection',{p_session_id:sessionId})).error).toBeNull()
    expect((await client.rpc('set_member_caci',{p_member_id:member.memberId,p_expiry_date:'2031-12-01'})).error).toBeNull()
    await page.reload()
    const bell=page.getByRole('button',{name:'Notifications : 2 non lues',exact:true})
    await expect(bell).toBeVisible()
    await page.setViewportSize({width:1440,height:900})
    await bell.focus();await page.keyboard.press('Enter')
    const dialog=page.getByRole('dialog',{name:'Mes notifications'})
    await expect(dialog.getByRole('heading',{name:'Votre CACI a été mis à jour'})).toBeVisible()
    await expect(dialog.getByRole('button',{name:'Fermer'})).toBeFocused()
    await mkdir('test-results/visual-acceptance',{recursive:true})
    await page.screenshot({path:'test-results/visual-acceptance/notifications-desktop.png'})
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible();await expect(bell).toBeFocused()
    await page.setViewportSize({width:390,height:844});await bell.click()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    await page.screenshot({path:'test-results/visual-acceptance/notifications-mobile.png'})
    await dialog.getByRole('button',{name:'Voir mon profil'}).click()
    await expect(page.getByRole('heading',{name:'Mon profil',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Notifications : 1 non lues',exact:true})).toBeVisible()
    // Profile drafts survive navigation, as with the existing app navigation.
    const firstName=page.getByLabel('Prénom',{exact:true})
    await firstName.fill('Modification non enregistrée')
    await page.getByRole('button',{name:'Notifications : 1 non lues',exact:true}).click()
    await dialog.getByRole('button',{name:'Voir la séance'}).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('heading',{name:'Fosse fictive — notifications',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Mon profil',exact:true}).click()
    await expect(firstName).toHaveValue('Modification non enregistrée')
    // Reload deliberately discards the test edit; read states belong to the DB.
    await page.reload()
    await expect(page.getByRole('button',{name:'Notifications',exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Notifications',exact:true}).click()
    await expect(dialog.getByText('Lue',{exact:true})).toHaveCount(2)
    await dialog.getByRole('button',{name:'Fermer'}).click()
    await page.getByRole('button',{name:'Se déconnecter',exact:true}).click()
    await page.getByRole('dialog',{name:'Se déconnecter ?'}).getByRole('button',{name:'Se déconnecter',exact:true}).click()
    await expect(page.getByLabel('Adresse email')).toBeVisible()
    await expect(page.getByRole('button',{name:/Notifications/})).toHaveCount(0)
  } finally {
    enableLocalInbox(false)
    if(sessionId)await removeSession(sessionId)
    await removeMemberFixture(member);await removeMemberFixture(admin)
  }
})
