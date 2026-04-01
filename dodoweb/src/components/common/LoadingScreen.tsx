import React from 'react';

export function LoadingScreen({
  title = 'Loading',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="loading-screen">
      <div className="loading-mark">DODO</div>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
