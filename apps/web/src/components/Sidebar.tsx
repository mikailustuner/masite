import {
  BarChart3,
  Blocks,
  ChartNoAxesCombined,
  Clock3,
  FileText,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Target,
  Route,
  UsersRound,
  X,
} from "lucide-react";

export type PageId =
  | "overview"
  | "sites"
  | "issues"
  | "visibility"
  | "keywords"
  | "competitors"
  | "intelligence"
  | "journeys"
  | "ads"
  | "reports"
  | "settings";

interface SidebarProps {
  activePage: PageId;
  isOpen: boolean;
  onNavigate: (page: PageId) => void;
  onClose: () => void;
  siteCount: number;
  issueCount: number;
  userName: string;
  role: string;
}

const primaryItems = [
  { id: "overview" as const, label: "Genel Bakış", icon: LayoutDashboard },
  { id: "sites" as const, label: "Siteler", icon: Blocks },
  { id: "issues" as const, label: "Sorunlar", icon: ShieldCheck },
  { id: "visibility" as const, label: "Görünürlük", icon: ChartNoAxesCombined },
  { id: "keywords" as const, label: "Keyword’ler", icon: KeyRound },
  { id: "competitors" as const, label: "Rakipler", icon: UsersRound },
  { id: "intelligence" as const, label: "Intelligence", icon: Clock3 },
  { id: "journeys" as const, label: "Yolculuklar", icon: Route },
];

const workspaceItems = [
  { id: "ads" as const, label: "Ads Studio", icon: Megaphone },
  { id: "reports" as const, label: "Raporlar", icon: FileText },
];

export function Sidebar({ activePage, isOpen, onNavigate, onClose, siteCount, issueCount, userName, role }: SidebarProps) {
  const navigate = (page: PageId) => {
    onNavigate(page);
    onClose();
  };

  return (
    <>
      <button
        className={`sidebar-scrim ${isOpen ? "is-visible" : ""}`}
        onClick={onClose}
        aria-label="Menüyü kapat"
      />
      <aside className={`sidebar ${isOpen ? "is-open" : ""}`} aria-label="Ana menü">
        <div className="brand-row">
          <button className="brand-mark" onClick={() => navigate("overview")} aria-label="Evidera ana sayfa">
            <Gauge size={19} strokeWidth={2.2} />
          </button>
          <button className="brand-copy" onClick={() => navigate("overview")}>
            <span>Evidera</span>
            <small>Site Intelligence</small>
          </button>
          <button className="sidebar-close" onClick={onClose} aria-label="Menüyü kapat">
            <X size={19} />
          </button>
        </div>

        <nav className="nav-groups">
          <div className="nav-group">
            <p className="nav-label">Çalışma alanı</p>
            {primaryItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "is-active" : ""}`}
                onClick={() => navigate(item.id)}
                aria-current={activePage === item.id ? "page" : undefined}
              >
                <item.icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
                {item.id === "sites" && <small>{siteCount}</small>}{item.id === "issues" && <small>{issueCount}</small>}
              </button>
            ))}
          </div>

          <div className="nav-group">
            <p className="nav-label">Üretim</p>
            {workspaceItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "is-active" : ""}`}
                onClick={() => navigate(item.id)}
                aria-current={activePage === item.id ? "page" : undefined}
              >
                <item.icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-insight">
          <div className="insight-icon"><Target size={17} /></div>
          <div>
            <strong>Kanıt merkezi aktif</strong>
            <span>{siteCount} site · {issueCount} açık bulgu</span>
          </div>
          <BarChart3 size={17} className="insight-arrow" />
        </div>

        <div className="sidebar-footer">
          <button className={`nav-item ${activePage === "settings" ? "is-active" : ""}`} onClick={() => navigate("settings")}>
            <Settings size={18} strokeWidth={1.9} />
            <span>Ayarlar</span>
          </button>
          <div className="profile-row">
            <div className="avatar">{userName.split(/\s+/).map((part)=>part[0]).join("").slice(0,2).toLocaleUpperCase("tr")}</div>
            <div>
              <strong>{userName}</strong>
              <span>{role}</span>
            </div>
            <PanelLeftClose size={17} />
          </div>
        </div>
      </aside>
    </>
  );
}
