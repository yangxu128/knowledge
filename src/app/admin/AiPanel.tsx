'use client';

import { useState, useEffect, useRef } from 'react';

export default function AiPanel() {
  const [config, setConfig] = useState({ baseUrl: '', model: '', configured: false });
  const [tagRelTask, setTagRelTask] = useState<{ taskId: string; total: number } | null>(null);
  const [tagRelProgress, setTagRelProgress] = useState<{ status: string; done: number; total: number; relations: number; errors: string[]; logs: string[] } | null>(null);
  const [tagRelations, setTagRelations] = useState<any[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ai/config').then(r => r.json()).then(setConfig).catch(() => {});
    loadTagRelations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [tagRelProgress?.logs]);

  const loadTagRelations = () => fetch('/api/ai/tag-relations').then(r => r.json()).then(d => setTagRelations(d.relations || [])).catch(() => {});

  useEffect(() => {
    if (!tagRelTask) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } return; }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      if (tagRelTask) {
        fetch(`/api/ai/tag-relations?taskId=${tagRelTask.taskId}`).then(r => r.json()).then(d => {
          if (d.status) setTagRelProgress({ status: d.status, done: d.done, total: d.total || tagRelTask.total, relations: d.relations || 0, errors: d.errors || [], logs: d.logs || [] });
          if (d.status === 'done') { setTagRelTask(null); loadTagRelations(); }
        }).catch(() => {});
      }
    }, 1500);
  }, [tagRelTask]);

  const handleDiscoverTagRelations = async () => {
    const res = await fetch('/api/ai/tag-relations', { method: 'POST' });
    const data = await res.json();
    if (data.error) { setTagRelProgress({ status: 'done', done: 0, total: 0, relations: 0, errors: [data.error], logs: [data.error] }); return; }
    setTagRelTask({ taskId: data.taskId, total: data.total });
    setTagRelProgress({ status: 'running', done: 0, total: data.total, relations: 0, errors: [], logs: ['启动分析...'] });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-warm p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">LLM 配置</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-slate-400">API 地址</span><div className="font-medium text-ink mt-1">{config.baseUrl || '-'}</div></div>
          <div><span className="text-slate-400">模型</span><div className="font-medium text-ink mt-1">{config.model || '-'}</div></div>
          <div><span className="text-slate-400">状态</span><div className={`font-medium mt-1 ${config.configured ? 'text-green-600' : 'text-red-500'}`}>{config.configured ? '已配置' : '未配置'}</div></div>
        </div>
        {!config.configured && (
          <div className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            请在项目根目录 .env 文件中配置 LLM_API_KEY、LLM_BASE_URL、LLM_MODEL
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-warm p-6">
        <h3 className="font-semibold text-ink mb-2">标签关联发现</h3>
        <p className="text-sm text-slate-500 mb-4">用大模型分析标签之间的语义关联，用于知识图谱中标签之间的连线</p>
        <button onClick={handleDiscoverTagRelations} disabled={!!tagRelTask || !config.configured}
          className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {tagRelTask ? '分析中...' : '发现标签关联'}
        </button>
      </div>

      {tagRelProgress && (
        <div className="bg-white rounded-2xl border border-warm p-6">
          <h3 className="font-semibold text-ink mb-3">分析日志</h3>
          <div ref={logRef} className="bg-slate-900 text-green-400 rounded-xl p-4 font-mono text-xs leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
            {tagRelProgress.logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
          {tagRelProgress.status === 'done' && (
            <div className="mt-3 text-sm">
              <span className="text-sage">发现 {tagRelProgress.relations} 条标签关联</span>
              {tagRelProgress.errors.length > 0 && <span className="text-amber-600 ml-2">{tagRelProgress.errors.join('; ')}</span>}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-warm p-6">
        <h3 className="font-semibold text-ink mb-4">标签关联列表 ({tagRelations.length})</h3>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {tagRelations.length === 0 && <div className="text-sm text-slate-400 text-center py-8">暂无标签关联，请先点击"发现标签关联"</div>}
          {tagRelations.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-paper">
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent-light text-accent">{r.tagA}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.relationType === 'parent_child' ? 'bg-blue-100 text-blue-700' : r.relationType === 'synonym' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                {r.relationType === 'parent_child' ? '父子' : r.relationType === 'synonym' ? '同义' : '关联'}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent-light text-accent">{r.tagB}</span>
              <span className="text-xs text-slate-400 ml-auto">置信度 {(r.confidence * 100).toFixed(0)}%</span>
              {r.reason && <span className="text-xs text-slate-500 max-w-xs truncate" title={r.reason}>{r.reason}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
