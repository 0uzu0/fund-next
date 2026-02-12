import { useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    // 立即添加登录页面类名，在渲染前
    document.body.classList.add('login-page');
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => router.replace('/portfolio'))
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password, remember_me: rememberMe }),
      });
      const data = await res.json();
      if (data.success) router.replace('/portfolio');
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
        <style dangerouslySetInnerHTML={{
          __html: `
            html body.login-page #__next {
              width: 100%;
              max-width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            html body.login-page {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Microsoft YaHei', 'PingFang SC', sans-serif;
              background: #1A1B2C;
              background-color: #1A1B2C;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              position: relative;
              overflow: hidden;
              color: #E0E0E0;
              margin: 0;
            }

            html body.login-page::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-image: radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
              background-size: 20px 20px;
              opacity: 0.6;
              z-index: 0;
              pointer-events: none;
            }

            html body.login-page .login-container {
              background: rgba(13, 17, 23, 0.95);
              backdrop-filter: blur(20px);
              border-radius: 16px;
              box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.1), 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(102, 126, 234, 0.15);
              padding: 50px 40px;
              width: 100%;
              max-width: 500px;
              position: relative;
              z-index: 1;
              border: 1px solid rgba(102, 126, 234, 0.2);
            }

            html body.login-page .login-header {
              text-align: center;
              margin-bottom: 40px;
            }

            html body.login-page .logo-wrapper {
              display: inline-flex;
              width: 100px;
              height: 100px;
              border-radius: 50%;
              background: white;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              padding: 15px;
              box-shadow: 0 0 20px rgba(74, 144, 226, 0.4), 0 0 40px rgba(107, 70, 193, 0.3);
              position: relative;
            }

            html body.login-page .logo-wrapper::before {
              content: '';
              position: absolute;
              inset: -2px;
              border-radius: 50%;
              background: linear-gradient(135deg, rgba(74, 144, 226, 0.5), rgba(107, 70, 193, 0.5));
              z-index: -1;
              filter: blur(8px);
            }

            html body.login-page .login-header .logo {
              width: 70px;
              height: 70px;
              animation: loginFloat 3s ease-in-out infinite;
            }

            @keyframes loginFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }

            html body.login-page .login-header h1 {
              color: white;
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 8px;
              letter-spacing: -0.5px;
            }

            html body.login-page .login-header p {
              color: #A0AEC0;
              font-size: 14px;
              font-weight: 400;
            }

            html body.login-page .form-group {
              margin-bottom: 24px;
            }

            html body.login-page .form-group label {
              display: block;
              color: #E0E0E0;
              font-size: 14px;
              font-weight: 400;
              margin-bottom: 8px;
            }

            html body.login-page .input-wrapper {
              position: relative;
            }

            html body.login-page .input-icon {
              position: absolute;
              left: 14px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 18px;
              color: rgba(255, 255, 255, 0.6);
              z-index: 1;
            }

            html body.login-page .form-group input[type="text"],
            html body.login-page .form-group input[type="password"] {
              width: 100%;
              padding: 14px 14px 14px 44px;
              border: 1px solid #4A90E2;
              border-radius: 8px;
              font-size: 15px;
              transition: all 0.3s;
              background: #1A1B2C;
              color: #E0E0E0;
            }

            html body.login-page .form-group input[type="text"]::placeholder,
            html body.login-page .form-group input[type="password"]::placeholder {
              color: rgba(255, 255, 255, 0.5);
            }

            html body.login-page .form-group input[type="text"]:focus,
            html body.login-page .form-group input[type="password"]:focus {
              outline: none;
              border-color: #4A90E2;
              background: #1A1B2C;
              box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.15);
            }

            html body.login-page .remember-me-label {
              display: flex;
              align-items: center;
              cursor: pointer;
              font-weight: normal;
              font-size: 14px;
              color: #E0E0E0;
            }

            html body.login-page .remember-me-label input[type="checkbox"] {
              width: 18px;
              height: 18px;
              cursor: pointer;
              accent-color: #6B46C1;
              margin-right: 8px;
              background: #1A1B2C;
              border: 1px solid #4A90E2;
              border-radius: 4px;
            }

            html body.login-page .btn-login {
              width: 100%;
              padding: 14px;
              background: linear-gradient(135deg, #6B46C1 0%, #9F7AEA 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s;
              box-shadow: 0 4px 15px rgba(107, 70, 193, 0.4);
              position: relative;
              overflow: hidden;
            }

            html body.login-page .btn-login::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
              transition: left 0.5s;
            }

            html body.login-page .btn-login:hover::before {
              left: 100%;
            }

            html body.login-page .btn-login:hover:not(:disabled) {
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(107, 70, 193, 0.5);
            }

            html body.login-page .btn-login:active:not(:disabled) {
              transform: translateY(0);
            }

            html body.login-page .btn-login:disabled {
              opacity: 0.7;
              cursor: not-allowed;
            }

            html body.login-page .error-message {
              background: linear-gradient(135deg, #f85149 0%, #da3633 100%);
              color: white;
              padding: 14px;
              border-radius: 8px;
              margin-bottom: 24px;
              font-size: 14px;
              text-align: center;
              box-shadow: 0 4px 15px rgba(248, 81, 73, 0.3);
              border: 1px solid rgba(248, 81, 73, 0.3);
            }

            html body.login-page .divider {
              text-align: center;
              margin: 24px 0;
              position: relative;
            }

            html body.login-page .divider::before {
              content: '';
              position: absolute;
              left: 0;
              top: 50%;
              width: 100%;
              height: 1px;
              background: rgba(255, 255, 255, 0.2);
            }

            html body.login-page .divider span {
              background: rgba(13, 17, 23, 0.95);
              padding: 0 15px;
              position: relative;
              color: rgba(255, 255, 255, 0.5);
              font-size: 13px;
            }

            html body.login-page .register-link {
              text-align: center;
              margin-top: 24px;
              font-size: 13px;
              color: rgba(255, 255, 255, 0.6);
            }

            @media (max-width: 768px) {
              html body.login-page {
                padding: 15px;
              }

              html body.login-page .login-container {
                padding: 40px 30px;
                max-width: 100%;
              }

              html body.login-page .logo-wrapper {
                width: 80px;
                height: 80px;
                padding: 12px;
              }

              html body.login-page .login-header .logo {
                width: 56px;
                height: 56px;
              }

              html body.login-page .login-header h1 {
                font-size: 28px;
              }

              html body.login-page .login-header p {
                font-size: 13px;
              }

              html body.login-page .form-group input[type="text"],
              html body.login-page .form-group input[type="password"] {
                font-size: 16px;
              }

              html body.login-page .btn-login {
                font-size: 15px;
                padding: 13px;
              }
            }

            @media (max-width: 480px) {
              html body.login-page .login-container {
                padding: 35px 25px;
              }

              html body.login-page .logo-wrapper {
                width: 70px;
                height: 70px;
                padding: 10px;
              }

              html body.login-page .login-header .logo {
                width: 48px;
                height: 48px;
              }

              html body.login-page .login-header h1 {
                font-size: 24px;
              }

              html body.login-page .form-group {
                margin-bottom: 20px;
              }
            }
          `
        }} />
      </Head>
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
    </>
  );
}
