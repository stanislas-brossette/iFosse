import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
export function Confirmation({open,title,children,confirmLabel,onConfirm,onCancel,busy=false,danger=true,returnFocus,fallbackFocus}:{open:boolean;title:string;children:ReactNode;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;busy?:boolean;danger?:boolean;returnFocus?:RefObject<HTMLElement|null>;fallbackFocus?:RefObject<HTMLElement|null>}){
  const dialog=useRef<HTMLDialogElement>(null);const previousFocus=useRef<HTMLElement|null>(null)
  const titleId=useRef(`confirmation-${crypto.randomUUID()}`)
  useEffect(()=>{if(open){previousFocus.current=returnFocus?.current ?? document.activeElement as HTMLElement;if(!dialog.current?.open)dialog.current?.showModal()}else if(dialog.current?.open){dialog.current.close();const focus=previousFocus.current instanceof HTMLButtonElement && previousFocus.current.disabled ? fallbackFocus?.current : previousFocus.current;if(focus?.isConnected)focus.focus()}},[open,returnFocus,fallbackFocus])
  return <dialog ref={dialog} aria-labelledby={titleId.current} onCancel={event=>{event.preventDefault();if(!busy)onCancel()}}><h2 id={titleId.current}>{title}</h2>{children}<div className="actions"><button autoFocus disabled={busy} onClick={onCancel}>Annuler</button><button className={danger?'danger':'primary'} disabled={busy} onClick={onConfirm}>{busy?'En cours…':confirmLabel}</button></div></dialog>
}
