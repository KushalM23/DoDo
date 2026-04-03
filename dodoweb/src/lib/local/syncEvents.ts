type SyncCompletedPayload = {
  type: 'sync-completed';
  userId: string;
  at: string;
};

type SyncEventListener = (payload: SyncCompletedPayload) => void;

const BROADCAST_CHANNEL_NAME = 'dodo.sync.events';
const STORAGE_EVENT_KEY = 'dodo.sync.events';

declare global {
  var __dodoSyncEventListeners: Set<SyncEventListener> | undefined;
  var __dodoSyncEventChannel: BroadcastChannel | null | undefined;
  var __dodoSyncEventInitialized: boolean | undefined;
}

const listeners = globalThis.__dodoSyncEventListeners ??= new Set<SyncEventListener>();

function notifyListeners(payload: SyncCompletedPayload) {
  listeners.forEach(listener => {
    listener(payload);
  });
}

function parsePayload(value: unknown): SyncCompletedPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<SyncCompletedPayload>;
  if (
    payload.type !== 'sync-completed' ||
    typeof payload.userId !== 'string' ||
    typeof payload.at !== 'string'
  ) {
    return null;
  }

  return payload as SyncCompletedPayload;
}

function ensureBrowserListeners() {
  if (typeof window === 'undefined' || globalThis.__dodoSyncEventInitialized) {
    return;
  }

  globalThis.__dodoSyncEventInitialized = true;

  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.addEventListener('message', event => {
      const payload = parsePayload(event.data);
      if (payload) {
        notifyListeners(payload);
      }
    });
    globalThis.__dodoSyncEventChannel = channel;
  } else {
    globalThis.__dodoSyncEventChannel = null;
  }

  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_EVENT_KEY || !event.newValue) {
      return;
    }
    try {
      const payload = parsePayload(JSON.parse(event.newValue));
      if (payload) {
        notifyListeners(payload);
      }
    } catch {
      // Ignore malformed cross-tab sync events.
    }
  });
}

export function publishSyncCompleted(userId: string) {
  const payload: SyncCompletedPayload = {
    type: 'sync-completed',
    userId,
    at: new Date().toISOString(),
  };

  ensureBrowserListeners();
  notifyListeners(payload);

  try {
    globalThis.__dodoSyncEventChannel?.postMessage(payload);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(payload));
      localStorage.removeItem(STORAGE_EVENT_KEY);
    }
  } catch {
    // Cross-tab propagation is best effort only.
  }
}

export function subscribeToSyncCompleted(userId: string, listener: () => void) {
  ensureBrowserListeners();

  const wrappedListener: SyncEventListener = payload => {
    if (payload.userId === userId) {
      listener();
    }
  };

  listeners.add(wrappedListener);
  return () => {
    listeners.delete(wrappedListener);
  };
}
