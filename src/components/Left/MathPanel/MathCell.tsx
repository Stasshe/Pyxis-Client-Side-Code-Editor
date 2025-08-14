import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { MathCell, MathVariable } from '@/types/math';
import 'katex/dist/katex.min.css';

interface MathCellProps {
  cell: MathCell;
  variables: Map<string, MathVariable>;
  onUpdate: (input: string) => void;
  onCalculate: () => void;
}

export default function MathCellComponent({ 
  cell, 
  variables, 
  onUpdate, 
  onCalculate 
}: MathCellProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState(cell.input);

  useEffect(() => {
    setInput(cell.input);
  }, [cell.input]);

  const handleInputChange = (value: string) => {
    setInput(value);
    onUpdate(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onCalculate();
    }
  };

  // LaTeX出力をレンダリング
  const renderLatexOutput = () => {
    if (!cell.output) return null;
    
    try {
      // KaTeXを使用してLaTeX式をレンダリング
      return (
        <div 
          className="p-2 rounded mt-1"
          style={{ 
            background: colors.mutedBg,
            color: colors.foreground,
            fontFamily: 'KaTeX_Math, Times New Roman, serif'
          }}
        >
          <div 
            dangerouslySetInnerHTML={{ 
              __html: cell.output 
            }} 
          />
        </div>
      );
    } catch (error) {
      return (
        <div 
          className="p-2 rounded mt-1 text-xs"
          style={{ 
            background: colors.mutedBg,
            color: colors.foreground
          }}
        >
          {cell.output}
        </div>
      );
    }
  };

  return (
    <div className="space-y-1">
      {/* 入力エリア */}
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="LaTeX数式を入力 (例: x^2 + 2*x + 1, a = 5, y = a*x + 1)"
          className="w-full p-2 text-sm rounded resize-none"
          style={{
            background: colors.background,
            color: colors.foreground,
            border: `1px solid ${colors.border}`,
            fontFamily: 'Monaco, Menlo, Consolas, monospace',
            minHeight: '60px'
          }}
          rows={2}
        />
        <div 
          className="absolute bottom-1 right-1 text-xs opacity-50"
          style={{ color: colors.mutedFg }}
        >
          Ctrl+Enter で計算
        </div>
      </div>

      {/* エラー表示 */}
      {cell.error && (
        <div 
          className="p-2 rounded text-xs"
          style={{ 
            background: colors.red + '20',
            color: colors.red,
            border: `1px solid ${colors.red}40`
          }}
        >
          {cell.error}
        </div>
      )}

      {/* 出力エリア */}
      {cell.output && renderLatexOutput()}

      {/* セル情報 */}
      {cell.dependencies.length > 0 && (
        <div 
          className="text-xs px-2 py-1 rounded"
          style={{ 
            background: colors.mutedBg + '50',
            color: colors.mutedFg
          }}
        >
          依存変数: {cell.dependencies.join(', ')}
        </div>
      )}
    </div>
  );
}
