import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { MathCell, MathVariable, GraphFunction, MathContext, CalculationResult } from '@/types/math';
import GraphArea from './GraphArea';
import CellsArea from './CellsArea';
import mathCalculator from '@/utils/math/calculator';

interface MathPanelProps {
  onFileOperation?: (
    path: string,
    type: 'file' | 'folder' | 'delete',
    content?: string
  ) => Promise<void>;
}

export default function MathPanel({ onFileOperation }: MathPanelProps) {
  const { colors } = useTheme();
  
  // 数学コンテキストの状態管理
  const [mathContext, setMathContext] = useState<MathContext>({
    variables: new Map<string, MathVariable>(),
    functions: new Map<string, GraphFunction>(),
    cells: [
      {
        id: '1',
        input: '',
        output: '',
        error: '',
        isExpression: true,
        dependencies: []
      }
    ],
    nextCellId: 2
  });

  // セルの追加
  const addCell = () => {
    setMathContext(prev => ({
      ...prev,
      cells: [
        ...prev.cells,
        {
          id: prev.nextCellId.toString(),
          input: '',
          output: '',
          error: '',
          isExpression: true,
          dependencies: []
        }
      ],
      nextCellId: prev.nextCellId + 1
    }));
  };

  // セルの削除
  const deleteCell = (cellId: string) => {
    if (mathContext.cells.length <= 1) return; // 最低1つのセルを保持
    
    setMathContext(prev => ({
      ...prev,
      cells: prev.cells.filter(cell => cell.id !== cellId)
    }));
  };

  // セルの更新
  const updateCell = (cellId: string, input: string) => {
    setMathContext(prev => ({
      ...prev,
      cells: prev.cells.map(cell => 
        cell.id === cellId 
          ? { ...cell, input, output: '', error: '' }
          : cell
      )
    }));
  };

  // 数式計算とグラフ更新
  const calculateCell = async (cellId: string) => {
    const cell = mathContext.cells.find(c => c.id === cellId);
    if (!cell || !cell.input.trim()) return;

    try {
      const result = await mathCalculator.calculate(cell.input, cellId);
      
      setMathContext(prev => {
        const newContext = { ...prev };
        
        // セルの出力を更新
        newContext.cells = prev.cells.map(c => 
          c.id === cellId 
            ? { 
                ...c, 
                output: result.success ? result.latex || '' : '',
                error: result.success ? '' : result.error || ''
              }
            : c
        );

        // 変数を更新
        if (result.variables) {
          result.variables.forEach(variable => {
            newContext.variables.set(variable.name, variable);
          });
        }

        // 関数を更新
        if (result.functions) {
          result.functions.forEach(func => {
            newContext.functions.set(func.id, func);
          });
        }

        return newContext;
      });
    } catch (error) {
      setMathContext(prev => ({
        ...prev,
        cells: prev.cells.map(c => 
          c.id === cellId 
            ? { ...c, output: '', error: `エラー: ${(error as Error).message}` }
            : c
        )
      }));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* グラフエリア */}
      <div 
        className="flex-shrink-0"
        style={{ 
          height: '200px',
          borderBottom: `1px solid ${colors.border}`
        }}
      >
        <GraphArea 
          functions={Array.from(mathContext.functions.values())}
          variables={mathContext.variables}
        />
      </div>

      {/* セルエリア */}
      <div className="flex-1 overflow-auto">
        <CellsArea
          cells={mathContext.cells}
          variables={mathContext.variables}
          onCellUpdate={updateCell}
          onCellCalculate={calculateCell}
          onAddCell={addCell}
          onDeleteCell={deleteCell}
        />
      </div>
    </div>
  );
}
