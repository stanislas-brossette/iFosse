import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { createMemberFixture, fixtureClient, makeFixturePresident, openConfirmation, releaseFixturePresident, removeMemberFixture, requestMagicLink, serviceClient } from './helpers/local-supabase.js'
import type { MemberFixture } from './helpers/local-supabase.js'
const signIn=async(page:import('@playwright/test').Page,person:MemberFixture)=>{await openConfirmation(page,await requestMagicLink(page,person));await page.getByRole('button',{name:'Se connecter',exact:true}).click();await expect(page.getByRole('button',{name:'Mon profil',exact:true})).toBeVisible()}

test('President deliberately hands over on desktop/mobile; stale choice reconfirms, existing tokens gain/lose rights and history remains',async({page,browser})=>{
 test.setTimeout(120000)
 const people:MemberFixture[]=[];const context=await browser.newContext();const successorPage=await context.newPage();let sessionId:string|undefined
 try{
  for(let i=0;i<50;i++)people.push(await createMemberFixture())
  const [president,successor,,inactive]=people;makeFixturePresident(president)
  await signIn(page,president);await signIn(successorPage,successor)
  const old=await fixtureClient(president),next=await fixtureClient(successor)
  expect((await old.rpc('set_member_active',{p_member_id:inactive.memberId,p_active:false})).error).toBeNull()
  const session=await old.rpc('save_session',{p_date:'2099-10-15',p_start_time:'21:00',p_end_time:'22:00',p_title:'Historique fictif de transfert',p_capacity:20,p_venue:'Bassin fictif',p_address:'',p_notes:'',p_registration_open:true,p_school_holiday:false,p_end_time_estimated:false});expect(session.error).toBeNull();sessionId=session.data!
  expect((await old.rpc('set_session_rsvp',{p_session_id:sessionId,p_member_id:successor.memberId,p_rsvp:'yes'})).error).toBeNull()
  expect((await old.rpc('set_draft_selection',{p_session_id:sessionId,p_member_id:successor.memberId,p_state:'selected'})).error).toBeNull()
  expect((await old.rpc('publish_selection',{p_session_id:sessionId})).error).toBeNull()
  expect((await old.rpc('set_payment_status',{p_session_id:sessionId,p_member_id:successor.memberId,p_status:'paid'})).error).toBeNull()
  const before=(await old.from('session_participations').select('*').eq('session_id',sessionId)).data
  await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Administration',exact:true}).click()
  await page.getByText('Présidence du club · transfert exceptionnel',{exact:true}).click()
  const trigger=page.getByRole('button',{name:'Transférer la présidence',exact:true})
  await trigger.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:'Transférer la présidence ?'})
  await expect(dialog.getByRole('button',{name:'Annuler',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused()
  // A pending member creation must not silently disappear when handing over.
  await page.getByRole('button',{name:'Ajouter un adhérent',exact:true}).click();await page.locator('.directory').getByLabel('Prénom',{exact:true}).fill('Brouillon fictif')
  await trigger.click();const unsaved=page.getByRole('dialog',{name:'Quitter sans enregistrer ?'});await expect(unsaved).toBeVisible();await unsaved.getByRole('button',{name:'Rester'}).click();await expect(page.locator('.directory').getByLabel('Prénom',{exact:true})).toHaveValue('Brouillon fictif')
  await trigger.click();await unsaved.getByRole('button',{name:'Quitter sans enregistrer'}).click();await expect(dialog).toBeVisible();await expect(page.locator('.directory').getByLabel('Prénom',{exact:true})).toHaveCount(0)
  await expect(dialog.getByLabel('Successeur').locator('option')).toHaveCount(49)
  await expect(dialog.getByLabel('Successeur').locator(`option[value="${president.memberId}"]`)).toHaveCount(0);await expect(dialog.getByLabel('Successeur').locator(`option[value="${inactive.memberId}"]`)).toHaveCount(0)
  await dialog.getByLabel('Successeur').selectOption(successor.memberId)
  const confirm=dialog.getByRole('button',{name:'Confirmer le transfert de présidence'})
  await expect(confirm).toBeDisabled();await dialog.getByLabel('Recopier l’email du successeur').fill('autre@example.test');await dialog.getByRole('checkbox').check();await expect(confirm).toBeDisabled()
  await mkdir('test-results/visual-acceptance',{recursive:true});expect(new URL(page.url()).hash).toBe('');await page.screenshot({path:'test-results/visual-acceptance/presidency-desktop.png'})
  // Force a REAL server conflict between displayed snapshot and SQL execution.
  let race=true
  await page.route('**/rest/v1/rpc/transfer_presidency_if_current',async route=>{if(race){race=false;expect((await old.rpc('set_member_caci',{p_member_id:successor.memberId,p_expiry_date:'2099-12-31'})).error).toBeNull()}await route.continue()})
  await dialog.getByLabel('Recopier l’email du successeur').fill(successor.email);await confirm.click()
  await expect(dialog.getByText(/Aucun transfert effectué/)).toBeVisible();expect((await old.rpc('is_president')).data).toBe(true);expect((await next.rpc('is_president')).data).toBe(false)
  await expect(dialog.getByLabel('Recopier l’email du successeur')).toHaveValue('');await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  await dialog.getByRole('button',{name:'Actualiser le choix'}).click();await dialog.getByLabel('Recopier l’email du successeur').fill(successor.email);await dialog.getByRole('checkbox').check()
  await page.setViewportSize({width:390,height:844});await expect(confirm).toBeEnabled()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  expect(await dialog.locator('button,input:not([type=checkbox]),select').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).length)).toBe(0)
  await page.screenshot({path:'test-results/visual-acceptance/presidency-phone.png'})
  await confirm.click();await expect(dialog).toHaveCount(0);await expect(page.locator('.auth-toolbar .identity-role')).toHaveText('Administrateur');await expect(trigger).toHaveCount(0);await expect(page.getByRole('button',{name:'Ajouter un adhérent',exact:true})).toHaveCount(0)
  await expect(page.getByRole('status').filter({hasText:'Présidence transférée'})).toBeVisible();await expect(page.getByRole('combobox',{name:'Accès',exact:true})).toBeFocused()
  expect((await old.rpc('set_member_role',{p_member_id:people[2].memberId,p_role:'admin'})).error?.code).toBe('42501')
  expect((await old.rpc('transfer_presidency',{p_member_id:people[2].memberId})).error?.code).toBe('42501')
  await successorPage.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(successorPage.locator('.auth-toolbar .identity-role')).toHaveText('Président');await successorPage.getByRole('button',{name:'Administration',exact:true}).click();await successorPage.getByText('Présidence du club · transfert exceptionnel',{exact:true}).click();await expect(successorPage.getByRole('button',{name:'Transférer la présidence',exact:true})).toBeVisible()
  expect((await next.rpc('set_member_role',{p_member_id:people[2].memberId,p_role:'admin'})).error).toBeNull()
  expect((await old.from('session_participations').select('*').eq('session_id',sessionId)).data).toEqual(before)
  expect((await old.from('selection_publications').select('id').eq('session_id',sessionId)).data).toHaveLength(1)
  expect((await old.from('members').select('id').eq('role','president')).data).toEqual([{id:successor.memberId}])
  const audit=await old.from('audit_events').select('actor_member_id,target_member_id').eq('event_type','presidency_transferred').eq('actor_member_id',president.memberId);expect(audit.data).toEqual([{actor_member_id:president.memberId,target_member_id:successor.memberId}])
 }finally{await context.close();if(sessionId && people[0])await serviceClient().from('sessions').delete().eq('id',sessionId);for(const person of people)releaseFixturePresident(person);for(const person of people)await removeMemberFixture(person)}
})

test('two concurrent handovers cannot create two Presidents or let a former President reuse the old token',async()=>{
 const people:MemberFixture[]=[]
 try{
  for(let i=0;i<3;i++)people.push(await createMemberFixture());makeFixturePresident(people[0]);const client=await fixtureClient(people[0]);const rows=await client.from('members').select('id,updated_at').in('id',people.slice(1).map(p=>p.memberId));expect(rows.error).toBeNull()
  const results=await Promise.all(rows.data!.map(row=>client.rpc('transfer_presidency_if_current',{p_member_id:row.id,p_expected_updated_at:row.updated_at})))
  expect(results.filter(r=>!r.error)).toHaveLength(1);expect(results.filter(r=>r.error?.code==='42501')).toHaveLength(1)
  expect((await client.from('members').select('id').eq('role','president')).data).toHaveLength(1);expect((await client.from('audit_events').select('id').eq('event_type','presidency_transferred').eq('actor_member_id',people[0].memberId)).data).toHaveLength(1)
 }finally{for(const person of people)releaseFixturePresident(person);for(const person of people)await removeMemberFixture(person)}
})


test('handover and suspension serialize without creating an inactive or missing President',async()=>{
 const people:MemberFixture[]=[]
 try{
  for(let i=0;i<2;i++)people.push(await createMemberFixture());makeFixturePresident(people[0]);const client=await fixtureClient(people[0]);const target=await client.from('members').select('updated_at').eq('id',people[1].memberId).single();expect(target.error).toBeNull()
  const [transfer,suspend]=await Promise.all([client.rpc('transfer_presidency_if_current',{p_member_id:people[1].memberId,p_expected_updated_at:target.data!.updated_at}),client.rpc('set_member_active',{p_member_id:people[1].memberId,p_active:false})])
  if(!transfer.error){expect(suspend.error?.code).toBe('42501')}else{expect(transfer.error.code).toBe('40001');expect(suspend.error).toBeNull()}
  const presidents=await client.from('members').select('id,disabled_at').eq('role','president');expect(presidents.error).toBeNull();expect(presidents.data).toHaveLength(1);expect(presidents.data![0].disabled_at).toBeNull()
 }finally{for(const person of people)releaseFixturePresident(person);for(const person of people)await removeMemberFixture(person)}
})
