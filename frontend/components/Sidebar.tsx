import { useEffect, useState, useRef, memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiGet } from '../utils/apiClient';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const ITEMS = [
  { href: '/portfolio', icon: '💼', label: '持仓基金' },
  { href: '/position-records', icon: '📋', label: '持仓记录' },
  { href: '/market', icon: '📈', label: '市场行情' },
  { href: '/market-indices', icon: '📊', label: '市场指数' },
  { href: '/precious-metals', icon: '🥇', label: '贵金属行情' },
  { href: '/sectors', icon: '🏢', label: '行业板块' },
];

// 缓存 admin 状态，避免每次组件挂载都请求
let adminCache: { isAdmin: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

function Sidebar() {
  const router = useRouter();
  const pathname = router.pathname;
  const [isAdmin, setIsAdmin] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    // 检查缓存
    if (adminCache && Date.now() - adminCache.timestamp < CACHE_DURATION) {
      setIsAdmin(adminCache.isAdmin);
      return;
    }
    
    // 避免重复请求
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    // 使用 setTimeout 确保不会阻塞 UI
    setTimeout(() => {
      // 使用 API 客户端，带缓存（5分钟）
      apiGet<{ is_admin?: boolean }>(`${API}/api/auth/me`, {
        cache: { ttl: 5 * 60 * 1000 }, // 5分钟缓存
      })
        .then((data) => {
          const admin = !!data.is_admin;
          adminCache = { isAdmin: admin, timestamp: Date.now() };
          setIsAdmin(admin);
        })
        .catch(() => {
          setIsAdmin(false);
          adminCache = { isAdmin: false, timestamp: Date.now() };
        });
    }, 0);
  }, []);

  return (
    <aside className="sidebar-nav">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`sidebar-icon ${pathname === item.href ? 'active' : ''}`}
          title={item.label}
        >
          <span className="icon">{item.icon}</span>
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin/users"
          className={`sidebar-icon ${pathname === '/admin/users' || pathname === '/admin/profile' ? 'active' : ''}`}
          title="用户管理"
        >
          <span className="icon">👤</span>
        </Link>
      )}
    </aside>
  );
}

export default memo(Sidebar);
