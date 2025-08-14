// 数学パネル用の型定義

export interface MathCell {
  id: string;
  input: string; // LaTeX入力
  output?: string; // LaTeX出力
  error?: string; // エラーメッセージ
  isExpression: boolean; // 式 or 代入文
  dependencies: string[]; // 依存する変数名
}

export interface MathVariable {
  name: string;
  value: number | string | any; // Algebrite expression
  type: 'constant' | 'function' | 'expression';
  cellId: string;
  latex?: string; // LaTeX表現
}

export interface GraphFunction {
  id: string;
  expression: string; // 内部表現
  latex: string; // LaTeX表現
  color: string;
  visible: boolean;
  domain?: [number, number];
  range?: [number, number];
  type: 'cartesian' | 'polar' | 'parametric';
  cellId: string;
}

export interface MathContext {
  variables: Map<string, MathVariable>;
  functions: Map<string, GraphFunction>;
  cells: MathCell[];
  nextCellId: number;
}

export interface CalculationResult {
  success: boolean;
  result?: any; // Algebrite result
  latex?: string; // LaTeX formatted result
  error?: string;
  variables?: MathVariable[]; // 更新された変数
  functions?: GraphFunction[]; // 更新された関数
}
