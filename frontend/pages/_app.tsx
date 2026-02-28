import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from '../components/Layout';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // 性能优化：预加载关键资源（仅在开发环境或配置了 API URL 时）
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    // 生产环境或未配置 API URL 时不进行预连接（使用相对路径）
    if (!apiUrl || process.env.NODE_ENV === 'production') return;
    
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

  // 获取预连接 URL（生产环境使用当前 origin）
  const preconnectUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* 性能优化：DNS 预解析（仅在配置了 API URL 时） */}
        {process.env.NEXT_PUBLIC_API_URL && (
          <>
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} crossOrigin="anonymous" />
          </>
        )}
      </Head>
      <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}
