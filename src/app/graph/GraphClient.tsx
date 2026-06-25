'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Article {
  title: string;
  tags: string[];
  category: string;
  slug?: string;
  id?: number;
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  color: string;
  count: number;
  cat: string;
  type: 'tag' | 'article';
  href?: string;
}

interface GraphEdge {
  si: number;
  ti: number;
  weight: number;
  aiRelation?: 'similar' | 'related' | 'prerequisite';
  confidence?: number;
}

interface TagRelationData {
  tagRelations: { tagA: string; tagB: string; relationType: string; confidence: number; reason: string }[];
  articleRelations: { articleAId: number; articleBId: number; articleATitle: string; articleBTitle: string; similarity: number; sharedKeywords: string[] }[];
}

const PALETTE: Record<string, { fill: string; glow: string; text: string }> = {
  '技术文档': { fill: '#5b8a72', glow: 'rgba(91,138,114,0.3)', text: '#3d6b54' },
  '最佳实践': { fill: '#e06050', glow: 'rgba(224,96,80,0.3)', text: '#b84030' },
  '方法论':   { fill: '#c4a882', glow: 'rgba(196,168,130,0.3)', text: '#9a8060' },
  '导入知识': { fill: '#7c6cdb', glow: 'rgba(124,108,219,0.3)', text: '#5a48b0' },
  '网页收藏': { fill: '#e88c3a', glow: 'rgba(232,140,58,0.3)', text: '#c06a18' },
  '未分类':   { fill: '#8b8fa3', glow: 'rgba(139,143,163,0.3)', text: '#6b6f83' },
};
const DEFAULT_P = { fill: '#8b8fa3', glow: 'rgba(139,143,163,0.3)', text: '#6b6f83' };

function fuzzyMatchTag(input: string, tagIdxMap: Map<string, number>): number | null {
  const trimmed = input.trim();
  if (tagIdxMap.has(trimmed)) return tagIdxMap.get(trimmed)!;
  const lower = trimmed.toLowerCase();
  for (const [tag, idx] of tagIdxMap) {
    if (tag.toLowerCase() === lower) return idx;
  }
  for (const [tag, idx] of tagIdxMap) {
    const tagLower = tag.toLowerCase();
    if (tagLower.includes(lower) || lower.includes(tagLower)) return idx;
  }
  return null;
}

export default function GraphClient({ articles: serverArticles }: { articles: Article[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const zoomRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const nodePosRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  const [is3D, setIs3D] = useState(false);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [tip, setTip] = useState<{ show: boolean; x: number; y: number; text: string; sub: string; cat: string }>({ show: false, x: 0, y: 0, text: '', sub: '', cat: '' });

  const [importedArticles, setImportedArticles] = useState<Article[]>([]);
  const [tagRelData, setTagRelData] = useState<TagRelationData>({ tagRelations: [], articleRelations: [] });

  const fetchData = useCallback(() => {
    fetch('/api/imported').then(r => r.json()).then(d => {
      if (d.articles) setImportedArticles(d.articles.map((a: any) => ({ id: a.id, title: a.title, tags: a.tags || ['导入'], category: a.category || '导入知识' })));
    }).catch(() => {});
    fetch('/api/graph').then(r => r.json()).then(d => {
      setTagRelData({ tagRelations: d.tagRelations || [], articleRelations: d.articleRelations || [] });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    let timer: ReturnType<typeof setInterval>;
    const startPolling = () => { timer = setInterval(fetchData, 120000); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') { fetchData(); startPolling(); }
      else { clearInterval(timer); }
    };
    startPolling();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchData]);

  const buildData = useCallback(() => {
    const articles: Article[] = [...serverArticles, ...importedArticles].filter(a => a.slug || a.id);
    const totalArticles = articles.length || 1;

    // Only use original article tags
    const tagSet = new Set<string>();
    articles.forEach(a => a.tags.forEach(t => tagSet.add(t)));

    // Filter out overly generic tags (appear in >50% of articles)
    const tagArticleCount = new Map<string, number>();
    articles.forEach(a => {
      const uniqueTags = [...new Set(a.tags)];
      uniqueTags.forEach(t => { tagArticleCount.set(t, (tagArticleCount.get(t)||0)+1); });
    });
    const GENERIC_THRESHOLD = totalArticles * 0.5;
    const genericTags = new Set([...tagArticleCount.entries()].filter(([,c]) => c > GENERIC_THRESHOLD).map(([t]) => t));
    genericTags.forEach(t => tagSet.delete(t));

    const tagList = [...tagSet];

    const tagCount = new Map<string, number>();
    const tagCat = new Map<string, string>();
    articles.forEach(a => a.tags.forEach(t => {
      if (genericTags.has(t)) return;
      tagCount.set(t, (tagCount.get(t)||0)+1);
      if (!tagCat.has(t)) tagCat.set(t, a.category);
    }));

    const maxCount = Math.max(...[...tagCount.values()], 1);

    // Tag nodes as first-level, positioned in a circle
    const tagAngleStep = (Math.PI * 2) / tagList.length;
    const savedPos = nodePosRef.current;
    const nodes: GraphNode[] = tagList.map((tag, i) => {
      const c = tagCount.get(tag) || 1;
      const norm = c / maxCount;
      const angle = tagAngleStep * i - Math.PI / 2;
      const radius = 200;
      const prev = savedPos.get(tag);
      return {
        id: tag,
        x: prev?.x ?? Math.cos(angle) * radius,
        y: prev?.y ?? Math.sin(angle) * radius,
        z: prev?.z ?? (Math.random() - 0.5) * 200,
        vx: 0, vy: 0, vz: 0,
        r: 20 + norm * 28,
        color: PALETTE[tagCat.get(tag) || '']?.fill || DEFAULT_P.fill,
        count: c,
        cat: tagCat.get(tag) || '未分类',
        type: 'tag',
        href: '/tags/' + encodeURIComponent(tag),
      };
    });

    // Article nodes as second-level, orbit around their first tag
    const tagIdxMap = new Map<string, number>();
    tagList.forEach((tag, i) => tagIdxMap.set(tag, i));
    const tagArticleMap = new Map<string, number[]>(); // tag -> article indices in nodes

    const MAX_TAGS_PER_ARTICLE = 3;
    const articleNodes: GraphNode[] = [];
    const articleToTags = new Map<number, string[]>(); // articleNodeIndex -> limitedTags
    const articleIdToNodeIdx = new Map<number, number>(); // article.id -> node index in nodes[]

    const validArticles = articles.map(a => {
      const filteredTags = a.tags.filter(t => !genericTags.has(t) && tagIdxMap.has(t));
      return { a, limitedTags: filteredTags.slice(0, MAX_TAGS_PER_ARTICLE) };
    }).filter(({ limitedTags }) => limitedTags.length > 0);

    validArticles.forEach(({ a, limitedTags }) => {
      const primaryTag = limitedTags[0];
      const tagNode = nodes[tagIdxMap.get(primaryTag)!];
      const existing = tagArticleMap.get(primaryTag) || [];
      const orbitIdx = existing.length;
      const orbitAngle = (orbitIdx / Math.max(tagNode.count, 1)) * Math.PI * 2 + Math.random() * 0.3;
      const orbitRadius = 80 + tagNode.r;
      const href = a.slug ? `/knowledge/${a.slug}` : `/knowledge/${a.id}`;
      const artKey = a.slug ? `s:${a.slug}` : `i:${a.id}`;
      const prevArt = savedPos.get(artKey);

      const nodeIdx = nodes.length + articleNodes.length;
      existing.push(nodeIdx);
      tagArticleMap.set(primaryTag, existing);
      articleToTags.set(articleNodes.length, limitedTags);
      if (a.id) articleIdToNodeIdx.set(a.id, nodeIdx);

      articleNodes.push({
        id: a.title,
        x: prevArt?.x ?? tagNode.x + Math.cos(orbitAngle) * orbitRadius,
        y: prevArt?.y ?? tagNode.y + Math.sin(orbitAngle) * orbitRadius,
        z: prevArt?.z ?? tagNode.z + (Math.random() - 0.5) * 100,
        vx: 0, vy: 0, vz: 0,
        r: 8,
        color: PALETTE[a.category || '']?.fill || DEFAULT_P.fill,
        count: 1,
        cat: a.category || '未分类',
        type: 'article' as const,
        href,
      });
    });
    nodes.push(...articleNodes);

    // Edges: article -> its tags (use pre-computed mapping, no O(n²) filter)
    const edges: GraphEdge[] = [];
    articleNodes.forEach((_, ai) => {
      const limitedTags = articleToTags.get(ai)!;
      const articleNodeIdx = tagList.length + ai;
      limitedTags.forEach(tag => {
        const tagIdx = tagIdxMap.get(tag);
        if (tagIdx !== undefined) {
          edges.push({ si: articleNodeIdx, ti: tagIdx, weight: 1 });
        }
      });
    });

    // Tag-tag edges: LLM relations (fuzzy match) + co-occurrence fallback
    const addedTagEdges = new Set<string>();
    const addTagEdge = (ai: number, bi: number) => {
      const key = `${Math.min(ai, bi)}-${Math.max(ai, bi)}`;
      if (!addedTagEdges.has(key)) {
        addedTagEdges.add(key);
        edges.push({ si: Math.min(ai, bi), ti: Math.max(ai, bi), weight: 0.3 });
      }
    };

    // LLM tag relations with fuzzy matching
    for (const tr of tagRelData.tagRelations) {
      const ti = fuzzyMatchTag(tr.tagA, tagIdxMap);
      const ni = fuzzyMatchTag(tr.tagB, tagIdxMap);
      if (ti !== null && ni !== null && ti !== ni) addTagEdge(ti, ni);
    }

    // Co-occurrence fallback: tags sharing articles (use pre-computed data)
    validArticles.forEach(({ limitedTags }) => {
      for (let i = 0; i < limitedTags.length; i++) {
        for (let j = i + 1; j < limitedTags.length; j++) {
          const ai = tagIdxMap.get(limitedTags[i])!;
          const bi = tagIdxMap.get(limitedTags[j])!;
          addTagEdge(ai, bi);
        }
      }
    });

    // 文章语义关联边（基于 LLM 关键词余弦相似度）
    for (const ar of tagRelData.articleRelations) {
      const ai = articleIdToNodeIdx.get(ar.articleAId);
      const bi = articleIdToNodeIdx.get(ar.articleBId);
      if (ai !== undefined && bi !== undefined && ai !== bi) {
        edges.push({ si: Math.min(ai, bi), ti: Math.max(ai, bi), weight: ar.similarity, aiRelation: 'similar', confidence: ar.similarity });
      }
    }

    return { nodes, edges, tagArticleMap, tagIdxMap };
  }, [serverArticles, importedArticles, tagRelData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { nodes, edges, tagArticleMap, tagIdxMap } = buildData();
    const tagCount = tagIdxMap ? tagIdxMap.size : 0;
    setStats({ nodes: nodes.length, edges: edges.length });
    if (nodes.length === 0) return;

    let alpha = nodePosRef.current.size > 0 ? 0.15 : 0.8;
    let hoverIdx = -1;
    let prevHoverIdx = -1;
    let dragging = false;
    let dragNode = -1;
    let dragOffX = 0, dragOffY = 0;
    let prevZoom = 0, prevPanX = 0, prevPanY = 0;
    let rotationY = 0;
    let rotationX = 0;
    let autoRotate = is3D;
    let mouseX = 0, mouseY = 0;
    let zoom = 1;
    let panX = 0, panY = 0;
    let panning = false;
    let panStartX = 0, panStartY = 0;
    let didPan = false;

    const canvasEl = canvas;
    const ctxEl = ctx;

    function resize() {
      if (!canvasEl) return { w: 800, h: 600 };
      const parent = canvasEl.parentElement;
      if (!parent) return { w: 800, h: 600 };
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!ctxEl) return { w, h };
      if (canvasEl.width !== w * dpr || canvasEl.height !== h * dpr) {
        canvasEl.width = w * dpr;
        canvasEl.height = h * dpr;
        canvasEl.style.width = w + 'px';
        canvasEl.style.height = h + 'px';
      }
      ctxEl.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    function project3D(x: number, y: number, z: number, cx: number, cy: number) {
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const perspective = 800;
      const scale = perspective / (perspective + z2 + 400);
      return { x: cx + x1 * scale, y: cy + y1 * scale, scale, z: z2 };
    }

    function getNodePos(n: GraphNode, cx: number, cy: number) {
      if (is3D) {
        const p = project3D(n.x, n.y, n.z, 0, 0);
        return { x: cx + (p.x + panX) * zoom, y: cy + (p.y + panY) * zoom, scale: p.scale * zoom, z: p.z };
      }
      return { x: cx + (n.x + panX) * zoom, y: cy + (n.y + panY) * zoom, scale: zoom, z: 0 };
    }

    function loop() {
      zoom = zoomRef.current.zoom;
      panX = zoomRef.current.panX;
      panY = zoomRef.current.panY;
      const { w, h } = resize();
      const cx = w / 2;
      const cy = h / 2;
      if (!ctxEl) return;

      // Background gradient
      const bg = ctxEl.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#faf8f5');
      bg.addColorStop(1, '#f0ece5');
      ctxEl.fillStyle = bg;
      ctxEl.fillRect(0, 0, w, h);

      if (autoRotate && is3D) {
        rotationY += 0.003;
        rotationX = Math.sin(Date.now() * 0.0005) * 0.2;
      }

      // Force simulation
      if (alpha > 0.001) {
        // Tag-tag repulsion (keep tags spaced)
        for (let i = 0; i < tagCount; i++) {
          for (let j = i + 1; j < tagCount; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dz = is3D ? nodes[j].z - nodes[i].z : 0;
            const d = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
            const minDist = (nodes[i].r + nodes[j].r) * 3;
            const repulse = (5000 * alpha) / (d * d);
            const overlap = minDist - d;
            const pushF = overlap > 0 ? overlap * 0.5 * alpha : 0;
            const f = repulse + pushF;
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            const fz = is3D ? (dz / d) * f : 0;
            nodes[i].vx -= fx; nodes[i].vy -= fy; if (is3D) nodes[i].vz -= fz;
            nodes[j].vx += fx; nodes[j].vy += fy; if (is3D) nodes[j].vz += fz;
          }
        }
        // Article-article repulsion (light)
        for (let i = tagCount; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dz = is3D ? nodes[j].z - nodes[i].z : 0;
            const d = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
            const minDist = (nodes[i].r + nodes[j].r) * 2;
            const repulse = (800 * alpha) / (d * d);
            const overlap = minDist - d;
            const pushF = overlap > 0 ? overlap * 0.3 * alpha : 0;
            const f = repulse + pushF;
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            const fz = is3D ? (dz / d) * f : 0;
            nodes[i].vx -= fx; nodes[i].vy -= fy; if (is3D) nodes[i].vz -= fz;
            nodes[j].vx += fx; nodes[j].vy += fy; if (is3D) nodes[j].vz += fz;
          }
        }
        // Edge attraction: articles orbit their tags
        edges.forEach(e => {
          const s = nodes[e.si], t = nodes[e.ti];
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dz = is3D ? t.z - s.z : 0;
          const d = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
          const isArticleTag = s.type !== t.type;
          const idealDist = isArticleTag ? (100 + t.r) : 250;
          const strength = isArticleTag ? 0.04 : 0.01;
          const f = (d - idealDist) * strength * alpha;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          const fz = is3D ? (dz / d) * f : 0;
          s.vx += fx; s.vy += fy; if (is3D) s.vz += fz;
          t.vx -= fx; t.vy -= fy; if (is3D) t.vz -= fz;
        });
        // Tag center gravity (keep tags from drifting too far)
        for (let i = 0; i < tagCount; i++) {
          nodes[i].vx -= nodes[i].x * 0.002 * alpha;
          nodes[i].vy -= nodes[i].y * 0.002 * alpha;
          if (is3D) nodes[i].vz -= nodes[i].z * 0.002 * alpha;
        }
        // Article center gravity (lighter)
        for (let i = tagCount; i < nodes.length; i++) {
          nodes[i].vx -= nodes[i].x * 0.001 * alpha;
          nodes[i].vy -= nodes[i].y * 0.001 * alpha;
          if (is3D) nodes[i].vz -= nodes[i].z * 0.001 * alpha;
        }
        // Apply velocity
        nodes.forEach((n, i) => {
          if (i === dragNode) return;
          const damping = i < tagCount ? 0.6 : 0.4;
          n.vx *= damping; n.vy *= damping; n.x += n.vx; n.y += n.vy;
          if (is3D) { n.vz *= damping; n.z += n.vz; }
        });
        alpha -= 0.002;
      }

      // Compute positions
      const positions = nodes.map(n => getNodePos(n, cx, cy));

      // Sort by z for 3D
      let drawOrder = nodes.map((n, i) => ({ n, i, z: positions[i].z }));
      if (is3D) drawOrder.sort((a, b) => a.z - b.z);

      // Draw edges
      edges.forEach(e => {
        const sp = positions[e.si];
        const tp = positions[e.ti];
        const isConn = hoverIdx >= 0 && (hoverIdx === e.si || hoverIdx === e.ti);
        const dim = hoverIdx >= 0 && !isConn;
        const isArticleTag = nodes[e.si].type !== nodes[e.ti].type;
        const isTagTag = nodes[e.si].type === 'tag' && nodes[e.ti].type === 'tag';
        const isArticleArticle = nodes[e.si].type === 'article' && nodes[e.ti].type === 'article';

        ctxEl.globalAlpha = dim ? 0.04 : isConn ? 0.6 : isArticleArticle ? 0.25 : isArticleTag ? 0.2 : isTagTag ? 0.15 : 0.1;
        ctxEl.strokeStyle = isConn
          ? (PALETTE[nodes[hoverIdx]?.cat]?.fill || '#e85d4e')
          : isArticleArticle ? '#5b8a72' : isTagTag ? '#7c6cdb' : '#c8c0b4';
        ctxEl.lineWidth = isConn ? 1.2 : isArticleArticle ? 1 : isArticleTag ? 0.8 : 0.7;

        if (isTagTag) ctxEl.setLineDash([4, 4]);
        else if (isArticleArticle) ctxEl.setLineDash([2, 3]);
        else ctxEl.setLineDash([]);

        ctxEl.beginPath();
        ctxEl.moveTo(sp.x, sp.y);
        ctxEl.lineTo(tp.x, tp.y);
        ctxEl.stroke();
      });
      ctxEl.setLineDash([]);
      ctxEl.globalAlpha = 1;

      // Draw nodes
      drawOrder.forEach(({ n, i }) => {
        const p = positions[i];
        const isH = i === hoverIdx;
        const isConn = hoverIdx >= 0 && edges.some(e => (e.si === hoverIdx && e.ti === i) || (e.ti === hoverIdx && e.si === i));
        const dim = hoverIdx >= 0 && !isH && !isConn;
        const isTag = n.type === 'tag';
        const r = n.r * p.scale * (isH ? 1.3 : isConn ? 1.1 : 1);
        const ga = dim ? 0.15 : 1;
        const pal = PALETTE[n.cat] || DEFAULT_P;

        if (r < 1) return;

        // Outer glow
        if (!dim) {
          const glowR = r + (isH ? 16 : isTag ? 8 : 5);
          const grad = ctxEl.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, glowR);
          grad.addColorStop(0, pal.glow);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctxEl.globalAlpha = ga * (isH ? 0.7 : 0.3);
          ctxEl.fillStyle = grad;
          ctxEl.beginPath();
          ctxEl.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctxEl.fill();
        }

        if (isTag) {
          // Tag node: filled circle with count
          const cGrad = ctxEl.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
          cGrad.addColorStop(0, lighten(pal.fill, 30));
          cGrad.addColorStop(1, pal.fill);
          ctxEl.globalAlpha = ga;
          ctxEl.fillStyle = cGrad;
          ctxEl.beginPath();
          ctxEl.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctxEl.fill();

          ctxEl.strokeStyle = isH ? '#fff' : 'rgba(255,255,255,0.5)';
          ctxEl.lineWidth = isH ? 2.5 : 1;
          ctxEl.globalAlpha = ga * (isH ? 1 : 0.6);
          ctxEl.stroke();

          if (r > 12) {
            ctxEl.font = `700 ${Math.max(10, 11 * p.scale)}px Inter, sans-serif`;
            ctxEl.textAlign = 'center';
            ctxEl.textBaseline = 'middle';
            ctxEl.fillStyle = '#fff';
            ctxEl.globalAlpha = ga * 0.95;
            ctxEl.fillText(n.count + '', p.x, p.y);
            ctxEl.textBaseline = 'alphabetic';
          }
        } else {
          // Article node: small circle with border
          ctxEl.globalAlpha = ga;
          ctxEl.fillStyle = '#fff';
          ctxEl.beginPath();
          ctxEl.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctxEl.fill();

          ctxEl.strokeStyle = pal.fill;
          ctxEl.lineWidth = isH ? 2.5 : 1.5;
          ctxEl.globalAlpha = ga * (isH ? 1 : 0.7);
          ctxEl.stroke();
        }

        // Label
        const showLabel = !dim && (isTag ? (zoom > 0.5 || n.count >= 2 || isH || isConn) : (zoom > 1 || isH || isConn));
        if (showLabel && p.scale > 0.35) {
          const fontSize = Math.max(isTag ? 11 : 9, (isH ? 13 : isTag ? 11 : 9) * p.scale);
          ctxEl.font = `${isH ? '700' : '500'} ${fontSize}px "Noto Sans SC", sans-serif`;
          ctxEl.textAlign = 'center';
          const labelY = p.y + r + 12 * p.scale;
          const textW = ctxEl.measureText(n.id).width;

          ctxEl.fillStyle = 'rgba(250,248,245,0.85)';
          ctxEl.globalAlpha = ga * 0.7;
          const pad = 4;
          ctxEl.beginPath();
          roundRect(ctxEl, p.x - textW / 2 - pad, labelY - fontSize + 2, textW + pad * 2, fontSize + 4, 4);
          ctxEl.fill();

          ctxEl.fillStyle = isTag ? pal.text : '#6b6f83';
          ctxEl.globalAlpha = ga * (isH ? 1 : 0.85);
          ctxEl.fillText(n.id, p.x, labelY);
        }

        ctxEl.globalAlpha = 1;
      });

      const cz = zoomRef.current.zoom, cpx = zoomRef.current.panX, cpy = zoomRef.current.panY;
      const viewChanged = cz !== prevZoom || cpx !== prevPanX || cpy !== prevPanY;
      prevZoom = cz; prevPanX = cpx; prevPanY = cpy;
      const hoverChanged = hoverIdx !== prevHoverIdx;
      prevHoverIdx = hoverIdx;
      const idle = alpha < 0.001 && !autoRotate && !dragging && !viewChanged && !hoverChanged;
      if (idle) { rafRef.current = 0; return; }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    function ensureRAF() { if (rafRef.current === 0) rafRef.current = requestAnimationFrame(loop); }

    function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function lighten(hex: string, amt: number): string {
      const num = parseInt(hex.slice(1), 16);
      const r = Math.min(255, ((num >> 16) & 0xff) + amt);
      const g = Math.min(255, ((num >> 8) & 0xff) + amt);
      const b = Math.min(255, (num & 0xff) + amt);
      return `rgb(${r},${g},${b})`;
    }

    function getMouseNode(mx: number, my: number): number {
      const rect = canvasEl.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const p = getNodePos(nodes[i], cx, cy);
        const d = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2);
        if (d < nodes[i].r * p.scale + 8) return i;
      }
      return -1;
    }

    const onMouseMove = (e: MouseEvent) => {
      ensureRAF();
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mouseX = mx; mouseY = my;
      if (dragging && dragNode >= 0) {
        const cx = rect.width / 2, cy = rect.height / 2;
        nodes[dragNode].x = (mx - cx) / zoom - panX - dragOffX / zoom;
        nodes[dragNode].y = (my - cy) / zoom - panY - dragOffY / zoom;
        nodes[dragNode].vx = 0;
        nodes[dragNode].vy = 0;
        alpha = Math.max(alpha, 0.08);
        return;
      }
      if (panning) {
        panX = (e.clientX - panStartX) / zoom;
        panY = (e.clientY - panStartY) / zoom;
        didPan = true;
        zoomRef.current = { zoom, panX, panY };
        return;
      }
      const idx = getMouseNode(mx, my);
      hoverIdx = idx;
      canvasEl.style.cursor = idx >= 0 ? 'pointer' : 'default';
      if (idx >= 0) {
        const n = nodes[idx];
        const connCount = edges.filter(e => e.si === idx || e.ti === idx).length;
        const sub = n.type === 'tag' ? `${n.count} 篇文章 · ${connCount} 个关联` : `文章 · ${connCount} 个关联`;
        setTip({ show: true, x: e.clientX + 15, y: e.clientY - 10, text: n.id, sub, cat: n.cat });
      } else {
        setTip(t => ({ ...t, show: false }));
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      ensureRAF();
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      dragNode = getMouseNode(mx, my);
      if (dragNode >= 0) {
        dragging = true;
        const cx = rect.width / 2, cy = rect.height / 2;
        dragOffX = mx - (cx + (nodes[dragNode].x + panX) * zoom);
        dragOffY = my - (cy + (nodes[dragNode].y + panY) * zoom);
        canvasEl.style.cursor = 'grabbing';
      } else {
        panning = true;
        didPan = false;
        panStartX = e.clientX - panX * zoom;
        panStartY = e.clientY - panY * zoom;
        canvasEl.style.cursor = 'move';
      }
    };

    const onMouseUp = () => {
      dragging = false;
      panning = false;
      dragNode = -1;
      canvasEl.style.cursor = hoverIdx >= 0 ? 'pointer' : 'default';
    };

    const onMouseLeave = () => {
      hoverIdx = -1;
      dragging = false;
      panning = false;
      setTip(t => ({ ...t, show: false }));
    };

    const onWheel = (e: WheelEvent) => {
      ensureRAF();
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.2, Math.min(5, zoom * delta));
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const wx = (mx - cx) / zoom - panX;
      const wy = (my - cy) / zoom - panY;
      zoom = newZoom;
      panX = (mx - cx) / zoom - wx;
      panY = (my - cy) / zoom - wy;
      zoomRef.current = { zoom, panX, panY };
    };

    const onClick = () => {
      if (didPan) { didPan = false; return; }
      if (!dragging && hoverIdx >= 0) {
        const n = nodes[hoverIdx];
        if (n.href && n.href !== '#') {
          window.location.href = n.href;
        }
      }
    };

    let touchPinchDist = 0;

    const onTouchStart = (e: TouchEvent) => {
      ensureRAF();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const rect = canvasEl.getBoundingClientRect();
        const mx = t.clientX - rect.left;
        const my = t.clientY - rect.top;
        dragNode = getMouseNode(mx, my);
        if (dragNode >= 0) {
          dragging = true;
          const cx = rect.width / 2, cy = rect.height / 2;
          dragOffX = mx - (cx + (nodes[dragNode].x + panX) * zoom);
          dragOffY = my - (cy + (nodes[dragNode].y + panY) * zoom);
        } else {
          panning = true;
          didPan = false;
          panStartX = t.clientX - panX * zoom;
          panStartY = t.clientY - panY * zoom;
        }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchPinchDist = Math.sqrt(dx * dx + dy * dy);
        dragging = false;
        panning = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      ensureRAF();
      e.preventDefault();
      if (e.touches.length === 1 && (dragging || panning)) {
        const t = e.touches[0];
        const rect = canvasEl.getBoundingClientRect();
        const mx = t.clientX - rect.left;
        const my = t.clientY - rect.top;
        if (dragging && dragNode >= 0) {
          const cx = rect.width / 2, cy = rect.height / 2;
          nodes[dragNode].x = (mx - cx) / zoom - panX - dragOffX / zoom;
          nodes[dragNode].y = (my - cy) / zoom - panY - dragOffY / zoom;
          nodes[dragNode].vx = 0;
          nodes[dragNode].vy = 0;
          alpha = Math.max(alpha, 0.08);
        } else if (panning) {
          panX = (t.clientX - panStartX) / zoom;
          panY = (t.clientY - panStartY) / zoom;
          didPan = true;
          zoomRef.current = { zoom, panX, panY };
        }
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (touchPinchDist > 0) {
          const delta = dist / touchPinchDist;
          zoom = Math.max(0.2, Math.min(5, zoom * delta));
          zoomRef.current = { zoom, panX, panY };
        }
        touchPinchDist = dist;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (!didPan && !dragging && hoverIdx >= 0) {
          const n = nodes[hoverIdx];
          if (n.href && n.href !== '#') {
            window.location.href = n.href;
          }
        }
        dragging = false;
        panning = false;
        dragNode = -1;
        touchPinchDist = 0;
      }
    };

    canvasEl.addEventListener('mousemove', onMouseMove);
    canvasEl.addEventListener('mousedown', onMouseDown);
    canvasEl.addEventListener('mouseup', onMouseUp);
    canvasEl.addEventListener('mouseleave', onMouseLeave);
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    canvasEl.addEventListener('click', onClick);
    canvasEl.addEventListener('touchstart', onTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', onTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', onTouchEnd);

    return () => {
      const posMap = new Map<string, { x: number; y: number; z: number }>();
      nodes.forEach(n => {
        if (n.type === 'tag') {
          posMap.set(n.id, { x: n.x, y: n.y, z: n.z });
        } else if (n.href) {
          const key = `s:${n.href.replace('/knowledge/', '')}`;
          posMap.set(key, { x: n.x, y: n.y, z: n.z });
        }
      });
      nodePosRef.current = posMap;
      cancelAnimationFrame(rafRef.current);
      canvasEl.removeEventListener('mousemove', onMouseMove);
      canvasEl.removeEventListener('mousedown', onMouseDown);
      canvasEl.removeEventListener('mouseup', onMouseUp);
      canvasEl.removeEventListener('mouseleave', onMouseLeave);
      canvasEl.removeEventListener('wheel', onWheel);
      canvasEl.removeEventListener('click', onClick);
      canvasEl.removeEventListener('touchstart', onTouchStart);
      canvasEl.removeEventListener('touchmove', onTouchMove);
      canvasEl.removeEventListener('touchend', onTouchEnd);
    };
  }, [buildData, is3D]);

  const handleZoomIn = () => { zoomRef.current.zoom = Math.min(5, zoomRef.current.zoom * 1.2); };
  const handleZoomOut = () => { zoomRef.current.zoom = Math.max(0.2, zoomRef.current.zoom * 0.8); };
  const handleZoomReset = () => { zoomRef.current = { zoom: 1, panX: 0, panY: 0 }; };

  const legendItems = Object.entries(PALETTE).map(([cat, pal]) => ({ cat, color: pal.fill }));

  return (
    <div className="page-enter">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-ink mb-2">知识图谱</h1>
          <p className="text-slate-500">你的知识是如何连接的</p>
        </div>
      </div>
      <div className="relative border-y border-warm overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 500, background: 'linear-gradient(135deg, #faf8f5 0%, #f0ece5 100%)' }}>
        <a href="/library" className="absolute top-6 right-6 z-10 bg-white/90 backdrop-blur rounded-xl border border-warm shadow-lg px-4 py-2 text-sm text-slate-600 hover:text-ink hover:bg-white transition-colors flex items-center gap-2">
          <i className="fas fa-arrow-left text-xs"></i>返回知识库
        </a>
        <canvas ref={canvasRef} role="img" aria-label="知识图谱可视化，显示文章与标签的关联网络" className="w-full h-full block" />
        <div className="absolute top-6 left-6 bg-white/90 backdrop-blur rounded-xl border border-warm shadow-lg overflow-hidden flex">
          <button onClick={() => setIs3D(false)} className={`px-4 py-2 text-xs font-semibold transition-colors ${!is3D ? 'bg-accent text-white' : 'text-slate-500 hover:text-ink'}`}>2D</button>
          <button onClick={() => setIs3D(true)} className={`px-4 py-2 text-xs font-semibold transition-colors ${is3D ? 'bg-accent text-white' : 'text-slate-500 hover:text-ink'}`}>3D</button>
        </div>
        <div className="absolute top-6 left-28 bg-white/90 backdrop-blur rounded-xl border border-warm shadow-lg overflow-hidden flex flex-col">
          <button onClick={handleZoomIn} className="px-3 py-2 text-slate-500 hover:text-ink hover:bg-warm/50 transition-colors text-lg leading-none font-light">+</button>
          <div className="border-t border-warm"></div>
          <button onClick={handleZoomOut} className="px-3 py-2 text-slate-500 hover:text-ink hover:bg-warm/50 transition-colors text-lg leading-none font-light">−</button>
          <div className="border-t border-warm"></div>
          <button onClick={handleZoomReset} className="px-3 py-1.5 text-slate-500 hover:text-ink hover:bg-warm/50 transition-colors text-[10px] leading-none">重置</button>
        </div>
        <div className="absolute top-6 right-6 bg-white/90 backdrop-blur rounded-xl p-3 border border-warm shadow-lg text-xs text-slate-500">
          <div className="mb-1 font-medium text-ink">{stats.nodes} 节点</div>
          <div>{stats.edges} 连接</div>
        </div>
        <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur rounded-xl p-4 border border-warm shadow-lg">
          <div className="space-y-2 text-xs">
            <div className="text-slate-400 font-medium mb-1">节点类型</div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 bg-accent"></span>
              <span className="text-slate-600">标签（大圆）</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 border-2 border-accent bg-white"></span>
              <span className="text-slate-600">文章（小圆）</span>
            </div>
            <div className="border-t border-warm my-2 pt-2">
              <div className="text-slate-400 font-medium mb-1">分类</div>
              {legendItems.map(item => (
                <div key={item.cat} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-600">{item.cat}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-warm my-2 pt-2">
              <div className="text-slate-400 font-medium mb-1">标签关联</div>
              <div className="flex items-center gap-2"><span className="w-4 border-t" style={{ borderColor: '#c8c0b4' }}></span><span className="text-slate-600">关联</span></div>
              <div className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: '#7c6cdb' }}></span><span className="text-slate-600">父子</span></div>
              <div className="flex items-center gap-2"><span className="w-4 border-t-2 border-dotted" style={{ borderColor: '#5b8a72' }}></span><span className="text-slate-600">同义</span></div>
            </div>
            <div className="border-t border-warm my-2 pt-2">
              <div className="text-slate-400 font-medium mb-1">文章语义关联</div>
              <div className="flex items-center gap-2"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: '#5b8a72' }}></span><span className="text-slate-600">语义相似</span></div>
            </div>
          </div>
        </div>
        {tip.show && (
          <div className="fixed bg-ink text-paper text-sm px-4 py-2.5 rounded-xl shadow-xl pointer-events-none z-50" style={{ left: tip.x, top: tip.y }}>
            <div className="font-semibold mb-0.5">{tip.text}</div>
            <div className="opacity-70 text-xs">{tip.sub}</div>
          </div>
        )}
      </div>
    </div>
  );
}
