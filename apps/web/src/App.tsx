import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Globe2, LoaderCircle, LogOut, Play, ShieldCheck, X } from "lucide-react";
import type { ApiAuditRun, ApiIssue, AuditIssue, CreateSiteRequest, SiteSummary, UserSession } from "@evidera/contracts";
import { Sidebar, type PageId } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { AuditActivity, AuditToast, type AuditToastNotice } from "./components/AuditActivity";
import { OverviewPage } from "./pages/OverviewPage";
import { IssuesPage } from "./pages/IssuesPage";
import { AdsStudioPage, CompetitorsPage, KeywordsPage, ReportsPage, SettingsPage, SitesPage, VisibilityPage } from "./pages/IntelligencePages";
import { IntelligenceCenterPage, JourneysPage } from "./pages/IntelligenceCenterPage";
import { ApiError, api } from "./lib/api";

const pageTitles: Record<PageId, string> = { overview: "Genel Bakış", sites: "Siteler", issues: "Sorunlar", visibility: "Görünürlük", keywords: "Keyword’ler", competitors: "Rakipler", intelligence: "Intelligence Center", journeys: "Sentetik Yolculuklar", ads: "Ads Studio", reports: "Raporlar", settings: "Ayarlar" };
const paths: Record<PageId, string> = { overview: "/", sites: "/sites", issues: "/issues", visibility: "/visibility", keywords: "/keywords", competitors: "/competitors", intelligence: "/intelligence", journeys: "/journeys", ads: "/ads-studio", reports: "/reports", settings: "/settings" };

function pageFromPath(): PageId {
  return (Object.entries(paths).find(([, path]) => path === window.location.pathname)?.[0] as PageId | undefined) ?? "overview";
}

export function App() {
  const [session, setSession] = useState<UserSession | null | undefined>();
  useEffect(() => { api.session().then(setSession).catch(() => setSession(null)); }, []);
  if (session === undefined) return <div className="app-loading"><LoaderCircle className="spinning" /><span>Çalışma alanı yükleniyor…</span></div>;
  if (!session) return <LoginPage onLogin={setSession} />;
  return <Workspace session={session} onLogout={() => setSession(null)} />;
}

function Workspace({ session, onLogout }: { session: UserSession; onLogout: () => void }) {
  const [activePage, setActivePage] = useState<PageId>(pageFromPath);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [activeSiteId, setActiveSiteId] = useState("");
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [auditRuns, setAuditRuns] = useState<Record<string, ApiAuditRun>>({});
  const [auditToast, setAuditToast] = useState<AuditToastNotice | null>(null);
  const auditRunsRef = useRef<Record<string, ApiAuditRun>>({});
  const notifiedRunsRef = useRef(new Set<string>());
  const activeSite = useMemo(() => sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null, [activeSiteId, sites]);
  const activeAuditRuns = useMemo(() => Object.values(auditRuns).filter((run) => run.status === "queued" || run.status === "running"), [auditRuns]);
  const activeAuditKey = useMemo(() => activeAuditRuns.map((run) => run.id).sort().join(","), [activeAuditRuns]);

  const loadSites = useCallback(async () => {
    try {
      const rows = await api.sites();
      setSites(rows);
      setActiveSiteId((current) => rows.some((site) => site.id === current) ? current : rows[0]?.id ?? "");
      setLoadError(null);
    } catch (error) {
      setLoadError(messageOf(error));
    } finally {
      setSitesLoading(false);
    }
  }, []);
  useEffect(() => { void loadSites(); }, [loadSites]);
  useEffect(() => { auditRunsRef.current = auditRuns; }, [auditRuns]);
  useEffect(() => {
    if (sitesLoading) return;
    let cancelled = false;
    api.activeAudits().then((rows) => {
      if (cancelled) return;
      rememberAuditRuns(rows.map((run) => run.id));
      setAuditRuns(Object.fromEntries(rows.map((run) => [run.id, run])));
    }).catch((error) => setLoadError(messageOf(error)));
    return () => { cancelled = true; };
  }, [sitesLoading]);
  useEffect(() => {
    if (!activeSiteId) { setIssues([]); return; }
    api.issues(activeSiteId).then((rows) => setIssues(rows.map(toAuditIssue))).catch((error) => setLoadError(messageOf(error)));
  }, [activeSiteId]);
  useEffect(() => {
    const pop = () => setActivePage(pageFromPath());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!scanModalOpen && !siteModalOpen) return;
    const previousOverflow=document.body.style.overflow; document.body.style.overflow="hidden";
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape"){setScanModalOpen(false);setSiteModalOpen(false);}};
    window.addEventListener("keydown",close); return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener("keydown",close);};
  },[scanModalOpen,siteModalOpen]);

  const navigate = (page: PageId) => {
    setActivePage(page); setSelectedIssue(null); setSidebarOpen(false);
    if (window.location.pathname !== paths[page]) window.history.pushState({}, "", paths[page]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const finishAudit = useCallback((run: ApiAuditRun) => {
    if (notifiedRunsRef.current.has(run.id)) return;
    notifiedRunsRef.current.add(run.id);
    forgetAuditRun(run.id);
    const siteName = sites.find((site) => site.id === run.siteId)?.name ?? "Site";
    const succeeded = run.status === "completed";
    const notice: AuditToastNotice = {
      id: run.id,
      tone: succeeded ? "success" : "error",
      title: succeeded ? "Denetim tamamlandı" : "Denetim tamamlanamadı",
      message: succeeded ? `${siteName}: ${run.discoveredUrls} URL incelendi, ${run.issuesCreated} bulgu işlendi.` : `${siteName}: ${run.errorMessage ?? "Worker denetimi tamamlayamadı."}`,
      siteId: run.siteId,
    };
    setAuditToast(notice);
    if ("Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(notice.title, { body: notice.message, tag: `audit-${run.id}` });
      notification.onclick = () => { window.focus(); notification.close(); };
    }
    const previousTitle = document.title;
    document.title = `${succeeded ? "✓" : "!"} ${notice.title} · Evidera`;
    window.setTimeout(() => { document.title = previousTitle; }, 12_000);
    void loadSites();
    if (run.siteId === activeSiteId) api.issues(run.siteId).then((rows) => setIssues(rows.map(toAuditIssue))).catch(() => undefined);
  }, [activeSiteId, loadSites, sites]);
  useEffect(() => {
    if (sitesLoading) return;
    let cancelled = false;
    const trackedIds = rememberedAuditRuns();
    if (trackedIds.length === 0) return;
    Promise.allSettled(trackedIds.map((runId) => api.audit(runId))).then((results) => {
      if (cancelled) return;
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const run = result.value;
        auditRunsRef.current = { ...auditRunsRef.current, [run.id]: run };
        setAuditRuns((current) => ({ ...current, [run.id]: run }));
        if (run.status !== "queued" && run.status !== "running") finishAudit(run);
      }
    });
    return () => { cancelled = true; };
  }, [finishAudit, sitesLoading]);
  useEffect(() => {
    if (!activeAuditKey) return;
    let cancelled = false;
    let polling = false;
    const runIds = activeAuditKey.split(",");
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const results = await Promise.allSettled(runIds.map((runId) => api.audit(runId)));
        if (cancelled) return;
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const next = result.value;
          const previous = auditRunsRef.current[next.id];
          auditRunsRef.current = { ...auditRunsRef.current, [next.id]: next };
          setAuditRuns((current) => ({ ...current, [next.id]: next }));
          if (previous && (previous.status === "queued" || previous.status === "running") && next.status !== "queued" && next.status !== "running") finishAudit(next);
        }
      } finally { polling = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), document.visibilityState === "hidden" ? 5_000 : 2_500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeAuditKey, finishAudit]);
  useEffect(() => {
    if (!auditToast) return;
    const timer = window.setTimeout(() => setAuditToast((current) => current?.id === auditToast.id ? null : current), 15_000);
    return () => window.clearTimeout(timer);
  }, [auditToast]);
  useEffect(() => {
    const showApiError = (event: Event) => {
      const error = (event as CustomEvent<ApiError>).detail;
      if (!error || error.status === 401) return;
      setAuditToast({ id: `api-${Date.now()}`, tone: "error", title: "İşlem tamamlanamadı", message: error.message });
    };
    window.addEventListener("evidera:api-error", showApiError);
    return () => window.removeEventListener("evidera:api-error", showApiError);
  }, []);
  const openIssue = async (issue: AuditIssue) => {
    setSelectedIssue(issue); navigate("issues");
    try { setSelectedIssue(toAuditIssue(await api.issue(issue.id))); } catch (error) { setLoadError(messageOf(error)); }
  };
  const logout = async () => { await api.logout().catch(() => undefined); onLogout(); };

  if (sitesLoading) return <div className="app-loading"><LoaderCircle className="spinning" /><span>Siteler yükleniyor…</span></div>;
  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} isOpen={sidebarOpen} onNavigate={navigate} onClose={() => setSidebarOpen(false)} siteCount={sites.length} issueCount={sites.reduce((sum,site)=>sum+site.openIssues,0)} userName={session.user.displayName} role={session.role} />
      <div className="main-shell">
        {activeSite && <Topbar sites={sites} activeSite={activeSite} title={pageTitles[activePage]} onSiteChange={setActiveSiteId} onMenuOpen={() => setSidebarOpen(true)} onNewScan={() => setScanModalOpen(true)} auditRunning={activeAuditRuns.some((run) => run.siteId === activeSite.id)} />}
        <main className="main-content">
          {loadError && <div className="app-error" role="alert">{loadError}<button onClick={() => { setLoadError(null); setSitesLoading(true); void loadSites(); }}>Yeniden dene</button></div>}
          {!activeSite ? <EmptyPortfolio onAdd={() => setSiteModalOpen(true)} /> : <>
            {activePage === "overview" && <OverviewPage activeSite={activeSite} sites={sites} issues={issues} onOpenIssue={openIssue} onViewIssues={() => navigate("issues")} onViewSites={() => navigate("sites")} onSelectSite={setActiveSiteId} />}
            {activePage === "sites" && <SitesPage sites={sites} onAddSite={() => setSiteModalOpen(true)} onSelectSite={(id) => { setActiveSiteId(id); navigate("overview"); }} />}
            {activePage === "issues" && <IssuesPage activeSite={activeSite} issues={issues} selectedIssue={selectedIssue} onSelectIssue={(issue) => issue ? void openIssue(issue) : setSelectedIssue(null)} onUpdateState={async (issueId, state) => { const updated=toAuditIssue(await api.updateIssue(issueId,state)); setSelectedIssue(updated); setIssues((current)=>current.map((item)=>item.id===issueId?updated:item)); }} />}
            {activePage === "visibility" && <VisibilityPage activeSite={activeSite} />}
            {activePage === "keywords" && <KeywordsPage activeSite={activeSite} />}
            {activePage === "competitors" && <CompetitorsPage activeSite={activeSite} />}
            {activePage === "intelligence" && <IntelligenceCenterPage activeSite={activeSite} />}
            {activePage === "journeys" && <JourneysPage activeSite={activeSite} />}
            {activePage === "ads" && <AdsStudioPage activeSite={activeSite} />}{activePage === "reports" && <ReportsPage activeSite={activeSite} />}{activePage === "settings" && <SettingsPage activeSite={activeSite} />}
          </>}
        </main>
      </div>
      <button className="session-button" onClick={logout} title={`${session.user.displayName} · Çıkış`} aria-label="Oturumu kapat"><LogOut size={16} /></button>
      <AuditActivity runs={Object.values(auditRuns)} sites={sites}/>
      {auditToast && (
        <AuditToast notice={auditToast} onClose={() => setAuditToast(null)} onOpen={() => { if (auditToast.siteId) setActiveSiteId(auditToast.siteId); setAuditToast(null); navigate("issues"); }}/>
      )}
      {scanModalOpen && activeSite && <ScanModal site={activeSite} onClose={() => setScanModalOpen(false)} onStarted={(run) => { rememberAuditRuns([run.id]); auditRunsRef.current = { ...auditRunsRef.current, [run.id]: run }; setAuditRuns((current) => ({ ...current, [run.id]: run })); setAuditToast({ id: `started-${run.id}`, tone: "info", title: "Denetim arka planda başladı", message: `${activeSite.name} denetimi sürerken diğer ekranları kullanabilirsiniz.` }); setScanModalOpen(false); }} />}
      {siteModalOpen && <SiteModal onClose={() => setSiteModalOpen(false)} onCreated={async () => { setSiteModalOpen(false); await loadSites(); }} />}
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(null); try { onLogin(await api.login(email, password)); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <main className="auth-shell"><section className="auth-card"><div className="auth-mark"><ShieldCheck /></div><span className="section-kicker">Evidera Intelligence</span><h1>Çalışma alanına giriş</h1><p>Harici site denetimlerini ve kanıt paketlerini güvenli biçimde yönetin.</p><form onSubmit={submit}><label><span>E-posta</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label><span>Parola</span><input type="password" autoComplete="current-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <div className="scan-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button></form></section></main>;
}

function ScanModal({ site, onClose, onStarted }: { site: SiteSummary; onClose: () => void; onStarted: (run: ApiAuditRun) => void }) {
  const [mode, setMode] = useState<ApiAuditRun["mode"]>("standard"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const start = async () => { setBusy(true); setError(null); void enableBrowserNotifications(); try { onStarted(await api.startAudit(site.id, mode)); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title"><div className="modal-handle"/><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Pencereyi kapat"><X size={18}/></button><div className="modal-icon"><Globe2 size={23}/></div><div className="modal-heading"><span className="section-kicker">Harici denetim</span><h2 id="scan-title">Yeni tarama başlat</h2><p>{site.origin} için robots kurallarına uyan denetim. Başlattıktan sonra bu pencere kapanır ve çalışma arka planda sürer.</p></div><fieldset className="scan-mode-fieldset"><legend>Tarama derinliği</legend>{(["quick","standard","deep"] as const).map((id) => <button type="button" key={id} className={mode === id ? "is-selected" : ""} onClick={() => setMode(id)}><span className="radio-dot"><i/></span><div><strong>{id === "quick" ? "Hızlı" : id === "standard" ? "Standart" : "Derin"}</strong><small>{id === "quick" ? "Ana sayfa" : id === "standard" ? "En fazla 100 URL" : "En fazla 500 URL"}</small></div>{mode === id && <Check size={16}/>}</button>)}</fieldset><div className="scan-safety-note"><ShieldCheck size={17}/><span>Pasif kontroller, SSRF koruması ve hız limiti uygulanır. Bittiğinde uygulama bildirimi gösterilir.</span></div>{error && <div className="scan-error" role="alert">{error}</div>}<button className="primary-button modal-primary" onClick={start} disabled={busy}>{busy ? <LoaderCircle className="spinning" size={17}/> : <Play size={17}/>} {busy ? "Kuyruğa alınıyor…" : "Arka planda başlat"}</button></section></div>;
}

function SiteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateSiteRequest>({ name: "", origin: "https://", market: "Türkiye", language: "tr" }); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api.createSite(form); onCreated(); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="scan-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="site-title"><button className="modal-close" onClick={onClose} aria-label="Pencereyi kapat"><X size={18}/></button><div className="modal-heading"><span className="section-kicker">Portföy</span><h2 id="site-title">Site ekle</h2><p>Yalnızca herkese açık başlangıç adresi gerekir.</p></div><form className="modal-form" onSubmit={submit}><label><span>Müşteri / site adı</span><input required minLength={2} value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/></label><label><span>Site adresi</span><input required type="url" value={form.origin} onChange={(e) => setForm({...form,origin:e.target.value})}/></label><div><label><span>Pazar</span><input required value={form.market} onChange={(e) => setForm({...form,market:e.target.value})}/></label><label><span>Dil</span><input required value={form.language} onChange={(e) => setForm({...form,language:e.target.value})}/></label></div>{error && <div className="scan-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "Ekleniyor…" : "Siteyi ekle"}</button></form></section></div>;
}

function EmptyPortfolio({ onAdd }: { onAdd: () => void }) { return <section className="surface-card empty-portfolio"><Globe2 size={30}/><h2>İlk sitenizi ekleyin</h2><p>DNS, Search Console veya Analytics erişimi gerekmez.</p><button className="primary-button" onClick={onAdd}>Site ekle</button></section>; }
function messageOf(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu."; }
async function enableBrowserNotifications() { if ("Notification" in window && window.isSecureContext && Notification.permission === "default") await Notification.requestPermission().catch(() => undefined); }
const rememberedAuditKey = "evidera.background-audits";
function rememberedAuditRuns(): string[] { try { const value=JSON.parse(localStorage.getItem(rememberedAuditKey)??"[]") as unknown; return Array.isArray(value)?value.filter((item):item is string=>typeof item==="string").slice(-100):[]; } catch { return []; } }
function rememberAuditRuns(runIds:string[]) { localStorage.setItem(rememberedAuditKey,JSON.stringify([...new Set([...rememberedAuditRuns(),...runIds])].slice(-100))); }
function forgetAuditRun(runId:string) { localStorage.setItem(rememberedAuditKey,JSON.stringify(rememberedAuditRuns().filter((id)=>id!==runId))); }
function toAuditIssue(row: ApiIssue): AuditIssue { const categories: AuditIssue["category"][] = ["technical","performance","accessibility","security","content","privacy"]; return { id: row.id, siteId: row.siteId, title: row.title, category: categories.includes(row.category as AuditIssue["category"]) ? row.category as AuditIssue["category"] : "technical", severity: row.severity, confidence: row.confidence === "strong_inference" ? "strong-inference" : row.confidence, status: row.state === "in_progress" ? "in-progress" : row.state === "accepted_risk" ? "accepted-risk" : row.state === "false_positive" ? "resolved" : row.state, affectedUrls: row.affectedUrlCount, affectedTemplates: ["Taranan sayfalar"], summary: row.summary, inference: row.inference, impact: row.impact, recommendation: row.recommendation, verification: row.verification, effort: (["XS","S","M","L","XL"].includes(row.effort) ? row.effort : "S") as AuditIssue["effort"], firstSeenAt: new Date(row.firstSeenAt).toLocaleDateString("tr-TR"), lastSeenAt: new Date(row.lastSeenAt).toLocaleDateString("tr-TR"), evidence: row.evidence ?? [] }; }
