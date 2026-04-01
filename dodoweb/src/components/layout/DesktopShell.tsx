import React from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {AppIcon, type AppIconName} from '@/components/common/AppIcon';
import {cx, tw} from '@/lib/tw';
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
    <div className={tw.appShell}>
      <aside className={tw.sidebar}>
        <button type="button" className={tw.brand} onClick={() => router.push('/tasks')}>
          <img src="/dodo-icon.png" alt="" className="h-[34px] w-[34px] rounded-[10px]" />
          <span className={tw.brandText}>DODO</span>
        </button>

        <nav className={tw.nav}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.to || pathname.startsWith(item.to + '/');
            return (
              <Link
                key={item.to}
                href={item.to}
                className={cx(tw.navLink, isActive && tw.navLinkActive)}>
                <AppIcon name={item.icon} size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-3 rounded-[18px] bg-surface-light p-3">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-accent font-display text-[22px] text-white">
              {user?.display_name?.trim()?.charAt(0).toUpperCase() ?? 'D'}
            </div>
            <div>
              <strong className="block font-sans-bold">
                {user?.display_name?.trim() || user?.email?.split('@')[0] || 'Guest'}
              </strong>
              <span className="block text-xs text-muted-text">{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className={tw.contentShell}>{children}</main>
    </div>
  );
}

