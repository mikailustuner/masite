import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  Gauge,
  KeyRound,
  LayoutTemplate,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ApiAuditRun, AuditIssue, SiteSummary } from "@evidera/contracts";
import { useEffect, useState } from "react";
import { MetricCard, ScoreRing, SegmentedBar } from "../components/Visuals";
import { api } from "../lib/api";

interface OverviewPageProps {
  activeSite: SiteSummary;
  sites: SiteSummary[];
  issues: AuditIssue[];
  onOpenIssue: (issue: AuditIssue) => void;
  onViewIssues: () => void;
  onViewSites: () => void;
  onSelectSite: (siteId: string) => void;
}

const severityLabel = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
  info: "Bilgi",
};

const categoryLabel = {
  technical: "Teknik SEO",
  performance: "Performance",
  accessibility: "Accessibility",
  security: "Güvenlik",
  content: "İçerik",
  privacy: "Privacy",
};

export function OverviewPage({ activeSite, sites, issues, onOpenIssue, onViewIssues, onViewSites, onSelectSite }: OverviewPageProps) {
  const [auditHistory,setAuditHistory]=useState<ApiAuditRun[]>([]); const[detailsOpen,setDetailsOpen]=useState(false);
  useEffect(()=>{void api.audits(activeSite.id).then(setAuditHistory);},[activeSite.id]);
  const activeIssues = issues.filter((issue) => issue.siteId === activeSite.id);
  const portfolioHealth = sites.length ? Math.round(sites.reduce((sum,site)=>sum+site.healthScore,0)/sites.length) : 0;
  const measuredVisibility=sites.map((site)=>site.visibilityScore).filter((value):value is number=>value!==null);
  const severityCounts={critical:activeIssues.filter((issue)=>issue.severity==="critical").length,high:activeIssues.filter((issue)=>issue.severity==="high").length,medium:activeIssues.filter((issue)=>issue.severity==="medium").length,low:activeIssues.filter((issue)=>issue.severity==="low"||issue.severity==="info").length};
  const topIssue=activeIssues[0];

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <p className="section-kicker">{new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"long",weekday:"long"})}</p>
          <h2>Portföy özeti</h2>
          <p>{activeSite.name} için <strong>{activeIssues.length} açık bulgu</strong> izleniyor.</p>
        </div>
        <div className="scan-status">
          <span className="scan-pulse"><span /></span>
          <div>
            <strong>Denetim altyapısı bağlı</strong>
            <span>{activeSite.lastScanAt?`Son koşu ${new Date(activeSite.lastScanAt).toLocaleString("tr-TR")}`:"İlk tarama bekleniyor"}</span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Ana metrikler">
        <MetricCard
          label="Portföy sağlığı"
          value={String(portfolioHealth)}
          helper={`${sites.length} sitenin dış sağlık skoru`}
          icon={<Gauge size={19} />}
          tone="#0a84ff"
        />
        <MetricCard
          label="Search visibility"
          value={measuredVisibility.length?`${Math.round(measuredVisibility.reduce((a,b)=>a+b,0)/measuredVisibility.length)}%`:"—"}
          helper={measuredVisibility.length?`${measuredVisibility.length} ölçülen site`:"SERP connector gerekli"}
          icon={<ScanSearch size={19} />}
          tone="#5856d6"
        />
        <MetricCard
          label="Açık sorunlar"
          value={String(sites.reduce((sum,site)=>sum+site.openIssues,0))}
          helper={`${sites.reduce((sum,site)=>sum+site.criticalIssues,0)} kritik bulgu`}
          icon={<TriangleAlert size={19} />}
          tone="#ff9f0a"
        />
        <MetricCard
          label="Keyword kapsamı"
          value="—"
          helper="Site bazlı keyword ekranında"
          icon={<KeyRound size={19} />}
          tone="#30b86b"
        />
      </section>

      <section className="dashboard-grid">
        <article className="surface-card portfolio-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">Portföy görünümü</span>
              <h3>Site sağlığı</h3>
            </div>
            <button className="text-button" onClick={onViewSites}>Tüm siteler <ChevronRight size={15} /></button>
          </div>
          <div className="site-health-list">
            {sites.slice(0, 4).map((site) => (
              <button key={site.id} className="site-health-row" onClick={() => onSelectSite(site.id)}>
                <div className={`site-monogram status-${site.status}`}>{site.name.charAt(0)}</div>
                <div className="site-identity">
                  <strong>{site.name}</strong>
                  <span>{site.domain}</span>
                </div>
                <div className="site-mini-chart"><small>{site.lastScanAt ? new Date(site.lastScanAt).toLocaleDateString("tr-TR") : "Ölçülmedi"}</small></div>
                <div className={`trend-value ${(site.trend ?? 0) >= 0 ? "positive" : "negative"}`}>
                  {site.trend === null ? "—" : `${site.trend >= 0 ? "+" : ""}${site.trend}%`}
                </div>
                <ScoreRing
                  value={site.healthScore}
                  size={48}
                  tone={site.healthScore >= 85 ? "green" : site.healthScore >= 70 ? "orange" : "red"}
                />
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card opportunity-card">
          <div className="opportunity-glow" />
          <div className="opportunity-topline">
            <span className="ai-badge"><Sparkles size={14} /> Kanıt destekli fırsat</span>
            <span>Yüksek etki</span>
          </div>
          <div className="opportunity-body">
            <div className="opportunity-icon"><LayoutTemplate size={22} /></div>
            <h3>{topIssue?.title ?? "Kanıtlı fırsat için veri bekleniyor"}</h3>
            <p>{topIssue?.impact ?? "İlk denetimi çalıştırın; sistem yalnızca doğrudan gözlenen sinyaller üzerinden fırsat ve çözüm önerisi oluşturur."}</p>
            <div className="evidence-strip">
              <span><Check size={14} /> {topIssue?.affectedUrls ?? 0} URL</span>
              <span><Check size={14} /> {topIssue?.evidence.length ?? 0} kanıt örneği</span>
              <span><Check size={14} /> {topIssue?.confidence ?? "ölçüm bekleniyor"}</span>
            </div>
          </div>
          <button className="opportunity-action" disabled={!topIssue} onClick={()=>topIssue&&onOpenIssue(topIssue)}>Bulguyu incele <ArrowRight size={16} /></button>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="surface-card issues-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">Öncelikli aksiyonlar</span>
              <h3>{activeSite.name}</h3>
            </div>
            <button className="text-button" onClick={onViewIssues}>Tüm sorunlar <ChevronRight size={15} /></button>
          </div>
          <div className="issue-list">
            {activeIssues.slice(0, 4).map((issue) => (
              <button key={issue.id} className="issue-row" onClick={() => onOpenIssue(issue)}>
                <span className={`severity-indicator severity-${issue.severity}`}>
                  {issue.severity === "critical" ? <CircleAlert size={17} /> : <TriangleAlert size={17} />}
                </span>
                <div className="issue-row-copy">
                  <strong>{issue.title}</strong>
                  <span>{categoryLabel[issue.category]} · {issue.affectedUrls} URL · {issue.effort} efor</span>
                </div>
                <span className={`severity-chip severity-${issue.severity}`}>{severityLabel[issue.severity]}</span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card distribution-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">Kapsam</span>
              <h3>Sorun dağılımı</h3>
            </div>
            <button className="text-button" onClick={onViewIssues}>Bulguları aç <ChevronRight size={14}/></button>
          </div>
          <div className="distribution-total">
            <strong>{activeIssues.length}</strong>
            <span>açık bulgu</span>
          </div>
          <SegmentedBar values={[
            { value: severityCounts.critical, color: "#ff453a", label: "Kritik" },
            { value: severityCounts.high, color: "#ff9f0a", label: "Yüksek" },
            { value: severityCounts.medium, color: "#ffd60a", label: "Orta" },
            { value: severityCounts.low, color: "#64d2ff", label: "Düşük" },
          ]} />
          <div className="distribution-legend">
            <div><i style={{ background: "#ff453a" }} /><span>Kritik</span><strong>{severityCounts.critical}</strong></div>
            <div><i style={{ background: "#ff9f0a" }} /><span>Yüksek</span><strong>{severityCounts.high}</strong></div>
            <div><i style={{ background: "#ffd60a" }} /><span>Orta</span><strong>{severityCounts.medium}</strong></div>
            <div><i style={{ background: "#64d2ff" }} /><span>Düşük</span><strong>{severityCounts.low}</strong></div>
          </div>
          <div className="resolution-note">
            <ShieldCheck size={18} />
            <div><strong>Yaşam döngüsü etkin</strong><span>Çözülen bulgular derin taramada yeniden doğrulanır</span></div>
          </div>
        </article>
      </section>

      <section className="activity-banner surface-card">
        <div className="activity-icon"><Activity size={20} /></div>
        <div>
          <strong>{activeSite.lastScanAt?"Son denetim tamamlandı":"Denetim henüz çalıştırılmadı"}</strong>
          <span>{activeSite.lastScanAt?`${new Date(activeSite.lastScanAt).toLocaleString("tr-TR")} · ${activeIssues.length} açık bulgu`:"Yeni tarama ile HTTP, HTML, render ve axe kanıtlarını toplayın."}</span>
        </div>
        <button className="secondary-button" onClick={()=>setDetailsOpen(true)}>Tarama ayrıntıları</button>
      </section>
      {detailsOpen&&<div className="modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&setDetailsOpen(false)}><section className="scan-modal audit-history-modal" role="dialog" aria-modal="true" aria-labelledby="audit-history-title"><button className="modal-close" onClick={()=>setDetailsOpen(false)} aria-label="Kapat"><X size={18}/></button><div className="modal-heading"><span className="section-kicker">Gerçek worker kayıtları</span><h2 id="audit-history-title">Tarama geçmişi</h2><p>{activeSite.name} için son 50 denetim ve işlenen sayaçlar.</p></div><div className="audit-history-list">{auditHistory.map((run)=><article key={run.id}><div><strong>{run.mode === "quick"?"Hızlı":run.mode === "standard"?"Standart":"Derin"} denetim</strong><span>{new Date(run.queuedAt).toLocaleString("tr-TR")}</span></div><span className={`run-status ${run.status}`}>{run.status}</span><dl><div><dt>URL</dt><dd>{run.discoveredUrls}</dd></div><div><dt>Render</dt><dd>{run.renderedUrls}</dd></div><div><dt>Bulgu</dt><dd>{run.issuesCreated}</dd></div></dl>{run.errorMessage&&<p>{run.errorMessage}</p>}</article>)}{auditHistory.length===0&&<div className="empty-state"><ScanSearch size={24}/><strong>Henüz denetim yok</strong><span>İlk çalışma başladığında burada görünür.</span></div>}</div></section></div>}
    </div>
  );
}
