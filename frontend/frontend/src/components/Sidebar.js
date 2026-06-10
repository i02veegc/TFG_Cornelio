'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

const items = [
  { href: '/', label: 'Inicio', icon: 'bi-house-door' },
  { href: '/obras', label: 'Obras', icon: 'bi-palette' },
  { href: '/ventas', label: 'Ventas', icon: 'bi-cash-coin' },
  { href: '/ferias', label: 'Ferias', icon: 'bi-shop' },
];

export default function Sidebar({ collapsed, setCollapsed, isMobile, width }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const showLabels = isMobile || !collapsed;
  const hidden = isMobile && collapsed;

  const handleLinkClick = () => {
    if (isMobile) setCollapsed(true);
  };

  return (
    <aside
      className={`${styles.sidebar} ${hidden ? styles.hidden : ''}`}
      style={{ width }}
    >
      <div className={`${styles.header} ${!showLabels ? styles.headerCollapsed : ''}`}>
        {showLabels && <span className={styles.brand}>Metaverso TFG</span>}
        <button
          className={styles.toggle}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <i className={`bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}`}></i>
        </button>
      </div>

      <nav className={styles.nav}>
        {items.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.link} ${isActive(href) ? styles.active : ''}`}
            title={!showLabels ? label : undefined}
            onClick={handleLinkClick}
          >
            <i className={`bi ${icon}`}></i>
            {showLabels && <span>{label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
