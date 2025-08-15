// 数学計算エンジン
import { CalculationResult, MathVariable, GraphFunction } from '@/types/math';

// LaTeX構文解析トークン
interface LaTeXToken {
  type: 'command' | 'text' | 'group' | 'superscript' | 'subscript' | 'number' | 'variable';
  value: string;
  args?: LaTeXToken[][];
  superscript?: LaTeXToken[];
  subscript?: LaTeXToken[];
}

// Algebrite用の本格的数学計算エンジン
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

  // LaTeX式を内部表現に変換（本格的構文解析）
  parseLatex(latex: string): string {
    if (!latex.trim()) return '';
    
    console.log('LaTeX input:', latex);
    
    try {
      // LaTeX式をトークン化
      const tokens = this.tokenizeLaTeX(latex);
      console.log('Tokens:', tokens);
      
      // トークンをAlgebrite形式に変換
      const algebraiteExpression = this.convertTokensToAlgebrite(tokens);
      
      console.log('Parsed result:', algebraiteExpression);
      return algebraiteExpression;
    } catch (error) {
      console.error('LaTeX parsing error:', error);
      throw new Error(`LaTeX解析エラー: ${(error as Error).message}`);
    }
  }

  // LaTeX文字列をトークンに分解
  private tokenizeLaTeX(latex: string): LaTeXToken[] {
    const tokens: LaTeXToken[] = [];
    let i = 0;
    
    while (i < latex.length) {
      const char = latex[i];
      
      if (char === '\\') {
        // コマンドの解析
        const command = this.parseCommand(latex, i);
        tokens.push(command.token);
        i = command.nextIndex;
      } else if (char === '{') {
        // グループの解析
        const group = this.parseGroup(latex, i);
        tokens.push(group.token);
        i = group.nextIndex;
      } else if (char === '^') {
        // 上付き文字
        const superscript = this.parseSuperscript(latex, i);
        if (tokens.length > 0) {
          tokens[tokens.length - 1].superscript = superscript.tokens;
        }
        i = superscript.nextIndex;
      } else if (char === '_') {
        // 下付き文字
        const subscript = this.parseSubscript(latex, i);
        if (tokens.length > 0) {
          tokens[tokens.length - 1].subscript = subscript.tokens;
        }
        i = subscript.nextIndex;
      } else if (/[0-9.]/.test(char)) {
        // 数値の解析
        const number = this.parseNumber(latex, i);
        tokens.push(number.token);
        i = number.nextIndex;
      } else if (/[a-zA-Z]/.test(char)) {
        // 変数の解析
        tokens.push({
          type: 'variable',
          value: char
        });
        i++;
      } else if (char === ' ') {
        // 空白をスキップ
        i++;
      } else {
        // その他の文字
        tokens.push({
          type: 'text',
          value: char
        });
        i++;
      }
    }
    
    return tokens;
  }

  // LaTeXコマンドの解析
  private parseCommand(latex: string, startIndex: number): { token: LaTeXToken, nextIndex: number } {
    let i = startIndex + 1; // \ をスキップ
    let commandName = '';
    
    // コマンド名を取得
    while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
      commandName += latex[i];
      i++;
    }
    
    const token: LaTeXToken = {
      type: 'command',
      value: commandName,
      args: []
    };
    
    // コマンドの引数を解析
    const argsInfo = this.parseCommandArguments(latex, i, commandName);
    token.args = argsInfo.args;
    
    return {
      token,
      nextIndex: argsInfo.nextIndex
    };
  }

  // コマンドの引数を解析
  private parseCommandArguments(latex: string, startIndex: number, commandName: string): { args: LaTeXToken[][], nextIndex: number } {
    const args: LaTeXToken[][] = [];
    let i = startIndex;
    
    // コマンドごとの引数パターンを定義
    const commandPatterns: { [key: string]: number } = {
      'frac': 2,        // \frac{分子}{分母}
      'sqrt': 1,        // \sqrt{中身}
      'int': 0,         // \int (引数なし、下付き上付きで処理)
      'sum': 0,         // \sum
      'prod': 0,        // \prod
      'lim': 0,         // \lim
      'sin': 0,         // \sin
      'cos': 0,         // \cos
      'tan': 0,         // \tan
      'log': 0,         // \log
      'ln': 0,          // \ln
      'exp': 0,         // \exp
      'left': 0,        // \left
      'right': 0,       // \right
    };
    
    const expectedArgs = commandPatterns[commandName] || 0;
    
    // 引数を解析
    for (let argIndex = 0; argIndex < expectedArgs; argIndex++) {
      // 空白をスキップ
      while (i < latex.length && latex[i] === ' ') {
        i++;
      }
      
      if (i < latex.length && latex[i] === '{') {
        const group = this.parseGroup(latex, i);
        if (group.token.type === 'group') {
          args.push(this.tokenizeLaTeX(group.token.value));
        }
        i = group.nextIndex;
      }
    }
    
    return { args, nextIndex: i };
  }

  // グループ（{}で囲まれた部分）の解析
  private parseGroup(latex: string, startIndex: number): { token: LaTeXToken, nextIndex: number } {
    let i = startIndex + 1; // { をスキップ
    let content = '';
    let braceCount = 1;
    
    while (i < latex.length && braceCount > 0) {
      const char = latex[i];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
      
      if (braceCount > 0) {
        content += char;
      }
      i++;
    }
    
    return {
      token: {
        type: 'group',
        value: content
      },
      nextIndex: i
    };
  }

  // 上付き文字の解析
  private parseSuperscript(latex: string, startIndex: number): { tokens: LaTeXToken[], nextIndex: number } {
    let i = startIndex + 1; // ^ をスキップ
    
    if (i < latex.length && latex[i] === '{') {
      const group = this.parseGroup(latex, i);
      return {
        tokens: this.tokenizeLaTeX(group.token.value),
        nextIndex: group.nextIndex
      };
    } else {
      // 単一文字の上付き
      const char = latex[i] || '';
      return {
        tokens: [{
          type: /[0-9]/.test(char) ? 'number' : 'variable',
          value: char
        }],
        nextIndex: i + 1
      };
    }
  }

  // 下付き文字の解析
  private parseSubscript(latex: string, startIndex: number): { tokens: LaTeXToken[], nextIndex: number } {
    let i = startIndex + 1; // _ をスキップ
    
    if (i < latex.length && latex[i] === '{') {
      const group = this.parseGroup(latex, i);
      return {
        tokens: this.tokenizeLaTeX(group.token.value),
        nextIndex: group.nextIndex
      };
    } else {
      // 単一文字の下付き
      const char = latex[i] || '';
      return {
        tokens: [{
          type: /[0-9]/.test(char) ? 'number' : 'variable',
          value: char
        }],
        nextIndex: i + 1
      };
    }
  }

  // 数値の解析
  private parseNumber(latex: string, startIndex: number): { token: LaTeXToken, nextIndex: number } {
    let i = startIndex;
    let number = '';
    
    while (i < latex.length && /[0-9.]/.test(latex[i])) {
      number += latex[i];
      i++;
    }
    
    return {
      token: {
        type: 'number',
        value: number
      },
      nextIndex: i
    };
  }

  // トークンをAlgebrite形式に変換
  private convertTokensToAlgebrite(tokens: LaTeXToken[]): string {
    // 積分を含む式の特別処理
    const integralResult = this.processIntegrals(tokens);
    if (integralResult) {
      return integralResult;
    }
    
    // 通常の変換処理
    let result = '';
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const converted = this.convertSingleToken(token, tokens, i);
      result += converted;
    }
    
    // 後処理：暗黙の乗算を明示的に
    result = this.addImplicitMultiplication(result);
    
    return result;
  }

  // 積分式を特別に処理
  private processIntegrals(tokens: LaTeXToken[]): string | null {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token.type === 'command' && token.value === 'int') {
        // 積分が見つかった場合の処理
        const integralInfo = this.extractIntegralInfo(tokens, i);
        if (integralInfo) {
          return integralInfo;
        }
      }
    }
    return null;
  }

  // 積分情報を抽出
  private extractIntegralInfo(tokens: LaTeXToken[], integralIndex: number): string | null {
    const integralToken = tokens[integralIndex];
    
    // 下限と上限を取得
    const lower = integralToken.subscript ? this.convertTokensToAlgebrite(integralToken.subscript) : '';
    const upper = integralToken.superscript ? this.convertTokensToAlgebrite(integralToken.superscript) : '';
    
    if (!lower || !upper) {
      return null; // 定積分でない場合はスキップ
    }
    
    // 積分記号の後の被積分関数を取得
    let integrandTokens: LaTeXToken[] = [];
    let variable = 'x'; // デフォルト変数
    let foundDifferential = false;
    
    // 積分記号の後から dx または dy などまでのトークンを収集
    for (let i = integralIndex + 1; i < tokens.length; i++) {
      const token = tokens[i];
      
      // dx, dy などの微分要素を検出（別々のトークン）
      if (token.type === 'text' && token.value === 'd' && i + 1 < tokens.length) {
        const nextToken = tokens[i + 1];
        if (nextToken.type === 'variable') {
          variable = nextToken.value;
          foundDifferential = true;
          break;
        }
      }
      
      // dx が一つのトークンとして認識された場合
      if (token.type === 'variable' && token.value.length > 1 && token.value.startsWith('d')) {
        variable = token.value.substring(1);
        foundDifferential = true;
        break;
      }
      
      // \d コマンドとして認識された場合
      if (token.type === 'command' && token.value === 'd' && i + 1 < tokens.length) {
        const nextToken = tokens[i + 1];
        if (nextToken.type === 'variable') {
          variable = nextToken.value;
          foundDifferential = true;
          break;
        }
      }
      
      integrandTokens.push(token);
    }
    
    // 被積分関数をAlgebrite形式に変換（積分専用の変換を使用）
    const integrand = this.convertIntegrandToAlgebrite(integrandTokens);
    
    // 不要な文字を除去
    const cleanIntegrand = integrand
      .replace(/\*$/, '') // 末尾の*を除去
      .replace(/^\*/, '') // 先頭の*を除去
      .trim();
    
    return `defint(${cleanIntegrand}, ${variable}, ${lower}, ${upper})`;
  }

  // 被積分関数専用の変換（dxを除外）
  private convertIntegrandToAlgebrite(tokens: LaTeXToken[]): string {
    let result = '';
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const converted = this.convertSingleToken(token, tokens, i);
      result += converted;
    }
    
    // 暗黙の乗算を明示的に追加
    result = this.addImplicitMultiplication(result);
    
    return result;
  }

  // 単一トークンの変換
  private convertSingleToken(token: LaTeXToken, allTokens: LaTeXToken[], index: number): string {
    switch (token.type) {
      case 'command':
        return this.convertCommand(token);
      
      case 'variable':
        let result = token.value;
        if (token.superscript) {
          const superscriptExpr = this.convertTokensToAlgebrite(token.superscript);
          result += `^(${superscriptExpr})`;
        }
        if (token.subscript) {
          const subscriptExpr = this.convertTokensToAlgebrite(token.subscript);
          // 下付き文字は変数名の一部として扱う（例：x_1 -> x1）
          result += subscriptExpr;
        }
        return result;
      
      case 'number':
        let numResult = token.value;
        if (token.superscript) {
          const superscriptExpr = this.convertTokensToAlgebrite(token.superscript);
          numResult += `^(${superscriptExpr})`;
        }
        return numResult;
      
      case 'group':
        return `(${this.parseLatex(token.value)})`;
      
      case 'text':
        return token.value;
      
      default:
        return token.value;
    }
  }

  // LaTeXコマンドをAlgebrite関数に変換
  private convertCommand(token: LaTeXToken): string {
    const commandName = token.value;
    const args = token.args || [];
    
    switch (commandName) {
      case 'frac':
        if (args.length >= 2) {
          const numerator = this.convertTokensToAlgebrite(args[0]);
          const denominator = this.convertTokensToAlgebrite(args[1]);
          return `((${numerator})/(${denominator}))`;
        }
        return '';
      
      case 'sqrt':
        if (args.length >= 1) {
          const argument = this.convertTokensToAlgebrite(args[0]);
          return `sqrt(${argument})`;
        }
        return 'sqrt';
      
      case 'int':
        // 積分：この段階では空文字を返す（processIntegralsで処理済み）
        return '';
      
      case 'sum':
        const sumLower = token.subscript ? this.convertTokensToAlgebrite(token.subscript) : '';
        const sumUpper = token.superscript ? this.convertTokensToAlgebrite(token.superscript) : '';
        return `sum_placeholder_${sumLower}_${sumUpper}`;
      
      case 'prod':
        const prodLower = token.subscript ? this.convertTokensToAlgebrite(token.subscript) : '';
        const prodUpper = token.superscript ? this.convertTokensToAlgebrite(token.superscript) : '';
        return `product_placeholder_${prodLower}_${prodUpper}`;
      
      case 'lim':
        const limExpr = token.subscript ? this.convertTokensToAlgebrite(token.subscript) : '';
        return `limit_placeholder_${limExpr}`;
      
      // 三角関数
      case 'sin': return 'sin';
      case 'cos': return 'cos';
      case 'tan': return 'tan';
      case 'sec': return 'sec';
      case 'csc': return 'csc';
      case 'cot': return 'cot';
      
      // 逆三角関数
      case 'arcsin': return 'arcsin';
      case 'arccos': return 'arccos';
      case 'arctan': return 'arctan';
      
      // 双曲線関数
      case 'sinh': return 'sinh';
      case 'cosh': return 'cosh';
      case 'tanh': return 'tanh';
      
      // 対数・指数関数
      case 'log': return 'log';
      case 'ln': return 'log'; // Algebraiteでは log が自然対数
      case 'exp': return 'exp';
      
      // 数学定数
      case 'pi': return 'pi';
      case 'e': return 'e';
      case 'infty': return 'infinity';
      
      // 微分
      case 'd': 
        return ''; // dx は積分処理で既に処理済み
      
      // 括弧
      case 'left':
      case 'right':
        return ''; // 括弧は既に処理済み
      
      default:
        return commandName;
    }
  }

  // 暗黙の乗算を明示的に追加
  private addImplicitMultiplication(expression: string): string {
    let result = expression;
    
    // 関数と括弧の間に乗算を挿入：sin(x)(1) -> sin(x)*(1)
    result = result.replace(/\)\s*\(/g, ')*(');
    
    // 数字と変数の間：2x -> 2*x
    result = result.replace(/(\d)\s*([a-zA-Z])/g, '$1*$2');
    
    // 変数と関数の間：x sin(y) -> x*sin(y)
    result = result.replace(/([a-zA-Z])\s+(sin|cos|tan|log|exp|sqrt)/g, '$1*$2');
    
    // 関数名と変数の間に括弧を挿入：sin x -> sin(x)
    result = result.replace(/\b(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|arcsin|arccos|arctan)\s*([a-zA-Z]|\()/g, (match, func, nextChar) => {
      if (nextChar === '(') {
        return `${func}${nextChar}`;
      } else {
        return `${func}(${nextChar})`;
      }
    });
    
    // 関数名と式の間：sin*x -> sin(x)
    result = result.replace(/\b(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|arcsin|arccos|arctan)\*([a-zA-Z0-9]+)/g, '$1($2)');
    
    // 閉じ括弧と変数の間：(a)x -> (a)*x
    result = result.replace(/\)\s*([a-zA-Z])/g, ')*$1');
    
    // 変数と開き括弧の間：x(a) -> x*(a)
    result = result.replace(/([a-zA-Z])\s*\(/g, '$1*(');
    
    return result;
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
