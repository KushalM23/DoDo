import type {SyncState} from './task';

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
  syncState?: SyncState;
};

export type CreateNoteInput = {
  heading?: string;
  contentRich?: string;
  contentPlain?: string;
  isPinned?: boolean;
  pinnedAt?: string | null;
};

export type UpdateNoteInput = Partial<CreateNoteInput>;
