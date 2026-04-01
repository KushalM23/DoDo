import React from 'react';
import Link from 'next/link';
import {cx, tw} from '@/lib/tw';

export function NotFoundScreen() {
  return (
    <div className={tw.emptyCenter}>
      <div className={tw.emptyCard}>
        <h1 className={tw.h1}>Not Found</h1>
        <p className={tw.muted}>The page you are looking for does not exist.</p>
        <Link href="/tasks" className={cx(tw.action, tw.actionAccent)}>
          Back to DODO
        </Link>
      </div>
    </div>
  );
}

