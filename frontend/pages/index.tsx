import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${api}/api/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? router.replace('/portfolio') : router.replace('/login')))
      .catch(() => router.replace('/login'));
  }, [router]);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      加载中…
    </div>
  );
}
