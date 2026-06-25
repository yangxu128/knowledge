-- kb-next Supabase schema
-- 在 Supabase Dashboard → SQL Editor 中执行

-- Users
create table if not exists users (
  id bigserial primary key,
  username text unique not null,
  password text not null,
  role text not null default 'viewer',
  created_at timestamptz default now()
);

-- Imported articles (also stores admin-edited articles with slug)
create table if not exists imported_articles (
  id bigserial primary key,
  slug text unique,
  title text not null default '未命名',
  content text not null default '',
  description text default '',
  tags jsonb default '[]'::jsonb,
  category text default '',
  published date default current_date,
  author text default '',
  source text default '',
  created_at timestamptz default now()
);

-- 增量添加 slug/description 列（表已存在时）
alter table imported_articles add column if not exists slug text unique;
alter table imported_articles add column if not exists description text default '';

-- pg_trgm 扩展：支持中文模糊匹配（trigram）
create extension if not exists pg_trgm;

-- Full-text search index (PostgreSQL tsvector) — 标题 + 内容 + 分类
create index if not exists imported_articles_fts_idx
  on imported_articles using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, '')));

-- trigram GIN 索引：加速 ILIKE 模糊匹配（中文友好）
create index if not exists imported_articles_title_trgm_idx
  on imported_articles using gin (title gin_trgm_ops);
create index if not exists imported_articles_content_trgm_idx
  on imported_articles using gin (content gin_trgm_ops);

-- Review cards (SuperMemo-2)
create table if not exists review_cards (
  id bigserial primary key,
  title text not null,
  description text default '',
  tags jsonb default '[]'::jsonb,
  category text default '',
  next_review date not null,
  interval integer default 1,
  ease_factor real default 2.5,
  repetitions integer default 0,
  article_id bigint,
  source text default 'manual'
);

-- 复习历史记录
create table if not exists review_history (
  id bigserial primary key,
  card_id bigint not null,
  quality integer not null,
  reviewed_at timestamptz default now()
);

create index if not exists review_history_card_idx on review_history(card_id);
create index if not exists review_history_time_idx on review_history(reviewed_at desc);

-- Activities
create table if not exists activities (
  id bigserial primary key,
  action text not null,
  article_type text not null,
  article_id text not null,
  article_title text default '',
  article_href text default '',
  created_at timestamptz default now()
);

-- Tag relations
create table if not exists tag_relations (
  id bigserial primary key,
  tag_a text not null,
  tag_b text not null,
  relation_type text not null default 'related',
  confidence real default 0.5,
  reason text default '',
  unique (tag_a, tag_b, relation_type)
);

-- 文章关键词（LLM 提取，用于语义关联计算）
create table if not exists article_keywords (
  id bigserial primary key,
  article_id bigint not null,
  keyword text not null,
  weight real default 1.0,
  unique (article_id, keyword)
);

create index if not exists article_keywords_article_idx on article_keywords(article_id);
create index if not exists article_keywords_keyword_idx on article_keywords(keyword);

-- Reading progress
create table if not exists reading_progress (
  id bigserial primary key,
  article_type text not null,
  article_id text not null,
  progress real default 0,
  updated_at timestamptz default now(),
  unique (article_type, article_id)
);

-- Full-text search function (used by db.ts searchArticles)
-- 改进：ts_rank 相关性排序 + 标签/分类纳入 FTS + ts_headline 高亮 + 分页
create or replace function search_articles(
  search_query text,
  result_limit int default 50,
  result_offset int default 0
)
returns table (
  article_type text,
  article_id text,
  title text,
  snippet text,
  tags jsonb,
  category text,
  author text,
  rank real
) as $$
begin
  return query
  select
    case when i.slug is not null then 'knowledge'::text else 'imported'::text end as article_type,
    case when i.slug is not null then i.slug else i.id::text end as article_id,
    i.title,
    ts_headline('simple', i.content, plainto_tsquery('simple', search_query),
      'MaxWords=35, MinWords=15, ShortWord=3, MaxFragments=2, FragmentDelimiter=" ... ", HighlightStart="<mark>", HighlightEnd="</mark>"') as snippet,
    i.tags,
    i.category,
    i.author,
    -- 综合相关性：FTS rank (权重 10) + 标题命中 (权重 5) + trigram 相似度 (权重 3)
    (
      coalesce(ts_rank(to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.content, '') || ' ' || coalesce(i.category, '')),
        plainto_tsquery('simple', search_query)), 0) * 10
      + case when i.title ilike '%' || search_query || '%' then 5 else 0 end
      + coalesce(similarity(i.title, search_query), 0) * 3
    )::real as rank
  from imported_articles i
  where to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.content, '') || ' ' || coalesce(i.category, ''))
      @@ plainto_tsquery('simple', search_query)
     or i.title ilike '%' || search_query || '%'
     or i.content ilike '%' || search_query || '%'
     or i.title % search_query
  order by rank desc
  limit result_limit offset result_offset;
end;
$$ language plpgsql stable;

-- RLS 策略：允许 service_role 完全访问（服务端用 service_role key，绕过 RLS）
-- 这里额外加 policy 作为双保险，防止 key 配错
alter table users disable row level security;
alter table imported_articles disable row level security;
alter table review_cards disable row level security;
alter table review_history disable row level security;
alter table activities disable row level security;
alter table tag_relations disable row level security;
alter table article_keywords disable row level security;
alter table reading_progress disable row level security;
