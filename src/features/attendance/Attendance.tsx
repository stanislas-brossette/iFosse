import { useCallback, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'
import type { Member } from '../auth/AuthGate'
import type { Session } from '../sessions/SessionEditor'
import { useSharedRefresh } from '../../lib/useSharedRefresh'
import { businessError } from '../../lib/businessErrors'
import { attendanceLabels } from '../../lib/labels'
import { Confirmation } from '../../components/Confirmation'
import { parseAttendancePreview } from './batch'
import type { AttendancePreview } from './batch'

type Person = { id: string; first_name: string; last_name: string; disabled_at: string | null }
type AttendanceRow = Database['public']['Functions']['get_session_attendance']['Returns'][number]
type Bilan = Database['public']['Functions']['get_bilan_state']['Returns'][number]
type Status = Database['public']['Enums']['attendance_state']
export function Attendance({ client, member, session, onChanged }: { client: SupabaseClient<Database>; member: Member; session: Session; onChanged: () => Promise<void> }) {
  const admin = member.role !== 'member'
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [state, setState] = useState<Bilan | null>(null)
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<'close' | 'reopen' | null>(null)
  const [messageFor,setMessageFor] = useState<string|null>(null)
  const [message, setMessage] = useState('')
  const [messageError,setMessageError] = useState(false)
  const batchRegion=useRef<HTMLDivElement>(null)
  const batchButton=useRef<HTMLButtonElement>(null)
  const [batchPreview,setBatchPreview] = useState<AttendancePreview|null>(null)
  const [batchMessage,setBatchMessage] = useState('')
  const [batchError,setBatchError] = useState(false)
  const sequence = useRef(0)
  const load = useCallback(async () => {
    const request = ++sequence.current
    const attendance = await client.rpc('get_session_attendance', { p_session_id: session.id })
    if (request !== sequence.current) return
    if (attendance.error) { setRows([]); setMessageFor(null);setMessageError(true);setMessage('Présences indisponibles. Actualisez la séance.'); return }
    setRows(attendance.data ?? [])
    if (admin) {
      const [directory, selection, bilan] = await Promise.all([
        client.from('members').select('id,first_name,last_name,disabled_at').order('last_name'),
        client.rpc('get_current_selection', { p_session_id: session.id }),
        client.rpc('get_bilan_state', { p_session_id: session.id }),
      ])
      if (request !== sequence.current) return
      if (directory.error || selection.error || bilan.error) { setPeople([]); setState(null); setMessageFor(null);setMessageError(true);setMessage('Bilan indisponible. Vérifiez vos droits.'); return }
      setPeople(directory.data ?? [])
      setSelected((selection.data ?? []).filter(person => person.state === 'selected').map(person => person.member_id))
      setState(bilan.data?.[0] ?? null)
    }
  }, [client, session.id, admin])
  useSharedRefresh(load)

  async function change(memberId: string, value: Status) {
    if(busy)return;setBatchMessage('');setBusy(true);setMessageFor(memberId);setMessageError(false);setMessage('Enregistrement de la présence…')
    const result = await client.rpc('set_attendance', { p_session_id: session.id, p_member_id: memberId, p_status: value })
    setMessageError(!!result.error);setMessage(result.error ? businessError(result.error,'Présence refusée. Vérifiez que la séance est terminée et le bilan ouvert.') : 'Présence enregistrée. Elle comptera après clôture du bilan.')
    await load(); await onChanged(); setBusy(false)
  }
  async function confirm() {
    if (!confirmation || busy)return
    setBatchMessage('');setBusy(true);setMessageFor(null);setMessageError(false);setMessage('Mise à jour du bilan…')
    const result = await client.rpc(confirmation === 'close' ? 'close_session_bilan' : 'reopen_session_bilan', { p_session_id: session.id })
    setMessageError(!!result.error);setMessage(result.error ? businessError(result.error,'Bilan non modifié. Vérifiez les présences des confirmés et la capacité, puis actualisez.') : confirmation === 'close' ? 'Bilan clôturé. Les plongées réalisées sont comptabilisées.' : 'Bilan rouvert. Cette séance ne compte plus jusqu’à sa nouvelle clôture.')
    if (!result.error) setConfirmation(null)
    await load(); await onChanged(); setBusy(false)
  }
  async function readBatch() {
    const result = await client.rpc('get_attendance_batch_preview', {p_session_id:session.id})
    const preview = result.error ? null : parseAttendancePreview(result.data)
    if (!preview) {
      setBatchPreview(null);setBatchError(true)
      setBatchMessage(businessError(result.error,'Récapitulatif indisponible. Actualisez le bilan avant de réessayer.'))
      return false
    }
    setBatchPreview(preview)
    return true
  }
  async function prepareBatch() {
    if(busy)return
    setMessage('');setBusy(true);setBatchError(false);setBatchMessage('Chargement du récapitulatif…')
    try {if(await readBatch())setBatchMessage('')} catch {setBatchError(true);setBatchMessage('Récapitulatif indisponible. Réessayez.')} finally {setBusy(false)}
  }
  async function applyBatch() {
    if(busy || !batchPreview)return
    setBusy(true);setBatchError(false);setBatchMessage('Enregistrement des présences…')
    try {
      const result=await client.rpc('mark_confirmed_attendance',{p_session_id:session.id,p_expected_fingerprint:batchPreview.fingerprint})
      if(result.error?.code==='40001') {
        if(await readBatch()){setBatchError(true);setBatchMessage('Les présences ou la sélection ont changé. Vérifiez le nouveau récapitulatif et confirmez à nouveau. Aucune présence du lot n’a été enregistrée.')}
      } else if(result.error) {
        setBatchError(true);setBatchMessage(businessError(result.error,'Présences non enregistrées. Actualisez le bilan avant de réessayer.'))
      } else {
        setBatchPreview(null);setBatchMessage(`${result.data} présences enregistrées. Vérifiez les absents avant de clôturer ; les compteurs restent inchangés jusqu’à la clôture.`)
      }
      await load();await onChanged()
    } catch {setBatchError(true);setBatchMessage('Résultat indisponible. Actualisez les présences avant de réessayer.')} finally {setBusy(false)}
  }
  const displayed = people.filter(person => (all && !person.disabled_at) || selected.includes(person.id) || rows.some(row => row.member_id === person.id && row.attendance_status !== 'unknown'))
  return <div className="mt attendance"><h3>Bilan des présences</h3>
    <p>{session.status === 'closed' ? 'Bilan clôturé : seules les plongées réalisées comptent pour la saison.' : 'Les présences comptent uniquement après clôture du bilan.'}</p>
    {admin ? <>
      {state && <p>{state.dived_count} personnes ont plongé · {state.unknown_selected_count} présences de confirmés à renseigner.</p>}
      {!state?.session_ended && session.status !== 'closed' && <p>Les présences se renseignent après l’heure de fin de la séance (heure de Paris).</p>}
      {session.status !== 'closed' && state?.session_ended && <div ref={batchRegion} tabIndex={-1} className="attendance-batch" aria-label="Présences en lot"><button ref={batchButton} className="secondary" disabled={busy || !state.unknown_selected_count} onClick={()=>void prepareBatch()}>Marquer les confirmés comme ayant plongé</button><p className="muted">Seules les présences « À renseigner » des confirmés de la dernière publication sont proposées. Les autres saisies et les remplacements sont conservés.</p>{!batchPreview && batchMessage && <p role={batchError?'alert':'status'}>{batchMessage}</p>}</div>}
      {!batchPreview && batchMessage && (session.status === 'closed' || !state?.session_ended) && <p role={batchError?'alert':'status'}>{batchMessage}</p>}
      <label className="check"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />Afficher tous les adhérents pour renseigner un remplacement</label>
      {messageFor && !displayed.some(person=>person.id===messageFor) && message && <p role={messageError?'alert':'status'}>{people.find(person=>person.id===messageFor)?.first_name} · {message}</p>}
      <ul className="member-list">{displayed.map(person => <li key={person.id}><strong>{person.first_name} {person.last_name}</strong><label>Présence de {person.first_name} {person.last_name}
        <select disabled={busy || session.status === 'closed' || !state?.session_ended} value={rows.find(row => row.member_id === person.id)?.attendance_status ?? 'unknown'} onChange={event => void change(person.id, event.target.value as Status)}>
          {(['unknown', 'dived', 'absent', 'not_dived'] as const).map(value => <option key={value} value={value}>{attendanceLabels[value]}</option>)}
        </select></label>{messageFor === person.id && message && <p role={messageError?'alert':'status'}>{message}</p>}</li>)}</ul>
      {!displayed.length && <p>Aucun participant confirmé. Affichez tous les adhérents pour renseigner une présence réelle.</p>}
      <button disabled={busy || !state || (session.status !== 'closed' && !state.session_ended)} onClick={() => setConfirmation(session.status === 'closed' ? 'reopen' : 'close')}>{session.status === 'closed' ? 'Rouvrir le bilan' : 'Clôturer le bilan'}</button>
      {confirmation && <div className="mt"><p>{confirmation === 'close' ? 'Clôturer après vérification des présences ? Les inscriptions seront fermées et le brouillon de sélection abandonné. Toutes les présences des confirmés doivent être renseignées, et le nombre de plongeurs doit respecter la capacité.' : 'Rouvrir pour correction ? Les présences sont conservées ; cette séance ne compte plus jusqu’à sa nouvelle clôture. Les inscriptions restent fermées.'}</p><div className="actions"><button disabled={busy} onClick={() => void confirm()}>{confirmation === 'close' ? 'Confirmer la clôture' : 'Confirmer la réouverture'}</button><button disabled={busy} onClick={() => setConfirmation(null)}>Annuler</button></div></div>}
    </> : session.status === 'closed' ? <ul className="member-list">{rows.filter(row => row.attendance_status !== 'unknown').map(row => <li key={row.member_id}><span>{row.first_name} {row.last_name}</span><strong>{attendanceLabels[row.attendance_status]}</strong></li>)}</ul> : <p>Le bilan sera visible après validation par un administrateur.</p>}
    {!messageFor && message && <p role={messageError?'alert':'status'}>{message}</p>}
    {admin && <Confirmation open={!!batchPreview} title="Confirmer les présences en lot ?" confirmLabel="Confirmer les présences" danger={false} returnFocus={batchButton} fallbackFocus={batchRegion} onConfirm={()=>void applyBatch()} onCancel={()=>{setBatchPreview(null);setBatchMessage('')}} busy={busy}><p>{batchPreview?.member_count} personnes seront marquées « A plongé ». Vérifiez cette liste et les absents. Le bilan restera ouvert.</p><ul className="batch-preview-people" tabIndex={0} aria-label="Personnes concernées">{batchPreview?.rows.map(person=><li key={person.member_id}>{person.first_name} {person.last_name}</li>)}</ul>{batchPreview && batchMessage && <p role={batchError?'alert':'status'}>{batchMessage}</p>}</Confirmation>}
  </div>
}
