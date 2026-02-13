import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { API_BASE } from '../utils/apiClient';

function getApiBase(): string {
  if (API_BASE) return API_BASE;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(getApiBase() + '/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => {
        const redirect = typeof router.query.redirect === 'string' ? router.query.redirect : '/portfolio';
        router.replace(redirect.startsWith('/') ? redirect : '/' + redirect);
      })
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(getApiBase() + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password, remember_me: rememberMe }),
      });
      const data = await res.json();
      if (data.success) {
        const redirect = typeof router.query.redirect === 'string' ? router.query.redirect : '/portfolio';
        router.replace(redirect.startsWith('/') ? redirect : '/' + redirect);
      }
      else setError(data.message || '登录失败');
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>登录 - LanFund</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/1.ico" />
      </Head>
      <div className="page-login">
      <div className="login-container">
        <div className="login-header">
          <div className="logo-wrapper">
            <img src="/1.ico" alt="Logo" className="logo" />
          </div>
          <h1>LanFund</h1>
          <p>智能基金管理助手</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="remember-me-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>记住我 (7天内自动登录)</span>
            </label>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <div className="divider">
          <span>或</span>
        </div>

        <div className="register-link">
          注册已关闭,请联系管理员获取账号
        </div>
      </div>
      </div>
    </>
  );
}
