'use client';

import { exportMarkdown } from '@/lib/export';

interface ExportButtonProps {
  title: string;
  content: string;
  tags: string[];
  category: string;
  author: string;
  published: string;
}

export default function ExportButton({ title, content, tags, category, author, published }: ExportButtonProps) {
  return (
    <button onClick={() => {
      exportMarkdown(title, content, { title, tags, category, author, published });
    }} className="text-accent hover:underline">导出</button>
  );
}
