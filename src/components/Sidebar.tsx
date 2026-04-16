import { History, LayoutGrid, RadioTower, Settings2 } from 'lucide-react';
import { motion } from 'framer-motion';

type TabId = 'servers' | 'subscriptions' | 'history' | 'settings';
interface SidebarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  title: string;
  subtitle: string;
  labels: Record<TabId, string>;
}

export function Sidebar({ activeTab, onChange, title, subtitle, labels }: SidebarProps): JSX.Element {
  const items: Array<{ id: TabId; icon: JSX.Element }> = [
    { id: 'servers', icon: <LayoutGrid size={18} /> },
    { id: 'subscriptions', icon: <RadioTower size={18} /> },
    { id: 'history', icon: <History size={18} /> },
    { id: 'settings', icon: <Settings2 size={18} /> }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__logo">C</div>
        <div>
          <div className="brand__title">{title}</div>
          <div className="brand__subtitle">{subtitle}</div>
        </div>
      </div>
      <nav className="sidebar__nav">
        {items.map((item) => {
          const active = item.id === activeTab;
          return (
            <button key={item.id} type="button" className={`sidebar__item ${active ? 'is-active' : ''}`} onClick={() => onChange(item.id)}>
              {active && <motion.div layoutId="sidebar-pill" className="sidebar__pill" />}
              <span className="sidebar__item-icon">{item.icon}</span>
              <span className="sidebar__item-label">{labels[item.id]}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
