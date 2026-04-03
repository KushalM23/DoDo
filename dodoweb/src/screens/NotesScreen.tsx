import {useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {cx} from '@/lib/tw';
import {useAlert} from '@/providers/AlertContext';
import {useNotes} from '@/providers/NotesContext';
import type {Note} from '@/types/note';

function deriveHeadingFallback(contentPlain: string) {
  const normalized = contentPlain.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Untitled';
  }
  return normalized.split(' ').filter(Boolean).slice(0, 2).join(' ');
}

const ACTION_MENU_WIDTH = 188;
const ACTION_MENU_HEIGHT = 110;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function NoteCard({
  note,
  selected,
  onPress,
  onLongPress,
}: {
  note: Note;
  selected: boolean;
  onPress: () => void;
  onLongPress: (position: {x: number; y: number}) => void;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pointerPositionRef = useRef<{x: number; y: number}>({x: 0, y: 0});

  const displayHeading = note.heading.trim() || deriveHeadingFallback(note.contentPlain);

  function clearLongPressTimer() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  return (
    <article
      className={cx(
        'relative min-h-[126px] cursor-pointer rounded-control bg-surface px-4 py-3.5 transition-transform duration-150 hover:scale-[0.995] active:scale-[0.985]',
        selected && 'border-2 border-accent bg-surface-light',
      )}
      onPointerDown={event => {
        pointerPositionRef.current = {x: event.clientX, y: event.clientY};
        longPressTriggeredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true;
          onLongPress(pointerPositionRef.current);
        }, 220);
      }}
      onPointerUp={clearLongPressTimer}
      onPointerCancel={clearLongPressTimer}
      onPointerLeave={clearLongPressTimer}
      onContextMenu={event => {
        event.preventDefault();
        onLongPress({x: event.clientX, y: event.clientY});
      }}
      onClick={() => {
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          return;
        }
        onPress();
      }}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 flex-1 truncate font-display-semibold text-[21px] tracking-[-0.3px] text-text">{displayHeading}</h3>
        {note.isPinned ? <AppIcon name="pin" size={15} color="var(--accent)" /> : null}
      </div>
      <p className="m-0 mt-1.5 line-clamp-3 font-sans-medium text-sm leading-[19px] text-muted-text">
        {note.contentPlain || 'Tap to start writing...'}
      </p>
    </article>
  );
}

export function NotesScreen() {
  const router = useRouter();
  const {showAlert} = useAlert();
  const {notes, loading, addNote, removeNote, togglePin} = useNotes();
  const [actionMenu, setActionMenu] = useState<{
    note: Note;
    x: number;
    y: number;
  } | null>(null);

  async function handleCreateNote() {
    const created = await addNote({
      heading: '',
      contentRich: '<div style="font-size:20px"></div>',
      contentPlain: '',
      isPinned: false,
      pinnedAt: null,
    });
    if (!created) {
      return;
    }
    router.push(`/notes/${created.id}`);
  }

  const actionMenuPosition = useMemo(() => {
    if (!actionMenu || typeof window === 'undefined') {
      return null;
    }

    const left = clamp(
      actionMenu.x - ACTION_MENU_WIDTH / 2,
      12,
      window.innerWidth - ACTION_MENU_WIDTH - 12,
    );

    const openBelow = actionMenu.y + ACTION_MENU_HEIGHT + 16 <= window.innerHeight;
    const preferredTop = openBelow ? actionMenu.y + 8 : actionMenu.y - ACTION_MENU_HEIGHT - 8;
    const top = clamp(preferredTop, 78, window.innerHeight - ACTION_MENU_HEIGHT - 24);

    return {left, top};
  }, [actionMenu]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-background">
      <section className="h-full overflow-y-auto px-6 pb-36 pt-2">
        <div className="pb-5 pt-6 text-center">
          <h1 className="m-0 font-display text-[40px] tracking-[-0.8px] text-text">Note Down</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map(note => {
            return (
              <NoteCard
                key={note.id}
                note={note}
                selected={actionMenu?.note.id === note.id}
                onPress={() => router.push(`/notes/${note.id}`)}
                onLongPress={position => setActionMenu({note, ...position})}
              />
            );
          })}

          {!loading && notes.length === 0 ? (
            <div className="col-span-full grid gap-2 pt-[72px] text-center">
              <h3 className="m-0 font-display text-[24px] tracking-[-0.4px] text-text">No notes yet</h3>
              <p className="m-0 font-sans-medium text-sm text-muted-text">Hit the plus button to start</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-36 bg-gradient-to-t from-background via-background/75 to-transparent" />

      <div className="fixed bottom-24 right-12 z-30">
        <button
          type="button"
          className="inline-grid h-16 w-16 place-items-center rounded-full bg-accent text-white shadow-[0_16px_26px_var(--shadow)] transition-transform hover:scale-[1.02] active:scale-95"
          onClick={() => void handleCreateNote()}
          aria-label="Create note">
          <AppIcon name="plus" size={32} color="#fff" />
        </button>
      </div>

      {actionMenu && actionMenuPosition ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            onClick={() => setActionMenu(null)}
            aria-label="Close note actions"
          />

          <div
            className="absolute w-[188px] rounded-[14px] border border-border bg-surface p-2 shadow-[0_6px_14px_var(--shadow)]"
            style={{left: actionMenuPosition.left, top: actionMenuPosition.top}}>
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-2.5 rounded-xl bg-surface-light px-3 text-left font-sans-bold text-sm text-text"
              onClick={() => {
                const selected = actionMenu.note;
                setActionMenu(null);
                void togglePin(selected.id);
              }}>
              <AppIcon name="pin" size={16} color="var(--text)" />
              <span>{actionMenu.note.isPinned ? 'Unpin' : 'Pin'}</span>
            </button>

            <button
              type="button"
              className="mt-1.5 flex min-h-12 w-full items-center gap-2.5 rounded-xl bg-surface-light px-3 text-left font-sans-bold text-sm text-danger"
              onClick={() => {
                const selected = actionMenu.note;
                setActionMenu(null);
                showAlert('Delete note?', 'This action cannot be undone.', [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void removeNote(selected.id);
                    },
                  },
                ]);
              }}>
              <AppIcon name="trash-2" size={16} color="var(--danger)" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
