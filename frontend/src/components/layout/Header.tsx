import { Bell, Menu, Search, Sun } from 'lucide-react'

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick}>
        <Menu size={21} />
      </button>

      <div className="breadcrumb">
        <span>LogiSense</span>
        <b>/</b>
        <strong>Overview</strong>
      </div>

      <div className="topbar-actions">
        <div className="search-box">
          <Search size={17} />
          <input placeholder="Search analytics..." />
          <kbd>⌘ K</kbd>
        </div>

        <button className="icon-button" title="Theme">
          <Sun size={18} />
        </button>

        <button className="icon-button notification" title="Notifications">
          <Bell size={18} />
          <i />
        </button>

        <div className="avatar">AD</div>
      </div>
    </header>
  )
}
