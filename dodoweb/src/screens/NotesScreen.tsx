import React from 'react';
import {useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
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
    <div className="page-grid single">
      <section className="desktop-panel">
        <div className="panel-header">
          <div>
            <h1>Note Down</h1>
            <p>Rich desktop notes synced to the same backend as mobile.</p>
          </div>
          <div className="row-actions">
            <button type="button" className="icon-button subtle" onClick={() => void refresh()}>
              <AppIcon name="rotate-ccw" size={18} />
            </button>
            <button type="button" className="action-pill accent" onClick={() => void handleCreateNote()}>
              <AppIcon name="plus" size={18} />
              <span>New Note</span>
            </button>
          </div>
        </div>

        <div className="notes-grid">
          {notes.map(note => {
            const displayHeading = note.heading.trim() || deriveHeadingFallback(note.contentPlain);
            return (
              <article
                key={note.id}
                className="note-card"
                onClick={() => router.push(`/notes/${note.id}`)}>
                <div className="note-card-header">
                  <h3>{displayHeading}</h3>
                  {note.isPinned ? <AppIcon name="pin" size={15} color="var(--accent)" /> : null}
                </div>
                <p>{note.contentPlain || 'Tap to start writing...'}</p>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-button subtle"
                    onClick={event => {
                      event.stopPropagation();
                      void togglePin(note.id);
                    }}>
                    <AppIcon name="pin" size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
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
            <div className="empty-block">
              <h3>No notes yet</h3>
              <p>Hit the plus button to start.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
