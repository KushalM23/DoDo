import React from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {useAuth} from '@/providers/AuthContext';

const NAV_ITEMS: {to: string; label: string; icon: AppIconName}[] = [
  {to: '/habits', label: 'Habits', icon: 'repeat'},
  {to: '/notes', label: 'Notes', icon: 'file-text'},
  {to: '/tasks', label: 'Tasks', icon: 'check-square'},
  {to: '/calendar', label: 'Calendar', icon: 'calendar'},
  {to: '/profile', label: 'Profile', icon: 'user'},
];

export function DesktopShell({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="brand-mark" onClick={() => router.push('/tasks')}>
          <img src="/dodo-icon.png" alt="" />
          <span>DODO</span>
        </button>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                href={item.to}
                className={`sidebar-link ${isActive ? 'active' : ''}`}>
                <AppIcon name={item.icon} size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-chip">
            <div className="profile-chip-avatar">
              {user?.display_name?.trim()?.charAt(0).toUpperCase() ?? 'D'}
            </div>
            <div>
              <strong>{user?.display_name?.trim() || user?.email?.split('@')[0] || 'Guest'}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="content-shell">{children}</main>
    </div>
  );
}
