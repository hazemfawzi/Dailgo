import { Bell, Check, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
export function Reminder({t}: {t:(en:string,ar:string)=>string}) {
 const [dismissed,setDismissed,error]=usePersisted('personal-os.reminder.v1',false);
 return <section className="reminder-card"><span className="assistant-icon"><Bell size={18}/></span><div><h3 dir="auto">{dismissed?t('A little more breathing room','مساحة إضافية ليومك'):t('A gentle reminder','تذكير لطيف')}</h3><p dir="auto">{dismissed?t('Reminder marked as done.','تم إكمال التذكير.'):t('Check in with family this evening.','تواصل مع العائلة هذا المساء.')} <span>{t('Sample · No notification will be sent','تجريبي · لن يتم إرسال إشعار')}</span></p>{error&&<p dir="auto" role="alert">{t('Unable to save this reminder.','تعذر حفظ التذكير.')}</p>}</div><Button variant="ghost" onClick={()=>setDismissed(!dismissed)}>{dismissed?<RotateCcw size={16}/>:<Check size={16}/ >}{dismissed?t('Restore','استعادة'):t('Done','تم')}</Button></section>;
}
