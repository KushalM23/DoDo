import React from 'react';
import type {Metadata} from 'next';
import {AppProviders} from './providers';
import './styles.css';

export const metadata: Metadata = {
  title: 'DODO',
  description: 'Desktop web workspace for tasks, habits, notes, and focus mode.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
