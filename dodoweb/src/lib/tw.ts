export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export const tw = {
  appShell: 'grid min-h-screen grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)]',
  sidebar:
    'top-0 flex h-auto flex-col gap-6 border-b border-border bg-surface px-5 py-7 xl:sticky xl:h-screen xl:border-b-0 xl:border-r',
  brand:
    'inline-flex w-fit items-center gap-3 rounded-3xl bg-surface-light px-3.5 py-2.5 text-text',
  brandText: 'font-display text-[28px] tracking-[-0.6px]',
  nav: 'grid gap-2.5',
  navLink:
    'flex min-h-12 items-center gap-3 rounded-full px-3.5 text-muted-text transition hover:-translate-y-px',
  navLinkActive: 'bg-accent text-white',
  contentShell: 'p-4 sm:p-6 xl:p-7',
  pageGrid: 'grid gap-6',
  panel:
    'rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]',
  header: 'flex items-start justify-between gap-4',
  h1: 'm-0 font-display text-[40px] tracking-[-0.7px]',
  h2: 'm-0 font-display text-[30px] tracking-[-0.7px]',
  muted: 'm-0 text-muted-text',
  action:
    'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-[18px] font-sans-bold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none',
  actionAccent: 'bg-accent text-white',
  actionMuted: 'bg-surface-light text-text',
  actionDanger: 'bg-danger text-white',
  iconBtn:
    'inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
  iconBtnDanger: 'bg-danger-light text-danger',
  card:
    'flex items-center gap-[14px] rounded-[22px] border border-transparent bg-surface p-4',
  fieldWrap: 'grid gap-2',
  fieldLabel:
    'mb-2 block text-xs uppercase tracking-[1px] text-muted-text font-sans-bold',
  fieldInput:
    'min-h-12 w-full rounded-[18px] border border-border bg-surface-light px-4 py-3 text-text outline-none focus:border-accent',
  chip:
    'min-h-[42px] rounded-full bg-surface-light px-4 text-text transition hover:-translate-y-px',
  chipActive: 'bg-accent text-white',
  modalOverlay: 'fixed inset-0 z-50 grid place-items-center',
  modalBackdrop: 'absolute inset-0 bg-black/80',
  modalCard:
    'relative w-[min(100vw-32px,460px)] rounded-[28px] border border-border bg-surface p-[22px] shadow-[0_24px_60px_var(--shadow)]',
  modalCardWide: 'w-[min(100vw-32px,720px)]',
  modalActions: 'mt-5 flex justify-end gap-3',
  emptyCenter: 'grid min-h-screen place-items-center p-6',
  emptyCard:
    'grid gap-2 rounded-[28px] border border-border bg-surface p-6 text-center shadow-[0_24px_60px_var(--shadow)]',
};
