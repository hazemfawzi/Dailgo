import { formatCalendarDate as localizedDate,formatTime as localizedTime } from '../../i18n/format';
import { formatNumber as localizedNumber } from '../../i18n/format';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { usePersisted } from '../../lib/storage';
import { localDate } from '../../lib/workspace';
import { statusOf,isActionable,isOverdue,priorityOf } from '../tasks/model';
import type { Task } from '../tasks/model';
import type { Translate } from '../../lib/workspace';
export function suggestionReason(task:Task,t:Translate){return task.pinned?t('You pinned this step.','أنت ثبّت الخطوة دي.'):isOverdue(task)?t('Its due date has passed; review the commitment.','موعد تسليمها فات؛ راجع الالتزام.'):task.dueDate===localDate()?t('Due today.','تسليمها النهارده.'):priorityOf(task)==='high'?t('You marked it high priority.','أنت حددت أولويتها عالية.'):task.goalId?t('Linked to one of your goals.','مرتبطة بهدف عندك.'):t('An available open step, ordered by priority and due date.','خطوة متاحة، مرتبة حسب الأولوية والتسليم.');}
export function NeedsAttention({tasks,t,edit}:{tasks:Task[];t:Translate;edit:(task:Task)=>void}){const today=localDate();const waiting=tasks.filter(x=>!x.archived&&!x.done&&x.reviewDate&&x.reviewDate<=today&&['waiting','blocked','deferred'].includes(statusOf(x)));return waiting.length?<section className="card attention-card"><h3 dir="auto">{t('Needs your decision','محتاج قرار منك')} · {localizedNumber(waiting.length,t('en','ar'))}</h3>{waiting.slice(0,5).map(task=><button className="attention-row" key={task.id} onClick={()=>edit(task)}>{task.title}<small>{task.waitingFor} · {localizedDate(task.reviewDate,t('en','ar'))}</small></button>)}<Link to="/planner?filter=waiting">{t('Review waiting tasks','راجع المهام المنتظرة')}</Link></section>:null;}
export function useSuggestionDismissals(){return usePersisted<Record<string,string>>('personal-os.suggestions.v1',{});}
export function SuggestionNote({task,t,onDismiss}:{task:Task;t:Translate;onDismiss:()=>void}){return <div className="suggestion-reason"><small>{suggestionReason(task,t)}{task.estimate?` · ${task.estimate} ${t('estimated min; review capacity before starting','دقيقة تقديرية؛ راجع سعة اليوم قبل البداية')}`:''}</small><Button  variant="ghost" onClick={onDismiss}>{t('Hide today','إخفاء النهارده')}</Button></div>;}

