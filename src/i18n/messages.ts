import type { Translate } from '../lib/workspace';
const storageMessages = {
  routines: [
    'Each day starts with a fresh routine check-in. Earlier check-ins stay saved in your workspace.',
    'كل يوم يبدأ بتسجيل روتين جديد، وسجل الأيام السابقة محفوظ في مساحة عملك.',
  ],
  saved: ['Saved to your workspace', 'محفوظ في مساحة عملك'],
  serverSaved: ['Saved to your server account', 'محفوظ على حسابك في السيرفر'],
  memory: [
    'Saved to your server workspace. Server records and exported backups are not encrypted at rest. The rule-based assistant can list your saved memories.',
    'محفوظة في مساحة عملك على السيرفر. السجلات وملفات النسخ الاحتياطي غير مشفرة على القرص. يستطيع المساعد القائم على قواعد عرض المعلومات المحفوظة.',
  ],
  taskEditor: [
    'Plan it, break it down, and save it in your workspace.',
    'حدد تفاصيلها وقسّمها لخطوات واحفظها في مساحة عملك.',
  ],
  entryEditor: [
    'Saved in your workspace. No external action or notification is created.',
    'يُحفظ في مساحة عملك. لن يتم تنفيذ إجراء خارجي أو إرسال إشعار.',
  ],
  focusSaved: ['Focus time saved in your workspace.', 'تم حفظ وقت التركيز في مساحة عملك.'],
  resultSaved: ['Result saved in your workspace.', 'اتحفظت الحصيلة في مساحة عملك.'],
  weeklyFailed: ['Weekly notes could not be saved.', 'تعذر حفظ خطة الأسبوع.'],
  review: [
    'Notes save in your workspace. Unfinished tasks never move automatically.',
    'الملاحظات بتتحفظ في مساحة عملك. المهام غير المكتملة مش بتترحّل تلقائيًا.',
  ],
  backup: [
    'Changes are saved to your server account. Export a backup before replacing data.',
    'التعديلات بتتحفظ على حسابك في السيرفر. صدّر نسخة احتياطية قبل استبدال البيانات.',
  ],
} satisfies Record<string, [string, string]>;
export function storageText(t: Translate, key: keyof typeof storageMessages) {
  return t(...storageMessages[key]);
}
