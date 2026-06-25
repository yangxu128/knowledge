import type { Metadata } from 'next';
import { Noto_Sans_SC } from 'next/font/google';
import './globals.css';
import UserMenu from '@/components/UserMenu';
import ThemeToggle from '@/components/ThemeToggle';

const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400','600'], display: 'swap', variable: '--font-noto', preload: true, adjustFontFallback: true });

export const metadata: Metadata = {
  metadataBase: new URL('https://knowledge.example.com'),
  title: { default: '知海 — 你的第二大脑', template: '%s · 知海' },
  description: '让知识自然生长 — 记录、连接、复习，构建你的个人知识体系',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    title: '知海 — 你的第二大脑',
    description: '让知识自然生长 — 记录、连接、复习，构建你的个人知识体系',
    siteName: '知海',
  },
  twitter: {
    card: 'summary_large_image',
    title: '知海 — 你的第二大脑',
    description: '让知识自然生长 — 记录、连接、复习，构建你的个人知识体系',
  },
  robots: { index: true, follow: true },
};

const navItems = [
  { label: '探索', href: '/explore' },
  { label: '知识库', href: '/library' },
  { label: '图谱', href: '/graph' },
  { label: '复习', href: '/review' },
  { label: '导入', href: '/import' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={notoSansSC.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();` }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-paper/80 backdrop-blur-md border-b border-warm/60">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <a href="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center" style={{width:32,height:32,borderRadius:8,backgroundColor:'var(--accent,#e85d4e)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <span className="text-lg font-bold text-ink tracking-tight">知海</span>
              </a>
              <div className="hidden md:flex items-center gap-6 text-sm">
                {navItems.map(item => (
                  <a key={item.href} href={item.href} className="nav-link py-1 text-slate-500 hover:text-ink">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <form action="/search" method="get" className="relative hidden sm:block">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  name="q"
                  aria-label="搜索知识"
                  placeholder="搜索知识..."
                  className="w-48 bg-warm/50 border border-warm rounded-full pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:border-accent/30 search-glow transition-all placeholder:text-slate-400"
                />
              </form>
              <button id="quickCaptureBtn" aria-label="快速记录" className="btn-ghost px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                <span className="hidden sm:inline">记录</span>
              </button>
              <button id="mobileMenuBtn" aria-label="菜单" className="md:hidden w-8 h-8 flex items-center justify-center text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
              </button>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
          <div id="mobileMenu" className="hidden md:hidden border-t border-warm/60 bg-paper">
            <div className="px-6 py-4 space-y-3">
              {navItems.map(item => (
                <a key={item.href} href={item.href} className="block py-2 text-sm text-slate-500">{item.label}</a>
              ))}
            </div>
          </div>
        </nav>

        {children}

        {/* Quick Capture Modal */}
        <div id="captureModal" role="dialog" aria-modal="true" aria-label="快速记录" className="hidden fixed inset-0 z-50 flex items-start justify-center pt-32 bg-ink/30 backdrop-blur-sm">
          <div className="bg-paper rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-warm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent-light flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e85d4e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-ink">快速记录</h3>
                <p className="text-xs text-slate-400">想法、灵感、链接... 先记录，后整理</p>
              </div>
            </div>
            <textarea id="captureInput" className="w-full bg-warm/50 border border-warm rounded-xl p-3.5 text-sm focus:outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/10 resize-none h-32 placeholder:text-slate-400 transition-all" placeholder="写下你的想法..."></textarea>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1"></div>
              <button id="cancelCapture" className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:text-ink transition-colors">取消</button>
              <button id="saveCapture" className="px-4 py-2 rounded-lg bg-accent text-white text-sm shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30 transition-all">保存</button>
            </div>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            document.getElementById('mobileMenu')?.classList.toggle('hidden');
          });
          document.querySelectorAll('#mobileMenu a').forEach(a => {
            a.addEventListener('click', () => {
              document.getElementById('mobileMenu')?.classList.add('hidden');
            });
          });
          document.getElementById('quickCaptureBtn')?.addEventListener('click', () => {
            document.getElementById('captureModal')?.classList.remove('hidden');
            document.getElementById('captureInput')?.focus();
          });
          document.getElementById('cancelCapture')?.addEventListener('click', () => {
            document.getElementById('captureModal')?.classList.add('hidden');
          });
          document.getElementById('captureModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('captureModal')) document.getElementById('captureModal').classList.add('hidden');
          });
          document.getElementById('saveCapture')?.addEventListener('click', () => {
            const input = document.getElementById('captureInput');
            if (input?.value.trim()) { localStorage.setItem('capture_' + Date.now(), input.value); input.value = ''; }
            document.getElementById('captureModal').classList.add('hidden');
          });
          document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); document.getElementById('captureModal')?.classList.remove('hidden'); document.getElementById('captureInput')?.focus(); }
          });
        ` }} />
      </body>
    </html>
  );
}
