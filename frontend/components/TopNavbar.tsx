import Link from 'next/link';
import { useState, useEffect, memo } from 'react';
import { apiGet } from '../utils/apiClient';

const LYRICS = [
  '总要有一首我的歌,大声唱过,再看天地辽阔——————《一颗苹果》',
  '偶然与巧合, 舞动了蝶翼, 谁的心头风起 ————《如果我们不曾相遇》',
  '如海上的浪花, 如深海的鱼, 浪与鱼相依 ————《鱼仔》',
];

function TopNavbar() {
  const [username, setUsername] = useState('');
  const [lyric, setLyric] = useState(LYRICS[0]);

  const apiBase = typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || '') : '';

  useEffect(() => {
    // 使用 API 客户端，带缓存（10分钟）
    apiGet<{ username: string }>(apiBase + '/api/auth/me', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then((d) => d && setUsername(d.username))
      .catch(() => {});
  }, [apiBase]);

  useEffect(() => {
    const i = setInterval(() => {
      setLyric((prev) => {
        const idx = (LYRICS.indexOf(prev) + 1) % LYRICS.length;
        return LYRICS[idx];
      });
    }, 10000);
    return () => clearInterval(i);
  }, []);

  const logout = () => {
    fetch(apiBase + '/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => window.location.href = '/login');
  };

  return (
    <nav className="top-navbar">
      <div className="top-navbar-brand">
        <img src="/1.ico" alt="Logo" style={{ width: 28, height: 28, borderRadius: 6 }} />
      </div>
      <div className="top-navbar-quote" id="lyricsDisplay">{lyric}</div>
      <div className="top-navbar-menu">
        {username && (
          <>
            <span className="nav-user">🍎 {username}</span>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} className="nav-logout">退出登录</a>
          </>
        )}
      </div>
    </nav>
  );
}

export default memo(TopNavbar);
