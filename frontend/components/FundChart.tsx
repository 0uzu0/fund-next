import { useRef, useMemo, memo } from 'react';
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

type FundChartProps = {
  labels: string[];
  growth: number[];
  netValues?: number[];
};

function FundChart({ labels, growth, netValues }: FundChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  if (!labels.length || !growth.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-dim)' }}>暂无估值曲线数据</span>
      </div>
    );
  }

  // 计算0%基准线位置 - 使用 useMemo 优化
  const { minG, maxG, hasZero } = useMemo(() => {
    const min = Math.min(...growth);
    const max = Math.max(...growth);
    const hasZeroLine = min <= 0 && max >= 0;
    return { minG: min, maxG: max, hasZero: hasZeroLine };
  }, [growth]);

  // 曲线颜色：高于 0 为红色，低于 0 为绿色（按线段分段着色）
  const datasets = useMemo(() => {
    if (growth.length <= 1) return [];
    return [{
      label: '',
      data: growth,
      borderWidth: 1,
      pointRadius: 0,
      pointHoverRadius: 4,
      spanGaps: false,
      backgroundColor: 'transparent',
      segment: {
        borderColor: (ctx: any) => {
          const y0 = ctx.p0?.parsed?.y ?? 0;
          const y1 = ctx.p1?.parsed?.y ?? 0;
          const val = (Number(y0) + Number(y1)) / 2;
          return val >= 0 ? '#ff4d4f' : '#52c41a';
        },
      },
    }];
  }, [growth]);

  // 填充：大于 0 为淡红；小于 0 为渐变绿（从 0 到负数：由透明逐步加深）
  const fillDataset = useMemo(() => ({
    label: '',
    data: growth,
    borderColor: 'transparent',
    backgroundColor: (context: any) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      const greenTransparent = 'rgba(82, 196, 26, 0)';   // 0 线处透明
      const greenDeeper = 'rgba(82, 196, 26, 0.3)';     // 向负方向逐步加深
      if (!chartArea) return greenDeeper;

      const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      const zeroY = hasZero
        ? chartArea.top + (chartArea.bottom - chartArea.top) * (1 - (0 - minG) / (maxG - minG))
        : chartArea.bottom;

      if (!hasZero) {
        if (minG >= 0) {
          gradient.addColorStop(0, 'rgba(255, 77, 79, 0.18)');
          gradient.addColorStop(1, 'rgba(255, 77, 79, 0)');
        } else {
          // 全在 0 下：从透明（上）逐步加深到底部
          gradient.addColorStop(0, greenTransparent);
          gradient.addColorStop(1, greenDeeper);
        }
      } else {
        const t = (zeroY - chartArea.top) / (chartArea.bottom - chartArea.top);
        const tClamp = Math.max(0, Math.min(1, t));
        gradient.addColorStop(0, 'rgba(255, 77, 79, 0.18)');
        gradient.addColorStop(tClamp, 'rgba(255, 77, 79, 0)');
        // 低于 0 区域：从 0 线（透明）向负数方向逐步加深
        gradient.addColorStop(Math.min(tClamp + 0.002, 1), greenTransparent);
        gradient.addColorStop(1, greenDeeper);
      }
      return gradient;
    },
    borderWidth: 0,
    pointRadius: 0,
    fill: true,
    order: -1,
  }), [growth, minG, maxG, hasZero]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [fillDataset, ...datasets],
  }), [labels, fillDataset, datasets]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    // 性能优化：减少动画和交互计算
    animation: {
      duration: 0, // 禁用动画，提升渲染速度
    },
    transitions: {
      active: {
        animation: {
          duration: 0,
        },
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        titleColor: 'rgba(255,255,255,0.8)',
        bodyColor: '#fff',
        borderColor: 'var(--border)',
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        titleFont: {
          size: 11,
        },
        bodyFont: {
          size: 12,
        },
        filter: (tooltipItem: any) => {
          // 只显示填充数据集（第一个数据集，index 0）的 tooltip，避免重复显示
          return tooltipItem.datasetIndex === 0;
        },
        callbacks: {
          title: (context: any[]) => {
            return `时间: ${context[0].label}`;
          },
          label: (context: any): string[] => {
            const index = context.dataIndex;
            const pct = growth[index];
            const netValue = netValues?.[index];
            const labels: string[] = [`涨幅: ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`];
            if (netValue != null) {
              labels.push(`净值: ${netValue.toFixed(4)}`);
            }
            return labels;
          },
          labelColor: (context: any) => {
            const pct = growth[context.dataIndex];
            return {
              borderColor: pct >= 0 ? '#ff4d4f' : '#52c41a',
              backgroundColor: pct >= 0 ? '#ff4d4f' : '#52c41a',
            };
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 0.5,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 12,
          },
          maxRotation: 0,
          minRotation: 0,
          padding: 10,
          maxTicksLimit: 15, // 横坐标铺满容器
        },
        border: {
          display: false,
        },
      },
      y: {
        title: {
          display: true,
          text: '涨幅(%)',
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 12,
          },
          padding: {
            top: 0,
            bottom: 0,
          },
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 0.5,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.9)',
          font: {
            size: 12,
          },
          callback: (value: any) => {
            return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
          },
          padding: 8,
        },
        border: {
          display: false,
        },
      },
    },
    layout: {
      padding: {
        bottom: 10, // 为时间轴预留空间（减小）
      },
    },
  } as any), [growth, netValues]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

export default memo(FundChart);
