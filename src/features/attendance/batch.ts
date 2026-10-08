export type AttendancePreview = {fingerprint:string;member_count:number;rows:{member_id:string;first_name:string;last_name:string}[]}
export function parseAttendancePreview(value:unknown):AttendancePreview|null {
 if(!value || typeof value!=='object')return null
 const preview=value as AttendancePreview
 if(typeof preview.fingerprint!=='string' || !/^[a-f0-9]{32}$/.test(preview.fingerprint) || !Number.isInteger(preview.member_count) || preview.member_count<0 || !Array.isArray(preview.rows) || preview.rows.length!==preview.member_count)return null
 const ids=new Set<string>()
 for(const row of preview.rows){
  if(!row || typeof row.member_id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.member_id) || typeof row.first_name!=='string' || typeof row.last_name!=='string' || ids.has(row.member_id))return null
  ids.add(row.member_id)
 }
 return preview
}
