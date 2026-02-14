import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getApiBase, apiGet } from '../utils/apiClient';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    apiGet<{ username?: string }>(getApiBase() + '/api/auth/me', { cache: { ttl: 0 } })
      .then(() => router.replace('/portfolio'))
      .catch(() => router.replace('/login?redirect=' + encodeURIComponent(router.asPath || '/portfolio')));
  }, [router]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      加载中…
    </div>
  );
}
