'use client';
import { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function getPasswordStrength(p: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!p) return { level: 0, label: '', color: '' };
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^a-zA-Z0-9]/.test(p)) score++;
  if (score <= 1) return { level: 1, label: '弱', color: 'text-red-500' };
  if (score <= 3) return { level: 2, label: '中', color: 'text-yellow-500' };
  return { level: 3, label: '强', color: 'text-sage' };
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/admin';
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const lockRef = useRef<number | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const usernameError = useMemo(() => {
    if (!isRegister || !username) return '';
    if (username.length < 2) return '用户名至少 2 位';
    if (username.length > 20) return '用户名最多 20 位';
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) return '仅支持字母、数字、下划线、中文';
    return '';
  }, [username, isRegister]);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const passwordError = useMemo(() => {
    if (!isRegister || !password) return '';
    if (password.length < 8) return '密码至少 8 位';
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return '密码需包含字母和数字';
    return '';
  }, [password, isRegister]);

  const confirmError = useMemo(() => {
    if (!isRegister || !confirm) return '';
    if (confirm !== password) return '两次输入的密码不一致';
    return '';
  }, [confirm, password, isRegister]);

  const canSubmit = !submitting
    && countdown <= 0
    && username.trim().length > 0
    && password.length > 0
    && (!isRegister || (!usernameError && !passwordError && !confirmError));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          const m = data.error.match(/\d+/);
          setCountdown(m ? parseInt(m[0]) * 60 : 60);
        }
        setError(data.error);
        return;
      }
      router.push(from);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-ink mb-6 text-center">
        {isRegister ? '注册账号' : '登录'}
      </h1>
      {searchParams.get('from') && (
        <div className="bg-warm/50 text-slate-600 text-xs px-4 py-2 rounded-lg mb-4 text-center">
          登录后将返回：<span className="font-medium text-ink">{from}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4 flex items-center gap-2">
          <i className="fas fa-exclamation-circle"></i>{error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">用户名</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            disabled={submitting || countdown > 0}
            maxLength={20}
            autoComplete="username"
            className={`w-full px-4 py-2.5 rounded-xl border bg-paper focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 ${usernameError ? 'border-red-300' : 'border-warm'}`}
            required />
          {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
          {isRegister && /^(admin|root|system)$/i.test(username) && !usernameError && (
            <p className="text-xs text-yellow-600 mt-1"><i className="fas fa-info-circle mr-1"></i>该用户名为系统保留</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            disabled={submitting || countdown > 0}
            maxLength={64}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            className={`w-full px-4 py-2.5 rounded-xl border bg-paper focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 ${passwordError ? 'border-red-300' : 'border-warm'}`}
            required />
          {isRegister && password && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 bg-warm rounded-full overflow-hidden flex gap-0.5">
                <div className={`flex-1 rounded-full ${passwordStrength.level >= 1 ? (passwordStrength.level === 1 ? 'bg-red-400' : passwordStrength.level === 2 ? 'bg-yellow-400' : 'bg-sage') : 'bg-warm'}`}></div>
                <div className={`flex-1 rounded-full ${passwordStrength.level >= 2 ? (passwordStrength.level === 2 ? 'bg-yellow-400' : 'bg-sage') : 'bg-warm'}`}></div>
                <div className={`flex-1 rounded-full ${passwordStrength.level >= 3 ? 'bg-sage' : 'bg-warm'}`}></div>
              </div>
              <span className={`text-xs font-medium ${passwordStrength.color}`}>{passwordStrength.label}</span>
            </div>
          )}
          {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
        </div>
        {isRegister && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">确认密码</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              disabled={submitting || countdown > 0}
              maxLength={64}
              autoComplete="new-password"
              className={`w-full px-4 py-2.5 rounded-xl border bg-paper focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 ${confirmError ? 'border-red-300' : 'border-warm'}`}
              required />
            {confirmError && <p className="text-xs text-red-500 mt-1">{confirmError}</p>}
          </div>
        )}
        <button type="submit" disabled={!canSubmit}
          className="w-full py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting && <i className="fas fa-spinner fa-spin text-xs"></i>}
          {countdown > 0 ? `请等待 ${countdown} 秒` : isRegister ? '注册' : '登录'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-400 mt-4">
        {isRegister ? '已有账号？' : '没有账号？'}
        <button onClick={() => { setIsRegister(!isRegister); setError(''); setConfirm(''); }}
          className="text-accent hover:underline ml-1">
          {isRegister ? '去登录' : '去注册'}
        </button>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl border border-warm p-8">
        <Suspense fallback={<div className="text-center text-slate-400 text-sm py-8">加载中...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
