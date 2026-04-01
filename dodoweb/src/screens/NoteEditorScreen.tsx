import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {useAlert} from '@/providers/AlertContext';
import {useNotes} from '@/providers/NotesContext';

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32] as const;
const ALIGNMENT_CYCLE = ['left', 'center', 'right'] as const;

function htmlToPlain(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function initialRichContent(contentRich: string | null | undefined) {
  if (contentRich && contentRich.trim()) {
    return contentRich;
  }
  return '<div style="font-size:20px"></div>';
}

export function NoteEditorScreen() {
  const params = useParams<{noteId: string}>();
  const noteId = typeof params.noteId === 'string' ? params.noteId : '';
  const router = useRouter();
  const {showAlert} = useAlert();
  const {notes, updateNote, removeNote, syncNow} = useNotes();
  const note = notes.find(item => item.id === noteId) ?? null;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const finalizingRef = useRef(false);
  const saveErrorShownRef = useRef(false);
  const lastSavedSignatureRef = useRef('');
  const headingRef = useRef('');
  const richRef = useRef('');
  const plainRef = useRef('');

  const [headingDraft, setHeadingDraft] = useState('');
  const [contentRichDraft, setContentRichDraft] = useState('');
  const [contentPlainDraft, setContentPlainDraft] = useState('');
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [alignmentIndex, setAlignmentIndex] = useState(0);
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    underline: false,
    ordered: false,
    unordered: false,
  });

  useEffect(() => {
    if (!note) {
      return;
    }
    const rich = initialRichContent(note.contentRich);
    setHeadingDraft(note.heading ?? '');
    setContentRichDraft(rich);
    setContentPlainDraft(note.contentPlain ?? '');
    headingRef.current = note.heading ?? '';
    richRef.current = rich;
    plainRef.current = note.contentPlain ?? '';
    lastSavedSignatureRef.current = [headingRef.current, richRef.current, plainRef.current].join('|');
    saveErrorShownRef.current = false;
    finalizingRef.current = false;
  }, [note?.id]);

  useEffect(() => {
    headingRef.current = headingDraft;
  }, [headingDraft]);

  useEffect(() => {
    richRef.current = contentRichDraft;
  }, [contentRichDraft]);

  useEffect(() => {
    plainRef.current = contentPlainDraft;
  }, [contentPlainDraft]);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    editorRef.current.innerHTML = contentRichDraft;
  }, [contentRichDraft]);

  const refreshToolbarState = useCallback(() => {
    if (!document.hasFocus()) {
      return;
    }
    setActiveState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      ordered: document.queryCommandState('insertOrderedList'),
      unordered: document.queryCommandState('insertUnorderedList'),
    });
    if (document.queryCommandState('justifyCenter')) {
      setAlignmentIndex(1);
    } else if (document.queryCommandState('justifyRight')) {
      setAlignmentIndex(2);
    } else {
      setAlignmentIndex(0);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshToolbarState);
    return () => document.removeEventListener('selectionchange', refreshToolbarState);
  }, [refreshToolbarState]);

  const persistDraft = useCallback(
    async (syncAfterSave: boolean) => {
      if (!note) {
        return;
      }
      const heading = headingRef.current;
      const contentRich = initialRichContent(richRef.current);
      const contentPlain = plainRef.current;
      const signature = [heading, contentRich, contentPlain].join('|');

      if (signature === lastSavedSignatureRef.current) {
        if (syncAfterSave) {
          await syncNow();
        }
        return;
      }

      try {
        const updated = await updateNote(
          note.id,
          {
            heading,
            contentRich,
            contentPlain,
          },
          {sync: false},
        );

        if (updated) {
          lastSavedSignatureRef.current = signature;
          saveErrorShownRef.current = false;
        }

        if (syncAfterSave) {
          await syncNow();
        }
      } catch (error) {
        if (!saveErrorShownRef.current) {
          showAlert(
            'Autosave failed',
            error instanceof Error ? error.message : 'Unable to save this note right now.',
          );
          saveErrorShownRef.current = true;
        }
      }
    },
    [note, showAlert, syncNow, updateNote],
  );

  const finalizeOnExit = useCallback(async () => {
    if (!note || finalizingRef.current) {
      return;
    }
    finalizingRef.current = true;

    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const headingEmpty = headingRef.current.trim().length === 0;
    const contentEmpty = plainRef.current.trim().length === 0;

    if (headingEmpty && contentEmpty) {
      await removeNote(note.id);
      return;
    }
    await persistDraft(true);
  }, [note, persistDraft, removeNote]);

  useEffect(() => {
    if (!note) {
      return;
    }
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = window.setTimeout(() => {
      void persistDraft(false);
    }, 450);
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [contentPlainDraft, contentRichDraft, headingDraft, note, persistDraft]);

  useEffect(() => {
    return () => {
      void finalizeOnExit();
    };
  }, [finalizeOnExit]);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContentRichDraft(html);
      setContentPlainDraft(htmlToPlain(html));
    }
    refreshToolbarState();
  }

  function applyFontSize(size: number) {
    setFontSize(size);
    setFontMenuOpen(false);
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach(node => {
      node.removeAttribute('size');
      (node as HTMLElement).style.fontSize = `${size}px`;
    });
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContentRichDraft(html);
      setContentPlainDraft(htmlToPlain(html));
    }
  }

  function cycleAlignment() {
    const nextIndex = (alignmentIndex + 1) % ALIGNMENT_CYCLE.length;
    setAlignmentIndex(nextIndex);
    const action =
      nextIndex === 1 ? 'justifyCenter' : nextIndex === 2 ? 'justifyRight' : 'justifyLeft';
    exec(action);
  }

  if (!note) {
    return (
      <div className="detail-page">
        <div className="detail-card empty-card">
          <h1>Note not found</h1>
          <Link href="/notes" className="action-pill accent">
            Back to notes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <section className="detail-card note-editor-page">
        <div className="detail-header">
          <div>
            <Link href="/notes" className="back-link" onClick={() => void finalizeOnExit()}>
              <AppIcon name="chevron-left" size={18} />
              <span>Back to notes</span>
            </Link>
            <input
              className="detail-title-input"
              value={headingDraft}
              onChange={event => setHeadingDraft(event.target.value)}
              placeholder="Title"
            />
          </div>

          <div className="row-actions">
            <button type="button" className="icon-button subtle" onClick={() => void updateNote(note.id, {
              isPinned: !note.isPinned,
              pinnedAt: note.isPinned ? null : new Date().toISOString(),
            })}>
              <AppIcon name="pin" size={18} color={note.isPinned ? 'var(--accent)' : 'currentColor'} />
            </button>
            <button
              type="button"
              className="icon-button danger"
              onClick={() =>
                showAlert('Delete note?', 'This action cannot be undone.', [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      finalizingRef.current = true;
                      void removeNote(note.id).then(() => router.push('/notes'));
                    },
                  },
                ])
              }>
              <AppIcon name="trash-2" size={18} />
            </button>
          </div>
        </div>

        <div className="note-toolbar">
          <button type="button" className="chip" onClick={() => setFontMenuOpen(value => !value)}>
            <span>{fontSize}</span>
            <AppIcon name="chevron-down" size={14} />
          </button>

          {fontMenuOpen ? (
            <div className="font-menu">
              {FONT_SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  className={`font-option ${size === fontSize ? 'active' : ''}`}
                  onClick={() => applyFontSize(size)}>
                  {size}
                </button>
              ))}
            </div>
          ) : null}

          <button type="button" className={`tool-button ${activeState.bold ? 'active' : ''}`} onClick={() => exec('bold')}>
            B
          </button>
          <button type="button" className={`tool-button ${activeState.italic ? 'active' : ''}`} onClick={() => exec('italic')}>
            <em>I</em>
          </button>
          <button type="button" className={`tool-button ${activeState.underline ? 'active' : ''}`} onClick={() => exec('underline')}>
            <u>U</u>
          </button>
          <button type="button" className="tool-button" onClick={cycleAlignment}>
            {ALIGNMENT_CYCLE[alignmentIndex]}
          </button>
          <button type="button" className={`tool-button ${activeState.ordered ? 'active' : ''}`} onClick={() => exec('insertOrderedList')}>
            <AppIcon name="list-ordered" size={16} />
          </button>
          <button type="button" className={`tool-button ${activeState.unordered ? 'active' : ''}`} onClick={() => exec('insertUnorderedList')}>
            <AppIcon name="list" size={16} />
          </button>
        </div>

        <div
          ref={editorRef}
          className="note-editor-surface"
          contentEditable
          suppressContentEditableWarning
          onInput={event => {
            const html = (event.target as HTMLDivElement).innerHTML;
            setContentRichDraft(html);
            setContentPlainDraft(htmlToPlain(html));
          }}
        />
      </section>
    </div>
  );
}
