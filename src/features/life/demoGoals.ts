import type { Entry, Area } from '../../lib/workspace';
const definitions: [string,string,Area,number,string][] = [
 ['product','بناء منتج المساعد الشخصي وإكمال نسخته التجريبية','Work',65,'مبني على هدفك المعلن: بناء نظام شخصي يجمع الحياة والعمل.\nالخطوة التالية: تجربة السيناريوهات اليومية وتحديد أهم التحسينات قبل الخدمات الحقيقية.\nمقياس مقترح: تجربة المهام والمواعيد والذاكرة والمساعد من البداية للنهاية.'],
 ['feedback','اختبار المنتج مع مستخدمين وتحويل الملاحظات لخطة تطوير','Work',20,'اقتراح تجريبي وليس هدفاً شخصياً مؤكداً عنك.\nخطوات: تجهيز تجربة قصيرة، جمع الملاحظات، ترتيب المشكلات حسب الأثر.\nمقياس مقترح: خمس جلسات تجربة وقائمة تحسينات.'],
 ['learning','تقوية فهم تصميم المنتجات وبرمجة الواجهات','Learning',30,'اقتراح تجريبي مرتبط بالمشروع وليس تقييماً لمستواك.\nخطوات: فهم React وTypeScript، قراءة مكونات المشروع، تنفيذ تعديل صغير أسبوعياً.\nمقياس مقترح: شرح مسار البيانات وتنفيذ ميزة بسيطة.'],
 ['knowledge','بناء نظام لتوثيق الأفكار والقرارات وما أتعلمه','Learning',15,'اقتراح تجريبي.\nخطوات: حفظ ملاحظة بعد التعلم، تسجيل القرارات المهمة، مراجعة ما تم حفظه أسبوعياً.\nمقياس مقترح: ملاحظات واضحة قابلة للرجوع إليها.'],
 ['relationships','تخصيص وقت منتظم للعلاقات المهمة في حياتي','Family',25,'اقتراح تجريبي بدون افتراض تفاصيل عن أسرتك.\nخطوات: اختيار الأشخاص المهمين، تخصيص وقت للتواصل، وضع موعد مناسب في التقويم.\nمقياس مقترح: تواصل منتظم يناسب ظروفك.'],
 ['wellbeing','بناء روتين يومي للحركة والراحة','Health',35,'اقتراح عام وليس مبنياً على معلومات صحية عنك.\nخطوات: اختيار نشاط بسيط يناسبك، إتاحة فواصل راحة، متابعة الالتزام في الروتين.\nمقياس مقترح: الاستمرارية أسبوعاً بعد أسبوع.'],
 ['finance','تكوين صورة واضحة عن دخلي ومصروفاتي','Finance',10,'اقتراح تنظيمي تجريبي بدون افتراض دخل أو التزامات أو ديون.\nخطوات: حصر الدخل، تصنيف المصروفات، مراجعة شهرية.\nمقياس مقترح: ملخص شهري يساعدك على تحديد أهدافك بنفسك.'],
 ['review','عمل مراجعة أسبوعية تربط أهدافي بخطوات عملية','Personal',40,'اقتراح تجريبي لتجربة النظام الشخصي.\nخطوات: مراجعة ما تحقق، اختيار ثلاث أولويات، تحويل الأولويات لمهام قابلة للتنفيذ.\nمقياس مقترح: مراجعة منتظمة وخطة أسبوعية واقعية.'],
];
export const demoGoals: Entry[]=definitions.map(([key,title,area,progress,detail])=>({id:`demo-life-v1-${key}`,kind:'goal',title,area,progress,detail:`${detail}\nتقدم المهام محسوب من الإنجاز؛ تحقق نتيجة الهدف يُراجع بشكل مستقل.`,archived:false,date:'',time:'',doneDates:[]}));
export type WorkspaceData={version:2;demoVersion:1;entries:Entry[]};
export function restoreWorkspace(saved:unknown,initial:Entry[]=[]):WorkspaceData {
 const current=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved as Partial<WorkspaceData>:null;
 if(current?.version===2&&current.demoVersion===1&&Array.isArray(current.entries))return current as WorkspaceData;
 const previous:Entry[]=Array.isArray(saved)?saved:current&&Array.isArray(current.entries)?current.entries:initial;
 const entries=previous.map(entry=>entry.kind==='goal'&&((entry.id==='seed-goal-learning'&&entry.title==='Build a consistent reading habit')||(entry.id==='seed-goal-health'&&entry.title==='Move a little every day'))?{...entry,archived:true}:entry);
 for(const goal of demoGoals)if(!entries.some(e=>e.id===goal.id||(e.kind==='goal'&&e.title===goal.title)))entries.push({...goal,doneDates:[]});
 return {version:2,demoVersion:1,entries};
}
