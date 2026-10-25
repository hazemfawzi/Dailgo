import type { CaptureSource } from './model';
import type { Translate } from '../../lib/workspace';
export function CaptureOrigin({source,t}:{source?:CaptureSource;t:Translate}){return source?<details className="capture-original"><summary>{t('Captured from your request','مصدر العنصر من طلبك')}</summary><p>{source.fragment}</p><small>{new Date(source.createdAt).toLocaleString()}</small><details><summary>{t('Full request','الطلب كاملًا')}</summary><p>{source.text}</p></details></details>:null;}
