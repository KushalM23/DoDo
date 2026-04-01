import React from 'react';
import Link from 'next/link';

export function NotFoundScreen() {
  return (
    <div className="empty-state-page">
      <div className="empty-card">
        <h1>Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <Link href="/tasks" className="action-pill accent">
          Back to DODO
        </Link>
      </div>
    </div>
  );
}
