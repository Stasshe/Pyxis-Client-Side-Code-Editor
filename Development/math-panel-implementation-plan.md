# 数学パネル実装計画書

## 概要
Pyxis Code Editorに数学パネルを追加し、LaTeX記法での数式入力・計算・グラフ表示機能を実装する。
理系高校数学レベルをカバーし、iPad等のタッチデバイスに対応したインタラクティブな数学環境を提供する。

## 機能要件

### 1. UI構成
- **MenuBar**: 設定アイコンの上に数学アイコン（∑ または π）を追加
- **LeftSidebar**: 新しい数学タブを追加
- **MathPanel**: LeftSidebarに表示される数学パネル
  - **GraphArea**: パネル上部に関数グラフ表示領域
  - **CellsArea**: パネル下部にExcelライクなセル入力領域

### 2. セル機能
- **LaTeX入力**: LaTeX記法での数式入力
- **LaTeX出力**: 計算結果をLaTeX記法で表示
- **リアルタイム計算**: セル内容変更時の自動再計算
- **変数共有**: セル間での変数・定数の共有
- **関数定義**: y = f(x)形式での関数定義

### 3. グラフ機能
- **リアルタイムプロット**: セル内容変更時の自動グラフ更新
- **マルチ関数表示**: 複数関数の同時プロット
- **色分け**: 関数ごとのランダム色付け
- **タッチ操作対応**: ズーム、パン、値確認

### 4. 数学機能範囲
- 基本四則演算、べき乗、根号
- 三角関数、逆三角関数、双曲線関数
- 指数関数、対数関数
- 微分、積分（基本的なもの）
- 行列演算（基本的なもの）
- 方程式求解（多項式等）

## 技術選定

### 1. 数式計算ライブラリ
**選定: Algebrite + Math.js の組み合わせ**
- **Algebrite**: 
  - 記号計算に特化（微分、積分、因数分解等）
  - LaTeX入出力サポート
  - 高校数学範囲を網羅
- **Math.js**: 
  - 数値計算に特化
  - 行列演算、統計関数等
  - 単位計算、式パーサー

### 2. グラフ描画ライブラリ
**選定: Function Plot**
- 数学関数に特化した高性能グラフライブラリ
- LaTeX式を直接プロット可能
- タッチ操作（ズーム、パン）対応
- 複数関数の色分け表示
- 陰関数、媒介変数、極座標対応

### 3. LaTeX処理
**選定: 既存KaTeX + LaTeX-to-AST パーサー**
- **表示**: 既存のKaTeX（react-markdown + rehype-katex）
- **パース**: math-expressions または algebrite内蔵パーサー
- **入力支援**: LaTeX入力補完機能

### 4. 変数管理
**変数スコープ設計**:
```
グローバル変数: a=5, b=2, etc. (全セルで共有)
関数変数: x, y (各関数定義内でのみ有効)
関数定義: f(x) = x^2 + a*x + b (グローバル変数参照可能)
```

## 実装フェーズ

### フェーズ1: 基盤構築
1. **依存関係追加**
   ```bash
   npm install algebrite math-expressions function-plot
   npm install @types/algebrite
   ```

2. **型定義作成**
   - MathCell, MathVariable, GraphFunction等の型定義

3. **MenuBar拡張**
   - 数学アイコン追加（settings上に配置）
   - MenuTab型に'math'追加

### フェーズ2: UI構築
1. **MathPanel コンポーネント作成**
   - GraphArea: Function-Plotを使用したグラフ表示
   - CellsArea: セル入力エリア

2. **MathCell コンポーネント作成**
   - LaTeX入力フィールド
   - LaTeX出力表示
   - エラー表示

3. **LeftSidebar拡張**
   - 数学タブ対応

### フェーズ3: 数学機能実装
1. **数式計算エンジン**
   - Algebrite + Math.js統合
   - LaTeX ↔ 内部表現変換
   - 変数管理システム

2. **グラフ機能**
   - Function-Plot統合
   - 関数自動プロット
   - 色管理システム

3. **セル間連携**
   - 変数共有システム
   - リアルタイム再計算

### フェーズ4: 高度機能・最適化
1. **タッチ操作最適化**
   - iPad対応のジェスチャー
   - レスポンシブ対応

2. **LaTeX入力支援**
   - 数式入力補完
   - 記号パレット

3. **エクスポート機能**
   - LaTeX形式でのエクスポート
   - 画像形式でのグラフエクスポート

## ファイル構成

```
src/
├── components/
│   ├── MenuBar.tsx (拡張)
│   ├── Left/
│   │   ├── LeftSidebar.tsx (拡張)
│   │   └── MathPanel/
│   │       ├── MathPanel.tsx
│   │       ├── GraphArea.tsx
│   │       ├── CellsArea.tsx
│   │       ├── MathCell.tsx
│   │       └── LaTeXInput.tsx
├── hooks/
│   ├── useMathCalculation.ts
│   ├── useMathVariables.ts
│   └── useGraphPlot.ts
├── utils/
│   ├── math/
│   │   ├── calculator.ts
│   │   ├── latexParser.ts
│   │   ├── variableManager.ts
│   │   └── graphRenderer.ts
└── types/
    └── math.ts
```

## 実装詳細

### 1. 数学計算フロー
```
LaTeX入力 → パーサー → AST → 計算エンジン → 結果 → LaTeX出力
                ↓
         変数更新 → 他セル再計算 → グラフ更新
```

### 2. 変数管理
```typescript
interface MathVariable {
  name: string;
  value: number | string | AlgebraicExpression;
  type: 'constant' | 'function' | 'expression';
  cellId: string;
}

interface MathContext {
  variables: Map<string, MathVariable>;
  functions: Map<string, MathFunction>;
  updateVariable: (name: string, value: any) => void;
  getDependentCells: (varName: string) => string[];
}
```

### 3. グラフ表示
```typescript
interface GraphFunction {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  domain?: [number, number];
  type: 'cartesian' | 'polar' | 'parametric';
}
```

## 既存システムとの統合

### 1. テーマシステム連携
- 既存のThemeContextを使用
- グラフの色もテーマに対応

### 2. ファイルシステム連携
- 数学セッションの保存/読み込み
- .math拡張子でのファイル管理

### 3. 設定パネル連携
- 数学パネル固有の設定項目追加
- グラフ表示設定、計算精度等

## パフォーマンス考慮

### 1. 計算の最適化
- 変更されたセルのみ再計算
- 循環参照の検出と防止
- 重い計算の非同期実行

### 2. グラフ描画の最適化
- 関数変更時のみ再描画
- ビューポート外の計算スキップ
- Canvas最適化

### 3. メモリ管理
- 不要な計算結果のガベージコレクション
- 大きな数値配列の効率的管理

## テスト戦略

### 1. 単体テスト
- 数学計算エンジンの精度テスト
- LaTeXパーサーの正確性テスト
- 変数管理システムのテスト

### 2. 統合テスト
- セル間連携のテスト
- グラフ更新のテスト
- ファイル保存/読み込みテスト

### 3. UIテスト
- タッチ操作のテスト
- レスポンシブ対応テスト
- アクセシビリティテスト

## 将来の拡張可能性

### 1. 3Dグラフ対応
- Plot.ly等を使用した3D可視化

### 2. プログラミング機能
- 数学的アルゴリズムの実装
- データ分析機能

### 3. 協力機能
- 数学セッションの共有
- リアルタイム協力編集

この計画書に基づいて、段階的に実装を進めることで、高機能で使いやすい数学パネルを構築できます。
