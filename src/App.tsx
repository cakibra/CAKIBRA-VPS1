import { useCallback, useEffect, useMemo, useState } from 'react';
import { Import, Plus, RadioTower, RefreshCcw, ScanSearch, WandSparkles } from 'lucide-react';
import type {
  AppSettings,
  ConnectionHistoryEntry,
  ConnectionProfile,
  ImportPayload,
  PersistedAppState,
  QuickStats,
  RuntimeSnapshot,
  SubscriptionSubmitPayload,
  UserFilters
} from './types';
import { t } from './i18n';
import {
  compareProfiles,
  defaultPersistedState,
  mergePersistedState,
  normalizeError,
  textFileDownload,
  createId,
  nowIso
} from './lib/utils';
import { connectProfile, disconnectProfile, loadAppState, quickTest, resolveGeo, saveAppState, setAutostart, testProfiles, downloadSubscription } from './services/bridge';
import { buildSubscriptionEntry, parseSubscriptionPayload } from './services/subscriptionParser';
import { exportProfile, parseProfileText } from './services/profileAdapters';
import { useRuntimePoll } from './hooks/useRuntimePoll';
import { Sidebar } from './components/Sidebar';
import { TopStatusBar } from './components/TopStatusBar';
import { ConnectionHero } from './components/ConnectionHero';
import { FilterToolbar } from './components/FilterToolbar';
import { ServerList } from './components/ServerList';
import { SubscriptionPanel } from './components/SubscriptionPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { ImportModal } from './components/ImportModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { ProfileEditorModal } from './components/ProfileEditorModal';
import { SkeletonCard } from './components/ui/SkeletonCard';

type TabId = 'servers' | 'subscriptions' | 'history' | 'settings';

function AppInner(): JSX.Element {
  const { push } = useToast();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabId>('servers');
  const [persisted, setPersisted] = useState<PersistedAppState>(defaultPersistedState());
  const [runtime, setRuntime] = useState<RuntimeSnapshot>({ status: 'disconnected' });
  const [filters, setFilters] = useState<UserFilters>({ search: '', country: '', protocol: '', subscriptionId: '', favoritesOnly: false, sortBy: 'latency' });
  const [importOpen, setImportOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorProfileId, setEditorProfileId] = useState<string | null>(null);
  const [busySubscriptions, setBusySubscriptions] = useState<Record<string, boolean>>({});
  const [testingAll, setTestingAll] = useState(false);
  const language = persisted.settings.language;

  useRuntimePoll(
    useCallback((snapshot) => setRuntime(snapshot), []),
    useCallback((message: string) => push({ title: 'Runtime poll error', description: message, kind: 'error' }), [push])
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await loadAppState();
        if (!active) return;
        const merged = mergePersistedState(stored);
        setPersisted(merged);
        setFilters((prev) => ({ ...prev, sortBy: merged.settings.defaultSort }));
      } catch (error) {
        push({ title: 'Не удалось загрузить состояние', description: normalizeError(error), kind: 'error' });
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [push]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void saveAppState(persisted).catch((error) => push({ title: 'Не удалось сохранить состояние', description: normalizeError(error), kind: 'error' }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [persisted, ready, push]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = persisted.settings.theme;
    const actualTheme = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
    root.dataset.theme = actualTheme;
  }, [persisted.settings.theme]);

  const applyGeoForProfiles = useCallback(async (profiles: ConnectionProfile[]) => {
    const unknownProfiles = profiles.filter((profile) => !profile.countryCode).slice(0, 8);
    for (const profile of unknownProfiles) {
      try {
        const geo = await resolveGeo(profile.server);
        setPersisted((prev) => ({
          ...prev,
          profiles: prev.profiles.map((item) => item.id === profile.id ? { ...item, countryCode: geo.countryCode ?? item.countryCode ?? null, countryName: geo.countryName ?? item.countryName ?? null } : item)
        }));
      } catch {}
    }
  }, []);

  const refreshSubscription = useCallback(async (subscriptionId: string, silent = false) => {
    const subscription = persisted.subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return;
    setBusySubscriptions((prev) => ({ ...prev, [subscriptionId]: true }));
    try {
      const response = await downloadSubscription({
        url: subscription.url,
        etag: subscription.etag,
        lastModified: subscription.lastModified,
        timeoutMs: Math.max(3000, persisted.settings.pingTimeoutMs * 2)
      });
      if (response.error) throw new Error(response.error);
      if (response.notModified) {
        setPersisted((prev) => ({
          ...prev,
          subscriptions: prev.subscriptions.map((item) => item.id === subscriptionId ? { ...item, lastUpdatedAt: nowIso(), lastError: undefined, updatedAt: nowIso() } : item)
        }));
        if (!silent) push({ title: 'Подписка не изменилась', description: subscription.name, kind: 'info' });
        return;
      }
      const raw = response.content ?? '';
      const parsedProfiles = parseSubscriptionPayload({ raw, subscription });
      setPersisted((prev) => {
        const cleanedProfiles = prev.profiles.filter((item) => item.subscriptionId !== subscriptionId);
        const nextProfiles = [...cleanedProfiles, ...parsedProfiles];
        const nextSubscriptions = prev.subscriptions.map((item) =>
          item.id === subscriptionId
            ? { ...item, cacheRaw: raw, etag: response.etag ?? undefined, lastModified: response.lastModified ?? undefined, lastUpdatedAt: nowIso(), lastError: undefined, profileIds: parsedProfiles.map((profile) => profile.id), updatedAt: nowIso() }
            : item
        );
        return { ...prev, profiles: nextProfiles, subscriptions: nextSubscriptions };
      });
      void applyGeoForProfiles(parsedProfiles);
      if (!silent) push({ title: 'Подписка обновлена', description: `${subscription.name} · ${parsedProfiles.length} профилей`, kind: 'success' });
    } catch (error) {
      const message = normalizeError(error);
      setPersisted((prev) => ({ ...prev, subscriptions: prev.subscriptions.map((item) => item.id === subscriptionId ? { ...item, lastError: message, updatedAt: nowIso() } : item) }));
      push({ title: 'Ошибка обновления подписки', description: message, kind: 'error' });
    } finally {
      setBusySubscriptions((prev) => ({ ...prev, [subscriptionId]: false }));
    }
  }, [applyGeoForProfiles, persisted.settings.pingTimeoutMs, persisted.subscriptions, push]);

  useEffect(() => {
    if (!persisted.settings.autoUpdateSubscriptions || !ready) return;
    const timer = window.setInterval(() => {
      persisted.subscriptions.filter((subscription) => subscription.autoUpdate).forEach((subscription) => { void refreshSubscription(subscription.id, true); });
    }, persisted.settings.autoUpdateIntervalMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [persisted.settings.autoUpdateSubscriptions, persisted.settings.autoUpdateIntervalMinutes, persisted.subscriptions, ready, refreshSubscription]);

  const activeProfile = useMemo(() => persisted.profiles.find((profile) => profile.id === runtime.activeProfileId) ?? null, [persisted.profiles, runtime.activeProfileId]);

  const quickStats = useMemo<QuickStats>(() => {
    const online = persisted.profiles.filter((profile) => profile.latencyMs != null).length;
    const byProtocol = persisted.profiles.reduce<Record<string, number>>((acc, profile) => {
      acc[profile.protocol] = (acc[profile.protocol] ?? 0) + 1; return acc;
    }, {});
    return { total: persisted.profiles.length, favorites: persisted.profiles.filter((profile) => profile.favorite).length, online, byProtocol };
  }, [persisted.profiles]);

  const visibleProfiles = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return [...persisted.profiles]
      .filter((profile) => {
        if (filters.country && profile.countryName !== filters.country) return false;
        if (filters.protocol && profile.protocol !== filters.protocol) return false;
        if (filters.subscriptionId === 'local' && profile.sourceType !== 'local') return false;
        if (filters.subscriptionId && filters.subscriptionId !== 'local' && profile.subscriptionId !== filters.subscriptionId) return false;
        if (filters.favoritesOnly && !profile.favorite) return false;
        if (search) {
          const haystack = `${profile.name} ${profile.server} ${profile.countryName ?? ''}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((left, right) => compareProfiles(left, right, filters.sortBy));
  }, [filters, persisted.profiles]);

  const countries = useMemo(() => [...new Set(persisted.profiles.map((profile) => profile.countryName).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru')), [persisted.profiles]);
  const activeProtocolLabel = useMemo(() => {
    const highest = Object.entries(quickStats.byProtocol).sort((a, b) => b[1] - a[1])[0];
    return highest ? `${highest[0].toUpperCase()} лидирует` : 'Пока нет протоколов';
  }, [quickStats.byProtocol]);

  const updateProfiles = useCallback((nextProfiles: ConnectionProfile[]) => setPersisted((prev) => ({ ...prev, profiles: nextProfiles })), []);

  const addHistoryEntry = useCallback((profile: ConnectionProfile, success: boolean) => {
    const entry: ConnectionHistoryEntry = {
      id: createId('history'),
      profileId: profile.id,
      profileName: profile.name,
      protocol: profile.protocol,
      server: `${profile.server}:${profile.port}`,
      connectedAt: nowIso(),
      latencyMs: profile.latencyMs ?? null,
      success,
      sourceLabel: profile.sourceLabel
    };
    setPersisted((prev) => ({ ...prev, history: [entry, ...prev.history].slice(0, 100) }));
  }, []);

  const handleCreateSubscription = useCallback(async (payload: SubscriptionSubmitPayload) => {
    const subscription = buildSubscriptionEntry(payload);
    setPersisted((prev) => ({ ...prev, subscriptions: [subscription, ...prev.subscriptions] }));
    push({ title: 'Подписка добавлена', description: subscription.name, kind: 'success' });
    await refreshSubscription(subscription.id);
  }, [push, refreshSubscription]);

  const handleDeleteSubscription = useCallback((subscriptionId: string) => {
    setPersisted((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.filter((item) => item.id !== subscriptionId),
      profiles: prev.profiles.filter((item) => item.subscriptionId !== subscriptionId)
    }));
  }, []);

  const handleImport = useCallback(async (payload: ImportPayload) => {
    try {
      const profiles = parseProfileText(payload.content, { sourceType: 'local' });
      if (profiles.length === 0) throw new Error('Не удалось найти ни одного профиля');
      updateProfiles([...profiles, ...persisted.profiles]);
      void applyGeoForProfiles(profiles);
      push({ title: 'Импорт завершён', description: `${profiles.length} профилей`, kind: 'success' });
    } catch (error) {
      push({ title: 'Ошибка импорта', description: normalizeError(error), kind: 'error' });
    }
  }, [applyGeoForProfiles, persisted.profiles, push, updateProfiles]);

  const handleToggleFavorite = useCallback((profileId: string) => {
    setPersisted((prev) => ({ ...prev, profiles: prev.profiles.map((profile) => profile.id === profileId ? { ...profile, favorite: !profile.favorite, updatedAt: nowIso() } : profile) }));
  }, []);

  const handleDeleteProfile = useCallback((profileId: string) => {
    setPersisted((prev) => ({ ...prev, profiles: prev.profiles.filter((profile) => profile.id !== profileId) }));
  }, []);

  const handleEditProfile = useCallback((profileId: string) => { setEditorProfileId(profileId); setEditorOpen(true); }, []);

  const handleEditorSubmit = useCallback((payload: { mode: 'create' | 'update'; profile: ConnectionProfile }) => {
    setPersisted((prev) => payload.mode === 'create'
      ? { ...prev, profiles: [payload.profile, ...prev.profiles] }
      : { ...prev, profiles: prev.profiles.map((profile) => (profile.id === payload.profile.id ? payload.profile : profile)) });
    push({ title: payload.mode === 'create' ? 'Профиль создан' : 'Профиль обновлён', description: payload.profile.name, kind: 'success' });
  }, [push]);

  const handleExport = useCallback((profile: ConnectionProfile) => {
    const content = exportProfile(profile);
    textFileDownload(`${profile.name.replace(/[^\w\-]+/g, '_')}.txt`, content);
    push({ title: 'Профиль экспортирован', description: profile.name, kind: 'success' });
  }, [push]);

  const handleTestAll = useCallback(async () => {
    if (persisted.profiles.length === 0) return;
    setTestingAll(true);
    try {
      const results = await testProfiles(persisted.profiles.map((profile) => ({ id: profile.id, server: profile.server, port: profile.port })), persisted.settings.pingTimeoutMs);
      setPersisted((prev) => ({
        ...prev,
        profiles: prev.profiles.map((profile) => {
          const result = results.find((entry) => entry.id === profile.id);
          if (!result) return profile;
          return { ...profile, latencyMs: result.online ? result.latencyMs ?? null : null, lastCheckedAt: result.checkedAt, lastSuccessfulTestAt: result.online ? result.checkedAt : profile.lastSuccessfulTestAt, statusView: { state: result.online ? 'online' : 'offline' } };
        })
      }));
      push({ title: 'Тест завершён', description: `${results.length} профилей`, kind: 'success' });
    } catch (error) {
      push({ title: 'Ошибка теста', description: normalizeError(error), kind: 'error' });
    } finally { setTestingAll(false); }
  }, [persisted.profiles, persisted.settings.pingTimeoutMs, push]);

  const handleQuickTest = useCallback(async () => {
    const profile = activeProfile ?? persisted.profiles[0];
    if (!profile) return;
    try {
      const result = await quickTest({ id: profile.id, server: profile.server, port: profile.port }, persisted.settings.pingTimeoutMs);
      setPersisted((prev) => ({
        ...prev,
        profiles: prev.profiles.map((item) => item.id === profile.id ? { ...item, latencyMs: result.online ? result.latencyMs ?? null : null, lastCheckedAt: result.checkedAt, lastSuccessfulTestAt: result.online ? result.checkedAt : item.lastSuccessfulTestAt, statusView: { state: result.online ? 'online' : 'offline' } } : item)
      }));
      push({ title: 'Quick test завершён', description: `${profile.name} · ${result.online ? `${result.latencyMs} ms` : 'offline'}`, kind: result.online ? 'success' : 'info' });
    } catch (error) {
      push({ title: 'Quick test error', description: normalizeError(error), kind: 'error' });
    }
  }, [activeProfile, persisted.profiles, persisted.settings.pingTimeoutMs, push]);

  const handleConnect = useCallback(async (profile?: ConnectionProfile | null) => {
    const target = profile ?? activeProfile ?? visibleProfiles[0];
    if (!target) { push({ title: 'Нет профиля для подключения', kind: 'info' }); return; }
    try {
      const snapshot = await connectProfile(target, persisted.settings);
      setRuntime(snapshot);
      addHistoryEntry(target, true);
      setPersisted((prev) => ({ ...prev, lastSelectedProfileId: target.id }));
      push({ title: 'Процесс подключения запущен', description: target.name, kind: 'success' });
    } catch (error) {
      addHistoryEntry(target, false);
      push({ title: 'Не удалось подключиться', description: normalizeError(error), kind: 'error' });
    }
  }, [activeProfile, addHistoryEntry, persisted.settings, push, visibleProfiles]);

  const handleDisconnect = useCallback(async () => {
    try {
      const snapshot = await disconnectProfile();
      setRuntime(snapshot);
      push({ title: 'Подключение остановлено', kind: 'success' });
    } catch (error) {
      push({ title: 'Не удалось отключиться', description: normalizeError(error), kind: 'error' });
    }
  }, [push]);

  const handleSettingsChange = useCallback((patch: Partial<AppSettings>) => {
    setPersisted((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }));
    if (patch.launchOnWindowsStartup != null) {
      void setAutostart(Boolean(patch.launchOnWindowsStartup)).then(() => push({ title: patch.launchOnWindowsStartup ? 'Автозапуск включён' : 'Автозапуск выключен', kind: 'success' })).catch((error) => push({ title: 'Не удалось изменить автозапуск', description: normalizeError(error), kind: 'error' }));
    }
  }, [push]);

  const labels = {
    servers: t(language, 'tabServers'),
    subscriptions: t(language, 'tabSubscriptions'),
    history: t(language, 'tabHistory'),
    settings: t(language, 'tabSettings')
  };
  const editorProfile = editorProfileId ? persisted.profiles.find((profile) => profile.id === editorProfileId) ?? null : null;

  return (
    <div className="app-shell">
      <Sidebar activeTab={tab} onChange={setTab} title={t(language, 'appTitle')} subtitle={t(language, 'appSubtitle')} labels={labels} />
      <main className="main-content">
        <TopStatusBar stats={quickStats} runtime={runtime} activeProtocolLabel={activeProtocolLabel} />
        <ConnectionHero runtime={runtime} activeProfile={activeProfile ?? persisted.profiles.find((profile) => profile.id === persisted.lastSelectedProfileId) ?? null} onConnect={() => void handleConnect()} onDisconnect={() => void handleDisconnect()} onQuickTest={() => void handleQuickTest()} connectDisabled={runtime.status === 'connecting' || runtime.status === 'connected'} disconnectDisabled={runtime.status === 'disconnecting' || runtime.status === 'disconnected'} />
        <div className="toolbar-row">
          <div className="toolbar-row__left">
            <button type="button" className="primary-button" onClick={() => setImportOpen(true)}><Import size={16} />Импорт</button>
            <button type="button" className="secondary-button" onClick={() => setSubscriptionOpen(true)}><RadioTower size={16} />Подписка</button>
            <button type="button" className="secondary-button" onClick={() => { setEditorProfileId(null); setEditorOpen(true); }}><Plus size={16} />Профиль</button>
            <button type="button" className="secondary-button" onClick={() => void handleTestAll()} disabled={testingAll}><ScanSearch size={16} />{testingAll ? 'Testing...' : 'Тест всех'}</button>
          </div>
          <div className="toolbar-row__right">
            <button type="button" className="secondary-button" onClick={() => { persisted.subscriptions.forEach((subscription) => void refreshSubscription(subscription.id)); }}><RefreshCcw size={16} />Обновить подписки</button>
            <button type="button" className="secondary-button" onClick={() => void handleQuickTest()}><WandSparkles size={16} />Быстрый тест</button>
          </div>
        </div>

        {tab === 'servers' && (
          <>
            <FilterToolbar filters={filters} countries={countries} subscriptions={persisted.subscriptions} onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))} />
            {!ready ? (
              <div className="server-grid"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
            ) : (
              <ServerList profiles={visibleProfiles} subscriptions={persisted.subscriptions} runtime={runtime} onConnect={(profile) => void handleConnect(profile)} onToggleFavorite={handleToggleFavorite} onEdit={handleEditProfile} onDelete={handleDeleteProfile} onExport={handleExport} onCreateProfile={() => { setEditorProfileId(null); setEditorOpen(true); }} />
            )}
          </>
        )}
        {tab === 'subscriptions' && (
          <SubscriptionPanel
            subscriptions={persisted.subscriptions.map((subscription) => busySubscriptions[subscription.id] ? { ...subscription, lastError: 'Loading...' } : subscription)}
            onAdd={() => setSubscriptionOpen(true)}
            onRefresh={(subscriptionId) => void refreshSubscription(subscriptionId)}
            onDelete={handleDeleteSubscription}
          />
        )}
        {tab === 'history' && <HistoryPanel history={persisted.history} />}
        {tab === 'settings' && <SettingsPanel settings={persisted.settings} onChange={handleSettingsChange} />}
      </main>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onSubmit={(payload) => void handleImport(payload)} />
      <SubscriptionModal open={subscriptionOpen} onClose={() => setSubscriptionOpen(false)} onSubmit={(payload) => { setSubscriptionOpen(false); void handleCreateSubscription(payload); }} />
      <ProfileEditorModal open={editorOpen} profile={editorProfile} onClose={() => { setEditorOpen(false); setEditorProfileId(null); }} onSubmit={handleEditorSubmit} />
    </div>
  );
}

export default function App(): JSX.Element {
  return <ToastProvider><AppInner /></ToastProvider>;
}
