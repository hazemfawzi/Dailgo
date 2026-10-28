import { DateTimeInput } from '../../components/DateTimeInput';
import {
  formatCalendarDate as localizedDate,
  formatTime as localizedTime,
} from '../../i18n/format';
import { VoiceCapture } from '../capture/VoiceCapture';
import { apiRequest, ApiError } from '../../lib/serverStorage';
import { AIPlanPreview } from './ai/AIPlanPreview';
import { applyAIPlan, undoAIPlan, aiTargetId } from './ai/plan';
import { formatNumber } from '../../i18n/format';
import { formatTimestamp } from '../../i18n/format';
import { MutationPreview } from './MutationPreview';
import { confirmMutation } from './mutationModel';
import { BatchPreview } from './BatchPreview';
import { confirmBatch, scopeBatch } from './batchModel';
import { validDate } from '../capture/model';
import { transactData } from '../../lib/storage';
import { restoreWorkspace } from '../life/demoGoals';
import { areas, areaLabel } from '../../lib/workspace';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowUp,
  Check,
  X,
  Plus,
  MessageSquare,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { usePersisted } from '../../lib/storage';
import { kindLabel } from '../../lib/workspace';
import type { Area, Entry, EntrySetter, Translate } from '../../lib/workspace';
import type { Task } from '../home/HomeScreen';
import { proposalArea, respond, messageText, proposalEntry } from './engine';
import type { Message } from './engine';
type Conversation = { id: string; title: string; messages: Message[]; archived: boolean };
export function AssistantScreen({
  t,
  tasks,
  setTasks,
  entries,
  setEntries,
}: {
  t: Translate;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  entries: Entry[];
  setEntries: EntrySetter;
}) {
  const [conversations, setConversations, error] = usePersisted<Conversation[]>(
    'personal-os.conversations.v1',
    [],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [archive, setArchive] = useState(false);
  const [provider, setProvider] = useState<{
    enabled: boolean;
    remaining: number;
    limit: number;
    resetTimezone?: string;
  } | null>(null);
  const [providerError, setProviderError] = useState(false);
  const [mode, setMode] = useState<'local' | 'claude'>('local');
  const [consent, setConsent] = useState(false);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    void apiRequest('assistant/status')
      .then((value) => {
        setProvider(value);
        if (value.enabled) setMode('claude');
      })
      .catch(() => setProviderError(true));
  }, []);
  const [scope, setScope] = useState('all');
  const [actionError, setActionError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const handledPrompt = useRef<string | null>(null);
  const active =
    conversations.find((c) => c.id === selected) ?? conversations.find((c) => !c.archived);
  const messages = active?.messages ?? [];
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('conversation');
    if (id) {
      const found = conversations.find((c) => c.id === id);
      if (found) {
        setSelected(id);
        setArchive(found.archived);
      }
    }
  }, [location.search]);
  const messageList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [active?.id, messages.length]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('message');
    if (id && messages.some((m) => m.id === id))
      document.getElementById('assistant-message-' + id)?.scrollIntoView({ block: 'nearest' });
  }, [location.search, active?.id, messages.length]);
  const updateMessages = (fn: (messages: Message[]) => Message[]) => {
    if (active)
      setConversations((old) =>
        old.map((c) => (c.id === active.id ? { ...c, messages: fn(c.messages) } : c)),
      );
  };
  function send(text: string) {
    if (!text.trim() || active?.archived || asking) return;
    if (mode === 'claude') {
      void askClaude(text);
      return;
    }
    const user: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      scope,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const response: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      scope,
      createdAt: new Date().toISOString(),
      ...respond(
        text,
        t,
        tasks.filter(
          (x) =>
            scope === 'all' ||
            (scope.startsWith('context:') ? x.context === scope.slice(8) : x.category === scope),
        ),
        entries.filter(
          (x) =>
            scope === 'all' ||
            (scope.startsWith('context:') ? x.context === scope.slice(8) : x.area === scope),
        ),
      ),
    };
    if (response.batch) response.batch = scopeBatch(response.batch, scope);
    if (active)
      setConversations((old) =>
        old.map((c) =>
          c.id === active.id
            ? {
                ...c,
                title: c.messages.length ? c.title : text.slice(0, 45),
                messages: [...c.messages, user, response],
              }
            : c,
        ),
      );
    else {
      const id = crypto.randomUUID();
      setConversations((old) => [
        ...old,
        { id, title: text.slice(0, 45), messages: [user, response], archived: false },
      ]);
      setSelected(id);
    }
    setInput('');
  }
  async function askClaude(text: string) {
    if (!consent) {
      setActionError(t('ui.allowSendingTheSelectedScopeToClaude.103f42'));
      return;
    }
    setAsking(true);
    setActionError('');
    const chatId = active?.id ?? crypto.randomUUID();
    const responseId = crypto.randomUUID();
    const user: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      scope,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const saved = await transactData((data) => {
      const chats = (data['personal-os.conversations.v1'] ?? []) as Conversation[];
      const chat = chats.find((x) => x.id === chatId);
      if (chat?.archived) throw Error('archived');
      const messages = [...(chat?.messages ?? []), user];
      return {
        ...data,
        'personal-os.conversations.v1': chat
          ? chats.map((x) => (x.id === chatId ? { ...x, messages } : x))
          : [...chats, { id: chatId, title: text.slice(0, 45), messages, archived: false }],
      };
    });
    if (!saved) {
      setAsking(false);
      setActionError(t('ui.couldNotSaveYourMessageClaudeWas.1af766'));
      return;
    }
    setSelected(chatId);
    setInput('');
    try {
      const plan = await apiRequest('assistant/preview', 'POST', {
        requestId: responseId,
        message: text.trim(),
        language: t('en', 'ar'),
        scope,
        conversationId: chatId,
      });
      const ok = await transactData((data) => {
        const chats = (data['personal-os.conversations.v1'] ?? []) as Conversation[];
        const chat = chats.find((x) => x.id === chatId);
        if (!chat || chat.archived) throw Error('unavailable-chat');
        return {
          ...data,
          'personal-os.conversations.v1': chats.map((x) =>
            x.id === chatId
              ? {
                  ...x,
                  messages: [
                    ...x.messages,
                    {
                      id: responseId,
                      role: 'assistant',
                      text: plan.summary || t('ui.reviewTheProposedChangesBelow.a85440'),
                      createdAt: new Date().toISOString(),
                      scope,
                      ai: plan,
                      status: plan.actions.length ? 'pending' : undefined,
                    },
                  ],
                }
              : x,
          ),
        };
      });
      if (!ok) setActionError(t('ui.claudeRepliedButTheConversationChangedOr.0871bc'));
      setProvider(await apiRequest('assistant/status'));
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 429
          ? t('ui.assistantUsageLimitReachedTryLaterOr.487639')
          : t('ui.claudeIsUnavailableOrReturnedAnInvalid.a076c0'),
      );
    } finally {
      setAsking(false);
      try {
        setProvider(await apiRequest('assistant/status'));
      } catch {}
    }
  }
  async function saveAI(message: Message, inverse = false) {
    if (!active || !message.ai || confirming) return;
    setConfirming(true);
    const ok = await transactData((data) => {
      const chats = (data['personal-os.conversations.v1'] ?? []) as Conversation[];
      const chat = chats.find((x) => x.id === active.id);
      const stored = chat?.messages.find((x) => x.id === message.id);
      if (
        !chat ||
        chat.archived ||
        stored?.status !== (inverse ? 'confirmed' : 'pending') ||
        JSON.stringify(stored.ai) !== JSON.stringify(message.ai)
      )
        throw Error('ai-preview-changed');
      const changed = inverse ? undoAIPlan(data, message.ai!) : applyAIPlan(data, message.ai!);
      return {
        ...changed,
        'personal-os.conversations.v1': chats.map((x) =>
          x.id === active.id
            ? {
                ...x,
                messages: x.messages.map((m) =>
                  m.id === message.id
                    ? {
                        ...m,
                        status: inverse ? 'reverted' : 'confirmed',
                        targetIds: message.ai!.actions.map(aiTargetId),
                      }
                    : m,
                ),
              }
            : x,
        ),
      };
    });
    setConfirming(false);
    if (!ok) setActionError(t('ui.theProposalOrATargetChangedReview.9b5923'));
  }
  useEffect(() => {
    if (!provider && !providerError) return;
    const incoming = location.state?.prompt;
    if (typeof incoming === 'string' && handledPrompt.current !== location.key) {
      handledPrompt.current = location.key;
      if (provider?.enabled && !consent) setInput(incoming);
      else send(incoming);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.key, provider, providerError]);
  async function confirm(message: Message) {
    if (!message.proposal || message.status !== 'pending' || confirming || !active) return;
    if (
      !message.proposal.title.trim() ||
      (message.proposal.kind === 'task' &&
        ((!!message.proposal.date && !validDate(message.proposal.date)) ||
          (!!message.proposal.time &&
            (!validDate(message.proposal.date) ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(message.proposal.time))))) ||
      (message.proposal.kind === 'event' &&
        (!validDate(message.proposal.date) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(message.proposal.time))) ||
      (message.proposal.kind === 'routine' &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(message.proposal.time))
    ) {
      setActionError(t('ui.reviewTheTitleDateAndTimeFirst.1ac85a'));
      return;
    }
    setConfirming(true);
    setActionError('');
    const p = message.proposal;
    const actionArea = proposalArea(message.proposal, message.scope);
    const actionContext = message.scope?.startsWith('context:')
      ? message.scope.slice(8)
      : undefined;
    const targetId = `action-${message.id}`;
    const ok = await transactData((data) => {
      const chats = (data['personal-os.conversations.v1'] ?? []) as Conversation[];
      const stored = chats
        .find((c) => c.id === active.id)
        ?.messages.find((m) => m.id === message.id);
      if (stored?.status === 'confirmed') return data;
      if (
        !stored ||
        stored.status !== 'pending' ||
        JSON.stringify(stored.proposal) !== JSON.stringify(p)
      )
        throw Error('stale');
      const allTasks = (data['personal-os.tasks.v1'] ?? []) as Task[];
      const workspace = restoreWorkspace(data['personal-os.entries.v1']);
      return {
        ...data,
        ...(p.kind === 'task'
          ? {
              'personal-os.tasks.v1': allTasks.some((x) => x.id === targetId)
                ? allTasks
                : [
                    ...allTasks,
                    {
                      id: targetId,
                      title: p.title,
                      category: actionArea,
                      context: actionContext,
                      plannedDate: p.date || undefined,
                      plannedTime: p.time || undefined,
                      tags: p.tags,
                      done: false,
                      archived: false,
                    },
                  ],
            }
          : {
              'personal-os.entries.v1': {
                ...workspace,
                entries: workspace.entries.some((x) => x.id === targetId)
                  ? workspace.entries
                  : [
                      ...workspace.entries,
                      { ...proposalEntry(p, targetId), area: actionArea, context: actionContext },
                    ],
              },
            }),
        'personal-os.conversations.v1': chats.map((c) =>
          c.id === active.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === message.id ? { ...m, status: 'confirmed', targetId } : m,
                ),
              }
            : c,
        ),
      };
    });
    if (!ok) setActionError(t('ui.actionNotSavedReviewStorageAndRetry.5d3fb9'));
    setConfirming(false);
  }
  async function confirmActions(message: Message) {
    if (!active || confirming || message.status !== 'pending') return;
    setConfirming(true);
    setActionError('');
    const ok = await transactData((data) => confirmBatch(data, active.id, message));
    setConfirming(false);
    if (!ok) setActionError(t('ui.nothingExecutedThePreviewMayHaveChanged.f04ec0'));
  }
  async function confirmChange(message: Message) {
    if (!active || confirming) return;
    setConfirming(true);
    setActionError('');
    const ok = await transactData((data) => confirmMutation(data, active.id, message));
    setConfirming(false);
    if (!ok) setActionError(t('ui.nothingChangedTheRecordOrPreviewChanged.d47a62'));
  }
  const suggestions = [
    t('ui.taskReviewInterfaceEventDesignReviewNote.8a35f1'),
    t('ui.taskCheckMobileLayout.03755d'),
    t('ui.noteSupportArabicAndEnglish.e55394'),
    t('ui.showMyMemories.962543'),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} />
            {t('ui.thinkOutLoud.18ceab')}
          </div>
          <h1 dir="auto">{t('ui.assistant.f476e5')}</h1>
          <p dir="auto">{t('ui.prepareChangesReviewTheProposalThenDecide.7692a1')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/assistant/actions">{t('ui.actionCenter.de900b')}</Link>
        </Button>
      </div>
      {error && (
        <p dir="auto" role="alert" className="notice">
          {t('ui.conversationStorageIsUnavailable.62763e')}
        </p>
      )}
      <div className="conversation-layout">
        <aside className="card conversation-list">
          <Button
            variant="outline"
            onClick={() => {
              const id = crypto.randomUUID();
              setConversations((old) => [
                ...old,
                { id, title: t('ui.newConversation.68be9d'), messages: [], archived: false },
              ]);
              setSelected(id);
              setArchive(false);
              setInput('');
            }}
          >
            <Plus size={15} />
            {t('ui.newConversation.68be9d')}
          </Button>
          <div className="conversation-filter">
            <button className={!archive ? 'selected' : ''} onClick={() => setArchive(false)}>
              {t('ui.recent.4c5ef9')}
            </button>
            <button className={archive ? 'selected' : ''} onClick={() => setArchive(true)}>
              {t('ui.archived.a2bc44')}
            </button>
          </div>
          {conversations
            .filter((c) => c.archived === archive)
            .map((c) => (
              <div
                className={`conversation-row ${c.id === active?.id ? 'selected' : ''}`}
                key={c.id}
              >
                <button
                  onClick={() => {
                    setSelected(c.id);
                    setInput('');
                  }}
                >
                  <MessageSquare size={14} />
                  <span dir="auto">{c.title}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${c.archived ? t('ui.restoreConversation.087950') : t('ui.archiveConversation.95868d')}: ${c.title}`}
                  onClick={() => {
                    setConversations((old) =>
                      old.map((x) => (x.id === c.id ? { ...x, archived: !x.archived } : x)),
                    );
                    if (c.archived) {
                      setSelected(c.id);
                      setArchive(false);
                    }
                  }}
                >
                  {c.archived ? <Plus size={13} /> : <X size={13} />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('ui.deleteConversation.8d2cf2')}: ${c.title}`}
                  onClick={() => setDeleting(c)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          {!conversations.some((c) => c.archived === archive) && (
            <p dir="auto" className="muted">
              {t('ui.noConversationsHereYet.4a1778')}
            </p>
          )}
        </aside>
        <section className="card chat-panel">
          <div className="chat-header">
            <span className="assistant-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 dir="auto">{t('ui.yourThinkingSpace.d49c2d')}</h3>
              <p dir="auto">
                {mode === 'claude'
                  ? t('ui.claudeProposalsRequireConfirmation.7fe9b3')
                  : t('ui.quickHelpForTasksAndNotes.a79970')}
              </p>
            </div>
          </div>
          <section className="assistant-mode editor-form">
            <label>
              {t('ui.assistantMode.7a4a12')}
              <select
                aria-label={t('ui.assistantMode.7a4a12')}
                disabled={asking}
                value={mode}
                onChange={(e) => setMode(e.target.value as 'local' | 'claude')}
              >
                <option value="local">{t('ui.localRules.c0d011')}</option>
                <option value="claude" disabled={!provider?.enabled}>
                  Claude
                </option>
              </select>
            </label>
            {!provider?.enabled && (
              <p dir="auto" role="status">
                {provider
                  ? t('ui.quickCaptureIsAvailableTheSmartAssistant.a9809e')
                  : providerError
                    ? t('ui.couldNotCheckClaudeAvailabilityCheckYour.8ee9b9')
                    : t('ui.checkingClaudeAvailability.ede8ac')}
              </p>
            )}
            {mode === 'claude' && (
              <>
                <p dir="auto">{t('ui.onlyTheSelectedScopeSTasksGoals.c09847')}</p>
                <label>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {t('ui.allowSharingThisSelectedContextWithClaude.a08bc3')}
                </label>
                <p dir="auto">
                  {t('ui.remainingProviderAttemptsToday.559d39')}:{' '}
                  {formatNumber(provider?.remaining ?? 0, t('en', 'ar'))} /{' '}
                  {formatNumber(provider?.limit ?? 0, t('en', 'ar'))} ·{' '}
                  <bdi>{provider?.resetTimezone ?? 'Africa/Cairo'}</bdi>
                </p>
              </>
            )}
            {!provider?.enabled && (
              <p dir="auto">{t('ui.claudeRequiresAServerApiKeyAnd.b64364')}</p>
            )}
          </section>
          <label className="assistant-scope">
            {t('ui.conversationDataScope.e952e6')}
            <select
              aria-label={t('ui.conversationDataScope.e952e6')}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">{t('ui.allAreas.e2d78b')}</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {areaLabel(a, t)}
                </option>
              ))}
              {Array.from(
                new Set([...tasks, ...entries].map((x) => x.context).filter(Boolean)),
              ).map((context) => (
                <option key={context} value={'context:' + context}>
                  {t('ui.context.6dd3bd')}: {context}
                </option>
              ))}
            </select>
            <small>{t('ui.newSummariesUseThisScopeOnlyOlder.aa76cb')}</small>
          </label>
          <details className="assistant-command-help">
            <summary>{t('ui.supportedLocalEditCommands.662a0a')}</summary>
            <p dir="auto">{t('ui.useAnExactUniqueTitleInThe.1640d1')}</p>
            <ul>
              {[
                t('ui.renameTaskCurrentTitleNewTitle.47bc49'),
                t('ui.planTaskCurrentTitleYyyyMmDd.0c333d'),
                t('ui.dueTaskCurrentTitleYyyyMmDd.296e14'),
                t('ui.editNoteCurrentTitleNewDetails.229120'),
                t('ui.archiveExactTitle.eebe98'),
                t('ui.restoreExactTitle.3a8e7e'),
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
          {actionError && (
            <p dir="auto" className="notice" role="alert">
              {actionError}
            </p>
          )}
          <div
            ref={messageList}
            className="chat-messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.length === 0 && (
              <div className="chat-welcome">
                <Sparkles size={35} />
                <h2 dir="auto">{t('ui.whatSOnYourMind.d3226c')}</h2>
                <p dir="auto">{t('ui.turnAThoughtIntoATaskA.a63093')}</p>
                <div className="suggestion-grid">
                  {suggestions.map((text) => (
                    <button key={text} onClick={() => send(text)}>
                      {text}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <article
                id={'assistant-message-' + message.id}
                className={`chat-message ${message.role}`}
                key={message.id}
              >
                <span className="message-role">
                  {message.role === 'user'
                    ? t('ui.you.3548f9')
                    : message.ai
                      ? 'Claude'
                      : t('ui.localAssistant.fee397')}
                </span>
                <p dir="auto" className="message-text">
                  {messageText(message, t)}
                </p>
                {!message.createdAt && (
                  <small className="message-time">
                    {t('ui.legacyMessageTimeWasNotRecorded.89caa2')}
                  </small>
                )}
                {message.createdAt && (
                  <small className="message-time">
                    {formatTimestamp(message.createdAt, t('en', 'ar'))}
                  </small>
                )}
                {!!message.references?.length && (
                  <details>
                    <summary>{t('ui.basedOnLocalRecordsAtThisTime.31e897')}</summary>
                    {message.references.map((ref) => (
                      <p dir="auto" key={ref.id}>
                        {ref.title}
                      </p>
                    ))}
                  </details>
                )}
                {message.ai && message.ai.actions.length > 0 && (
                  <AIPlanPreview
                    plan={message.ai}
                    t={t}
                    status={message.status}
                    busy={confirming || !!active?.archived}
                    confirm={() => void saveAI(message)}
                    undo={() => void saveAI(message, true)}
                    cancel={() =>
                      updateMessages((old) =>
                        old.map((m) =>
                          m.id === message.id && m.status === 'pending'
                            ? { ...m, status: 'cancelled' }
                            : m,
                        ),
                      )
                    }
                  />
                )}
                {message.mutation && (
                  <MutationPreview
                    message={message}
                    t={t}
                    busy={confirming || !!active?.archived}
                    confirm={() => void confirmChange(message)}
                    cancel={() =>
                      updateMessages((old) =>
                        old.map((m) =>
                          m.id === message.id && m.status === 'pending'
                            ? { ...m, status: 'cancelled' }
                            : m,
                        ),
                      )
                    }
                  />
                )}
                {message.batch && (
                  <BatchPreview
                    message={message}
                    t={t}
                    busy={confirming || !!active?.archived}
                    patch={(id, values) =>
                      updateMessages((old) =>
                        old.map((m) =>
                          m.id === message.id && m.status === 'pending'
                            ? {
                                ...m,
                                batch: m.batch?.map((x) => (x.id === id ? { ...x, ...values } : x)),
                              }
                            : m,
                        ),
                      )
                    }
                    remove={(id) =>
                      updateMessages((old) =>
                        old.map((m) =>
                          m.id === message.id && m.status === 'pending'
                            ? { ...m, batch: m.batch?.filter((x) => x.id !== id) }
                            : m,
                        ),
                      )
                    }
                    confirm={() => void confirmActions(message)}
                    cancel={() =>
                      updateMessages((old) =>
                        old.map((m) =>
                          m.id === message.id && m.status === 'pending'
                            ? { ...m, status: 'cancelled' }
                            : m,
                        ),
                      )
                    }
                  />
                )}
                {message.proposal && (
                  <div className="chat-proposal">
                    <span className="eyebrow">
                      {t('ui.actionPreview.d0ec16')} ·{' '}
                      {message.proposal.kind === 'task'
                        ? t('ui.task.c7a3d8')
                        : kindLabel(message.proposal.kind, t)}
                    </span>
                    <strong dir="auto">{message.proposal.title}</strong>
                    {message.proposal.kind === 'event' && (
                      <span dir="auto">
                        {localizedDate(message.proposal.date, t('en', 'ar'))} ·{' '}
                        {localizedTime(message.proposal.time, t('en', 'ar'))}
                      </span>
                    )}
                    {message.proposal.kind === 'routine' && (
                      <span>
                        {t('ui.dailyAt.04f493')}{' '}
                        {localizedTime(message.proposal.time, t('en', 'ar'))}
                      </span>
                    )}
                    {message.status === 'pending' ? (
                      <>
                        <div className="editor-form">
                          <label>
                            {t('ui.proposedLifeArea.4064d6')}
                            <select
                              aria-label={t('ui.proposedLifeArea.4064d6')}
                              value={proposalArea(message.proposal, message.scope)}
                              disabled={areas.some((area) => area === message.scope)}
                              onChange={(e) => {
                                const area = e.target.value as Area;
                                updateMessages((old) =>
                                  old.map((m) =>
                                    m.id === message.id
                                      ? { ...m, proposal: { ...m.proposal!, area } }
                                      : m,
                                  ),
                                );
                              }}
                            >
                              {areas.map((area) => (
                                <option key={area} value={area}>
                                  {areaLabel(area, t)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {t('ui.previewTitle.a7df33')}
                            <input
                              dir="auto"
                              maxLength={160}
                              value={message.proposal.title}
                              onChange={(e) => {
                                const title = e.target.value;
                                updateMessages((old) =>
                                  old.map((m) =>
                                    m.id === message.id
                                      ? { ...m, proposal: { ...m.proposal!, title } }
                                      : m,
                                  ),
                                );
                              }}
                            />
                          </label>
                          {['event', 'task'].includes(message.proposal.kind) && (
                            <label>
                              {message.proposal.kind === 'task'
                                ? t('ui.executionDayOptional.98e9e0')
                                : t('ui.eventDate.fcd1d9')}
                              <DateTimeInput
                                type="date"
                                value={message.proposal.date}
                                onChange={(e) => {
                                  const date = e.target.value;
                                  updateMessages((old) =>
                                    old.map((m) =>
                                      m.id === message.id
                                        ? { ...m, proposal: { ...m.proposal!, date } }
                                        : m,
                                    ),
                                  );
                                }}
                                aria-label={
                                  message.proposal.kind === 'task'
                                    ? t('ui.executionDayOptional.98e9e0')
                                    : t('ui.eventDate.fcd1d9')
                                }
                              />
                            </label>
                          )}
                          {['event', 'routine', 'task'].includes(message.proposal.kind) && (
                            <label>
                              {message.proposal.kind === 'task'
                                ? t('ui.executionTimeOptional.a87ad6')
                                : t('ui.time.d46229')}
                              <DateTimeInput
                                type="time"
                                value={message.proposal.time}
                                onChange={(e) => {
                                  const time = e.target.value;
                                  updateMessages((old) =>
                                    old.map((m) =>
                                      m.id === message.id
                                        ? { ...m, proposal: { ...m.proposal!, time } }
                                        : m,
                                    ),
                                  );
                                }}
                                aria-label={
                                  message.proposal.kind === 'task'
                                    ? t('ui.executionTimeOptional.a87ad6')
                                    : t('ui.time.d46229')
                                }
                              />
                            </label>
                          )}
                        </div>
                        <p dir="auto">{t('ui.savedInYourWorkspaceOnlyAfterConfirmation.80a129')}</p>
                        {message.proposal.kind === 'event' && (
                          <p dir="auto">{t('ui.reviewTheExactDateAndTimeBefore.1917ee')}</p>
                        )}
                        {message.proposal?.timeAssumed && (
                          <p dir="auto" className="capture-hint">
                            {t('ui.unspecifiedHourInterpretedAsEveningReviewThe.287bb7')}
                          </p>
                        )}
                        <div className="proposal-actions">
                          <Button disabled={confirming} onClick={() => void confirm(message)}>
                            <Check size={15} />
                            {t('ui.confirmAction.5c1b9d')}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              updateMessages((old) =>
                                old.map((m) =>
                                  m.id === message.id ? { ...m, status: 'cancelled' } : m,
                                ),
                              )
                            }
                          >
                            {t('ui.cancel.428808')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="action-result" role="status">
                        {message.status === 'confirmed' ? (
                          <>
                            <Check size={15} />
                            {t('ui.confirmedAndSaved.8ee7c0')}
                            <Link
                              to={
                                message.proposal.kind === 'task' ||
                                message.proposal.kind === 'event' ||
                                message.proposal.kind === 'routine'
                                  ? '/planner'
                                  : ['goal', 'project'].includes(message.proposal.kind)
                                    ? '/life'
                                    : '/memory'
                              }
                            >
                              {t('ui.openSection.eb172a')}
                              <ArrowUpRight size={13} />
                            </Link>
                          </>
                        ) : (
                          <>
                            <X size={15} />
                            {message.status === 'reverted'
                              ? t('ui.revertedRemovedItemsCanBeRestoredFrom.7dd1ea')
                              : t('ui.cancelledNothingSaved.f6c92c')}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          <>
            {active?.archived ? (
              <div className="context-banner archived-chat">
                <p dir="auto">{t('ui.archivedConversationRestoreItToContinue.2d3024')}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConversations((old) =>
                      old.map((c) => (c.id === active.id ? { ...c, archived: false } : c)),
                    );
                    setArchive(false);
                  }}
                >
                  {t('ui.restoreConversation.087950')}
                </Button>
              </div>
            ) : (
              <form
                className="chat-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <VoiceCapture
                  t={t}
                  onText={(value) => setInput((old) => (old ? old + ' ' + value : value))}
                />
                <label htmlFor="chat-message" className="sr-only">
                  {t('ui.yourMessage.f58f21')}
                </label>
                <textarea
                  dir="auto"
                  id="chat-message"
                  rows={2}
                  maxLength={4000}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('ui.tryTaskReviewMyPriorities.6933e4')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                />
                <Button
                  disabled={!input.trim() || asking || (mode === 'claude' && !consent)}
                  size="icon"
                  aria-label={t('ui.sendMessage.cbcd6c')}
                >
                  <ArrowUp size={19} />
                </Button>
              </form>
            )}
          </>
          <p dir="auto" className="chat-disclaimer">
            {asking
              ? t('ui.claudeIsPreparingAProposal.ffb6b3')
              : mode === 'claude'
                ? t('ui.aiCanMakeMistakesCheckDatesScope.928a06')
                : t('ui.responsesUseLocalRulesConfirmedChangesAre.9042c0')}
          </p>
        </section>
      </div>
      <Dialog
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title={t('ui.deleteThisConversation.495a49')}
        description={t('ui.messagesAndPendingPreviewsWillBeRemoved.9f9b75')}
      >
        <p dir="auto">{deleting?.title}</p>
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            {t('ui.keepConversation.4d92b9')}
          </Button>
          <Button
            onClick={() => {
              setConversations((old) => old.filter((c) => c.id !== deleting?.id));
              setDeleting(null);
            }}
          >
            {t('ui.deleteConversation.8d2cf2')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
