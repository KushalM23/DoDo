import React from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {cx, tw} from '@/lib/tw';
import {useAlert} from '@/providers/AlertContext';
import {useNotes} from '@/providers/NotesContext';

function deriveHeadingFallback(contentPlain: string) {
  const normalized = contentPlain.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Untitled';
  }
  return normalized.split(' ').filter(Boolean).slice(0, 2).join(' ');
}

export function NotesScreen() {
  const router = useRouter();
  const {showAlert} = useAlert();
  const {notes, loading, refresh, addNote, removeNote, togglePin} = useNotes();

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

  return (
    <div className={tw.pageGrid}>
      <section className={tw.panel}>
        <div className={tw.header}>
          <div>
            <h1 className={tw.h1}>Note Down</h1>
            <p className={tw.muted}>Rich desktop notes synced to the same backend as mobile.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={tw.iconBtn} onClick={() => void refresh()}>
              <AppIcon name="rotate-ccw" size={18} />
            </button>
            <button type="button" className={cx(tw.action, tw.actionAccent)} onClick={() => void handleCreateNote()}>
              <AppIcon name="plus" size={18} />
              <span>New Note</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {notes.map(note => {
            const displayHeading = note.heading.trim() || deriveHeadingFallback(note.contentPlain);
            return (
              <article
                key={note.id}
                className={cx(tw.card, 'cursor-pointer')}
                onClick={() => router.push(`/notes/${note.id}`)}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 font-display-semibold tracking-[-0.3px]">{displayHeading}</h3>
                  {note.isPinned ? <AppIcon name="pin" size={15} color="var(--accent)" /> : null}
                </div>
                <p className={tw.muted}>{note.contentPlain || 'Tap to start writing...'}</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={tw.iconBtn}
                    onClick={event => {
                      event.stopPropagation();
                      void togglePin(note.id);
                    }}>
                    <AppIcon name="pin" size={16} />
                  </button>
                  <button
                    type="button"
                    className={cx(tw.iconBtn, tw.iconBtnDanger)}
                    onClick={event => {
                      event.stopPropagation();
                      showAlert('Delete note?', 'This action cannot be undone.', [
                        {text: 'Cancel', style: 'cancel'},
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            void removeNote(note.id);
                          },
                        },
                      ]);
                    }}>
                    <AppIcon name="trash-2" size={16} />
                  </button>
                </div>
              </article>
            );
          })}

          {!loading && notes.length === 0 ? (
            <div className="grid gap-2 text-center">
              <h3 className="m-0 font-display-semibold tracking-[-0.3px]">No notes yet</h3>
              <p className={tw.muted}>Hit the plus button to start.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

