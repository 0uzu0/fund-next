import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // 性能优化：预加载关键资源
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8311';
    
    // 预连接到 API 服务器
    const preconnectLink = document.createElement('link');
    preconnectLink.rel = 'preconnect';
    preconnectLink.href = apiUrl;
    preconnectLink.crossOrigin = 'anonymous';
    document.head.appendChild(preconnectLink);
    
    // DNS 预解析
    const dnsLink = document.createElement('link');
    dnsLink.rel = 'dns-prefetch';
    dnsLink.href = apiUrl;
    document.head.appendChild(dnsLink);
    
    return () => {
      if (preconnectLink.parentNode) {
        preconnectLink.parentNode.removeChild(preconnectLink);
      }
      if (dnsLink.parentNode) {
        dnsLink.parentNode.removeChild(dnsLink);
      }
    };
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* 性能优化：DNS 预解析 */}
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8311'} />
        {/* 性能优化：预连接 */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8311'} crossOrigin="anonymous" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
