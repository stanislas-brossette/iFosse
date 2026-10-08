import { expect, it } from 'vitest'
import { emptyFilters, managementRows, parsePublishPreview, publicationChanges } from './management'
import type { ManagementPerson } from './management'
const rows = [
  { member_id:'c',first_name:'Anne',last_name:'Zulu',completedCount:null,draftState:'waiting',readiness:{caci_status:'valid',transport_ready:true,transport_provisional:false,payment_ready:true} },
  { member_id:'b',first_name:'Bob',last_name:'Alpha',completedCount:2,draftState:'selected',readiness:{caci_status:'soon',transport_ready:true,transport_provisional:true,payment_ready:false} },
  { member_id:'a',first_name:'Alice',last_name:'Alpha',completedCount:2,draftState:'waiting',readiness:{caci_status:'expired',transport_ready:false,transport_provisional:false,payment_ready:false} },
] as ManagementPerson[]
it('sorts names and attendance counts in both directions with alphabetical ties, unknown always last and no mutation', () => {
  const sort = (key:'name'|'count',desc:boolean) => managementRows(rows,'',emptyFilters,key,desc).map(r=>r.member_id)
  expect(sort('name',false)).toEqual(['a','b','c']); expect(sort('name',true)).toEqual(['c','b','a'])
  expect(sort('count',false)).toEqual(['a','b','c']); expect(sort('count',true)).toEqual(['a','b','c'])
  expect(rows.map(r=>r.member_id)).toEqual(['c','b','a'])
})
it('combines readiness filters and search with AND; soon and provisional remain actionable', () => {
  expect(managementRows(rows,'alpha',{...emptyFilters,caci:true,transport:true,unpaid:true},'name',false).map(r=>r.member_id)).toEqual(['a','b'])
  expect(managementRows(rows,'',{...emptyFilters,waiting:true,caci:true},'name',false).map(r=>r.member_id)).toEqual(['a'])
  expect(managementRows(rows,'missing',emptyFilters,'name',false)).toEqual([])
})
it('reports equal-count swaps and waiting/declined changes without filtering; validates previews', () => {
  const preview = {fingerprint:'a'.repeat(32),publication_version:1,capacity:20,rows:[
    {member_id:'a',first_name:'Alice',last_name:'Test',published_state:'selected',draft_state:'waiting'},
    {member_id:'b',first_name:'Bob',last_name:'Test',published_state:'waiting',draft_state:'selected'},
    {member_id:'c',first_name:'Claire',last_name:'Test',published_state:'waiting',draft_state:'declined'},
  ]}
  expect(parsePublishPreview(preview)).toEqual(preview)
  const diff=publicationChanges(preview)
  expect(diff.added.map(r=>r.member_id)).toEqual(['b']);expect(diff.removed.map(r=>r.member_id)).toEqual(['a']);expect(diff.other.map(r=>r.member_id)).toEqual(['c']);expect(diff.selectedCount).toBe(1)
  expect(parsePublishPreview({ ...preview, fingerprint:'invalid' })).toBeNull();expect(parsePublishPreview(null)).toBeNull()
})
