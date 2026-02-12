import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '';
function getApiBase() {
  if (API) return API;
  if (typeof window !== 'undefined') return 'http://localhost:8311';
  return '';
}

export default function AdminProfile() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string; is_admin?: boolean } | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(getApiBase() + '/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setAuth(data);
        if (!data.is_admin) router.replace('/portfolio');
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const u = newUsername.trim();
    if (!u && !newPassword) {
      setMessage({ type: 'error', text: '请填写新用户名或新密码' });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setMessage({ type: 'error', text: '密码长度至少为 6 个字符' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(getApiBase() + '/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          new_username: u || null,
          new_password: newPassword || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || '修改成功' });
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
        if (u) setTimeout(() => window.location.reload(), 800);
      } else {
        setMessage({ type: 'error', text: data.message || '修改失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '请求失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        加载中…
      </div>
    );
  }

  if (!auth.is_admin) {
    return null;
  }

  return (
    <>
      <Head><title>修改管理员账号 - LanFund</title></Head>
          <Link href="/admin/users" style={{ color: 'var(--accent)', marginBottom: 16, display: 'inline-block' }}>
            ← 返回用户管理
          </Link>
          <h1 style={{ marginBottom: 4 }}>修改管理员账号</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>修改当前登录的管理员用户名和密码</p>

          {message && (
            <div
              className="content-card"
              style={{
                marginBottom: 16,
                padding: 12,
                color: message.type === 'error' ? 'var(--down-color)' : 'var(--up-color)',
              }}
            >
              {message.text}
            </div>
          )}

          <div className="content-card" style={{ maxWidth: 480 }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>当前用户名</label>
                <input
                  type="text"
                  value={auth.username}
                  readOnly
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--gh-bg-primary)',
                    color: 'var(--text-dim)',
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>新用户名</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="留空则不修改"
                  minLength={3}
                  maxLength={20}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg)',
                    color: 'var(--text-main)',
                    fontSize: 14,
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>3–20 个字符</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="留空则不修改"
                  minLength={6}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg)',
                    color: 'var(--text-main)',
                    fontSize: 14,
                  }}
                />
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>至少 6 个字符</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="仅修改密码时必填"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg)',
                    color: 'var(--text-main)',
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                type="submit"
                className="btn"
                style={{ background: 'var(--accent)', color: '#fff' }}
                disabled={submitting}
              >
                {submitting ? '保存中…' : '保存修改'}
              </button>
            </form>
          </div>
    </>
  );
}
