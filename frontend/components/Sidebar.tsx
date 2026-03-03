import { useEffect, useState, useRef, memo, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiGet } from '../utils/apiClient';

const ITEMS = [
  { href: '/portfolio', icon: '💼', label: '持仓基金' },
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
    // 检查缓存，但如果是管理页面则强制刷新
    const isAdminPage = pathname.startsWith('/admin');
    if (!isAdminPage && adminCache && Date.now() - adminCache.timestamp < CACHE_DURATION) {
      setIsAdmin(adminCache.isAdmin);
      return;
    }
    
    // 使用 setTimeout 确保不会阻塞 UI
    setTimeout(() => {
      // 使用 API 客户端检查管理员状态
      apiGet<{ is_admin?: boolean }>('/api/auth/me', {
        cache: { ttl: 5 * 60 * 1000 },
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
  }, [pathname]); // 监听 pathname 变化，切换页面时重新检查

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
    return pathname.startsWith('/admin');
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
          <span className="sidebar-label" aria-hidden="true">{item.label}</span>
        </Link>
      ))}
      {isAdmin && (
        <>
          <Link
            href="/admin/users"
            ref={(el) => setActiveRef(el, pathname === '/admin/users')}
            className={`sidebar-icon ${pathname === '/admin/users' ? 'active' : ''}`}
            title="用户管理"
            aria-current={pathname === '/admin/users' ? 'page' : undefined}
          >
            <span className="icon">👤</span>
            <span className="sidebar-label" aria-hidden="true">用户管理</span>
          </Link>
          <Link
            href="/admin/api-keys"
            ref={(el) => setActiveRef(el, pathname === '/admin/api-keys')}
            className={`sidebar-icon ${pathname === '/admin/api-keys' ? 'active' : ''}`}
            title="API密钥"
            aria-current={pathname === '/admin/api-keys' ? 'page' : undefined}
          >
            <span className="icon">🔑</span>
            <span className="sidebar-label" aria-hidden="true">API密钥</span>
          </Link>
        </>
      )}
    </aside>
  );
}

// Sidebar 组件没有 props，memo 会自动处理内部状态变化
// 由于 Sidebar 现在在 Layout 中，Layout 在 _app.tsx 中，所以不会在路由变化时重新挂载
export default memo(Sidebar);
