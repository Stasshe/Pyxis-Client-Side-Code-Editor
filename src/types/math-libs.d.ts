// Type definitions for external math libraries

// Algebrite型定義
declare module 'algebrite' {
  export function run(code: string): string;
  export function Eval(expression: any): any;
  export function derivative(expression: any, variable?: any): any;
  export function integral(expression: any, variable?: any): any;
  export function factor(expression: any): any;
  export function expand(expression: any): any;
  export function simplify(expression: any): any;
  export function solve(equation: any, variable?: any): any;
  export function latex(expression: any): string;
  export function parse(expression: string): any;
  export const Algebra: any;
}

// Math-expressions型定義
declare module 'math-expressions' {
  export function fromLatex(latex: string): any;
  export function fromText(text: string): any;
  export class Expression {
    toString(): string;
    evaluate(variables?: { [key: string]: number }): number;
    derivative(variable: string): Expression;
    substitute(substitutions: { [key: string]: any }): Expression;
  }
}
