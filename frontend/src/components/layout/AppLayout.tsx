import { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-is-open' : 'sidebar-is-collapsed'}`}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-main">{children}</main>
      </div>
    </div>
  )
}
