import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clipboard,
  ExternalLink,
  FileCode2,
  Filter,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { AuditIssue, EvidenceConfidence, IssueSeverity, SiteSummary } from "@evidera/contracts";
import { useMemo, useState } from "react";

interface IssuesPageProps {
  activeSite: SiteSummary;
  issues: AuditIssue[];
  selectedIssue: AuditIssue | null;
  onSelectIssue: (issue: AuditIssue | null) => void;
  onUpdateState: (issueId: string, state: "confirmed" | "shared" | "in_progress" | "resolved" | "accepted_risk" | "false_positive") => Promise<void>;
}

const severityLabel: Record<IssueSeverity, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
  info: "Bilgi",
};

const confidenceLabel: Record<EvidenceConfidence, string> = {
  proven: "Kanıtlandı",
  "strong-inference": "Güçlü çıkarım",
  hypothesis: "Hipotez",
};

const categoryLabel = {
  technical: "Teknik SEO",
  performance: "Performance",
  accessibility: "Accessibility",
  security: "Güvenlik",
  content: "İçerik",
  privacy: "Privacy",
};

export function IssuesPage({ activeSite, issues, selectedIssue, onSelectIssue, onUpdateState }: IssuesPageProps) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<IssueSeverity | "all">("all");
  const siteIssues = useMemo(() => issues.filter((issue) => {
    const matchesSite = issue.siteId === activeSite.id;
    const matchesQuery = issue.title.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"));
    const matchesSeverity = severity === "all" || issue.severity === severity;
    return matchesSite && matchesQuery && matchesSeverity;
  }), [activeSite.id, issues, query, severity]);

  if (selectedIssue) {
    return <IssueDetail issue={selectedIssue} onBack={() => onSelectIssue(null)} onUpdateState={onUpdateState} />;
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="section-kicker">Kanıt merkezi</span>
          <h2>Sorunlar</h2>
          <p>Her bulgu gözlem, kapsam, güven düzeyi ve doğrulama yöntemiyle birlikte tutulur.</p>
        </div>
        <div className="intro-stat-group">
          <div><strong>{siteIssues.length}</strong><span>gösterilen</span></div>
          <div><strong>{siteIssues.filter((issue) => issue.confidence === "proven").length}</strong><span>kanıtlanmış</span></div>
        </div>
      </section>

      <section className="surface-card filter-toolbar">
        <label className="table-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sorunlarda ara" />
          {query && <button onClick={() => setQuery("")} aria-label="Aramayı temizle"><X size={15} /></button>}
        </label>
        <div className="severity-filter" role="group" aria-label="Önem filtresi">
          {(["all", "critical", "high", "medium"] as const).map((item) => (
            <button key={item} className={severity === item ? "is-active" : ""} onClick={() => setSeverity(item)}>
              {item === "all" ? "Tümü" : severityLabel[item]}
            </button>
          ))}
        </div>
        <button className="secondary-button compact"><Filter size={16} /> Diğer filtreler <ChevronDown size={14} /></button>
      </section>

      <section className="surface-card data-table-card">
        <div className="issue-table-head">
          <span>Bulgu</span><span>Kapsam</span><span>Güven</span><span>Durum</span><span />
        </div>
        <div className="issue-table-body">
          {siteIssues.map((issue) => (
            <button key={issue.id} className="issue-table-row" onClick={() => onSelectIssue(issue)}>
              <div className="table-issue-title">
                <span className={`severity-indicator severity-${issue.severity}`}>
                  {issue.severity === "critical" ? <CircleAlert size={17} /> : <TriangleAlert size={17} />}
                </span>
                <div><strong>{issue.title}</strong><span>{issue.id} · {categoryLabel[issue.category]}</span></div>
              </div>
              <div className="table-scope"><strong>{issue.affectedUrls}</strong><span>URL · {issue.affectedTemplates.join(", ")}</span></div>
              <span className={`confidence-chip confidence-${issue.confidence}`}><ShieldCheck size={13} /> {confidenceLabel[issue.confidence]}</span>
              <span className={`status-chip status-${issue.status}`}>{issue.status === "in-progress" ? "Uygulanıyor" : issue.status === "shared" ? "Paylaşıldı" : issue.status === "confirmed" ? "Onaylandı" : "Yeni"}</span>
              <span className={`severity-chip severity-${issue.severity}`}>{severityLabel[issue.severity]}</span>
            </button>
          ))}
          {siteIssues.length === 0 && <div className="empty-state"><CheckCircle2 size={28} /><strong>Eşleşen sorun yok</strong><span>Arama veya filtrelerini değiştir.</span></div>}
        </div>
      </section>
    </div>
  );
}

function IssueDetail({ issue, onBack, onUpdateState }: { issue: AuditIssue; onBack: () => void; onUpdateState: IssuesPageProps["onUpdateState"] }) {
  return (
    <div className="page-stack issue-detail-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Sorunlara dön</button>
      <section className="issue-detail-hero surface-card">
        <div className={`detail-severity-mark severity-${issue.severity}`}><CircleAlert size={22} /></div>
        <div className="issue-detail-title">
          <div className="detail-meta">
            <span>{issue.id}</span>
            <span className={`severity-chip severity-${issue.severity}`}>{severityLabel[issue.severity]}</span>
            <span className={`confidence-chip confidence-${issue.confidence}`}><ShieldCheck size={13} /> {confidenceLabel[issue.confidence]}</span>
          </div>
          <h2>{issue.title}</h2>
          <p>{issue.summary}</p>
        </div>
        <div className="issue-actions"><button className="secondary-button" onClick={() => void onUpdateState(issue.id,"resolved")}>Çözüldü</button><button className="primary-button" onClick={() => void onUpdateState(issue.id,"shared")}>Müşteriye gönder</button></div>
      </section>

      <section className="issue-detail-layout">
        <div className="detail-main-column">
          <article className="surface-card detail-section evidence-card">
            <div className="detail-section-title"><FileCode2 size={18} /><div><h3>Kanıt</h3><span>{issue.evidence.length || 1} doğrulanabilir gözlem</span></div></div>
            {issue.evidence.length > 0 ? issue.evidence.map((evidence) => (
              <div className="evidence-item" key={evidence.id}>
                <div className="evidence-heading"><strong>{evidence.label}</strong><span>{new Date(evidence.capturedAt).toLocaleString("tr-TR")}</span></div>
                {evidence.sourceUrl && <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">{evidence.sourceUrl}<ExternalLink size={13} /></a>}
                {evidence.artifactKey && <a href={`/api/evidence/${evidence.id}/artifact`} target="_blank" rel="noreferrer">Ekran görüntüsü kanıtını aç <ExternalLink size={13}/></a>}
                <pre><code>{evidence.value}</code><button aria-label="Kanıtı kopyala" onClick={() => void navigator.clipboard.writeText(evidence.value)}><Clipboard size={14} /></button></pre>
              </div>
            )) : (
              <div className="evidence-placeholder"><ShieldCheck size={20} /><span>Ham kanıt tarama kaydında saklanıyor ve rapor oluşturulurken buraya bağlanacak.</span></div>
            )}
          </article>

          <article className="surface-card detail-section">
            <div className="detail-section-title"><Sparkles size={18} /><div><h3>Etki ve yorum</h3><span>Kanıt kapsamıyla sınırlandırılmış açıklama</span></div></div>
            <p className="detail-prose">{issue.impact}</p>
            <div className="boundary-note"><strong>Çıkarım sınırı</strong><span>{issue.inference}</span></div>
            <div className="boundary-note">
              <strong>Ölçüm sınırı</strong>
              <span>Bu bulgu harici gözleme dayanır. Google’ın seçtiği canonical veya gerçek trafik etkisi Search Console erişimi olmadan doğrulanamaz.</span>
            </div>
          </article>

          <article className="surface-card detail-section recommendation-section">
            <div className="detail-section-title"><CheckCircle2 size={18} /><div><h3>Önerilen çözüm</h3><span>Uygulanabilir ve yeniden test edilebilir</span></div></div>
            <p className="detail-prose">{issue.recommendation}</p>
            <div className="verification-box">
              <span>Doğrulama kriteri</span>
              <strong>{issue.verification}</strong>
            </div>
          </article>
        </div>

        <aside className="detail-side-column">
          <article className="surface-card issue-facts">
            <h3>Bulgu özeti</h3>
            <dl>
              <div><dt>Durum</dt><dd>{issue.status}</dd></div>
              <div><dt>Etkilenen URL</dt><dd>{issue.affectedUrls}</dd></div>
              <div><dt>Şablon</dt><dd>{issue.affectedTemplates.join(", ")}</dd></div>
              <div><dt>Tahmini efor</dt><dd>{issue.effort}</dd></div>
              <div><dt>İlk görüldü</dt><dd>{issue.firstSeenAt}</dd></div>
              <div><dt>Son doğrulama</dt><dd>{issue.lastSeenAt}</dd></div>
            </dl>
          </article>
          <article className="surface-card issue-timeline">
            <h3>Geçmiş</h3>
            <div><i /><p><strong>Yeniden doğrulandı</strong><span>{issue.lastSeenAt}</span></p></div>
            <div><i /><p><strong>Bulgu oluşturuldu</strong><span>{issue.firstSeenAt}</span></p></div>
          </article>
        </aside>
      </section>
    </div>
  );
}
