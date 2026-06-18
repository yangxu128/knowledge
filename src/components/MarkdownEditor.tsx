'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MarkdownEditorProps {
  initialContent: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => Promise<void>;
  saveDelay?: number;
}

export default function MarkdownEditor({ initialContent, onChange, onSave, saveDelay = 1500 }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState('');
  const [mode, setMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => { setContent(initialContent); }, [initialContent]);

  const render = useCallback((text: string) => {
    fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) })
      .then(r => r.json())
      .then(d => { if (d.html) setPreview(d.html); })
      .catch(() => {});
  }, []);

  useEffect(() => { render(content); }, [content, render]);

  const handleChange = (val: string) => {
    setContent(val);
    dirtyRef.current = true;
    onChange?.(val);
    if (onSave) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!dirtyRef.current) return;
        setSaving(true);
        try { await onSave(val); setSavedAt(Date.now()); dirtyRef.current = false; }
        finally { setSaving(false); }
      }, saveDelay);
    }
  };

  const insertAtCursor = (before: string, after: string = '', placeholder: string = '') => {
    const ta = taRef.current; if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel = content.slice(start, end) || placeholder;
    const next = content.slice(0, start) + before + sel + after + content.slice(end);
    handleChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + sel.length;
    });
  };

  const tools = [
    { icon: 'fa-heading', title: '标题', action: () => insertAtCursor('## ', '', '标题') },
    { icon: 'fa-bold', title: '加粗', action: () => insertAtCursor('**', '**', '加粗') },
    { icon: 'fa-italic', title: '斜体', action: () => insertAtCursor('*', '*', '斜体') },
    { icon: 'fa-quote-left', title: '引用', action: () => insertAtCursor('> ', '', '引用') },
    { icon: 'fa-list-ul', title: '列表', action: () => insertAtCursor('- ', '', '列表项') },
    { icon: 'fa-list-ol', title: '有序列表', action: () => insertAtCursor('1. ', '', '列表项') },
    { icon: 'fa-code', title: '行内代码', action: () => insertAtCursor('`', '`', 'code') },
    { icon: 'fa-code-block', title: '代码块', action: () => insertAtCursor('\n```\n', '\n```\n', '代码') },
    { icon: 'fa-link', title: '链接', action: () => insertAtCursor('[', '](url)', '链接文本') },
    { icon: 'fa-image', title: '图片', action: () => insertAtCursor('![', '](url)', 'alt') },
    { icon: 'fa-table', title: '表格', action: () => insertAtCursor('\n| 列1 | 列2 |\n| --- | --- |\n| ', ' |  |\n', '内容') },
    { icon: 'fa-minus', title: '分隔线', action: () => insertAtCursor('\n---\n') },
  ];

  return (
    <div className="border border-warm rounded-2xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b border-warm bg-paper">
        <div className="flex items-center gap-0.5 flex-wrap">
          {tools.map(t => (
            <button key={t.title} title={t.title} onClick={t.action}
              className="w-8 h-8 rounded-md hover:bg-warm text-slate-500 hover:text-ink text-xs flex items-center justify-center">
              <i className={`fas ${t.icon}`}></i>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-400"><i className="fas fa-spinner fa-spin mr-1"></i>保存中</span>}
          {!saving && savedAt && <span className="text-xs text-sage"><i className="fas fa-check mr-1"></i>已保存</span>}
          <div className="flex bg-warm rounded-md p-0.5">
            {(['edit', 'split', 'preview'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-2.5 py-1 rounded text-xs ${mode === m ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>
                {m === 'edit' ? '编辑' : m === 'split' ? '分屏' : '预览'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`grid ${mode === 'split' ? 'grid-cols-2' : 'grid-cols-1'} h-[600px]`}>
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            ref={taRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            className="w-full h-full p-4 text-sm font-mono resize-none focus:outline-none border-r border-warm bg-white text-ink"
            placeholder="在此输入 Markdown..."
            spellCheck={false}
          />
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className="overflow-auto p-4 reading-mode" dangerouslySetInnerHTML={{ __html: preview }} />
        )}
      </div>
    </div>
  );
}
