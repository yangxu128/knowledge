const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';

interface LLMMessage { role: 'system' | 'user' | 'assistant'; content: string }

async function callLLM(messages: LLMMessage[], onLog?: (msg: string) => void): Promise<string> {
  if (!LLM_API_KEY) throw new Error('LLM_API_KEY 未配置');
  let baseUrl = LLM_BASE_URL.replace(/\/+$/, '');
  if (baseUrl.endsWith('/v1')) baseUrl = baseUrl.slice(0, -3);
  const url = `${baseUrl}/v1/chat/completions`;
  onLog?.(`[请求] ${url} 模型: ${LLM_MODEL}`);
  const body = JSON.stringify({ model: LLM_MODEL, messages, temperature: 0.3, max_tokens: 2000 });
  onLog?.(`[发送] ${messages.length} 条消息, ${body.length} 字节`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${LLM_API_KEY}` },
    body,
  });
  onLog?.(`[响应] HTTP ${res.status}`);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`LLM 请求失败: ${res.status} ${errText.slice(0, 200)}`);
  }
  const buffer = await res.arrayBuffer();
  const text = new TextDecoder('utf-8').decode(buffer);
  onLog?.(`[原始响应] ${text.slice(0, 500)}`);
  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content || '';
  onLog?.(`[LLM输出] ${content.slice(0, 500) || '(空)'}`);
  return content;
}

export interface TagRelationResult {
  tagA: string;
  tagB: string;
  relationType: 'related' | 'parent_child' | 'synonym';
  confidence: number;
  reason: string;
}

export async function discoverTagRelations(tags: string[], onLog?: (msg: string) => void): Promise<TagRelationResult[]> {
  if (tags.length < 2) return [];
  const batchSize = 30;
  const allResults: TagRelationResult[] = [];
  for (let i = 0; i < tags.length; i += batchSize) {
    const batch = tags.slice(i, i + batchSize);
    onLog?.(`\n=== 分析第 ${Math.floor(i / batchSize) + 1} 批标签 (${batch.length}个) ===`);
    onLog?.(`标签: ${batch.join(', ')}`);
    let resp = '';
    try {
      resp = await callLLM([
        { role: 'system', content: `你是知识图谱标签关联分析助手。分析以下标签列表中标签之间的语义关联。

关联类型：
- related: 两个标签有语义关联（如"React"和"前端"）
- parent_child: 一个是另一个的父概念（如"前端"是"React"的父概念）
- synonym: 两个标签含义相近（如"机器学习"和"ML"）

请仔细分析每对标签，找出所有有语义关联的标签对。

返回JSON数组，格式：
[{"a":"标签A","b":"标签B","type":"related","confidence":0.8,"reason":"两者都涉及..."}]

重要：
- a和b必须是标签列表中存在的标签，原样复制标签名
- confidence范围0-1，只返回confidence > 0.3的关联
- 尽可能多找出有关联的标签对，不要遗漏
- 例如"agent"和"智能体"是synonym，"prompt"和"agent"是related` },
        { role: 'user', content: `标签列表：\n${batch.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}` },
      ], onLog);
    } catch (e: any) {
      onLog?.(`[错误] ${e.message}`);
      throw new Error('LLM调用失败: ' + e.message);
    }
    if (!resp.trim()) {
      onLog?.('[错误] LLM返回空响应');
      throw new Error('LLM返回空响应');
    }
    try {
      const cleaned = resp.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const match = cleaned.match(/\[[\s\S]*?\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        onLog?.(`[解析] 找到 ${parsed.length} 条原始关联`);
        for (const r of parsed) {
          if (!r.a || !r.b || !['related', 'parent_child', 'synonym'].includes(r.type)) continue;
          allResults.push({
            tagA: String(r.a).trim(),
            tagB: String(r.b).trim(),
            relationType: r.type,
            confidence: Math.min(1, Math.max(0, r.confidence || 0.5)),
            reason: r.reason || '',
          });
        }
        onLog?.(`[结果] 有效关联 ${allResults.length} 条`);
      } else {
        onLog?.(`[解析失败] 未找到JSON数组, 原始: ${cleaned.slice(0, 200)}`);
        throw new Error('LLM返回格式错误: ' + resp.slice(0, 200));
      }
    } catch (e: any) {
      if (e.message.startsWith('LLM')) throw e;
      onLog?.(`[解析错误] ${e.message}`);
      throw new Error('JSON解析失败: ' + e.message);
    }
  }
  return allResults;
}

export function getLLMConfig() {
  return { baseUrl: LLM_BASE_URL, model: LLM_MODEL, configured: !!LLM_API_KEY };
}
