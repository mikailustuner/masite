import { AlertTriangle, Bell, CheckCircle2, LoaderCircle, X } from "lucide-react";
import type { ApiAuditRun, SiteSummary } from "@evidera/contracts";

export interface AuditToastNotice {
  id: string;
  tone: "info" | "success" | "error";
  title: string;
  message: string;
  siteId?: string;
}

export function AuditActivity({ runs, sites }: { runs: ApiAuditRun[]; sites: SiteSummary[] }) {
  const activeRuns = runs.filter((run) => run.status === "queued" || run.status === "running");
  if (activeRuns.length === 0) return null;
  return <aside className="audit-activity" aria-live="polite" aria-label="Arka plan denetimleri">
    <div className="audit-activity-heading"><span><LoaderCircle className="spinning" size={16}/></span><div><strong>Arka plan denetimleri</strong><small>{activeRuns.length} çalışma etkin</small></div></div>
    <div className="audit-activity-list">{activeRuns.map((run) => {
      const site = sites.find((item) => item.id === run.siteId);
      const progress = auditProgress(run);
      return <article key={run.id}>
        <div className="audit-activity-row"><div><strong>{site?.name ?? "Site denetimi"}</strong><small>{stageLabel(run)} · {modeLabel(run.mode)}</small></div><span>{run.discoveredUrls} URL</span></div>
        <div className={`audit-progress ${run.status}`} role="progressbar" aria-label={`${site?.name ?? "Site"} denetim ilerlemesi`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }}/></div>
        <div className="audit-counters"><span>{run.renderedUrls} render</span><span>{run.issuesCreated} bulgu</span></div>
      </article>;
    })}</div>
  </aside>;
}

export function AuditToast({ notice, onClose, onOpen }: { notice: AuditToastNotice; onClose: () => void; onOpen: () => void }) {
  const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? AlertTriangle : Bell;
  return <div className={`audit-toast ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
    <span className="audit-toast-icon"><Icon size={18}/></span>
    <div><strong>{notice.title}</strong><p>{notice.message}</p>{notice.siteId && notice.tone === "success" && <button onClick={onOpen}>Sonuçları aç</button>}</div>
    <button className="audit-toast-close" onClick={onClose} aria-label="Bildirimi kapat"><X size={15}/></button>
  </div>;
}

function stageLabel(run: ApiAuditRun): string {
  if (run.status === "queued") return "Kuyrukta";
  const stage = typeof run.summary.stage === "string" ? run.summary.stage : "crawling";
  if (stage === "external-intelligence") return "Dış kaynaklar ölçülüyor";
  if (stage === "findings") return "Bulgular hazırlanıyor";
  return run.discoveredUrls > 0 ? "Sayfalar inceleniyor" : "Hazırlanıyor";
}

function modeLabel(mode: ApiAuditRun["mode"]): string {
  return mode === "quick" ? "Hızlı" : mode === "standard" ? "Standart" : "Derin";
}

function auditProgress(run: ApiAuditRun): number {
  if (run.status === "queued") return 4;
  const stage = typeof run.summary.stage === "string" ? run.summary.stage : "crawling";
  if (stage === "findings") return 94;
  if (stage === "external-intelligence") return 86;
  const limit = run.mode === "quick" ? 1 : run.mode === "standard" ? 100 : 500;
  return Math.min(80, Math.max(8, Math.round(8 + (run.discoveredUrls / limit) * 72)));
}
