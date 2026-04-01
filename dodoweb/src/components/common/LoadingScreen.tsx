import React from 'react';
import {tw} from '@/lib/tw';

export function LoadingScreen({
  title = 'Loading',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className={tw.emptyCenter}>
      <div className="grid gap-2 text-center">
        <div className="font-display text-[56px] text-accent">DODO</div>
        <h2 className={tw.h2}>{title}</h2>
        {subtitle ? <p className={tw.muted}>{subtitle}</p> : null}
      </div>
    </div>
  );
}

