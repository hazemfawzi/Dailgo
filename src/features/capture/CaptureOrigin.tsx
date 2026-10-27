import { formatTimestamp } from '../../i18n/format';
import type { CaptureSource } from './model';
import type { Translate } from '../../lib/workspace';
export function CaptureOrigin({source,t}:{source?:CaptureSource;t:Translate}){return source?<details className="capture-original"><summary>{t('Captured from your request','مصدر العنصر من طلبك')}</summary><p dir="auto">{source.fragment}</p><small>{formatTimestamp(source.createdAt,t('en','ar'))}</small><details><summary>{t('Full request','الطلب كاملًا')}</summary><p dir="auto">{source.text}</p></details></details>:null;}
