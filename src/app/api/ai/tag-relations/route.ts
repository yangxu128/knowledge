import { NextResponse } from 'next/server';
import { getAllTags as getDbTags, getTagRelations, setTagRelations } from '@/lib/db';
import { getAllTags as getKnowledgeTags } from '@/lib/articles';
import { discoverTagRelations } from '@/lib/llm';
import { getCurrentUser } from '@/lib/auth';

const taskStatus = new Map<string, {
  status: 'running' | 'done';
  total: number; done: number; relations: number;
  errors: string[]; logs: string[];
}>();

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const dbTags = await getDbTags();
  const knowledgeTags = getKnowledgeTags();
  const tags = [...new Set([...dbTags, ...knowledgeTags])];
  if (tags.length < 2) return NextResponse.json({ error: `至少需要2个标签，当前${tags.length}个: ${tags.join(',')}` }, { status: 400 });

  const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  taskStatus.set(taskId, { status: 'running', total: Math.ceil(tags.length / 30), done: 0, relations: 0, errors: [], logs: [`开始分析 ${tags.length} 个标签...`] });

  (async () => {
    const status = taskStatus.get(taskId)!;
    const onLog = (msg: string) => { status.logs.push(msg); };
    try {
      const results = await discoverTagRelations(tags, onLog);
      if (results.length > 0) await setTagRelations(results);
      status.status = 'done';
      status.done = status.total;
      status.relations = results.length;
      onLog(`\n完成！共发现 ${results.length} 条标签关联`);
    } catch (e: any) {
      status.status = 'done';
      status.errors.push(e.message || String(e));
      onLog(`\n失败: ${e.message}`);
    }
  })();

  return NextResponse.json({ taskId, total: Math.ceil(tags.length / 30) });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (taskId) {
    const status = taskStatus.get(taskId);
    if (!status) return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    const result = { ...status };
    if (status.status === 'done') taskStatus.delete(taskId);
    return NextResponse.json(result);
  }
  return NextResponse.json({ relations: await getTagRelations() });
}
