import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  ChevronRight,
  CircleDot,
  Download,
  FileText,
  Gauge,
  Globe2,
  Image,
  KeyRound,
  LayoutGrid,
  ListFilter,
  Megaphone,
  MonitorSmartphone,
  PencilLine,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  UsersRound,
} from "lucide-react";
import type { AdBrief, CompetitorSummary, SiteSummary, TrackedKeyword, VisibilitySnapshot } from "@evidera/contracts";
import { useEffect, useRef, useState } from "react";
import { ScoreRing } from "../components/Visuals";
import { api } from "../lib/api";
import { copyText, downloadText } from "../lib/browser";

export function SitesPage({ sites, onAddSite, onSelectSite }: { sites: SiteSummary[]; onAddSite: () => void; onSelectSite: (siteId: string) => void }) {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="section-kicker">Portföy</span><h2>Siteler</h2><p>Tüm müşterilerin sağlık, görünürlük ve tarama durumunu tek yerden izle.</p></div>
        <button className="primary-button" onClick={onAddSite}><Plus size={17} /> Site ekle</button>
      </section>
      <section className="site-card-grid">
        {sites.map((site) => (
          <article key={site.id} className="surface-card site-detail-card">
            <div className="site-card-top">
              <div className={`site-monogram large status-${site.status}`}>{site.name.charAt(0)}</div>
              <span className={`site-status-label status-${site.status}`}>{site.status === "healthy" ? "Sağlıklı" : site.status === "attention" ? "Dikkat" : site.status === "critical" ? "Kritik" : "Taranıyor"}</span>
            </div>
            <div className="site-card-copy"><h3>{site.name}</h3><span>{site.domain}</span><small>{site.market} · {site.language}</small></div>
            <div className="site-score-row">
              <ScoreRing value={site.healthScore} size={68} tone={site.healthScore >= 85 ? "green" : site.healthScore >= 70 ? "orange" : "red"} />
              <div><span>Teknik sağlık</span><strong>{site.openIssues} açık sorun</strong><small>{site.criticalIssues ? `${site.criticalIssues} kritik bulgu` : "Kritik bulgu yok"}</small></div>
            </div>
            <div className="site-card-metrics">
              <div><span>Visibility</span><strong>{site.visibilityScore ?? "—"}</strong></div>
              <div><span>Performance</span><strong>{site.performanceScore ?? "—"}</strong></div>
              <div><span>axe erişilebilirlik</span><strong>{site.accessibilityScore ?? "—"}</strong></div>
            </div>
            <div className="site-card-footer"><span>{site.lastScanAt ? `Son tarama ${new Date(site.lastScanAt).toLocaleString("tr-TR")}` : "Henüz taranmadı"}</span><button onClick={() => onSelectSite(site.id)}>Siteyi aç <ChevronRight size={14} /></button></div>
          </article>
        ))}
        <button className="add-site-card" onClick={onAddSite}>
          <span><Plus size={22} /></span><strong>Yeni site ekle</strong><small>Domain ve hedef pazarı tanımla</small>
        </button>
      </section>
    </div>
  );
}

export function VisibilityPage({ activeSite }: { activeSite: SiteSummary }) {
  const [series,setSeries]=useState<VisibilitySnapshot[]>([]); const [metric,setMetric]=useState<"score"|"top10"|"top3">("score"); useEffect(()=>{void api.visibility(activeSite.id).then(setSeries);},[activeSite.id]);
  const values=series.map((item)=>metric === "score" ? item.score : metric === "top10" ? item.top10 : item.top3); const minimum=Math.min(...values,0); const maximum=Math.max(...values,metric === "score" ? 100 : 1); const chartPoints=values.length>1?values.map((value,index)=>`${(index/(values.length-1))*720},${210-((value-minimum)/Math.max(1,maximum-minimum))*180}`).join(" "):""; const current=series.at(-1);
  const exportCsv=()=>downloadText(`${activeSite.domain}-visibility.csv`,["date,score,tracked,measured,top3,top10",...series.map((item)=>[item.date,item.score,item.tracked,item.measured,item.top3,item.top10].join(","))].join("\n"),"text/csv;charset=utf-8");
  const currentValue=current ? metric === "score" ? `${current.score}%` : String(metric === "top10" ? current.top10 : current.top3) : "Ölçülmedi";
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="section-kicker">Organik arama</span><h2>Search visibility</h2><p>{activeSite.name} için konum, cihaz ve SERP özelliği ağırlıklı görünürlük.</p></div><button className="secondary-button" disabled={!series.length} onClick={exportCsv}><Download size={16} /> CSV dışa aktar</button></section>
      <section className="visibility-summary-grid">
        <article className="surface-card visibility-hero-card">
          <div className="card-heading"><div><span className="section-kicker">Son 12 hafta</span><h3>Görünürlük trendi</h3></div><div className="chart-filter"><button className={metric === "score" ? "is-active" : ""} onClick={()=>setMetric("score")}>Visibility</button><button className={metric === "top10" ? "is-active" : ""} onClick={()=>setMetric("top10")}>Top 10</button><button className={metric === "top3" ? "is-active" : ""} onClick={()=>setMetric("top3")}>Top 3</button></div></div>
          <div className="visibility-number"><strong>{currentValue}</strong>{current && <span className="metric-change positive"><CircleDot size={14} /> {current.measured}/{current.tracked} keyword</span>}</div>
          <div className="main-line-chart">
            <div className="chart-y-labels"><span>{maximum}</span><span>{Math.round(maximum*.66)}</span><span>{Math.round(maximum*.33)}</span><span>{minimum}</span></div>
            <svg viewBox="0 0 720 220" preserveAspectRatio="none" aria-label="12 haftalık görünürlük grafiği">
              <defs><linearGradient id="visibilityArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a84ff" stopOpacity=".2"/><stop offset="1" stopColor="#0a84ff" stopOpacity="0"/></linearGradient></defs>
              {[20, 75, 130, 185].map((y) => <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="#e5e5ea" strokeWidth="1" />)}
              {chartPoints && <><polygon points={`0,220 ${chartPoints} 720,220`} fill="url(#visibilityArea)" /><polyline points={chartPoints} fill="none" stroke="#0a84ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>}
            </svg>
            <div className="chart-x-labels">{series.length ? series.filter((_item,index)=>index===0||index===series.length-1||index%Math.max(1,Math.floor(series.length/3))===0).map((item)=><span key={item.date}>{new Date(item.date).toLocaleDateString("tr-TR",{day:"numeric",month:"short"})}</span>) : <span>SERP connector yapılandırıldığında günlük ölçümler burada görünür.</span>}</div>
          </div>
        </article>
        <aside className="visibility-side-stats">
          <article className="surface-card compact-stat"><span><Target size={17} /> Top 3</span><strong>{current?.top3 ?? "—"}</strong><small>Ölçülen keyword</small></article>
          <article className="surface-card compact-stat"><span><TrendingUp size={17} /> Top 10</span><strong>{current?.top10 ?? "—"}</strong><small>Ölçülen keyword</small></article>
          <article className="surface-card compact-stat"><span><Globe2 size={17} /> Share of voice</span><strong>—</strong><small>Rakip SERP ölçümü gerekli</small></article>
        </aside>
      </section>
      <section className="surface-card topic-table-card">
        <div className="card-heading"><div><span className="section-kicker">Konu performansı</span><h3>Keyword kümeleri</h3></div><a className="text-button" href="/keywords">Keyword’lere git <ChevronRight size={15}/></a></div>
        <div className="empty-state"><Target size={25}/><strong>Küme ölçümü bekleniyor</strong><span>Keyword’lere cluster atandığında konu görünürlüğü hesaplanır.</span></div>
      </section>
    </div>
  );
}

export function KeywordsPage({ activeSite }: { activeSite: SiteSummary }) {
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState(false);
  const [measurement, setMeasurement] = useState<"all" | "measured" | "unmeasured">("all");
  const load = () => api.keywords(activeSite.id).then(setKeywords);
  useEffect(() => { void api.keywords(activeSite.id).then(setKeywords); }, [activeSite.id]);
  const add = async () => { if (!term.trim()) return; await api.createKeyword({ siteId: activeSite.id, term, locale: "tr-TR", device: "mobile", location: activeSite.market }); setTerm(""); setAdding(false); await load(); };
  const filtered = keywords.filter((keyword) => keyword.term.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")) && (measurement === "all" || (measurement === "measured" ? keyword.position !== null : keyword.position === null)));
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="section-kicker">Arama talebi</span><h2>Keyword sistemi</h2><p>Keyword evrenini intent, konu, pazar, cihaz ve hedef URL ile birlikte yönet.</p></div><button className="primary-button" onClick={() => setAdding((value) => !value)}><Plus size={17} /> Keyword ekle</button></section>
      {adding && <section className="surface-card inline-create"><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Örn. teknik seo danışmanlığı" onKeyDown={(event) => event.key === "Enter" && void add()} /><button className="primary-button" onClick={() => void add()}>Ekle</button></section>}
      <section className="keyword-stats">
        <div className="surface-card"><span>Takip edilen</span><strong>{keywords.length}</strong><small>Aktif keyword</small></div>
        <div className="surface-card"><span>Top 10</span><strong>{keywords.filter((item) => item.position !== null && item.position <= 10).length}</strong><small>Son sağlayıcı ölçümü</small></div>
        <div className="surface-card"><span>Tahmini hacim</span><strong>{keywords.reduce((sum,item) => sum + (item.searchVolume ?? 0), 0).toLocaleString("tr-TR")}</strong><small>Sağlayıcı verisi varsa</small></div>
        <div className="surface-card"><span>Ölçülmeyen</span><strong>{keywords.filter((item) => item.position === null).length}</strong><small>Connector yapılandırması gerekli</small></div>
      </section>
      <section className="surface-card data-table-card keyword-table-card">
        <div className="table-toolbar"><label className="table-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Keyword ara" /></label><label className="compact-select"><ListFilter size={15}/><select aria-label="Keyword ölçüm filtresi" value={measurement} onChange={(event)=>setMeasurement(event.target.value as typeof measurement)}><option value="all">Tüm keyword’ler</option><option value="measured">Ölçülenler</option><option value="unmeasured">Ölçülmeyenler</option></select></label></div>
        <div className="keyword-table-head"><span>Keyword</span><span>Konum</span><span>Değişim</span><span>Hacim</span><span>Intent</span><span>Hedef URL</span></div>
        {filtered.map((keyword) => {
          const change = keyword.position !== null && keyword.previousPosition !== null ? keyword.previousPosition - keyword.position : null;
          return <div className="keyword-row" key={keyword.id}>
            <div><strong>{keyword.term}</strong><span>{keyword.locale} · {keyword.location} · {keyword.device}</span></div>
            <strong className="rank-position">{keyword.position ?? "—"}</strong>
            <span className={(change ?? 0) > 0 ? "positive" : (change ?? 0) < 0 ? "negative" : "neutral"}>{change === null || change === 0 ? "—" : change > 0 ? <><ArrowUpRight size={14}/>{change}</> : <><ArrowDownRight size={14}/>{Math.abs(change)}</>}</span>
            <span>{keyword.searchVolume?.toLocaleString("tr-TR") ?? "—"}</span><span className="intent-chip">{keyword.intent ?? "Belirsiz"}</span><code>{keyword.targetUrl ?? "—"}</code>
          </div>;
        })}
        {filtered.length === 0 && <div className="empty-state"><KeyRound size={26}/><strong>Keyword yok</strong><span>İlk takip terimini ekleyin.</span></div>}
      </section>
    </div>
  );
}

export function CompetitorsPage({ activeSite }: { activeSite: SiteSummary }) {
  const [competitors, setCompetitors] = useState<CompetitorSummary[]>([]);
  const [selected, setSelected] = useState<CompetitorSummary | null>(null);
  const [adding, setAdding] = useState(false); const [name, setName] = useState(""); const [origin, setOrigin] = useState("https://");
  const load = () => api.competitors(activeSite.id).then(setCompetitors);
  useEffect(() => { void api.competitors(activeSite.id).then(setCompetitors); }, [activeSite.id]);
  const add = async () => { await api.createCompetitor({ siteId: activeSite.id, name, origin, kind: "organic" }); setAdding(false); setName(""); setOrigin("https://"); await load(); };
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="section-kicker">Pazar karşılaştırması</span><h2>Rakipler</h2><p>İş, organik ve içerik rakiplerini ölçülebilir faktörlerle karşılaştır.</p></div><button className="primary-button" onClick={() => setAdding((value) => !value)}><Plus size={17}/> Rakip ekle</button></section>
      {adding && <section className="surface-card inline-create"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rakip adı"/><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://rakip.com"/><button className="primary-button" onClick={() => void add()}>Ekle</button></section>}
      <section className="surface-card competitor-matrix">
        <div className="card-heading"><div><span className="section-kicker">Keyword overlap</span><h3>Rekabet haritası</h3></div><span className="data-source-note"><CircleDot size={13}/> {competitors.filter((item)=>item.overlap!==null&&item.visibility!==null).length} rakip ölçüldü</span></div>
        <div className="competitor-plot" aria-label="Rakip görünürlük ve keyword örtüşme grafiği">
          <span className="plot-axis-y">Yüksek visibility</span><span className="plot-axis-x">Yüksek keyword örtüşmesi</span>
          <div className="plot-line vertical"/><div className="plot-line horizontal"/>
          {activeSite.visibilityScore!==null&&<div className="plot-bubble own" style={{left:"90%",top:`${Math.max(5,90-activeSite.visibilityScore)}%`}}><span>{activeSite.name.charAt(0)}</span><strong>{activeSite.name}</strong></div>}
          {competitors.filter((item) => item.overlap !== null && item.visibility !== null).map((competitor, index) => <div key={competitor.id} className={`plot-bubble competitor c${index + 1}`} style={{left:`${competitor.overlap}%`,top:`${90 - (competitor.visibility ?? 0)}%`}}><span>{competitor.name.charAt(0)}</span><strong>{competitor.name}</strong></div>)}
          {competitors.every((item) => item.overlap === null) && <div className="unmeasured-note">SERP sağlayıcısı bağlandığında ölçüm noktaları burada görünür.</div>}
        </div>
      </section>
      <section className="competitor-card-grid">
        {competitors.map((competitor, index) => <article className="surface-card competitor-card" key={competitor.id}>
          <div className="competitor-card-head"><div className={`competitor-avatar c${index + 1}`}>{competitor.name.charAt(0)}</div><div><h3>{competitor.name}</h3><span>{new URL(competitor.origin).hostname}</span></div><button className="more-button" aria-label={`${competitor.name} rakibini sil`} onClick={() => { if(window.confirm(`${competitor.name} rakibini silmek istediğinize emin misiniz?`)) void api.deleteCompetitor(competitor.id).then(load); }}><Trash2 size={16}/></button></div>
          <div className="competitor-stat-row"><div><span>Visibility</span><strong>{competitor.visibility === null ? "—" : `${competitor.visibility}%`}</strong></div><div><span>Overlap</span><strong>{competitor.overlap === null ? "—" : `${competitor.overlap}%`}</strong></div><div><span>Top 10</span><strong>{competitor.top10 ?? "—"}</strong></div></div>
          <div className="competitor-insight"><Sparkles size={16}/><p><strong>Öne çıktığı alan</strong><span>Karşılaştırmalı tarama ve SERP kanıtı sonrası hesaplanacak.</span></p></div>
          <button className="full-text-button" onClick={()=>setSelected(competitor)}>Kanıtlı karşılaştırmayı aç <ArrowRight size={15}/></button>
        </article>)}{competitors.length === 0 && <button className="add-site-card" onClick={() => setAdding(true)}><span><Plus size={22}/></span><strong>İlk rakibi ekle</strong><small>Rakip neden önde sorusunu kanıtlarla incele</small></button>}
      </section>
      {selected && <div className="intelligence-drawer-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&setSelected(null)}><aside className="intelligence-drawer" role="dialog" aria-modal="true" aria-labelledby="competitor-title"><button className="modal-close" onClick={()=>setSelected(null)} aria-label="Kapat">×</button><span className="section-kicker">Kanıtlı rakip karşılaştırması</span><h2 id="competitor-title">{activeSite.name} ↔ {selected.name}</h2><section className="evidence-section"><span>Ölçülen görünürlük</span><p>{selected.visibility === null ? "Henüz ortak SERP ölçümü bulunmuyor." : `${selected.name} görünürlük skoru: %${selected.visibility}.`}</p></section><section className="evidence-section"><span>Keyword örtüşmesi</span><p>{selected.overlap === null ? "Her iki domain için ölçülmüş ortak keyword seti bekleniyor." : `İzlenen sorguların %${selected.overlap} oranında örtüştüğü gözlendi.`}</p></section><section className="evidence-section"><span>Top 10 kapsamı</span><p>{selected.top10 === null ? "Sağlayıcı konum verisi henüz oluşmadı." : `${selected.name}, ölçülen keyword’lerin ${selected.top10} tanesinde ilk 10 sonuçta.`}</p></section><div className="methodology-note"><BadgeCheck size={17}/><div><strong>Çıkarım sınırı</strong><span>Bu karşılaştırma yalnızca sistemde izlenen sorgulara ve dış SERP ölçümlerine dayanır; rakibin Analytics, Search Console veya gelir verisi değildir.</span></div></div><div className="drawer-actions"><a className="secondary-button" href={selected.origin} target="_blank" rel="noreferrer">Rakip siteyi aç</a><button className="primary-button" onClick={()=>setSelected(null)}>Tamam</button></div></aside></div>}
    </div>
  );
}

export function AdsStudioPage({ activeSite }: { activeSite: SiteSummary }) {
  const [briefs, setBriefs] = useState<AdBrief[]>([]); const [creating, setCreating] = useState(false); const [platform, setPlatform] = useState<"google"|"meta">("google");
  const [previewMode,setPreviewMode]=useState<"json"|"creative"|"test">("json"); const[busy,setBusy]=useState(false); const[error,setError]=useState<string|null>(null); const studioRef=useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({ name: "", objective: "Nitelikli trafik", audience: "Hedef müşteri", offer: "Ürün veya hizmet teklifini inceleyin" });
  const load = () => api.adBriefs(activeSite.id).then(setBriefs);
  useEffect(() => { void api.adBriefs(activeSite.id).then(setBriefs); }, [activeSite.id]);
  const create = async (event?:React.FormEvent) => { event?.preventDefault(); if(!form.name.trim())return;setBusy(true);setError(null);try{await api.createAdBrief({ siteId: activeSite.id, platform, ...form }); setCreating(false);setPreviewMode("json"); await load();}catch(reason){setError(reason instanceof Error?reason.message:"Brief oluşturulamadı.");}finally{setBusy(false);} };
  const openStudio=(nextPlatform:"google"|"meta")=>{setPlatform(nextPlatform);setCreating(true);window.setTimeout(()=>studioRef.current?.scrollIntoView({behavior:"smooth",block:"center"}),0);};
  const latest = briefs.find((brief)=>brief.platform===platform) ?? null;
  const googleBriefs=briefs.filter((brief)=>brief.platform==="google"); const metaBriefs=briefs.filter((brief)=>brief.platform==="meta");
  const googleGroups=googleBriefs.reduce((sum,brief)=>sum+arrayLength(brief.content.adGroups),0); const metaConcepts=metaBriefs.reduce((sum,brief)=>sum+arrayLength(brief.content.concepts),0);
  const exportLatest=()=>{if(latest)downloadText(`${activeSite.domain}-${latest.platform}-${slug(latest.name)}.json`,JSON.stringify(latest,null,2),"application/json");};
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="section-kicker">Üretim alanı</span><h2>Ads Studio</h2><p>Keyword ve landing page kanıtlarından kontrollü kampanya taslakları üret.</p></div><button className="primary-button" onClick={() => setCreating((value) => !value)}><Sparkles size={17}/> Yeni brief oluştur</button></section>
      {creating && <form ref={studioRef as React.RefObject<HTMLFormElement>} className="surface-card brief-form" onSubmit={(event)=>void create(event)}><div className="chart-filter"><button type="button" className={platform === "google" ? "is-active" : ""} onClick={() => setPlatform("google")}>Google</button><button type="button" className={platform === "meta" ? "is-active" : ""} onClick={() => setPlatform("meta")}>Meta</button></div><input required placeholder="Brief adı" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})}/><input required placeholder="Hedef" value={form.objective} onChange={(e) => setForm({...form,objective:e.target.value})}/><input required placeholder="Kitle" value={form.audience} onChange={(e) => setForm({...form,audience:e.target.value})}/><textarea required placeholder="Teklif" value={form.offer} onChange={(e) => setForm({...form,offer:e.target.value})}/><button className="primary-button" disabled={busy}>{busy?"Üretiliyor…":"Kanıtlı taslak üret"}</button>{error&&<div className="scan-error" role="alert">{error}</div>}</form>}
      <section className="studio-platforms">
        <article className="surface-card platform-card google-card"><div className="platform-icon"><Search size={23}/></div><div><span>Google Ads Studio</span><h3>Arama talebini kampanya yapısına dönüştür</h3><p>Ad group, RSA, negatif keyword, asset ve landing page eşleştirmeleri.</p></div><div className="platform-stats"><span><strong>{googleBriefs.length}</strong> gerçek brief</span><span><strong>{googleGroups}</strong> ad group taslağı</span></div><button onClick={()=>openStudio("google")}>Studio’yu aç <ArrowRight size={16}/></button></article>
        <article className="surface-card platform-card meta-card"><div className="platform-icon"><Megaphone size={23}/></div><div><span>Meta Ads Studio</span><h3>Kanıtlı açılardan kreatif sistemleri kur</h3><p>Hook, vaat, itiraz, format ve CTA matrisleriyle kontrollü üretim.</p></div><div className="platform-stats"><span><strong>{metaBriefs.length}</strong> gerçek brief</span><span><strong>{metaConcepts}</strong> kreatif konsept</span></div><button onClick={()=>openStudio("meta")}>Studio’yu aç <ArrowRight size={16}/></button></article>
      </section>
      <section className="studio-workspace">
        <article className="surface-card brief-builder">
          <div className="card-heading"><div><span className="section-kicker">Aktif brief</span><h3>{latest?.name ?? "Henüz brief oluşturulmadı"}</h3></div><span className="draft-chip">{latest?.status ?? "Boş"}</span></div>
          <div className="brief-flow">
            {[{icon:Target,label:"Hedef",value:latest?.objective ?? "—"},{icon:KeyRound,label:"Kanıt",value:`${latest?.evidenceRefs.length ?? 0} kaynak`},{icon:PencilLine,label:"Platform",value:latest?.platform ?? "—"},{icon:LayoutGrid,label:"Durum",value:latest?.status ?? "—"}].map((step,index)=><div key={step.label} className="brief-step"><span><step.icon size={18}/></span><div><small>0{index+1} · {step.label}</small><strong>{step.value}</strong></div>{index<3&&<ChevronRight size={15}/>}</div>)}
          </div>
          <div className="brief-evidence"><BadgeCheck size={18}/><div><strong>{latest ? "Kanıt referansları bağlı" : "Veri bekleniyor"}</strong><span>{latest ? `${latest.evidenceRefs.length} keyword/bulgu referansı · Ads hesabı performansı iddia edilmez` : "Keyword ekleyin ve bir brief oluşturun"}</span></div></div>
        </article>
        <aside className="surface-card creative-preview"><div className="preview-toolbar"><span>{previewMode==="json"?"Üretilen JSON":previewMode==="creative"?"Kreatif görünüm":"Test planı"}</span><div><button aria-label="JSON görünümü" className={previewMode==="json"?"is-active":""} onClick={()=>setPreviewMode("json")}><MonitorSmartphone size={15}/></button><button aria-label="Kreatif görünümü" className={previewMode==="creative"?"is-active":""} onClick={()=>setPreviewMode("creative")}><Image size={15}/></button><button aria-label="Test planı görünümü" className={previewMode==="test"?"is-active":""} onClick={()=>setPreviewMode("test")}><Play size={15}/></button></div></div><div className="ad-preview"><small>{latest ? `${latest.platform.toUpperCase()} taslağı · ${activeSite.domain}` : "Taslak yok"}</small><h3>{latest?.offer ?? "Yeni bir brief oluşturun"}</h3><pre>{latest ? previewContent(latest,previewMode) : "Kampanya önerileri burada görünür."}</pre></div><button className="secondary-button" disabled={!latest} onClick={exportLatest}><Download size={16}/> JSON dışa aktar</button></aside>
      </section>
    </div>
  );
}

export function ReportsPage({ activeSite }: { activeSite: SiteSummary }) {
  const [reports, setReports] = useState<Array<{ id:string; title:string; kind:string; status:string; createdAt:string }>>([]); const [busy,setBusy]=useState(false);const[notice,setNotice]=useState<string|null>(null);
  const load=()=>api.reports(activeSite.id).then(setReports); useEffect(()=>{void api.reports(activeSite.id).then(setReports);},[activeSite.id]);
  const create=async(kind:"executive"|"technical"|"competitor"|"ads",title:string)=>{setBusy(true);try{await api.createReport({siteId:activeSite.id,title:`${activeSite.name} — ${title}`,kind});await load();}finally{setBusy(false);}};
  const templates=[{icon:Gauge,title:"Yönetici özeti",kind:"executive" as const,desc:"Değişim, risk ve öncelikli kararlar"},{icon:FileText,title:"Teknik denetim",kind:"technical" as const,desc:"Kanıt, çözüm ve doğrulama kriterleri"},{icon:UsersRound,title:"Rakip fırsatları",kind:"competitor" as const,desc:"Visibility, içerik ve SERP karşılaştırması"},{icon:Megaphone,title:"Ads brief",kind:"ads" as const,desc:"Kampanya yapısı ve kreatif hipotezleri"}];
  const share=async(reportId:string)=>{const result=await api.shareReport(reportId);const copied=await copyText(result.url);setNotice(copied?"14 gün geçerli bağlantı kopyalandı.":`Bağlantı oluşturuldu: ${result.url}`);};
  return <div className="page-stack"><section className="page-intro"><div><span className="section-kicker">Teslimatlar</span><h2>Raporlar</h2><p>Kanıtları erişim kontrollü PDF teslimatlarına dönüştür.</p></div><span className="data-source-note">{busy ? "PDF hazırlanıyor…" : `${reports.length} rapor`}</span></section>{notice&&<div className="scan-safety-note" role="status"><BadgeCheck size={16}/><span>{notice}</span></div>}<section className="report-template-grid">{templates.map((template)=><button disabled={busy} onClick={()=>void create(template.kind,template.title)} className="surface-card report-template" key={template.title}><span><template.icon size={20}/></span><strong>{template.title}</strong><small>{template.desc}</small><Plus size={16}/></button>)}</section><section className="surface-card reports-list"><div className="card-heading"><div><span className="section-kicker">Son raporlar</span><h3>Hazır dosyalar</h3></div></div>{reports.map(report=><div className="report-row" key={report.id}><span className="report-file-icon"><FileText size={18}/></span><div><strong>{report.title}</strong><span>{report.kind} · {new Date(report.createdAt).toLocaleString("tr-TR")}</span></div><span className="report-status ready">Hazır</span><button className="icon-button" onClick={()=>void share(report.id)} aria-label="Paylaşım bağlantısı oluştur"><UsersRound size={16}/></button><a className="icon-button" href={`/api/reports/${report.id}/download`} aria-label="PDF indir"><Download size={16}/></a></div>)}{reports.length===0&&<div className="empty-state"><FileText size={25}/><strong>Henüz rapor yok</strong><span>Yukarıdaki şablonlardan PDF oluşturun.</span></div>}</section></div>;
}

export function SettingsPage({ activeSite }: { activeSite: SiteSummary }) {
  const [mode,setMode]=useState<"quick"|"standard"|"deep">("standard");const[intervalHours,setIntervalHours]=useState(168);const[enabled,setEnabled]=useState(true);const[saved,setSaved]=useState<string|null>(null);
  useEffect(()=>{setMode("standard");setIntervalHours(168);setEnabled(true);setSaved(null);api.auditSchedule(activeSite.id).then((schedule)=>{if(schedule){setMode(schedule.mode);setIntervalHours(schedule.intervalHours);setEnabled(schedule.enabled);setSaved(`Sonraki çalışma: ${new Date(schedule.nextRunAt).toLocaleString("tr-TR")}`);}});},[activeSite.id]);
  const save=async()=>{await api.saveAuditSchedule(activeSite.id,{mode,intervalHours,enabled});setSaved("Zamanlama kaydedildi.");};
  return <div className="page-stack"><section className="page-intro"><div><span className="section-kicker">Çalışma alanı</span><h2>Ayarlar</h2><p>Gerçek worker zamanlamasını ve tarama politikasını yönet.</p></div></section><section className="settings-layout"><nav className="surface-card settings-nav" aria-label="Kullanılabilir ayarlar"><div className="settings-nav-label is-active"><Bot size={17}/>Tarama politikası<BadgeCheck size={14}/></div><p>Bu sürümde API’ye bağlı site ayarı otomatik tarama politikasıdır. Ekip ve marka kontrolleri, gerçek yönetim API’leri eklenmeden gösterilmez.</p></nav><article className="surface-card settings-panel"><div><span className="section-kicker">{activeSite.name}</span><h3>Otomatik dış denetim</h3><p>Worker, zamanı geldiğinde tenant izolasyonlu bir koşu oluşturur.</p></div><label><span>Tarama profili</span><select value={mode} onChange={(e)=>setMode(e.target.value as typeof mode)}><option value="quick">Hızlı</option><option value="standard">Standart</option><option value="deep">Derin</option></select></label><label><span>Tekrar aralığı</span><select value={intervalHours} onChange={(e)=>setIntervalHours(Number(e.target.value))}><option value={24}>Her gün</option><option value={168}>Her hafta</option><option value={720}>Her 30 gün</option></select></label><div className="setting-toggle-row"><div><strong>Otomatik tarama</strong><span>{saved ?? "Zamanlama henüz kaydedilmedi."}</span></div><button onClick={()=>setEnabled((value)=>!value)} className={`toggle ${enabled?"is-on":""}`} aria-label={`Otomatik tarama ${enabled?"açık":"kapalı"}`}><span/></button></div><div className="panel-actions"><button className="primary-button" onClick={()=>void save()}>Zamanlamayı kaydet</button></div></article></section></div>;
}

function arrayLength(value: unknown): number { return Array.isArray(value) ? value.length : 0; }
function slug(value: string): string { return value.toLocaleLowerCase("tr").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").slice(0,60) || "brief"; }
function previewContent(brief: AdBrief, mode: "json"|"creative"|"test"): string {
  if(mode==="json")return JSON.stringify(brief.content,null,2);
  if(mode==="creative")return JSON.stringify(brief.platform==="google"?{adGroups:brief.content.adGroups}:{concepts:brief.content.concepts},null,2);
  return JSON.stringify(brief.platform==="google"?{negativeKeywordHypotheses:brief.content.negativeKeywordHypotheses,constraints:brief.content.constraints,disclaimer:brief.content.disclaimer}:{testPlan:brief.content.testPlan,disclaimer:brief.content.disclaimer},null,2);
}
