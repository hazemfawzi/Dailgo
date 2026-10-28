import { lazyView } from './lib/lazyView';
import { shortcutAction } from './lib/shortcuts';
import { Onboarding } from './features/journey/Onboarding';
import { UndoNotice } from './components/UndoNotice';
import { storageText } from './i18n/messages';
import { OfflineApp } from './components/OfflineApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { projectStats } from './features/life/projectModel';

import { GlobalSearch } from './features/capture/GlobalSearch';
import { QuickCapture } from './features/capture/QuickCapture';
import { DataSettings } from './features/settings/DataSettings';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Sparkles,
  Layers,
  CalendarDays,
  Brain,
  Sun,
  Moon,
  Trash2,
  Leaf,
  Menu,
} from 'lucide-react';
import { branding } from './config/branding';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
import { usePersisted, transactData, isServerStorage } from './lib/storage';
import { TaskEditor } from './features/tasks/TaskEditor';
import { HomeScreen, type Task } from './features/home/HomeScreen';
const GoalScreen = lazyView(() =>
  import('./features/life/GoalScreen').then((module) => ({ default: module.GoalScreen })),
);
import { goalStats } from './features/life/goalModel';
const LifeScreen = lazyView(() =>
  import('./features/life/LifeScreen').then((module) => ({ default: module.LifeScreen })),
);
const MemoryScreen = lazyView(() =>
  import('./features/memory/MemoryScreen').then((module) => ({ default: module.MemoryScreen })),
);
const PlannerScreen = lazyView(() =>
  import('./features/planner/PlannerScreen').then((module) => ({ default: module.PlannerScreen })),
);
const AssistantScreen = lazyView(() =>
  import('./features/assistant/AssistantScreen').then((module) => ({
    default: module.AssistantScreen,
  })),
);
import type { Entry } from './lib/workspace';
import { restoreWorkspace } from './features/life/demoGoals';
import type { WorkspaceData } from './features/life/demoGoals';
import type { SetStateAction } from 'react';
const ActionsScreen = lazyView(() =>
  import('./features/assistant/ActionsScreen').then((module) => ({
    default: module.ActionsScreen,
  })),
);
const ProjectScreen = lazyView(() =>
  import('./features/life/ProjectScreen').then((module) => ({ default: module.ProjectScreen })),
);
const ToolsScreen = lazyView(() =>
  import('./features/tools/ToolsScreen').then((module) => ({ default: module.ToolsScreen })),
);
const TodayView = lazyView(() =>
  import('./features/tools/TodayView').then((module) => ({ default: module.TodayView })),
);
const initialTasks: Task[] = [];
const sections = [
  { path: '/', en: 'Home', ar: 'الرئيسية', icon: Home },
  { path: '/assistant', en: 'AI Assistant', ar: 'المساعد', icon: Sparkles },
  { path: '/life', en: 'My Life', ar: 'حياتي', icon: Layers },
  { path: '/planner', en: 'Planner', ar: 'المخطط', icon: CalendarDays },
  { path: '/memory', en: 'Memory', ar: 'الذاكرة', icon: Brain },
  { path: '/tools', en: 'Life tools', ar: 'أدوات حياتك', icon: Layers },
];
export default function App() {
  const [lang, setLang] = usePersisted<'en' | 'ar'>('personal-os.language', 'ar');
  const [dark, setDark] = usePersisted('personal-os.dark', false);
  const [tasks, setTasks, storageError] = usePersisted<Task[]>(
    'personal-os.tasks.v1',
    initialTasks,
  );
  const [workspace, setWorkspace, entriesError] = usePersisted<WorkspaceData>(
    'personal-os.entries.v1',
    { version: 2, demoVersion: 1, entries: [] },
    (saved) => restoreWorkspace(saved, []),
  );
  const entries = workspace.entries.map((entry) =>
    entry.kind === 'goal'
      ? { ...entry, progress: goalStats(tasks, entry.id).progress }
      : entry.kind === 'project'
        ? { ...entry, progress: projectStats(tasks, entry.id).progress }
        : entry,
  );
  const setEntries = useCallback(
    (change: SetStateAction<Entry[]>) =>
      setWorkspace((old) => ({
        ...old,
        entries: typeof change === 'function' ? change(old.entries) : change,
      })),
    [setWorkspace],
  );
  const [, setClock] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const ar = lang === 'ar';
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState(false);
  const [editor, setEditor] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [remove, setRemove] = useState<Task | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle('dark', dark);
    document.title = ar ? branding.nameAr : branding.name;
  }, [ar, lang, dark]);
  function edit(task?: Task) {
    setEditor(
      task ?? {
        id: crypto.randomUUID(),
        title: '',
        category: 'Personal',
        done: false,
        archived: false,
      },
    );
    setFormOpen(true);
  }
  async function saveTask(task: Task) {
    const ok = await transactData((data) => {
      const all = (data['personal-os.tasks.v1'] ?? []) as Task[];
      if (task.revision && !all.some((x) => x.id === task.id)) throw Error('edit-conflict');
      return {
        ...data,
        'personal-os.tasks.v1': all.some((x) => x.id === task.id)
          ? all.map((x) => (x.id === task.id ? task : x))
          : [...all, task],
      };
    });
    if (ok) setFormOpen(false);
    return ok;
  }
  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const action = shortcutAction(
        event,
        !!target?.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]',
        ),
        !!document.querySelector('[role=dialog]'),
      );
      if (!action) return;
      event.preventDefault();
      if (action === 'assistant') {
        if (location.pathname === '/assistant') document.getElementById('chat-message')?.focus();
        else setAssistantOpen(true);
      } else if (action === 'task') edit();
      else if (action === 'search') window.dispatchEvent(new Event('dailgo-search'));
      else {
        if (location.pathname !== '/') navigate('/');
        requestAnimationFrame(() => {
          const focus = document.getElementById('daily-focus');
          focus?.scrollIntoView({ block: 'center' });
          focus?.querySelector('select')?.focus();
        });
      }
    };
    window.addEventListener('keydown', shortcuts, true);
    return () => window.removeEventListener('keydown', shortcuts, true);
  }, [location.pathname]);
  function propose(text: string) {
    if (!text.trim()) return;
    const message =
      text === t('Help me prioritize', 'ساعدني في ترتيب الأولويات')
        ? t('Plan my day', 'خطط يومي')
        : text === t('Make time for a break', 'خصص وقتاً للاستراحة')
          ? t('Task: Take a short break', 'مهمة: استراحة قصيرة')
          : text === t('Remind me to call family', 'ذكرني بالاتصال بالعائلة')
            ? t('Task: Call family', 'مهمة: الاتصال بالعائلة')
            : text;
    navigate('/assistant', { state: { prompt: message } });
  }
  const navigation = (
    <>
      {sections.map((s) => (
        <NavLink
          key={s.path}
          to={s.path}
          end={s.path === '/'}
          onClick={() => setMobileMenu(false)}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <s.icon size={19} />
          <span>{ar ? s.ar : s.en}</span>
          {s.path === '/assistant' && <span className="nav-dot" />}
        </NavLink>
      ))}
    </>
  );
  return (
    <div className="app-shell">
      <Dialog
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        title={t('Assistant and changes', 'المساعد والتغييرات')}
        description={t(
          'Ctrl/Cmd+K · Review every proposal before saving.',
          'Ctrl/Cmd+K · راجع كل اقتراح قبل الحفظ.',
        )}
      >
        <div className="assistant-drawer">
          <div className="tools-tabs">
            <button onClick={() => setAssistantHistory(false)}>
              {t('Conversation', 'المحادثة')}
            </button>
            <button onClick={() => setAssistantHistory(true)}>
              {t('Change history', 'سجل التغييرات')}
            </button>
          </div>
          <Suspense fallback={<p dir="auto">{t('Opening assistant…', 'جاري فتح المساعد…')}</p>}>
            {assistantHistory ? (
              <ActionsScreen t={t} />
            ) : (
              <AssistantScreen {...{ t, tasks, setTasks, entries, setEntries }} />
            )}
          </Suspense>
        </div>
      </Dialog>
      <UndoNotice t={t} />
      <Onboarding t={t} language={lang} dark={dark} onLanguage={setLang} onDark={setDark} />
      <a className="skip-link" href="#main-content">
        {t('Skip to content', 'انتقل للمحتوى')}
      </a>
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Sparkles size={23} />
          </span>
          <span>
            {t(branding.name, branding.nameAr)}
            <small>{t('YOUR PERSONAL OS', 'نظام حياتك الشخصي')}</small>
          </span>
        </Link>
        <div className="workspace-label">{t('WORKSPACE', 'مساحة العمل')}</div>
        <nav aria-label={t('Main navigation', 'التنقل الرئيسي')}>{navigation}</nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="status-dot" />
            {t('A space that’s only yours', 'مساحة تخصك وحدك')}
            <small>
              {isServerStorage()
                ? storageText(t, 'serverSaved')
                : t('Prototype · Stored on this device', 'نموذج أولي · محفوظ على هذا الجهاز')}
            </small>
          </div>
          <div className="profile">
            <span className="avatar">Y</span>
            <div>
              {t('Your workspace', 'مساحتك الشخصية')}
              <small>{t('Personal account · Demo', 'حساب شخصي · تجريبي')}</small>
            </div>
            <Leaf size={17} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu-button"
              aria-label={t('Toggle menu', 'فتح القائمة')}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={20} />
            </Button>
            <span className="breadcrumb">
              {t('Your workspace', 'مساحتك الشخصية')}
              <span>/</span>
              {location.pathname === '/'
                ? t('Personal overview', 'نظرة شخصية')
                : (sections.find((s) => s.path === location.pathname)?.[ar ? 'ar' : 'en'] ??
                  (location.pathname.startsWith('/life/')
                    ? t('Goal details', 'تفاصيل الهدف')
                    : t('Page', 'صفحة')))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch t={t} tasks={tasks} entries={entries} edit={edit} />
            <QuickCapture t={t} />
            <DataSettings t={t} />
            <OfflineApp t={t} />
            <span className="prototype-tag">
              {isServerStorage()
                ? t('SERVER WORKSPACE', 'مساحة متصلة بالسيرفر')
                : t('LOCAL PROTOTYPE', 'نموذج محلي')}
            </span>
            <Button
              variant="ghost"
              onClick={() => setLang(ar ? 'en' : 'ar')}
              aria-label={t('Switch to Arabic', 'التبديل إلى الإنجليزية')}
            >
              {ar ? 'EN' : 'العربية'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark(!dark)}
              aria-label={t('Toggle color theme', 'تغيير المظهر')}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <span className="avatar small">Y</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {(storageError || entriesError) && (
            <div role="alert" className="notice">
              {t(
                'Saving needs attention. Open Data and backup above.',
                'الحفظ يحتاج مراجعة. افتح البيانات والنسخ الاحتياطي بالأعلى.',
              )}
            </div>
          )}
          <ErrorBoundary t={t}>
            <Suspense
              fallback={
                <p dir="auto" className="notice" role="status">
                  {t('Loading your space…', 'جاري فتح مساحتك…')}
                </p>
              }
            >
              <Routes>
                <Route
                  path="/"
                  element={
                    <>
                      <HomeScreen
                        {...{ t, ar, tasks, setTasks, entries, setEntries, edit, propose }}
                      />
                    </>
                  }
                />
                <Route path="/assistant/actions" element={<ActionsScreen t={t} />} />
                <Route
                  path="/assistant"
                  element={<AssistantScreen {...{ t, tasks, setTasks, entries, setEntries }} />}
                />
                <Route
                  path="/projects/:projectId"
                  element={
                    <ProjectScreen
                      {...{ t, entries, setEntries, tasks, setTasks, edit, setRemove }}
                    />
                  }
                />
                <Route
                  path="/life/:goalId"
                  element={
                    <GoalScreen {...{ t, entries, setEntries, tasks, setTasks, edit, setRemove }} />
                  }
                />
                <Route path="/life" element={<LifeScreen {...{ t, entries, setEntries }} />} />
                <Route
                  path="/planner"
                  element={
                    <PlannerScreen
                      {...{ t, ar, tasks, setTasks, entries, setEntries, edit, setRemove }}
                    />
                  }
                />
                <Route path="/memory" element={<MemoryScreen {...{ t, entries, setEntries }} />} />
                <Route path="/tools" element={<ToolsScreen t={t} />} />
                <Route path="/today" element={<TodayView t={t} />} />
                <Route
                  path="*"
                  element={
                    <section className="card scope-page">
                      <h1 dir="auto">{t('Page not found', 'الصفحة غير موجودة')}</h1>
                      <Button asChild>
                        <Link to="/">{t('Back to Home', 'العودة للرئيسية')}</Link>
                      </Button>
                    </section>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t('Mobile navigation', 'التنقل للجوال')}>
        {navigation}
      </nav>
      {formOpen && editor && (
        <TaskEditor
          key={editor.id}
          task={editor}
          projects={entries.filter((x) => x.kind === 'project')}
          memories={entries.filter((x) =>
            ['note', 'decision', 'preference', 'personal'].includes(x.kind),
          )}
          goals={entries.filter((x) => x.kind === 'goal')}
          t={t}
          onClose={() => setFormOpen(false)}
          onSave={saveTask}
        />
      )}
      <Dialog
        open={!!remove}
        onOpenChange={() => setRemove(null)}
        title={t('Delete this priority?', 'حذف هذه الأولوية؟')}
        description={t(
          'Moves it to Recently deleted, where it can be restored.',
          'تنتقل للمحذوفات القابلة للاستعادة من البيانات والنسخ الاحتياطي.',
        )}
      >
        <p dir="auto" className="mb-6">
          {remove?.title}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            {t('Keep priority', 'الاحتفاظ بالأولوية')}
          </Button>
          <Button
            onClick={() => {
              setTasks((old) => old.filter((x) => x.id !== remove?.id));
              setRemove(null);
            }}
          >
            <Trash2 size={15} />
            {t('Delete', 'حذف')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
