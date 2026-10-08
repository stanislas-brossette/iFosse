import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { SessionTab } from '../components/SessionTabs'
import type { CalendarFilter } from '../features/sessions/calendar'
export type Route = { area:'sessions'|'profile'|'admin'; sessionId?:string; tab:SessionTab; view:CalendarFilter; season?:number; editing?:boolean }
const tabs = ['overview','participants','transport','groups','bilan','manage'] as const
const views = ['upcoming','past','all'] as const
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseRoute(path:string):Route|null {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('#') || path.includes('\\')) return null
  const [pathname,search=''] = path.split('?'); const query = new URLSearchParams(search)
  const requestedView=query.get('view');const requestedSeason=query.get('season')
  const base:Route={area:'sessions',tab:'overview',view:views.includes(requestedView as CalendarFilter)?requestedView as CalendarFilter:'upcoming',season:requestedSeason && /^\d{4}$/.test(requestedSeason) && Number(requestedSeason)>=2020 && Number(requestedSeason)<=2100?Number(requestedSeason):undefined}
  if (pathname==='/profil') return {...base,area:'profile'}
  if (pathname==='/administration') return {...base,area:'admin'}
  if (pathname==='/' || pathname==='/seances') {
    return base
  }
  if (pathname==='/seances/nouvelle') return {...base,editing:true}
  const match=pathname.match(/^\/seances\/([^/]+)(\/modifier)?$/)
  if (!match || !uuid.test(match[1])) return null
  const tab=query.get('tab')
  return {...base,sessionId:match[1].toLowerCase(),editing:!!match[2],tab:tabs.includes(tab as SessionTab)?tab as SessionTab:'overview'}
}
export function routePath(route:Route):string {
  if(route.area==='profile') return '/profil'
  if(route.area==='admin') return '/administration'
  const params=new URLSearchParams();if(route.sessionId)params.set('tab',route.tab);if(route.season)params.set('season',String(route.season));if(route.view!=='upcoming')params.set('view',route.view)
  const base=route.sessionId?`/seances/${route.sessionId}${route.editing?'/modifier':''}`:route.editing?'/seances/nouvelle':'/seances'
  return `${base}${params.size?'?'+params:''}`
}
export function allowedRoute(route:Route,admin:boolean):Route {
  return !admin && (route.area==='admin' || route.editing) ? {area:'sessions',tab:'overview',view:'upcoming'} : !admin && route.tab==='manage'? {...route,tab:'overview'}:route
}
// One small history store. Paths contain only validated enums/UUIDs, never Auth data.
const listeners=new Set<()=>void>();const prompts=new Set<()=>void>()
type Check={dirty:()=>boolean;leaves:(next:Route)=>boolean;scope?:string}
const checks=new Set<Check>()
let pending:(()=>void)|null=null
let accepted='';let index=0;let restoring=false;let bypassPop=false
function emit(){for(const listener of listeners) listener()}
function prompt(action:(()=>void)|null){pending=action;for(const listener of prompts)listener()}
function path(){return window.location.pathname+window.location.search}
function initialize(){if(!accepted || !Number.isInteger(history.state?.ifosseIndex)){accepted=path();index=Number.isInteger(history.state?.ifosseIndex)?history.state.ifosseIndex:0;history.replaceState({...history.state,ifosseIndex:index},'',accepted)}}
function commit(target:string,replace=false,scroll=true){initialize();if(target===path())return;if(!replace)index++;history[replace?'replaceState':'pushState']({...history.state,ifosseIndex:index},'',target);accepted=target;emit();if(scroll)window.scrollTo({top:0})}
function blocked(next:Route){return [...checks].some(check=>check.dirty()&&check.leaves(next))}
export function navigate(route:Route,{replace=false,scroll=true,bypass=false}={}){
  const target=routePath(route)
  if(pending)return
  if(!bypass&&blocked(route)){prompt(()=>commit(target,replace,scroll));return}
  commit(target,replace,scroll)
}
export function replaceNavigation(pathname:string){prompt(null);const route=parseRoute(pathname);commit(routePath(route??{area:'sessions',tab:'overview',view:'upcoming'}),true,false)}
export function syncNavigation(){accepted=path();history.replaceState({...history.state,ifosseIndex:index},'',accepted);emit()}
function onPop(){
  if(!accepted)initialize();const target=path();const next=parseRoute(target)??{area:'sessions',tab:'overview',view:'upcoming'};const nextIndex=history.state?.ifosseIndex
  if(restoring){restoring=false;accepted=target;emit();return}
  if(bypassPop){bypassPop=false;index=Number.isInteger(nextIndex)?nextIndex:index;accepted=target;emit();return}
  // A pop already moved the URL. Restore its index before asking, then replay
  // only after explicit confirmation; cancelling does not add a history entry.
  if(blocked(next)){
    const delta=Number.isInteger(nextIndex)?nextIndex-index:0
    if(delta){restoring=true;history.go(-delta);prompt(()=>{bypassPop=true;history.go(delta)})}
    else{history.replaceState({...history.state,ifosseIndex:index},'',accepted);prompt(()=>commit(routePath(next)))}
    return
  }
  index=Number.isInteger(nextIndex)?nextIndex:index;accepted=target;emit()
}
function beforeUnload(event:BeforeUnloadEvent){if([...checks].some(check=>check.dirty())){event.preventDefault();event.returnValue=''}}
window.addEventListener('popstate',onPop);window.addEventListener('beforeunload',beforeUnload)
export function useRoute(){const current=useSyncExternalStore(listener=>{initialize();listeners.add(listener);return()=>{listeners.delete(listener)}},path);return parseRoute(current)??{area:'sessions',tab:'overview',view:'upcoming'} as Route}
export function rememberReturnPath(){const route=parseRoute(path());if(route){try{sessionStorage.setItem('ifosse:return-path',routePath(route))}catch{/* Storage is optional. */}}}
export function consumeReturnPath(){let target:string|null=null;try{target=sessionStorage.getItem('ifosse:return-path');sessionStorage.removeItem('ifosse:return-path')}catch{/* Another browser resumes at the calendar. */}return routePath(target?parseRoute(target)??{area:'sessions',tab:'overview',view:'upcoming'}:{area:'sessions',tab:'overview',view:'upcoming'})}
export function clearReturnPath(){try{sessionStorage.removeItem('ifosse:return-path')}catch{/* No storage access. */}}
export function protectScope(scope:string|undefined,action:()=>void){if(scope&&[...checks].some(c=>c.scope===scope&&c.dirty()))prompt(action);else action()}
export function useUnsavedChanges(dirty:boolean,leaves:(next:Route)=>boolean=()=>false,scope?:string){
  const current=useRef({dirty,leaves});current.current={dirty,leaves}
  useEffect(()=>{const check={dirty:()=>current.current.dirty,leaves:(next:Route)=>current.current.leaves(next),scope};checks.add(check);return()=>{checks.delete(check)}},[scope])
  return {markClean:()=>{current.current.dirty=false},protect:(action:()=>void)=>{if(current.current.dirty)prompt(action);else action()}}
}
export function NavigationPrompt(){
  const action=useSyncExternalStore(listener=>{prompts.add(listener);return()=>{prompts.delete(listener)}},()=>pending)
  const dialog=useRef<HTMLDialogElement>(null);const previousFocus=useRef<HTMLElement|null>(null)
  useEffect(()=>{if(action){previousFocus.current=document.activeElement as HTMLElement;if(!dialog.current?.open)dialog.current?.showModal()}else if(dialog.current?.open){dialog.current.close();if(previousFocus.current?.isConnected)previousFocus.current.focus()}},[action])
  function cancel(){prompt(null)}
  return <dialog ref={dialog} aria-labelledby="unsaved-title" onCancel={event=>{event.preventDefault();cancel()}}><h2 id="unsaved-title">Quitter sans enregistrer ?</h2><p>Vos modifications locales non enregistrées seront perdues. Les brouillons déjà enregistrés sur le serveur sont conservés.</p><div className="actions"><button autoFocus onClick={cancel}>Rester</button><button className="danger" onClick={()=>{const proceed=pending;prompt(null);proceed?.()}}>Quitter sans enregistrer</button></div></dialog>
}

if(import.meta.hot)import.meta.hot.dispose(()=>{window.removeEventListener('popstate',onPop);window.removeEventListener('beforeunload',beforeUnload);checks.clear();listeners.clear();prompts.clear()})
