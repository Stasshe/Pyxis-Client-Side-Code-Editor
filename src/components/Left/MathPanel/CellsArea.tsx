import { Plus, Trash2 } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { MathCell, MathVariable } from '@/types/math';
import MathCellComponent from './MathCell';

interface CellsAreaProps {
  cells: MathCell[];
  variables: Map<string, MathVariable>;
  onCellUpdate: (cellId: string, input: string) => void;
  onCellCalculate: (cellId: string) => void;
  onAddCell: () => void;
  onDeleteCell: (cellId: string) => void;
}

export default function CellsArea({ 
  cells, 
  variables, 
  onCellUpdate, 
  onCellCalculate, 
  onAddCell, 
  onDeleteCell 
}: CellsAreaProps) {
  const { colors } = useTheme();

  return (
    <div className="p-2">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <span 
          className="text-xs font-medium"
          style={{ color: colors.sidebarTitleFg }}
        >
          数式セル
        </span>
        <button
          onClick={onAddCell}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:opacity-80"
          style={{ 
            background: colors.accentBg, 
            color: colors.accentFg,
            border: 'none',
            cursor: 'pointer'
          }}
          title="新しいセルを追加"
        >
          <Plus size={12} />
          セル追加
        </button>
      </div>

      {/* セルリスト */}
      <div className="space-y-2">
        {cells.map((cell, index) => (
          <div key={cell.id} className="relative">
            {/* セル番号とコントロール */}
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="text-xs font-mono px-2 py-1 rounded"
                style={{ 
                  background: colors.mutedBg, 
                  color: colors.mutedFg 
                }}
              >
                [{index + 1}]
              </span>
              {cells.length > 1 && (
                <button
                  onClick={() => onDeleteCell(cell.id)}
                  className="p-1 rounded hover:opacity-80"
                  style={{ 
                    background: 'transparent',
                    color: colors.mutedFg,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  title="セルを削除"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* セルコンポーネント */}
            <MathCellComponent
              cell={cell}
              variables={variables}
              onUpdate={(input: string) => onCellUpdate(cell.id, input)}
              onCalculate={() => onCellCalculate(cell.id)}
            />
          </div>
        ))}
      </div>

      {/* 変数表示エリア */}
      {variables.size > 0 && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
          <div 
            className="text-xs font-medium mb-2"
            style={{ color: colors.sidebarTitleFg }}
          >
            定義済み変数
          </div>
          <div className="space-y-1">
            {Array.from(variables.entries()).map(([name, variable]) => (
              <div 
                key={name}
                className="flex items-center justify-between text-xs px-2 py-1 rounded"
                style={{ 
                  background: colors.mutedBg,
                  color: colors.foreground
                }}
              >
                <span className="font-mono">{name}</span>
                <span style={{ color: colors.mutedFg }}>
                  {typeof variable.value === 'number' 
                    ? variable.value.toString() 
                    : variable.latex || variable.value.toString()
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
