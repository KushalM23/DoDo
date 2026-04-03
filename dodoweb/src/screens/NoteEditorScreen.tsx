import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppIcon } from "@/components/common/AppIcon";
import { cx } from "@/lib/tw";
import { useAlert } from "@/providers/AlertContext";
import { useNotes } from "@/providers/NotesContext";
import { backOrReplace } from "@/utils/navigation";

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32] as const;
const ALIGNMENT_CYCLE = ["left", "center", "right"] as const;

function htmlToPlain(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function initialRichContent(contentRich: string | null | undefined) {
  if (contentRich && contentRich.trim()) {
    return contentRich;
  }
  return '<div style="font-size:20px"></div>';
}

function AlignmentGlyph({
  mode,
  color,
}: {
  mode: (typeof ALIGNMENT_CYCLE)[number];
  color: string;
}) {
  const lineAlign =
    mode === "left" ? "flex-start" : mode === "center" ? "center" : "flex-end";

  return (
    <span className="inline-flex w-[18px] flex-col gap-[2px]">
      <span
        style={{
          width: 14,
          height: 2,
          borderRadius: 1,
          alignSelf: lineAlign,
          backgroundColor: color,
        }}
      />
      <span
        style={{
          width: 10,
          height: 2,
          borderRadius: 1,
          alignSelf: lineAlign,
          backgroundColor: color,
        }}
      />
      <span
        style={{
          width: 12,
          height: 2,
          borderRadius: 1,
          alignSelf: lineAlign,
          backgroundColor: color,
        }}
      />
    </span>
  );
}

export function NoteEditorScreen() {
  const params = useParams<{ noteId: string }>();
  const rawNoteParam = (params as Record<string, string | string[] | undefined>)
    .noteId;
  const noteId =
    typeof rawNoteParam === "string"
      ? decodeURIComponent(rawNoteParam)
      : Array.isArray(rawNoteParam)
      ? decodeURIComponent(rawNoteParam[0] ?? "")
      : "";
  const router = useRouter();
  const { showAlert } = useAlert();
  const {
    notes,
    loading,
    initialized,
    refresh,
    updateNote,
    removeNote,
    syncNow,
  } = useNotes();
  const note = notes.find((item) => item.id === noteId) ?? null;

  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const cleanupArmTimerRef = useRef<number | null>(null);
  const cleanupArmedRef = useRef(false);
  const finalizeOnExitRef = useRef<() => Promise<void>>(async () => {});
  const missingRefreshAttemptedRef = useRef<string | null>(null);
  const finalizingRef = useRef(false);
  const saveErrorShownRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const headingRef = useRef("");
  const richRef = useRef("");
  const plainRef = useRef("");

  const [headingDraft, setHeadingDraft] = useState("");
  const [contentRichDraft, setContentRichDraft] = useState("");
  const [contentPlainDraft, setContentPlainDraft] = useState("");
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [alignmentIndex, setAlignmentIndex] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    underline: false,
    ordered: false,
    unordered: false,
    align: false,
  });

  useEffect(() => {
    if (!note) {
      return;
    }
    const rich = initialRichContent(note.contentRich);
    setHeadingDraft(note.heading ?? "");
    setContentRichDraft(rich);
    setContentPlainDraft(note.contentPlain ?? "");
    headingRef.current = note.heading ?? "";
    richRef.current = rich;
    plainRef.current = note.contentPlain ?? "";
    lastSavedSignatureRef.current = [
      headingRef.current,
      richRef.current,
      plainRef.current,
    ].join("|");
    saveErrorShownRef.current = false;
    finalizingRef.current = false;
  }, [note?.id]);

  useEffect(() => {
    if (!initialized || !noteId || note) {
      return;
    }
    if (missingRefreshAttemptedRef.current === noteId) {
      return;
    }
    missingRefreshAttemptedRef.current = noteId;
    void refresh();
  }, [initialized, note, noteId, refresh]);

  useEffect(() => {
    if (note) {
      missingRefreshAttemptedRef.current = null;
    }
  }, [note]);

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
    if (editorRef.current.innerHTML !== contentRichDraft) {
      editorRef.current.innerHTML = contentRichDraft;
    }
  }, [contentRichDraft]);

  const refreshToolbarState = useCallback(() => {
    if (!document.hasFocus()) {
      return;
    }
    const alignCenter = document.queryCommandState("justifyCenter");
    const alignRight = document.queryCommandState("justifyRight");
    const alignLeft = !alignCenter && !alignRight;

    setActiveState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      ordered: document.queryCommandState("insertOrderedList"),
      unordered: document.queryCommandState("insertUnorderedList"),
      align: alignLeft || alignCenter || alignRight,
    });
    if (alignCenter) {
      setAlignmentIndex(1);
    } else if (alignRight) {
      setAlignmentIndex(2);
    } else {
      setAlignmentIndex(0);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshToolbarState);
    return () =>
      document.removeEventListener("selectionchange", refreshToolbarState);
  }, [refreshToolbarState]);

  useEffect(() => {
    if (!fontMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-note-font-menu]") ||
        target?.closest("[data-note-font-dropdown]")
      ) {
        return;
      }
      setFontMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [fontMenuOpen]);

  const persistDraft = useCallback(
    async (syncAfterSave: boolean) => {
      if (!note) {
        return;
      }
      const heading = headingRef.current;
      const contentRich = initialRichContent(richRef.current);
      const contentPlain = plainRef.current;
      const signature = [heading, contentRich, contentPlain].join("|");

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
          { sync: false },
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
            "Autosave failed",
            error instanceof Error
              ? error.message
              : "Unable to save this note right now.",
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
    finalizeOnExitRef.current = finalizeOnExit;
  }, [finalizeOnExit]);

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
    cleanupArmedRef.current = false;
    cleanupArmTimerRef.current = window.setTimeout(() => {
      cleanupArmedRef.current = true;
      cleanupArmTimerRef.current = null;
    }, 0);

    return () => {
      if (cleanupArmTimerRef.current != null) {
        window.clearTimeout(cleanupArmTimerRef.current);
        cleanupArmTimerRef.current = null;
      }
      if (!cleanupArmedRef.current) {
        return;
      }
      void finalizeOnExitRef.current();
    };
  }, []);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
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
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((node) => {
      node.removeAttribute("size");
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
      nextIndex === 1
        ? "justifyCenter"
        : nextIndex === 2
        ? "justifyRight"
        : "justifyLeft";
    exec(action);
  }

  function keepEditorSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  async function handleBackToNotes() {
    await finalizeOnExit();
    backOrReplace(router, "/notes");
  }

  function handleQuickBackToNotes() {
    backOrReplace(router, "/notes");
  }

  if (!note) {
    if (!initialized || loading) {
      return (
        <div className="grid h-full min-h-full bg-background">
          <header className="flex items-center gap-2 px-4 pt-4 sm:px-6 sm:pt-5">
            <button
              type="button"
              className="inline-grid h-8 w-8 place-items-center rounded-full text-text transition hover:bg-surface-light"
              onClick={handleQuickBackToNotes}
              aria-label="Back to notes"
            >
              <AppIcon name="chevron-left" size={24} color="var(--text)" />
            </button>
            <h1 className="m-0 font-display text-[22px] tracking-[-0.4px] text-text">
              Note
            </h1>
          </header>
          <div className="grid place-items-center px-6 text-center">
            <p className="m-0 font-display text-[22px] tracking-[-0.4px] text-text">
              Loading note...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="grid h-full min-h-full bg-background">
        <header className="flex items-center gap-2 px-4 pt-4 sm:px-6 sm:pt-5">
          <button
            type="button"
            className="inline-grid h-8 w-8 place-items-center rounded-full text-text transition hover:bg-surface-light"
            onClick={handleQuickBackToNotes}
            aria-label="Back to notes"
          >
            <AppIcon name="chevron-left" size={24} color="var(--text)" />
          </button>
          <h1 className="m-0 font-display text-[22px] tracking-[-0.4px] text-text">
            Note
          </h1>
        </header>
        <div className="grid place-items-center px-6 text-center">
          <p className="m-0 font-display text-[22px] tracking-[-0.4px] text-text">
            Note not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 px-4 pt-4 sm:px-6 sm:pt-5">
        <button
          type="button"
          className="inline-grid h-8 w-8 place-items-center rounded-full text-text transition hover:bg-surface-light"
          onClick={handleBackToNotes}
          aria-label="Back to notes"
        >
          <AppIcon name="chevron-left" size={24} color="var(--text)" />
        </button>

        <input
          className="min-h-12 flex-1 border-0 bg-transparent px-0 py-[2px] font-display text-[34px] tracking-[-0.6px] text-text outline-none placeholder:text-muted-text"
          value={headingDraft}
          onChange={(event) => setHeadingDraft(event.target.value)}
          placeholder="Title"
          aria-label="Note title"
        />

        <div className="flex items-center gap-3 pr-1">
          <button
            type="button"
            className="inline-grid h-8 w-8 place-items-center rounded-full text-muted-text transition hover:bg-surface-light"
            onClick={() =>
              void updateNote(note.id, {
                isPinned: !note.isPinned,
                pinnedAt: note.isPinned ? null : new Date().toISOString(),
              })
            }
            aria-label={note.isPinned ? "Unpin note" : "Pin note"}
          >
            <AppIcon
              name="pin"
              size={18}
              color={note.isPinned ? "var(--accent)" : "var(--muted-text)"}
            />
          </button>

          <button
            type="button"
            className="inline-grid h-8 w-8 place-items-center rounded-full text-text transition hover:bg-surface-light"
            onClick={() =>
              showAlert("Delete note?", "This action cannot be undone.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    finalizingRef.current = true;
                    void removeNote(note.id).then(() => router.replace("/notes"));
                  },
                },
              ])
            }
            aria-label="Delete note"
          >
            <AppIcon name="trash-2" size={18} color="var(--text)" />
          </button>
        </div>
      </header>

      <section className="relative min-h-0 flex-1 px-4 pb-5 pt-3 sm:px-6">
        <div className="relative flex h-full min-h-0 flex-col pb-[88px]">
          <div
            ref={editorRef}
            className="min-h-[1.55em] flex-1 overflow-y-auto rounded-none border-0 bg-transparent px-2 py-1 font-sans-medium text-[20px] leading-[1.55] text-text outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
            contentEditable
            suppressContentEditableWarning
            onFocus={() => setEditorFocused(true)}
            onBlur={() => setEditorFocused(false)}
            onInput={(event) => {
              const html = (event.target as HTMLDivElement).innerHTML;
              const plain = htmlToPlain(html);
              if (html === richRef.current && plain === plainRef.current) {
                return;
              }
              richRef.current = html;
              plainRef.current = plain;
              setContentRichDraft(html);
              setContentPlainDraft(plain);
            }}
          />

          {!editorFocused && contentPlainDraft.trim().length === 0 ? (
            <span className="pointer-events-none absolute left-2 top-1 font-sans-medium text-[20px] leading-[1.55] text-muted-text">
              Start writing...
            </span>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 w-full max-w-full">
            {fontMenuOpen ? (
              <div
                data-note-font-dropdown
                className="mb-2 grid max-h-[220px] w-[76px] gap-1 overflow-auto rounded-xl border border-border bg-surface p-2 shadow-[0_6px_14px_var(--shadow)]"
              >
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={cx(
                      "h-[34px] w-full rounded-[9px] bg-surface-light px-1 text-center font-sans-semibold text-[13px] text-text transition",
                      size === fontSize && "bg-accent text-white",
                    )}
                    onMouseDown={keepEditorSelection}
                    onClick={() => applyFontSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              data-note-font-menu
              className="w-fit max-w-full rounded-control border border-border bg-surface px-[10px] py-2 shadow-[0_8px_18px_var(--shadow)]"
            >
              <div className="flex items-center gap-1 overflow-x-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  className="flex h-[34px] min-w-[54px] items-center justify-center gap-0.5 rounded-[9px] bg-surface-light px-2"
                  onMouseDown={keepEditorSelection}
                  onClick={() => setFontMenuOpen((value) => !value)}
                >
                  <span className="font-sans-semibold text-[15px] text-text">
                    {fontSize}
                  </span>
                  <AppIcon
                    name="chevron-down"
                    size={14}
                    color="var(--muted-text)"
                  />
                </button>

                <span className="mx-1 h-6 w-px bg-border" />

                <button
                  type="button"
                  className={cx(
                    "inline-grid h-8 w-8 place-items-center rounded-lg font-sans-semibold text-[15px] text-text",
                    activeState.bold && "bg-accent text-white",
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={() => exec("bold")}
                >
                  B
                </button>
                <button
                  type="button"
                  className={cx(
                    "inline-grid h-8 w-8 place-items-center rounded-lg font-sans-semibold text-[15px] text-text",
                    activeState.italic && "bg-accent text-white",
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={() => exec("italic")}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  className={cx(
                    "inline-grid h-8 w-8 place-items-center rounded-lg font-sans-semibold text-[15px] text-text",
                    activeState.underline && "bg-accent text-white",
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={() => exec("underline")}
                >
                  <u>U</u>
                </button>

                <span className="mx-1 h-6 w-px bg-border" />

                <button
                  type="button"
                  className={cx(
                    "inline-grid h-8 w-8 place-items-center rounded-lg",
                    activeState.align && "bg-accent text-white",
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={cycleAlignment}
                >
                  <AlignmentGlyph
                    mode={ALIGNMENT_CYCLE[alignmentIndex]}
                    color={activeState.align ? "#fff" : "var(--text)"}
                  />
                </button>

                <span className="mx-1 h-6 w-px bg-border" />

                <button
                  type="button"
                  className={cx(
                    "inline-grid h-8 w-8 place-items-center rounded-lg text-text",
                    activeState.ordered && "bg-accent text-white",
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={() => exec("insertOrderedList")}
                >
                  <AppIcon
                    name="list-ordered"
                    size={16}
                    color={activeState.ordered ? "#fff" : "var(--text)"}
                  />
                </button>
                <button
                  type="button"
                  className={cx(
                    "inline-grid h-8 w-8 place-items-center rounded-lg text-text",
                    activeState.unordered && "bg-accent text-white",
                  )}
                  onMouseDown={keepEditorSelection}
                  onClick={() => exec("insertUnorderedList")}
                >
                  <AppIcon
                    name="list"
                    size={16}
                    color={activeState.unordered ? "#fff" : "var(--text)"}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
