# 知海 · kb-next

> 让知识自然生长 —— 你的第二大脑。

一个本地优先的个人知识库系统：导入、阅读、关联、复习一体化。围绕"探索 → 沉淀 → 串联 → 复盘"四个动作组织内容，支持 Markdown 笔记、URL 抓取、标签图谱、间隔重复复习与 AI 智能标签关联。

![Next.js](https://img.shields.io/badge/Next.js-16.2.7-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 核心特性

- 📥 **多源导入**：Markdown 文本、文件上传、URL 网页抓取、JSON 批量导入
- 🔍 **全文搜索**：PostgreSQL pg_trgm + ts_rank 高亮片段，支持知识库与导入内容
- 🕸️ **知识图谱**：基于标签共现的可视化关系网络
- 🧠 **间隔复习**：SuperMemo-2 算法，每日推送到期卡片
- 🏷️ **AI 标签关联**：调用 LLM（OpenAI 兼容）自动发现标签间潜在关联
- 🌓 **暗色模式** + 中文章节字体优化（Noto Sans SC）
- 📊 **阅读进度持久化** + 活动流
- 🛡️ **完整鉴权**：JWT + 角色（admin/editor/viewer），首注册即 admin
- 🛡️ **导入安全**：限频、字段清洗、危险内容审查、SSRF 防护、批量上限
- ⚡ **客户端缓存**：SWR 包裹 `useApi`，10 秒去重、聚焦不重取
- 🔗 **统一路由**：导入文章与在线编辑文章统一走 `/knowledge/[slug]` 路由

## 🏗️ 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | Next.js 16.2.7 (App Router, Turbopack) |
| UI | React 19.2 + Tailwind CSS 4 |
| 数据库 | Supabase (PostgreSQL) + pg_trgm |
| 鉴权 | jose (JWT) + bcryptjs |
| 渲染 | remark + remark-gfm + remark-html |
| 缓存 | SWR |
| 测试 | Vitest + jsdom |

## 📦 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env
# 编辑 .env，填入 Supabase 密钥和 JWT_SECRET

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器
open http://localhost:3000
```

注册的第一个账号自动获得 `admin` 角色。

## ⚙️ 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SUPABASE_URL` | 是 | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | Supabase service_role 密钥（绕过 RLS） |
| `JWT_SECRET` | 是 | JWT 签名密钥，至少 16 位 |
| `LLM_API_KEY` | 否 | OpenAI 兼容 API 的 key（用于 AI 标签关联） |
| `LLM_BASE_URL` | 否 | API 基础地址，默认 `https://api.deepseek.com` |
| `LLM_MODEL` | 否 | 模型名，默认 `deepseek-chat` |

未配置 LLM 也能用，AI 标签关联功能会静默跳过。

## 📂 文章存储说明

系统中有两种文章来源，但统一通过 `/knowledge/[slug]` 路由访问：

| 来源 | 存储位置 | 主键 | 说明 |
| --- | --- | --- | --- |
| 在线编辑文章 | 本地文件系统 `content/knowledge/*.md` | slug（字符串） | gray-matter frontmatter + Markdown body，支持静态生成 |
| 导入文章 | Supabase `imported_articles` 表 | id（数字自增） | Markdown/URL/文件/JSON 导入，存储于 PostgreSQL |

访问 `/knowledge/abc` 时先查文件系统 `content/knowledge/abc.md`，未命中且 slug 为纯数字时回退查 Supabase `imported_articles` 表。旧链接 `/imported?id=N` 会自动重定向到 `/knowledge/N`。

## 📂 目录结构

```
src/
├── app/
│   ├── api/              # 路由处理（auth/imported/scrape/search/...）
│   ├── admin/            # 管理后台（知识/导入/AI/用户 4 个 tab）
│   ├── explore/          # 探索页（推荐 + 标签云）
│   ├── graph/            # 知识图谱
│   ├── import/           # 导入页（4 种来源）
│   ├── imported/         # 重定向到 /knowledge/[id] 或 /library
│   ├── knowledge/[slug]/ # 知识详情（文件系统 + 导入统一路由）
│   ├── library/          # 知识库（分类/标签/分页）
│   ├── login/            # 登录
│   ├── review/           # 复习
│   ├── scrape/           # URL 抓取（兼容旧入口）
│   ├── search/           # 搜索结果
│   └── tags/[tag]/       # 按标签筛选
├── components/           # UserMenu / ThemeToggle
└── lib/
    ├── articles.ts       # Markdown 加载 + 导入文章渲染
    ├── auth.ts           # JWT 鉴权
    ├── db.ts             # Supabase 数据操作
    ├── export.ts         # 导出
    ├── llm.ts            # LLM 客户端
    ├── ratelimit.ts      # 限频 (token bucket)
    ├── sanitize.ts       # 导入清洗 + 危险审查
    ├── shared.ts         # frontmatter / timeAgo
    └── useApi.ts         # SWR Hook
```

## 🗄️ 数据模型

- `users` — 用户与角色
- `imported_articles` — 导入内容（Markdown/URL/文件/JSON）
- `review_cards` — 复习卡片（SuperMemo-2 字段）
- `activities` — 用户活动流
- `tag_relations` — 标签关联（AI 或人工）
- `reading_progress` — 阅读进度（百分比）
- `article_keywords` — 文章关键词（语义关联）

## 🛡️ 安全要点

- **限频**：登录 10/15min · 注册 3/h · 导入 30/min · 抓取 20/min · 渲染 60/min（按用户+IP 双维度）
- **强度校验**：用户名 regex / 密码 ≥8 位含字母数字 / 保留名黑名单
- **时序防护**：登录失败时 200-500ms 随机延迟
- **导入清洗**：[sanitize.ts](src/lib/sanitize.ts) 限制字段长度、过滤控制字符、拒绝 `script/iframe/javascript:` 等危险内容
- **SSRF 防护**：抓取拒绝内网地址（127/10/192.168/172.16-31/fc/fd/fe80）
- **路径遍历防护**：slug 校验 `^[a-zA-Z0-9][a-zA-Z0-9\-_]*$`，禁止 `..`
- **搜索注入防护**：用户输入转义 `%_,\` 再拼 ilike 查询

## 🚀 部署

```bash
npm run build
npm start
```

`.env` 必须存在于运行目录。需在 Supabase Dashboard 执行 `schema.sql` 创建表结构，并禁用各表的行级安全策略（RLS）以允许 service_role 操作。

## 📜 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（Turbopack） |
| `npm run build` | 生产构建 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 跑测试 |
| `npm run test:watch` | 监听模式跑测试 |

## 📄 License

MIT
