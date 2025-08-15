import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { GraphFunction, MathVariable } from '@/types/math';
import { create, all } from 'mathjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// MathJSの設定
const math = create(all, {
  number: 'number',
  precision: 64
});

// Chart.jsの登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface GraphAreaProps {
  functions: GraphFunction[];
  variables: Map<string, MathVariable>;
}

export default function GraphArea({ functions, variables }: GraphAreaProps) {
  const { colors } = useTheme();
  const [domain, setDomain] = useState<[number, number]>([-10, 10]);
  const [range, setRange] = useState<[number, number]>([-10, 10]);

  // 関数をプロット用のデータポイントに変換
  const generateDataPoints = (func: GraphFunction): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];
    const step = (domain[1] - domain[0]) / 1000; // 1000ポイント
    
    try {
      // MathJSを使って関数を評価
      for (let x = domain[0]; x <= domain[1]; x += step) {
        try {
          // 変数スコープを作成
          const scope: any = { x };
          
          // 他の変数を追加
          variables.forEach((variable, name) => {
            if (name !== 'x' && name !== 'y' && typeof variable.value === 'number') {
              scope[name] = variable.value;
            }
          });
          
          // MathJSで安全に計算
          const y = math.evaluate(func.expression, scope);
          
          // 有限な値のみ追加
          if (isFinite(y) && typeof y === 'number') {
            points.push({ x, y });
          }
        } catch (error) {
          // 個別のポイント計算エラーは無視
          //console.debug(`Point calculation error at x=${x}:`, error);
        }
      }
    } catch (error) {
      console.warn('Function evaluation error:', error);
    }
    
    return points;
  };

  // Chart.js用のデータセット
  const chartData = {
    datasets: functions
      .filter(func => func.visible && func.expression)
      .map(func => {
        const points = generateDataPoints(func);
        return {
          label: func.latex || func.expression,
          data: points,
          borderColor: func.color,
          backgroundColor: func.color + '20',
          borderWidth: 2,
          fill: false,
          pointRadius: 0, // ポイントを非表示
          pointHoverRadius: 4,
          tension: 0, // 直線補間
        };
      })
  };

  // Chart.jsのオプション
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: colors.foreground,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: colors.cardBg,
        titleColor: colors.foreground,
        bodyColor: colors.foreground,
        borderColor: colors.border,
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: (${context.parsed.x.toFixed(3)}, ${context.parsed.y.toFixed(3)})`;
          }
        }
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.05, // ズーム速度を調整
          },
          pinch: {
            enabled: true,
            threshold: 2, // ピンチの閾値を調整
          },
          mode: 'xy' as const,
          scaleMode: 'xy' as const, // スケールモードを明示
          onZoomComplete: function(chart: any) {
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            setDomain([xScale.min, xScale.max]);
            setRange([yScale.min, yScale.max]);
          }
        },
        pan: {
          enabled: true,
          mode: 'xy' as const,
          threshold: 1, // パンの感度を調整
          onPanComplete: function(chart: any) {
            const xScale = chart.scales.x;
            const yScale = chart.scales.y;
            setDomain([xScale.min, xScale.max]);
            setRange([yScale.min, yScale.max]);
          }
        },
        limits: {
          x: {min: -1000, max: 1000},
          y: {min: -1000, max: 1000}
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 6,
        hitRadius: 15, // タッチに優しいサイズ
      },
      line: {
        tension: 0,
        borderWidth: 2,
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        min: domain[0],
        max: domain[1],
        title: {
          display: true,
          text: 'x',
          color: colors.foreground
        },
        ticks: {
          color: colors.mutedFg
        },
        grid: {
          color: colors.border + '40'
        }
      },
      y: {
        type: 'linear' as const,
        min: range[0],
        max: range[1],
        title: {
          display: true,
          text: 'y',
          color: colors.foreground
        },
        ticks: {
          color: colors.mutedFg
        },
        grid: {
          color: colors.border + '40'
        }
      }
    },
    aspectRatio: 1, // 1:1の比率を強制
    onHover: (event: any, elements: any[]) => {
      // タッチデバイスではホバーカーソル変更を無効化
      if ('ontouchstart' in window) return;
      event.native.target.style.cursor = elements.length > 0 ? 'crosshair' : 'default';
    }
  };

  return (
    <div className="h-full w-full p-2" style={{ background: colors.background }}>
      {functions.length === 0 ? (
        <div 
          className="flex items-center justify-center h-full text-sm"
          style={{ color: colors.mutedFg }}
        >
          関数を入力してグラフを表示
        </div>
      ) : (
        <div className="h-full w-full relative">
          {/* コントロールパネル */}
          <div 
            className="absolute top-2 right-2 z-10 p-2 rounded text-xs"
            style={{ 
              background: colors.cardBg + 'CC',
              border: `1px solid ${colors.border}`,
              color: colors.foreground
            }}
          >
            <div className="flex gap-2 items-center flex-wrap">
              <label>X範囲:</label>
              <input
                type="number"
                value={domain[0]}
                onChange={(e) => setDomain([parseFloat(e.target.value) || -10, domain[1]])}
                className="w-12 px-1 rounded"
                style={{ 
                  background: colors.background, 
                  border: `1px solid ${colors.border}`,
                  color: colors.foreground
                }}
              />
              <span>~</span>
              <input
                type="number"
                value={domain[1]}
                onChange={(e) => setDomain([domain[0], parseFloat(e.target.value) || 10])}
                className="w-12 px-1 rounded"
                style={{ 
                  background: colors.background, 
                  border: `1px solid ${colors.border}`,
                  color: colors.foreground
                }}
              />
              <button
                onClick={() => {
                  setDomain([-10, 10]);
                  setRange([-10, 10]);
                }}
                className="px-2 py-1 rounded text-xs hover:opacity-80"
                style={{ 
                  background: colors.accentBg, 
                  color: colors.accentFg,
                  border: 'none',
                  cursor: 'pointer'
                }}
                title="グラフをリセット"
              >
                リセット
              </button>
            </div>
            <div className="text-xs mt-1 opacity-70">
              ホイール：ズーム / ドラッグ：パン
            </div>
          </div>
          
          {/* グラフ */}
          <div className="h-full w-full">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}
    </div>
  );
}
