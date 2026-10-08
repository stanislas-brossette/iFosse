import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
export function Confirmation({open,title,children,confirmLabel,onConfirm,onCancel,busy=false}:{open:boolean;title:string;children:ReactNode;confirmLabel:string;onConfirm:()=>void;onCancel:()=>void;busy?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);const previousFocus=useRef<HTMLElement|null>(null)
  const titleId=useRef(`confirmation-${crypto.randomUUID()}`)
  useEffect(()=>{if(open){previousFocus.current=document.activeElement as HTMLElement;if(!dialog.current?.open)dialog.current?.showModal()}else if(dialog.current?.open){dialog.current.close();if(previousFocus.current?.isConnected)previousFocus.current.focus()}},[open])
  return <dialog ref={dialog} aria-labelledby={titleId.current} onCancel={event=>{event.preventDefault();if(!busy)onCancel()}}><h2 id={titleId.current}>{title}</h2>{children}<div className="actions"><button autoFocus disabled={busy} onClick={onCancel}>Annuler</button><button className="danger" disabled={busy} onClick={onConfirm}>{busy?'En cours…':confirmLabel}</button></div></dialog>
}
