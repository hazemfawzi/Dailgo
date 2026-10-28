import { formatNumber as localizedNumber } from '../i18n/format';
import { useState,useSyncExternalStore } from 'react';
import { applyUndo,clearUndo,currentUndo,subscribeUndo } from '../lib/undoStore';
import { transactData } from '../lib/storage';
import type { Translate } from '../lib/workspace';
import { Button } from './ui/button';
export function UndoNotice({t}:{t:Translate}){
 const ticket=useSyncExternalStore(subscribeUndo,currentUndo);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 if(!ticket)return error?<p dir="auto" className="undo-notice" role="status">{error}<Button variant="ghost" onClick={()=>setError('')}>{t('Dismiss','إغلاق')}</Button></p>:null;
 return <aside className="undo-notice" role="status"><span>{t('Saved · Undo available for 20 seconds','اتحفظ · التراجع متاح لمدة ٢٠ ثانية')} · {localizedNumber(ticket.rows.length,t('en','ar'))}</span><Button disabled={busy} variant="outline" onClick={async()=>{setBusy(true);const ok=await transactData(data=>applyUndo(data,ticket));setBusy(false);clearUndo();setError(ok?'':t('Could not undo: the item changed or the time elapsed. Review the latest state.','تعذر التراجع: العنصر اتغير أو الوقت انتهى. راجع أحدث نسخة.'));}}>{t('Undo','تراجع')}</Button><Button variant="ghost" aria-label={t('Dismiss undo','إغلاق التراجع')} onClick={clearUndo}>×</Button></aside>;
}
