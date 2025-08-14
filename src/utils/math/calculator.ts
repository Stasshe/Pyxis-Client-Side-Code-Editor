// 数学計算エンジン
import { CalculationResult, MathVariable, GraphFunction } from '@/types/math';

// Algebrite用の基本ラッパー
class MathCalculator {
  private Algebrite: any = null;
  private variables: Map<string, any> = new Map();

  async initialize() {
    if (!this.Algebrite) {
      // 動的にAlgebriteを読み込み
      try {
        this.Algebrite = await import('algebrite');
      } catch (error) {
        console.error('Failed to load Algebrite:', error);
        throw new Error('数学ライブラリの読み込みに失敗しました');
      }
    }
  }

  // LaTeX式を内部表現に変換
  parseLatex(latex: string): string {
    if (!latex.trim()) return '';
    
    let expression = latex;
    console.log('LaTeX input:', expression);
    
    // まず特殊な記号を一時的に置換
    expression = expression.replace(/\\int/g, 'INTEGRAL');
    expression = expression.replace(/\\frac/g, 'FRAC');
    
    // 簡単な積分変換：\int_1^2\frac{1}{x} -> defint(1/x,x,1,2)
    expression = expression.replace(/INTEGRAL_(\d+)\^(\d+)\s*FRAC\{([^}]+)\}\{([^}]+)\}/g, 'defint(($3)/($4),x,$1,$2)');
    
    // 一般的な分数変換
    expression = expression.replace(/FRAC\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
    
    // 残った積分記号を処理
    expression = expression.replace(/INTEGRAL/g, 'integral');
    
    // その他の基本変換
    expression = expression.replace(/\^/g, '**');
    expression = expression.replace(/\\pi/g, 'pi');
    expression = expression.replace(/\\e/g, 'e');
    expression = expression.replace(/\{([^}]+)\}/g, '($1)');
    
    console.log('Parsed result:', expression);
    return expression;
  }

  // 内部表現をLaTeXに変換
  formatToLatex(result: any): string {
    if (!this.Algebrite) return result.toString();
    
    try {
      return this.Algebrite.latex(result);
    } catch (error) {
      return result.toString();
    }
  }

  // 式を計算
  async calculate(input: string, cellId: string): Promise<CalculationResult> {
    await this.initialize();
    
    try {
      let expression = input.trim();
      if (!expression) {
        return { success: false, error: '空の式です' };
      }

      console.log('Original input:', expression);

      // LaTeX記法を変換
      expression = this.parseLatex(expression);
      console.log('After LaTeX parsing:', expression);

      // 代入文かどうかを判定
      const isAssignment = expression.includes('=') && !expression.includes('==');
      
      if (isAssignment) {
        return this.handleAssignment(expression, cellId);
      } else {
        return this.handleExpression(expression, cellId);
      }
    } catch (error) {
      return {
        success: false,
        error: `計算エラー: ${(error as Error).message}`
      };
    }
  }

  // 代入文の処理
  private handleAssignment(expression: string, cellId: string): CalculationResult {
    const parts = expression.split('=');
    if (parts.length !== 2) {
      return { success: false, error: '不正な代入文です' };
    }

    const varName = parts[0].trim();
    const value = parts[1].trim();

    try {
      // まず右辺を計算（変数名を使用せずに）
      console.log('Original value:', value);
      console.log('Parsed expression:', value);
      
      const result = this.Algebrite.run(value);
      console.log('Calculation result:', result);
      console.log('Result type:', typeof result);
      console.log('Result string:', result.toString());
      
      // 結果の後処理（余分な文字を削除）
      let cleanResult = result.toString().trim();
      
      // Algebrite特有の余分な文字を削除
      cleanResult = cleanResult.replace(/^\$\s*/, ''); // 先頭の$を削除
      cleanResult = cleanResult.replace(/\s*\$$/, ''); // 末尾の$を削除
      cleanResult = cleanResult.replace(/\s*\?\s*$/, ''); // 末尾の?を削除
      cleanResult = cleanResult.replace(/\s*\?\s*Stop:\s*syntax\s*error.*$/gi, ''); // ? Stop: syntax error を削除
      cleanResult = cleanResult.replace(/Stop:\s*syntax\s*error.*$/gi, ''); // Stop: syntax error を削除
      
      // 空白のトリム
      cleanResult = cleanResult.trim();
      
      console.log('Cleaned result:', cleanResult);
      
      // 計算結果が変数名と同じでないかチェック
      if (cleanResult === varName || !cleanResult) {
        return {
          success: false,
          error: `計算エラー: 式 "${value}" を評価できませんでした。積分や微分が正しく記述されているか確認してください。`
        };
      }
      
      // 変数に値を代入（クリーンな結果を使用）
      this.Algebrite.run(`${varName} = ${cleanResult}`);
      
      // 変数を保存
      this.variables.set(varName, cleanResult);
      
      // LaTeX形式に変換
      let latex;
      try {
        latex = this.Algebrite.latex(cleanResult);
      } catch {
        // LaTeX変換に失敗した場合は文字列表現を使用
        latex = cleanResult;
      }
      
      const variable: MathVariable = {
        name: varName,
        value: result,
        type: this.isFunction(varName, value) ? 'function' : 'constant',
        cellId,
        latex
      };

      // 関数かどうかをチェック
      const functions: GraphFunction[] = [];
      if (this.isFunction(varName, value)) {
        functions.push({
          id: `${cellId}-${varName}`,
          expression: value,
          latex: `${varName} = ${latex}`,
          color: this.generateRandomColor(),
          visible: true,
          type: 'cartesian',
          cellId
        });
      }

      return {
        success: true,
        result,
        latex: `${varName} = ${latex}`,
        variables: [variable],
        functions
      };
    } catch (error) {
      return {
        success: false,
        error: `計算エラー: ${(error as Error).message}`
      };
    }
  }

  // 式の評価
  private handleExpression(expression: string, cellId: string): CalculationResult {
    try {
      // Algebraiteで式を評価
      const result = this.Algebrite.run(expression);
      
      // LaTeX形式に変換
      let latex;
      try {
        latex = this.Algebrite.latex(result);
      } catch {
        // LaTeX変換に失敗した場合は文字列表現を使用
        latex = result.toString();
      }
      
      return {
        success: true,
        result,
        latex
      };
    } catch (error) {
      return {
        success: false,
        error: `計算エラー: ${(error as Error).message}`
      };
    }
  }

  // 関数かどうかを判定
  private isFunction(varName: string, expression: string): boolean {
    // y = または f(x) = のような形式をチェック
    return varName === 'y' || 
           varName.includes('(') || 
           expression.includes('x') || 
           expression.includes('t');
  }

  // ランダムな色を生成
  private generateRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // 変数を取得
  getVariable(name: string): any {
    return this.variables.get(name);
  }

  // 全変数を取得
  getAllVariables(): Map<string, any> {
    return new Map(this.variables);
  }

  // 変数をクリア
  clearVariables(): void {
    this.variables.clear();
    if (this.Algebrite) {
      this.Algebrite.run('clear');
    }
  }
}

// シングルトンインスタンス
const mathCalculator = new MathCalculator();

export default mathCalculator;
