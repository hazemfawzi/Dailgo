import { JourneyPreferences } from '../journey/JourneyPreferences';
import { storageText } from '../../i18n/messages';
import { LocalServer } from './LocalServer';
import { Trash } from './Trash';
import { PlanningSettings } from './PlanningSettings';
import { useState } from 'react';
import { Download, Upload, Database } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useStorageState, restoreBackupData, refreshStorage, currentStorageToken, isServerStorage } from '../../lib/storage';
import { DATA_KEYS, STORE_KEY, makeBackup, parseBackup } from '../../lib/storageCore';
import type { Data } from '../../lib/storageCore';
import type { Translate } from '../../lib/workspace';
function download(value:string,name:string){const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function DataSettings({t}:{t:Translate}){
 const {data,error}=useStorageState();const [open,setOpen]=useState(false);const [preview,setPreview]=useState<{data:Data;token:string;name:string}|null>(null);const [notice,setNotice]=useState('');
 function token(){return currentStorageToken();}
 const counts=(d:Data)=>{const entries=d['personal-os.entries.v1'] as any;return [(d['personal-os.tasks.v1'] as any[]??[]).length,(Array.isArray(entries)?entries:entries?.entries??[]).length,(d['personal-os.conversations.v1'] as any[]??[]).length,Object.keys(d['personal-os.weeks.v1']??{}).length].join(' / ');};
 async function load(file?:File){if(!file)return;try{if(file.size>10*1024*1024)throw Error();const parsed=parseBackup(await file.text());setPreview({data:parsed,token:token(),name:file.name});setNotice('');}catch{setNotice(t('Invalid or unsupported backup. Nothing changed.','النسخة غير صالحة أو إصدارها غير مدعوم. لم تتغير البيانات.'));}}
 return <><Button variant="ghost" size="icon" aria-label={t('Data and backup','البيانات والنسخ الاحتياطي')} onClick={()=>setOpen(true)}><Database size={18}/></Button>
 {error&&<div className="data-status" role="alert">{error==='corrupt'?t('Saved data could not be read. Original data is protected; saving is blocked.','تعذر قراءة البيانات. الأصل محفوظ والحفظ متوقف لحمايته.'):error==='conflict'?t('Data changed elsewhere. Refresh the workspace, review and retry your change.','البيانات اتعدلت في مكان تاني. حدّث مساحة العمل وراجع التغيير قبل المحاولة.'):t('Save failed. Changes were not saved.','تعذر الحفظ. التغييرات لم تُحفظ.')} <button onClick={()=>setOpen(true)}>{t('Manage data','إدارة البيانات')}</button> {error==='failed'&&<button onClick={refreshStorage}>{t('Retry storage','إعادة فحص التخزين')}</button>}</div>}
 <Dialog open={open} onOpenChange={setOpen} title={t('Your data','بياناتك')} description={isServerStorage()?storageText(t,'backup'):t('Browser data is local. The optional local server account is separate; no automatic cloud sync.','بيانات المتصفح محلية. حساب السيرفر المحلي اختياري ومستقل؛ بدون مزامنة سحابية تلقائية.')}>
 <p>{t('Tasks / items / conversations / weeks','المهام / الأهداف والمواعيد والذاكرة والروتين / المحادثات / الأسابيع')}: <strong>{counts(data)}</strong></p><p className="muted">{t('Backup includes settings, archived items and links. The file is not encrypted; keep it somewhere private.','النسخة تشمل الإعدادات والعناصر المؤرشفة والروابط. الملف غير مشفر؛ احتفظ به في مكان خاص.')}</p>
 <div className="dialog-actions"><Button disabled={error==='corrupt'} onClick={()=>{try{download(JSON.stringify(makeBackup(data),null,2),`personal-os-backup-${new Date().toISOString().slice(0,10)}.json`);setNotice(t('Backup download requested.','تم طلب تنزيل النسخة الاحتياطية.'));}catch{setNotice(t('Could not export backup.','تعذر تصدير النسخة.'));}}}><Download size={16}/>{t('Export backup','تصدير نسخة احتياطية')}</Button>
 <label className="backup-upload"><Upload size={16}/>{t('Choose backup','اختيار نسخة للاستعادة')}<input type="file" accept=".json,application/json" onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/></label></div>
 {error==='corrupt'&&<Button variant="outline" onClick={()=>{try{download(JSON.stringify(Object.fromEntries([STORE_KEY,...DATA_KEYS].map(k=>[k,localStorage.getItem(k)])),null,2),'personal-os-recovery-raw.json');}catch{setNotice(t('Could not read browser storage.','تعذر قراءة تخزين المتصفح.'));}}}>{t('Download original data for recovery','تنزيل البيانات الأصلية لمحاولة إصلاحها')}</Button>}
 {preview&&<section className="backup-preview"><h3>{t('Restore preview','معاينة الاستعادة')}</h3><p>{preview.name}</p><strong>{counts(preview.data)}</strong><p>{t('Replaces the active workspace, including settings. Export a backup first.','سيستبدل مساحة العمل الحالية بما فيها الإعدادات. صدّر نسخة أولًا.')}</p><div className="dialog-actions"><Button onClick={async()=>{try{if(token()!==preview.token){setNotice(t('Data changed since preview. Select the backup again.','البيانات اتغيرت بعد المعاينة. اختار النسخة مرة تانية.'));setPreview(null);return;}const ok=await restoreBackupData(preview.data,preview.token);setNotice(ok?t('Restored successfully.','تمت الاستعادة بنجاح.'):t('Restore failed; current data was kept.','تعذرت الاستعادة؛ تم الاحتفاظ بالبيانات الحالية.'));setPreview(null);}catch{setNotice(t('Restore failed.','تعذرت الاستعادة.'));}}}>{t('Confirm replacement','تأكيد الاستبدال')}</Button><Button variant="outline" onClick={()=>setPreview(null)}>{t('Cancel','إلغاء')}</Button></div></section>}{notice&&<p role="status">{notice}</p>}
 {!isServerStorage()&&<LocalServer t={t}/>}<PlanningSettings t={t}/><JourneyPreferences t={t}/><Trash t={t}/></Dialog></>;
}






