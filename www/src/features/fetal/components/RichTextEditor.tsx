/**
 * RichTextEditor — minimal contenteditable HTML editor.
 *
 * Why not a textarea?  Templates contain real HTML (`<p>`, `<ul>`, `<b>`)
 * and the user wants to see rendered output while they edit + add their
 * own formatting on top.  A `<textarea>` would show the raw markup.
 *
 * Why not pull in TipTap/Slate/Lexical?  Bundle size + we only need
 * bold/italic/underline/lists/clear-formatting. document.execCommand is
 * deprecated but still works in every browser we ship to (Electron Chromium).
 */
import { useEffect, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Eraser } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 180, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Push external value into the DOM only when it actually differs from the
  // current innerHTML — otherwise re-syncing on every keystroke would
  // collapse the user's caret to position 0.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const fire = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML);
  }, [onChange]);

  const cmd = (command: string) => {
    document.execCommand(command, false);
    // Re-focus before firing so the toolbar click doesn't strip the selection.
    ref.current?.focus();
    fire();
  };

  // Paste handler: prefer plain text from the OS clipboard so users don't
  // accidentally drag in Word/Outlook styles that fight our print CSS.
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    fire();
  };

  const isEmpty = !value || value === '<br>';

  return (
    <div className="rich-editor border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-blue-500">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1 py-1 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
        <ToolBtn title="Bold (Ctrl+B)"       onClick={() => cmd('bold')}><Bold size={13} /></ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)"     onClick={() => cmd('italic')}><Italic size={13} /></ToolBtn>
        <ToolBtn title="Underline (Ctrl+U)"  onClick={() => cmd('underline')}><Underline size={13} /></ToolBtn>
        <Sep />
        <ToolBtn title="Bullet list"          onClick={() => cmd('insertUnorderedList')}><List size={13} /></ToolBtn>
        <ToolBtn title="Numbered list"        onClick={() => cmd('insertOrderedList')}><ListOrdered size={13} /></ToolBtn>
        <Sep />
        <ToolBtn title="Clear formatting"     onClick={() => cmd('removeFormat')}><Eraser size={13} /></ToolBtn>
        <span className="ml-auto text-[9px] text-slate-400 pr-1">Pastes as plain text</span>
      </div>

      {/* Editable surface */}
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute inset-x-2.5 top-2 text-sm text-slate-400 pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          aria-label={ariaLabel}
          onInput={fire}
          onBlur={fire}
          onPaste={handlePaste}
          className="px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none prose prose-sm max-w-none dark:prose-invert"
          style={{ minHeight: `${minHeight}px` }}
        />
      </div>
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}   // prevent selection loss before click
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 w-px h-4 bg-slate-300 dark:bg-slate-600" />;
}
