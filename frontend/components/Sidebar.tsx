import { useEffect, useState, useRef, memo, useMemo } from 'react';
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
  const activeIconRef = useRef<HTMLAnchorElement | null>(null);

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

  // 移动端：路由变化后把当前选中项滚动到可见区域
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile || !activeIconRef.current) return;
    activeIconRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pathname]);

  // 使用 useMemo 优化 active 状态的计算
  const isActive = useMemo(() => {
    return (href: string) => pathname === href;
  }, [pathname]);

  const isAdminActive = useMemo(() => {
    return pathname === '/admin/users' || pathname === '/admin/profile';
  }, [pathname]);

  const setActiveRef = (el: HTMLAnchorElement | null, active: boolean) => {
    if (active) activeIconRef.current = el;
  };

  return (
    <aside className="sidebar-nav" role="navigation" aria-label="主导航">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          ref={(el) => setActiveRef(el, isActive(item.href))}
          className={`sidebar-icon ${isActive(item.href) ? 'active' : ''}`}
          title={item.label}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          <span className="icon">{item.icon}</span>
        </Link>
      ))}
      {isAdmin && (
        <Link
          href="/admin/users"
          ref={(el) => setActiveRef(el, isAdminActive)}
          className={`sidebar-icon ${isAdminActive ? 'active' : ''}`}
          title="用户管理"
          aria-current={isAdminActive ? 'page' : undefined}
        >
          <span className="icon">👤</span>
        </Link>
      )}
    </aside>
  );
}

// Sidebar 组件没有 props，memo 会自动处理内部状态变化
// 由于 Sidebar 现在在 Layout 中，Layout 在 _app.tsx 中，所以不会在路由变化时重新挂载
export default memo(Sidebar);
