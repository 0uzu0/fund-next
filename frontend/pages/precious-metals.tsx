import { useEffect, useState, useRef, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import TopNavbar from '../components/TopNavbar';
import Sidebar from '../components/Sidebar';
import { apiGet } from '../utils/apiClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

type RealTimeGold = {
  name: string;
  price: string;
  change_amount: string;
  change_pct: string;
  open_price: string;
  high_price: string;
  low_price: string;
  prev_close: string;
  update_time: string;
  unit: string;
};

type OneDayGold = { date: string; price: number };

type HistoryGold = {
  date: string;
  china_gold_price: string | number;
  chow_tai_fook_price: string | number;
  china_gold_change: string;
  chow_tai_fook_change: string;
};

function PreciousMetals() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string } | null>(null);
  const [realTime, setRealTime] = useState<RealTimeGold[]>([]);
  const [oneDay, setOneDay] = useState<OneDayGold[]>([]);
  const [history, setHistory] = useState<HistoryGold[]>([]);
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [loadingOneDay, setLoadingOneDay] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chartRef = useRef<ChartJS<'line'>>(null);
  const historyChartRef = useRef<ChartJS<'line'>>(null);

  useEffect(() => {
    // 使用 API 客户端，带缓存
    apiGet<{ username: string }>(apiBase + '/api/auth/me', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then(setAuth)
      .catch(() => router.replace('/login'));
  }, [router]);

  const loadRealTime = () => {
    setLoadingRealtime(true);
    // 使用 API 客户端，带缓存（3分钟）
    apiGet<{ success: boolean; data?: RealTimeGold[] }>(apiBase + '/api/gold/real-time', {
      cache: { ttl: 3 * 60 * 1000 }, // 3分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setRealTime(res.data);
        else setRealTime([]);
      })
      .catch(() => setRealTime([]))
      .finally(() => setLoadingRealtime(false));
  };

  const loadOneDay = () => {
    setLoadingOneDay(true);
    // 使用 API 客户端，带缓存（2分钟）
    apiGet<{ success: boolean; data?: OneDayGold[] }>(apiBase + '/api/gold/one-day', {
      cache: { ttl: 2 * 60 * 1000 }, // 2分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setOneDay(res.data);
        else setOneDay([]);
      })
      .catch(() => setOneDay([]))
      .finally(() => setLoadingOneDay(false));
  };

  const loadHistory = () => {
    setLoadingHistory(true);
    // 使用 API 客户端，带缓存（10分钟）
    apiGet<{ success: boolean; data?: HistoryGold[] }>(apiBase + '/api/gold/history', {
      cache: { ttl: 10 * 60 * 1000 }, // 10分钟缓存
    })
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setHistory(res.data);
        else setHistory([]);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (auth) {
      loadRealTime();
      loadOneDay();
      loadHistory();
    }
  }, [auth]);

  const refresh = () => {
    loadRealTime();
    loadOneDay();
    loadHistory();
  };

  const isNegative = (s: string) => typeof s === 'string' && (s.startsWith('-') || s.includes('-'));

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        加载中…
      </div>
    );
  }

  // 提取时间标签，与原项目一致：只显示时间部分 (HH:MM:SS)
  // 但在横坐标上只显示 HH:MM，不显示秒
  const oneDayLabels = oneDay.map((d) => {
    if (d.date && typeof d.date === 'string') {
      const timePart = d.date.split(' ')[1] || d.date;
      // 如果格式是 HH:MM:SS，只取前5个字符（HH:MM）
      if (timePart.length >= 5 && timePart.includes(':')) {
        const parts = timePart.split(':');
        if (parts.length >= 2) {
          return `${parts[0]}:${parts[1]}`;
        }
        return timePart.substring(0, 5);
      }
      return timePart;
    }
    return '';
  });
  const oneDayPrices = oneDay.map((d) => d.price);

  // 准备分时图表数据
  const latestPrice = oneDay.length > 0 ? oneDay[oneDay.length - 1].price : 0;
  const latestTime = oneDay.length > 0 ? (oneDay[oneDay.length - 1].date.split(' ')[1] || oneDay[oneDay.length - 1].date) : '';
  // 只显示时间部分（HH:MM），不显示秒
  const latestTimeShort = latestTime.length >= 5 ? latestTime.substring(0, 5) : latestTime;
  const chartLabel = `金价 (元/克)  最新: ¥${latestPrice.toFixed(2)}  ${latestTimeShort}`;

  const chartData = {
    labels: oneDayLabels,
    datasets: [
      {
        label: chartLabel,
        data: oneDayPrices,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  // 准备历史金价图表数据
  // 后端已经通过 reverse() 反转，数据顺序是从旧到新（从月初到月尾）
  // 原项目：return gold_list[::-1]，所以数据已经是按时间从早到晚排列
  const historyLabels = history.map((h) => h.date);
  const historyChina = history.map((h) => (typeof h.china_gold_price === 'number' ? h.china_gold_price : parseFloat(String(h.china_gold_price)) || 0));
  const historyChow = history.map((h) => (typeof h.chow_tai_fook_price === 'number' ? h.chow_tai_fook_price : parseFloat(String(h.chow_tai_fook_price)) || 0));

  const historyChartData = {
    labels: historyLabels,
    datasets: [
      {
        label: '中国黄金',
        data: historyChina,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
      {
        label: '周大福',
        data: historyChow,
        borderColor: '#f44336',
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#f44336',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: 'rgba(255,255,255,0.8)',
        bodyColor: '#fff',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          title: (context: any) => {
            // 显示完整的时间（日期 + 时间）
            const index = context[0].dataIndex;
            if (index >= 0 && index < oneDay.length) {
              return oneDay[index].date;
            }
            return context[0].label || '';
          },
          label: (context: any) => {
            return `金价: ¥${context.parsed.y.toFixed(2)} 元/克`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
          maxTicksLimit: 12,
          font: {
            size: 11,
          },
          // 移除自定义 callback，直接使用 labels 数组中的值（已在生成时格式化为 HH:MM）
          // 与原项目一致：原项目没有自定义 callback，Chart.js 会自动显示 labels
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return `¥${value.toFixed(2)}`;
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: '价格 (元/克)',
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 12,
          },
        },
      },
    },
  };

  // 历史金价图表插件：在数据点上显示数值
  const dataLabelPlugin = {
    id: 'dataLabelPlugin',
    afterDatasetsDraw(chart: ChartJS) {
      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((datapoint, index) => {
          const value = dataset.data[index];
          if (value != null && typeof value === 'number') {
            const x = datapoint.x;
            const y = datapoint.y;
            ctx.save();
            ctx.fillStyle = dataset.borderColor as string || '#f59e0b';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(value.toFixed(2), x, y - 5);
            ctx.restore();
          }
        });
      });
    },
  };

  const historyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        enabled: true,
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: 'rgba(255,255,255,0.8)',
        bodyColor: '#fff',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} 元/克`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 11,
          },
          maxTicksLimit: historyLabels.length <= 10 ? historyLabels.length : 10,
          callback: function(value: any, index: number) {
            // Chart.js CategoryScale 中，value 是标签字符串本身
            if (typeof value === 'string') {
              return value;
            }
            // 如果 value 是数字（索引），从 historyLabels 获取
            if (typeof value === 'number' && value >= 0 && value < historyLabels.length) {
              return historyLabels[value];
            }
            // 使用 index 作为后备
            if (index >= 0 && index < historyLabels.length) {
              return historyLabels[index];
            }
            return '';
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  return (
    <>
      <Head><title>贵金属行情 - LanFund</title></Head>
      <TopNavbar />
      <div className="main-container">
        <Sidebar />
        <div className="content-area">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 8 }}>
            🥇 贵金属行情
            <button type="button" className="btn" style={{ background: 'var(--accent)', color: '#fff' }} onClick={refresh}>
              🔄 刷新
            </button>
          </h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>实时追踪贵金属价格走势</p>

          {/* 实时贵金属表格 */}
          <div className="content-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚡</span>
              <span style={{ fontWeight: 600 }}>实时贵金属</span>
            </div>
            <div style={{ padding: 16 }}>
              {loadingRealtime ? (
                <p style={{ color: 'var(--text-dim)' }}>加载中…</p>
              ) : realTime.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>暂无数据，请检查网络或稍后重试</p>
              ) : (
                <div className="table-container">
                  <table className="style-table">
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>最新价</th>
                        <th>涨跌额</th>
                        <th>涨跌幅</th>
                        <th>开盘价</th>
                        <th>最高价</th>
                        <th>最低价</th>
                        <th>昨收价</th>
                        <th>更新时间</th>
                        <th>单位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realTime.map((row, i) => (
                        <tr key={i}>
                          <td>{row.name}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.price}</td>
                          <td className={isNegative(row.change_amount) ? 'negative' : 'positive'} style={{ fontFamily: 'var(--font-mono)' }}>{row.change_amount}</td>
                          <td className={isNegative(row.change_pct) ? 'negative' : 'positive'} style={{ fontFamily: 'var(--font-mono)' }}>{row.change_pct}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.open_price}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.high_price}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.low_price}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{row.prev_close}</td>
                          <td style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{row.update_time}</td>
                          <td>{row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 分时黄金价格图表 */}
          <div className="content-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>📈 分时黄金价格</span>
            </div>
            <div style={{ padding: 16, height: 400 }}>
              {loadingOneDay && oneDay.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>加载中…</p>
              ) : oneDayLabels.length > 0 && oneDayPrices.length > 0 ? (
                <Line ref={chartRef} data={chartData} options={chartOptions as any} />
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>暂无今日分时数据（非交易时段可能无数据）</p>
              )}
            </div>
          </div>

          {/* 历史金价图表 */}
          <div className="content-card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>📊 历史金价</span>
            </div>
            <div style={{ padding: 16, height: 400 }}>
              {loadingHistory && history.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>加载中…</p>
              ) : historyLabels.length > 0 && (historyChina.some((v) => v > 0) || historyChow.some((v) => v > 0)) ? (
                <Line ref={historyChartRef} data={historyChartData} options={historyChartOptions as any} plugins={[dataLabelPlugin]} />
              ) : (
                <p style={{ color: 'var(--text-dim)' }}>暂无历史金价数据，请稍后重试</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(PreciousMetals);
