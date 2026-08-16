import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Globe2, LoaderCircle, LogOut, Play, ShieldCheck, X } from "lucide-react";
import type { ApiAuditRun, ApiIssue, AuditIssue, CreateSiteRequest, SiteSummary, UserSession } from "@evidera/contracts";
import { Sidebar, type PageId } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
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
  const activeSite = useMemo(() => sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null, [activeSiteId, sites]);

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
        {activeSite && <Topbar sites={sites} activeSite={activeSite} title={pageTitles[activePage]} onSiteChange={setActiveSiteId} onMenuOpen={() => setSidebarOpen(true)} onNewScan={() => setScanModalOpen(true)} />}
        <main className="main-content">
          {loadError && <div className="app-error" role="alert">{loadError}<button onClick={() => { setLoadError(null); setSitesLoading(true); void loadSites(); }}>Yeniden dene</button></div>}
          {!activeSite ? <EmptyPortfolio onAdd={() => setSiteModalOpen(true)} /> : <>
            {activePage === "overview" && <OverviewPage activeSite={activeSite} sites={sites} issues={issues} onOpenIssue={openIssue} onViewIssues={() => navigate("issues")} onViewSites={() => navigate("sites")} />}
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
      {scanModalOpen && activeSite && <ScanModal site={activeSite} onClose={() => setScanModalOpen(false)} onCompleted={() => { void loadSites(); api.issues(activeSite.id).then((rows) => setIssues(rows.map(toAuditIssue))).catch(() => undefined); }} />}
      {siteModalOpen && <SiteModal onClose={() => setSiteModalOpen(false)} onCreated={async () => { setSiteModalOpen(false); await loadSites(); }} />}
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(null); try { onLogin(await api.login(email, password)); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <main className="auth-shell"><section className="auth-card"><div className="auth-mark"><ShieldCheck /></div><span className="section-kicker">Evidera Intelligence</span><h1>Çalışma alanına giriş</h1><p>Harici site denetimlerini ve kanıt paketlerini güvenli biçimde yönetin.</p><form onSubmit={submit}><label><span>E-posta</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label><span>Parola</span><input type="password" autoComplete="current-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <div className="scan-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy && <LoaderCircle className="spinning" size={17} />}{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button></form></section></main>;
}

function ScanModal({ site, onClose, onCompleted }: { site: SiteSummary; onClose: () => void; onCompleted: () => void }) {
  const [mode, setMode] = useState<ApiAuditRun["mode"]>("standard"); const [run, setRun] = useState<ApiAuditRun | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { if (!run || !["queued", "running"].includes(run.status)) return; const timer = window.setInterval(() => api.audit(run.id).then((next) => { setRun(next); if (next.status === "completed") onCompleted(); }).catch((e) => setError(messageOf(e))), 1500); return () => clearInterval(timer); }, [run, onCompleted]);
  const start = async () => { setBusy(true); setError(null); try { setRun(await api.startAudit(site.id, mode)); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="scan-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title"><div className="modal-handle"/><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Pencereyi kapat"><X size={18}/></button>{!run ? <><div className="modal-icon"><Globe2 size={23}/></div><div className="modal-heading"><span className="section-kicker">Harici denetim</span><h2 id="scan-title">Yeni tarama başlat</h2><p>{site.origin} için robots kurallarına uyan denetim.</p></div><fieldset className="scan-mode-fieldset"><legend>Tarama derinliği</legend>{(["quick","standard","deep"] as const).map((id) => <button type="button" key={id} className={mode === id ? "is-selected" : ""} onClick={() => setMode(id)}><span className="radio-dot"><i/></span><div><strong>{id === "quick" ? "Hızlı" : id === "standard" ? "Standart" : "Derin"}</strong><small>{id === "quick" ? "Ana sayfa" : id === "standard" ? "En fazla 100 URL" : "En fazla 500 URL"}</small></div>{mode === id && <Check size={16}/>}</button>)}</fieldset><div className="scan-safety-note"><ShieldCheck size={17}/><span>Pasif kontroller, SSRF koruması ve hız limiti uygulanır.</span></div>{error && <div className="scan-error" role="alert">{error}</div>}<button className="primary-button modal-primary" onClick={start} disabled={busy}>{busy ? <LoaderCircle className="spinning" size={17}/> : <Play size={17}/>} {busy ? "Kuyruğa alınıyor…" : "Taramayı başlat"}</button></> : <div className="scan-started-state"><span className="started-check">{run.status === "completed" ? <Check size={28}/> : <LoaderCircle className="spinning" size={28}/>}</span><h2>{run.status === "completed" ? "Denetim tamamlandı" : run.status === "failed" ? "Denetim tamamlanamadı" : "Denetim çalışıyor"}</h2><p>{run.errorMessage ?? (run.status === "completed" ? "Kanıtlar ve bulgular çalışma alanına işlendi." : "Tarama worker tarafından güvenli biçimde yürütülüyor.")}</p><div className="scan-result-grid"><span><small>URL</small><strong>{run.discoveredUrls}</strong></span><span><small>Render</small><strong>{run.renderedUrls}</strong></span><span><small>Bulgu</small><strong>{run.issuesCreated}</strong></span></div><button className="primary-button" onClick={onClose}>Kapat</button></div>}</section></div>;
}

function SiteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateSiteRequest>({ name: "", origin: "https://", market: "Türkiye", language: "tr" }); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await api.createSite(form); onCreated(); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="scan-modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="site-title"><button className="modal-close" onClick={onClose} aria-label="Pencereyi kapat"><X size={18}/></button><div className="modal-heading"><span className="section-kicker">Portföy</span><h2 id="site-title">Site ekle</h2><p>Yalnızca herkese açık başlangıç adresi gerekir.</p></div><form className="modal-form" onSubmit={submit}><label><span>Müşteri / site adı</span><input required minLength={2} value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/></label><label><span>Site adresi</span><input required type="url" value={form.origin} onChange={(e) => setForm({...form,origin:e.target.value})}/></label><div><label><span>Pazar</span><input required value={form.market} onChange={(e) => setForm({...form,market:e.target.value})}/></label><label><span>Dil</span><input required value={form.language} onChange={(e) => setForm({...form,language:e.target.value})}/></label></div>{error && <div className="scan-error" role="alert">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "Ekleniyor…" : "Siteyi ekle"}</button></form></section></div>;
}

function EmptyPortfolio({ onAdd }: { onAdd: () => void }) { return <section className="surface-card empty-portfolio"><Globe2 size={30}/><h2>İlk sitenizi ekleyin</h2><p>DNS, Search Console veya Analytics erişimi gerekmez.</p><button className="primary-button" onClick={onAdd}>Site ekle</button></section>; }
function messageOf(error: unknown) { return error instanceof ApiError || error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu."; }
function toAuditIssue(row: ApiIssue): AuditIssue { const categories: AuditIssue["category"][] = ["technical","performance","accessibility","security","content","privacy"]; return { id: row.id, siteId: row.siteId, title: row.title, category: categories.includes(row.category as AuditIssue["category"]) ? row.category as AuditIssue["category"] : "technical", severity: row.severity, confidence: row.confidence === "strong_inference" ? "strong-inference" : row.confidence, status: row.state === "in_progress" ? "in-progress" : row.state === "accepted_risk" ? "accepted-risk" : row.state === "false_positive" ? "resolved" : row.state, affectedUrls: row.affectedUrlCount, affectedTemplates: ["Taranan sayfalar"], summary: row.summary, inference: row.inference, impact: row.impact, recommendation: row.recommendation, verification: row.verification, effort: (["XS","S","M","L","XL"].includes(row.effort) ? row.effort : "S") as AuditIssue["effort"], firstSeenAt: new Date(row.firstSeenAt).toLocaleDateString("tr-TR"), lastSeenAt: new Date(row.lastSeenAt).toLocaleDateString("tr-TR"), evidence: row.evidence ?? [] }; }
