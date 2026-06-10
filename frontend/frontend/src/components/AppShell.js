'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

const SIDEBAR_WIDTH = 200;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const SIDEBAR_MOBILE_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export default function AppShell({ children }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  const sidebarWidth = isMobile
    ? SIDEBAR_MOBILE_WIDTH
    : collapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_WIDTH;

  return (
    <div className={styles.shell}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        width={sidebarWidth}
      />

      {isMobile && collapsed && (
        <button
          className={styles.hamburger}
          onClick={() => setCollapsed(false)}
          aria-label="Abrir menú"
        >
          <i className="bi bi-list"></i>
        </button>
      )}

      {isMobile && !collapsed && (
        <div
          className={styles.backdrop}
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <main
        className={`container-fluid mt-4 ${styles.main}`}
        style={{ '--sidebar-width': `${sidebarWidth}px` }}
      >
        {children}
      </main>
    </div>
  );
}
