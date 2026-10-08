import { expect,it } from 'vitest'
import { parseAttendancePreview } from './batch'
const row={member_id:'53000000-0000-4000-8000-000000000001',first_name:'Camille',last_name:'Fictif'}
const preview={fingerprint:'a'.repeat(32),member_count:1,rows:[row]}
it('accepts a complete nominal preview and an explicit empty no-op',()=>{
 expect(parseAttendancePreview(preview)).toEqual(preview);expect(parseAttendancePreview({...preview,member_count:0,rows:[]})).toBeTruthy()
})
it('refuses incomplete, inconsistent or duplicate preview data before enabling a confirmation',()=>{
 for(const invalid of [null,{}, {...preview,fingerprint:'SECRET'}, {...preview,member_count:2}, {...preview,rows:[{...row,member_id:'bad'}]}, {...preview,member_count:2,rows:[row,row]}, {...preview,rows:[{...row,first_name:null}]}])expect(parseAttendancePreview(invalid)).toBeNull()
})
