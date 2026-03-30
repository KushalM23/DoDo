import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createNoteLocal,
  listNotesLocal,
  softDeleteNoteLocal,
  updateNoteLocal,
} from '../lib/local/repository';
import {runSync} from '../lib/local/syncEngine';
import {useAuth} from './AuthContext';
import type {CreateNoteInput, Note, UpdateNoteInput} from '../types/note';

type NotesContextValue = {
  notes: Note[];
  loading: boolean;
  initialized: boolean;
  refresh: () => Promise<void>;
  addNote: (input?: CreateNoteInput) => Promise<Note | null>;
  updateNote: (
    noteId: string,
    updates: UpdateNoteInput,
    options?: {sync?: boolean},
  ) => Promise<Note | null>;
  removeNote: (noteId: string) => Promise<void>;
  togglePin: (noteId: string) => Promise<void>;
  syncNow: () => Promise<boolean>;
};

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

function asTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortNotes(rows: Note[]): Note[] {
  return [...rows].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    if (a.isPinned && b.isPinned) {
      return asTimestamp(b.pinnedAt) - asTimestamp(a.pinnedAt);
    }

    const aUpdated = asTimestamp(a.updatedAt ?? a.createdAt);
    const bUpdated = asTimestamp(b.updatedAt ?? b.createdAt);
    return bUpdated - aUpdated;
  });
}

export function NotesProvider({children}: {children: React.ReactNode}) {
  const {user} = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotes([]);
      setInitialized(true);
      return;
    }

    setLoading(true);
    try {
      const next = await listNotesLocal(user.id);
      setNotes(sortNotes(next));

      void runSync(user.id, 'manual').then(async didSync => {
        if (!didSync) {
          return;
        }
        const reconciled = await listNotesLocal(user.id);
        setNotes(sortNotes(reconciled));
      });
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [user?.id]);

  useEffect(() => {
    setInitialized(false);
  }, [user?.id]);

  const addNote = useCallback(
    async (input: CreateNoteInput = {}) => {
      if (!user?.id) {
        return null;
      }

      const created = await createNoteLocal(user.id, input);
      setNotes(prev => sortNotes([created, ...prev]));
      void runSync(user.id, 'manual');
      return created;
    },
    [user?.id],
  );

  const updateNote = useCallback(
    async (
      noteId: string,
      updates: UpdateNoteInput,
      options?: {sync?: boolean},
    ) => {
      if (!user?.id) {
        return null;
      }

      const updated = await updateNoteLocal(user.id, noteId, updates);
      if (!updated) {
        return null;
      }

      setNotes(prev =>
        sortNotes(prev.map(note => (note.id === noteId ? updated : note))),
      );

      if (options?.sync !== false) {
        void runSync(user.id, 'manual');
      }
      return updated;
    },
    [user?.id],
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      if (!user?.id) {
        return;
      }

      await softDeleteNoteLocal(user.id, noteId);
      setNotes(prev => sortNotes(prev.filter(note => note.id !== noteId)));
      void runSync(user.id, 'manual');
    },
    [user?.id],
  );

  const togglePin = useCallback(
    async (noteId: string) => {
      if (!user?.id) {
        return;
      }

      const current = notes.find(note => note.id === noteId);
      if (!current) {
        return;
      }

      const willPin = !current.isPinned;
      const updated = await updateNoteLocal(user.id, noteId, {
        isPinned: willPin,
        pinnedAt: willPin ? new Date().toISOString() : null,
      });

      if (!updated) {
        return;
      }

      setNotes(prev =>
        sortNotes(prev.map(note => (note.id === noteId ? updated : note))),
      );
      void runSync(user.id, 'manual');
    },
    [notes, user?.id],
  );

  const syncNow = useCallback(async () => {
    if (!user?.id) {
      return false;
    }
    const didSync = await runSync(user.id, 'manual');
    if (!didSync) {
      return false;
    }
    const reconciled = await listNotesLocal(user.id);
    setNotes(sortNotes(reconciled));
    return true;
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<NotesContextValue>(
    () => ({
      notes,
      loading,
      initialized,
      refresh,
      addNote,
      updateNote,
      removeNote,
      togglePin,
      syncNow,
    }),
    [
      addNote,
      initialized,
      loading,
      notes,
      refresh,
      removeNote,
      syncNow,
      togglePin,
      updateNote,
    ],
  );

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
}

export function useNotes(): NotesContextValue {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used inside NotesProvider');
  }
  return context;
}
