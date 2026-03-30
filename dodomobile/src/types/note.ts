export type Note = {
  id: string;
  heading: string;
  contentRich: string;
  contentPlain: string;
  isPinned: boolean;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  lastModifiedDeviceAt?: string;
  syncState?: 'synced' | 'pending' | 'retry' | 'terminal_local_only';
};

export type CreateNoteInput = {
  heading?: string;
  contentRich?: string;
  contentPlain?: string;
  isPinned?: boolean;
  pinnedAt?: string | null;
};

export type UpdateNoteInput = Partial<CreateNoteInput>;
