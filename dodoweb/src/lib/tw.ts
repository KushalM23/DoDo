export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const tw = {
  appShell: "min-h-screen",
  sidebar:
    "hidden xl:sticky xl:top-0 xl:flex xl:h-screen xl:flex-col xl:gap-6 xl:border-r xl:border-border xl:bg-surface xl:px-5 xl:py-7",
  brand:
    "inline-flex w-fit items-center gap-3 rounded-3xl bg-surface-light px-3.5 py-2.5 text-text",
  brandText: "font-display text-3xl tracking-tight",
  nav: "grid gap-2.5",
  navLink:
    "flex min-h-12 items-center gap-3 rounded-full px-3.5 text-muted-text transition hover:-translate-y-px",
  navLinkActive: "bg-accent text-white",
  contentShell: "p-4 pb-28 sm:p-6 sm:pb-32 xl:p-7 xl:pb-32",
  pageGrid: "grid gap-6",
  panel:
    "rounded-panel border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]",
  header: "flex items-start justify-between gap-4",
  h1: "m-0 font-display text-4xl tracking-tight",
  h2: "m-0 font-display text-3xl tracking-tight",
  muted: "m-0 text-muted-text",
  action:
    "inline-flex min-h-12.5 items-center justify-center gap-2 rounded-full px-4.5 font-sans-bold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:transform-none",
  actionAccent: "bg-accent text-white",
  actionMuted: "bg-surface-light text-text",
  actionDanger: "bg-danger text-white",
  iconBtn:
    "inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
  iconBtnDanger: "bg-danger-light text-danger",
  card: "flex items-center gap-3.5 rounded-card border border-transparent bg-surface p-4",
  fieldWrap: "grid gap-2",
  fieldLabel:
    "mb-2 block font-sans-bold text-xs uppercase tracking-wide text-muted-text",
  fieldInput:
    "min-h-12 w-full rounded-control border border-border bg-surface-light px-4 py-3 text-text outline-none focus:border-accent",
  chip: "min-h-10.5 rounded-full bg-surface-light px-4 text-text transition hover:-translate-y-px",
  chipActive: "bg-accent text-white",
  modalOverlay: "fixed inset-0 z-50 grid place-items-center",
  modalBackdrop: "absolute inset-0 bg-black/80",
  modalCard:
    "relative w-[min(100vw-32px,460px)] rounded-panel border border-border bg-surface p-5.5 shadow-[0_24px_60px_var(--shadow)]",
  modalCardWide: "w-[min(100vw-32px,720px)]",
  modalActions: "mt-5 flex justify-end gap-3",
  emptyCenter: "grid min-h-screen place-items-center p-6",
  emptyCard:
    "grid gap-2 rounded-panel border border-border bg-surface p-6 text-center shadow-[0_24px_60px_var(--shadow)]",
};
