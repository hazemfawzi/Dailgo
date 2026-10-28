import { messagePair } from './i18n/translate';
import { createTranslator } from './i18n/translate';
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
  {
    path: '/',
    en: messagePair('content.a7e49d2ebdfb').en,
    ar: messagePair('content.a7e49d2ebdfb').ar,
    icon: Home,
  },
  {
    path: '/assistant',
    en: messagePair('content.81a0716edd1e').en,
    ar: messagePair('content.81a0716edd1e').ar,
    icon: Sparkles,
  },
  {
    path: '/life',
    en: messagePair('content.18769707fe48').en,
    ar: messagePair('content.18769707fe48').ar,
    icon: Layers,
  },
  {
    path: '/planner',
    en: messagePair('content.e7665d2bdb88').en,
    ar: messagePair('content.e7665d2bdb88').ar,
    icon: CalendarDays,
  },
  {
    path: '/memory',
    en: messagePair('content.eee0ded69112').en,
    ar: messagePair('content.eee0ded69112').ar,
    icon: Brain,
  },
  {
    path: '/tools',
    en: messagePair('content.0e12345976cb').en,
    ar: messagePair('content.0e12345976cb').ar,
    icon: Layers,
  },
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
  useEffect(() => {
    const open = () => {
      const id = location.hash.slice(1);
      if (id) document.getElementById(id)?.closest('details')?.setAttribute('open', '');
    };
    const frame = requestAnimationFrame(open);
    window.addEventListener('hashchange', open);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', open);
    };
  }, [location.pathname, location.hash]);
  const ar = lang === 'ar';
  const t = createTranslator(lang);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantHistory, setAssistantHistory] = useState(false);
  const [editor, setEditor] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [remove, setRemove] = useState<Task | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
          focus?.closest('details')?.setAttribute('open', '');
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
      text === t('ui.helpMePrioritize.fed84c')
        ? t('ui.planMyDay.fec857')
        : text === t('ui.makeTimeForABreak.944033')
          ? t('ui.taskTakeAShortBreak.35be98')
          : text === t('ui.remindMeToCallFamily.07c24d')
            ? t('ui.taskCallFamily.3bd63a')
            : text;
    navigate('/assistant', { state: { prompt: message } });
  }
  const appearanceControls = (
    <>
      <OfflineApp t={t} />
      <Button
        variant="ghost"
        onClick={() => setLang(ar ? 'en' : 'ar')}
        aria-label={t('ui.switchToArabic.1b1851')}
      >
        {ar ? 'EN' : 'العربية'}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDark(!dark)}
        aria-label={t('ui.toggleColorTheme.2331b0')}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </Button>
    </>
  );
  const preferenceControls = (
    <>
      <DataSettings t={t} />
      {appearanceControls}
    </>
  );
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
        title={t('ui.assistantAndChanges.c3f1e2')}
        description={t('ui.ctrlCmdKReviewEveryProposalBefore.83220b')}
      >
        <div className="assistant-drawer">
          <div className="tools-tabs">
            <button onClick={() => setAssistantHistory(false)}>
              {t('ui.conversation.627a03')}
            </button>
            <button onClick={() => setAssistantHistory(true)}>
              {t('ui.changeHistory.a2db94')}
            </button>
          </div>
          <Suspense fallback={<p dir="auto">{t('ui.openingAssistant.ddc30b')}</p>}>
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
        {t('ui.skipToContent.bbc2aa')}
      </a>
      <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Sparkles size={23} />
          </span>
          <span>
            {t(branding.name, branding.nameAr)}
            <small>{t('ui.yourPersonalOs.371ac2')}</small>
          </span>
        </Link>
        <div className="workspace-label">{t('ui.workspace.b0c0df')}</div>
        <nav aria-label={t('ui.mainNavigation.42cf8b')}>{navigation}</nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="status-dot" />
            {t('ui.aSpaceThatSOnlyYours.2c0a6e')}
            <small>
              {isServerStorage()
                ? storageText(t, 'serverSaved')
                : t('ui.prototypeStoredOnThisDevice.e72558')}
            </small>
          </div>
          <div className="profile">
            <span className="avatar">Y</span>
            <div>
              {t('ui.yourWorkspace.eecb50')}
              <small>{t('ui.personalAccountDemo.09e94a')}</small>
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
              aria-label={t('ui.toggleMenu.28abaa')}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={20} />
            </Button>
            <span className="breadcrumb">
              {t('ui.yourWorkspace.eecb50')}
              <span>/</span>
              {location.pathname === '/'
                ? t('ui.personalOverview.ce5964')
                : (sections.find((s) => s.path === location.pathname)?.[ar ? 'ar' : 'en'] ??
                  (location.pathname.startsWith('/life/')
                    ? t('ui.goalDetails.3d0520')
                    : t('ui.page.1c3616')))}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch t={t} tasks={tasks} entries={entries} edit={edit} />
            <QuickCapture t={t} />
            <div className="desktop-preferences">{preferenceControls}</div>
            <div id="account-controls" />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {(storageError || entriesError) && (
            <div role="alert" className="notice">
              {t('ui.savingNeedsAttentionOpenDataAndBackup.c4758b')}
            </div>
          )}
          <ErrorBoundary t={t}>
            <Suspense
              fallback={
                <p dir="auto" className="notice" role="status">
                  {t('ui.loadingYourSpace.9aabea')}
                </p>
              }
            >
              <Routes>
                <Route
                  path="/settings"
                  element={
                    <>
                      <div className="settings-appearance">{appearanceControls}</div>
                      <DataSettings t={t} inline />
                    </>
                  }
                />
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
                      <h1 dir="auto">{t('ui.pageNotFound.c1e58b')}</h1>
                      <Button asChild>
                        <Link to="/">{t('ui.backToHome.91e378')}</Link>
                      </Button>
                    </section>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t('ui.mobileNavigation.499dfb')}>
        {sections.slice(0, 4).map((section) => (
          <NavLink
            key={section.path}
            to={section.path}
            end={section.path === '/'}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <section.icon size={20} />
            <span>{ar ? section.ar : section.en}</span>
          </NavLink>
        ))}
        <button className="nav-link" onClick={() => setMoreOpen(true)}>
          <Menu size={20} />
          {t('ui.more.5ac23a')}
        </button>
      </nav>
      <Dialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={t('ui.more.5ac23a')}
        description={t('ui.additionalToolsAndSavedInformation.3302db')}
      >
        <nav className="more-navigation">
          {sections.slice(4).map((section) => (
            <Link key={section.path} to={section.path} onClick={() => setMoreOpen(false)}>
              {ar ? section.ar : section.en}
            </Link>
          ))}
          <Link to="/settings" onClick={() => setMoreOpen(false)}>
            {t('ui.settings.fc4a53')}
          </Link>
        </nav>
      </Dialog>
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
        title={t('ui.deleteThisPriority.90dc8e')}
        description={t('ui.movesItToRecentlyDeletedWhereIt.2930bc')}
      >
        <p dir="auto" className="mb-6">
          {remove?.title}
        </p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            {t('ui.keepPriority.4d6777')}
          </Button>
          <Button
            onClick={() => {
              setTasks((old) => old.filter((x) => x.id !== remove?.id));
              setRemove(null);
            }}
          >
            <Trash2 size={15} />
            {t('ui.delete.010491')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
