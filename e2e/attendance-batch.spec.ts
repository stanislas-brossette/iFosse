import {mkdir} from 'node:fs/promises'
import {expect,test} from '@playwright/test'
import {createMemberFixture,fixtureClient,makeFixtureAdmin,openConfirmation,removeMemberFixture,requestMagicLink} from './helpers/local-supabase.js'
import type {MemberFixture} from './helpers/local-supabase.js'
import {seasonOf,todayParis} from '../src/lib/dates.js'
const pastDate=new Date(Date.parse(`${todayParis()}T12:00:00Z`)-2*86400000).toISOString().slice(0,10)
async function create(client:Awaited<ReturnType<typeof fixtureClient>>,name:string){
 const result=await client.rpc('save_session',{p_date:pastDate,p_start_time:'21:00',p_end_time:'22:00',p_title:name,p_venue:'Bassin fictif',p_address:'',p_notes:'',p_capacity:20,p_registration_open:true,p_school_holiday:false,p_end_time_estimated:false});expect(result.error).toBeNull();return result.data!
}
const ok=(value:{error:unknown})=>expect(value.error).toBeNull()
test('batch attendance previews only unknown published confirmations, cancels and reconfirms concurrent changes at realistic volumes',async({page})=>{
 test.setTimeout(120000);const people:MemberFixture[]=[];let client:Awaited<ReturnType<typeof fixtureClient>>|undefined;let id:string|undefined
 try{
  for(let i=0;i<50;i++)people.push(await createMemberFixture());const admin=people[0];makeFixtureAdmin(admin)
  await openConfirmation(page,await requestMagicLink(page,admin));await page.getByRole('button',{name:'Se connecter',exact:true}).click();client=await fixtureClient(admin)
  id=await create(client,`Bilan en lot ${admin.firstName}`)
  for(let i=1;i<=22;i++){ok(await client.rpc('set_session_rsvp',{p_session_id:id,p_member_id:people[i].memberId,p_rsvp:'yes'}));if(i<=20)ok(await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:people[i].memberId,p_state:'selected'}))}
  ok(await client.rpc('publish_selection',{p_session_id:id}))
  for(const [i,status] of [[2,'absent'],[3,'not_dived'],[4,'dived'],[25,'dived']] as const)ok(await client.rpc('set_attendance',{p_session_id:id,p_member_id:people[i].memberId,p_status:status}))
  // Private draft differs: it must never supply the batch population.
  ok(await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:people[1].memberId,p_state:'waiting'}));ok(await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:people[21].memberId,p_state:'selected'}))
  await page.goto(`/seances/${id}?tab=bilan`);const batch=page.getByRole('button',{name:'Marquer les confirmés comme ayant plongé',exact:true});await expect(batch).toBeEnabled()
  await page.setViewportSize({width:1440,height:900});await batch.click();const dialog=page.getByRole('dialog',{name:'Confirmer les présences en lot ?'});await expect(dialog).toContainText('17 personnes')
  await expect(dialog.getByText(`${people[1].firstName} Fictif`,{exact:true})).toBeVisible();await expect(dialog.getByText(`${people[21].firstName} Fictif`,{exact:true})).toHaveCount(0)
  await mkdir('test-results/visual-acceptance',{recursive:true});expect(new URL(page.url()).hash).toBe('');await page.screenshot({path:'test-results/visual-acceptance/batch-desktop.png'})
  await dialog.getByRole('button',{name:'Annuler',exact:true}).press('Escape');await expect(dialog).not.toBeVisible();await expect(batch).toBeFocused()
  const before=await client.rpc('get_session_attendance',{p_session_id:id});expect(before.data?.filter(row=>row.attendance_status==='dived')).toHaveLength(2)
  await batch.click();ok(await client.rpc('set_attendance',{p_session_id:id,p_member_id:people[1].memberId,p_status:'absent'}))
  await dialog.getByRole('button',{name:'Confirmer les présences',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('ont changé');await expect(dialog).toContainText('16 personnes');await expect(dialog.getByRole('button',{name:'Confirmer les présences',exact:true})).toBeEnabled()
  expect((await client.rpc('get_session_attendance',{p_session_id:id})).data?.filter(row=>row.attendance_status==='dived')).toHaveLength(2)
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  await expect.poll(()=>dialog.locator('button').evaluateAll(nodes=>nodes.filter(node=>node.getBoundingClientRect().height<44).length)).toBe(0);await page.screenshot({path:'test-results/visual-acceptance/batch-phone.png'})
  await dialog.getByRole('button',{name:'Confirmer les présences',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.attendance-batch').getByRole('status')).toContainText('16 présences enregistrées');await expect(batch).toBeDisabled();await expect(page.locator('.attendance-batch')).toBeFocused()
  const attendance=(await client.rpc('get_session_attendance',{p_session_id:id})).data!
  for(const [i,status] of [[1,'absent'],[2,'absent'],[3,'not_dived'],[4,'dived'],[25,'dived'],[21,'unknown']] as const)expect(attendance.find(row=>row.member_id===people[i].memberId)?.attendance_status).toBe(status)
  expect(attendance.filter(row=>row.attendance_status==='dived')).toHaveLength(18)
  expect((await client.rpc('get_season_counts',{p_start_year:seasonOf(pastDate)})).data?.find(row=>row.member_id===people[5].memberId)?.completed_count).toBe(0)
  await page.getByRole('button',{name:'Clôturer le bilan',exact:true}).click();await page.getByRole('button',{name:'Confirmer la clôture',exact:true}).click();await expect(page.getByRole('button',{name:'Rouvrir le bilan',exact:true})).toBeVisible()
  expect((await client.rpc('get_season_counts',{p_start_year:seasonOf(pastDate)})).data?.find(row=>row.member_id===people[5].memberId)?.completed_count).toBe(1)
 }finally{if(id&&client)await client.rpc('delete_session',{p_session_id:id});for(const fixture of people.reverse())await removeMemberFixture(fixture)}
})
test('atomic batch serializes with closure and replay cannot update a closed bilan',async()=>{
 const admin=await createMemberFixture();const member=await createMemberFixture();makeFixtureAdmin(admin);const client=await fixtureClient(admin);const other=await fixtureClient(admin);let id:string|undefined
 try{
  id=await create(client,`Lot concurrent ${admin.firstName}`);ok(await client.rpc('set_session_rsvp',{p_session_id:id,p_member_id:member.memberId,p_rsvp:'yes'}));ok(await client.rpc('set_draft_selection',{p_session_id:id,p_member_id:member.memberId,p_state:'selected'}));ok(await client.rpc('publish_selection',{p_session_id:id}))
  const preview=await client.rpc('get_attendance_batch_preview',{p_session_id:id});ok(preview);const fingerprint=(preview.data as {fingerprint:string}).fingerprint
  const [batch,closure]=await Promise.all([client.rpc('mark_confirmed_attendance',{p_session_id:id,p_expected_fingerprint:fingerprint}),other.rpc('close_session_bilan',{p_session_id:id})])
  ok(batch);expect(batch.data).toBe(1);if(closure.error){expect(closure.error.code).toBe('22023');ok(await client.rpc('close_session_bilan',{p_session_id:id}))}
  expect((await other.rpc('mark_confirmed_attendance',{p_session_id:id,p_expected_fingerprint:fingerprint})).error?.code).toBe('22023')
  expect((await client.rpc('get_session_attendance',{p_session_id:id})).data?.[0].attendance_status).toBe('dived')
 }finally{if(id)await client.rpc('delete_session',{p_session_id:id});await removeMemberFixture(member);await removeMemberFixture(admin)}
})
