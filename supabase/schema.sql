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

-- Imported articles
create table if not exists imported_articles (
  id bigserial primary key,
  title text not null default '未命名',
  content text not null default '',
  tags jsonb default '[]'::jsonb,
  category text default '',
  published date default current_date,
  author text default '',
  source text default '',
  created_at timestamptz default now()
);

-- Full-text search index (PostgreSQL tsvector)
create index if not exists imported_articles_fts_idx
  on imported_articles using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

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
  repetitions integer default 0
);

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
create or replace function search_articles(search_query text, result_limit int default 50)
returns table (
  article_type text,
  article_id text,
  title text,
  snippet text,
  tags jsonb,
  category text,
  author text
) as $$
begin
  return query
  select
    'imported'::text as article_type,
    i.id::text as article_id,
    i.title,
    left(i.content, 200) as snippet,
    i.tags,
    i.category,
    i.author
  from imported_articles i
  where to_tsvector('simple', coalesce(i.title, '') || ' ' || coalesce(i.content, '')) @@ plainto_tsquery('simple', search_query)
     or i.title ilike '%' || search_query || '%'
     or i.content ilike '%' || search_query || '%'
  limit result_limit;
end;
$$ language plpgsql stable;
