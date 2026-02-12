import { memo } from 'react';
import { useRouter } from 'next/router';
import TopNavbar from './TopNavbar';
import Sidebar from './Sidebar';

// 不需要 Layout 的页面
const NO_LAYOUT_PAGES = ['/login', '/'];

function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = router.pathname;
  
  // 登录页面和首页不需要 Layout
  if (NO_LAYOUT_PAGES.includes(pathname)) {
    return <>{children}</>;
  }
  
  return (
    <>
      <TopNavbar />
      <div className="main-container">
        <Sidebar />
        <div className="content-area">
          {children}
        </div>
      </div>
    </>
  );
}

export default memo(Layout);
