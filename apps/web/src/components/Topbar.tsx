import { ChevronDown, Menu, Plus } from "lucide-react";
import type { SiteSummary } from "@evidera/contracts";

interface TopbarProps {
  sites: SiteSummary[];
  activeSite: SiteSummary;
  title: string;
  onSiteChange: (siteId: string) => void;
  onMenuOpen: () => void;
  onNewScan: () => void;
}

export function Topbar({ sites, activeSite, title, onSiteChange, onMenuOpen, onNewScan }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="menu-button" onClick={onMenuOpen} aria-label="Menüyü aç">
          <Menu size={20} />
        </button>
        <div>
          <span className="eyebrow">Portföy</span>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="site-switcher">
          <span className={`site-dot status-${activeSite.status}`} />
          <select value={activeSite.id} onChange={(event) => onSiteChange(event.target.value)} aria-label="Aktif site">
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
        <button className="primary-button" onClick={onNewScan} aria-label="Yeni tarama başlat">
          <Plus size={17} />
          <span>Yeni tarama</span>
        </button>
      </div>
    </header>
  );
}
