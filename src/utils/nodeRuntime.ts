import { getFileSystem, getProjectDir } from './filesystem';
import { UnixCommands } from './cmd/unix';

// Node.js風のランタイム環境
export class NodeJSRuntime {
  private fs: any;
  private projectDir: string;
  private unixCommands: UnixCommands;
  private console: any;
  private onOutput?: (output: string, type: 'log' | 'error') => void;
  private onFileOperation?: (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean) => Promise<void>;
  private moduleCache: Map<string, any> = new Map(); // モジュールキャッシュ
  private currentWorkingDirectory: string = '/'; // 現在の作業ディレクトリ

  constructor(
    projectName: string, 
    onOutput?: (output: string, type: 'log' | 'error') => void,
    onFileOperation?: (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean) => Promise<void>
  ) {
    this.fs = getFileSystem();
    this.projectDir = getProjectDir(projectName);
    this.unixCommands = new UnixCommands(projectName, onFileOperation);
    this.onOutput = onOutput;
    this.onFileOperation = onFileOperation;
    
    // console.logをオーバーライド
    this.console = {
      log: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        this.onOutput?.(output, 'log');
      },
      error: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        this.onOutput?.(output, 'error');
      },
      warn: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        this.onOutput?.(`⚠️ ${output}`, 'log');
      },
      info: (...args: any[]) => {
        const output = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        this.onOutput?.(`ℹ️ ${output}`, 'log');
      }
    };
  }

  // Node.js風のコードを実行
  async executeNodeJS(code: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      // まず必要なモジュールを事前ロード
      await this.preloadModules(code);
      
      // Node.js風のグローバル環境を構築
      const nodeGlobals = this.createNodeGlobals();
      
      // コードを実行可能な形に変換
      const wrappedCode = this.wrapCodeForExecution(code, nodeGlobals);
      
      // 実行
      const result = await this.executeInSandbox(wrappedCode, nodeGlobals);
      
      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.onOutput?.(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  }

  // コード内のrequire/importを解析して事前ロード
  private async preloadModules(code: string): Promise<void> {
    const moduleNames = new Set<string>();
    
    console.log('[preloadModules] Analyzing code for modules:', code);
    
    // require()文の検出
    const requireMatches = code.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
    if (requireMatches) {
      console.log('[preloadModules] Found require statements:', requireMatches);
      requireMatches.forEach(match => {
        const moduleName = match.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/)?.[1];
        if (moduleName && !this.isBuiltinModule(moduleName)) {
          console.log(`[preloadModules] Adding module to preload: ${moduleName}`);
          moduleNames.add(moduleName);
        }
      });
    }
    
    // import文の検出
    const importMatches = code.match(/from\s+['"`]([^'"`]+)['"`]/g);
    if (importMatches) {
      console.log('[preloadModules] Found import statements:', importMatches);
      importMatches.forEach(match => {
        const moduleName = match.match(/from\s+['"`]([^'"`]+)['"`]/)?.[1];
        if (moduleName && !this.isBuiltinModule(moduleName)) {
          console.log(`[preloadModules] Adding module to preload: ${moduleName}`);
          moduleNames.add(moduleName);
        }
      });
    }
    
    console.log(`[preloadModules] Total modules to preload: ${Array.from(moduleNames)}`);
    
    // 検出されたモジュールを事前ロード
    for (const moduleName of moduleNames) {
      try {
        console.log(`[preloadModules] Preloading module: ${moduleName}`);
        await this.resolveModule(moduleName);
        console.log(`[preloadModules] Successfully preloaded: ${moduleName}`);
      } catch (error) {
        console.warn(`[preloadModules] Failed to preload ${moduleName}:`, (error as Error).message);
        // 事前ロードに失敗してもエラーにはしない
      }
    }
    
    console.log(`[preloadModules] Preloading complete. Cache contents:`, Array.from(this.moduleCache.keys()));
  }

  // Node.js風のグローバル環境を作成
  private createNodeGlobals(): any {
    const self = this;
    
    return {
      console: this.console,
      process: {
        cwd: () => this.unixCommands.getRelativePath(),
        env: { NODE_ENV: 'development' },
        version: 'v18.0.0',
        platform: 'browser',
        argv: ['node', 'script.js']
      },
      require: (moduleName: string) => {
        // キャッシュから取得（事前ロード済み）
        if (this.moduleCache.has(moduleName)) {
          return this.moduleCache.get(moduleName);
        }
        
        // 組み込みモジュールの場合は同期的に作成
        if (this.isBuiltinModule(moduleName)) {
          const module = this.createBuiltinModule(moduleName);
          this.moduleCache.set(moduleName, module);
          return module;
        }
        
        // ファイルモジュールが事前ロードされていない場合
        throw new Error(`Module '${moduleName}' not found. Make sure the module file exists and is accessible.`);
      },
      __filename: this.projectDir + '/script.js',
      __dirname: this.projectDir,
      module: {
        exports: {}
      },
      exports: {},
      Buffer: globalThis.Buffer || {
        from: (data: any) => new Uint8Array(typeof data === 'string' ? new TextEncoder().encode(data) : data),
        isBuffer: (obj: any) => obj instanceof Uint8Array
      },
      setTimeout: globalThis.setTimeout,
      setInterval: globalThis.setInterval,
      clearTimeout: globalThis.clearTimeout,
      clearInterval: globalThis.clearInterval
    };
  }

  // fs モジュールのエミュレーション
  private createFSModule() {
    const self = this;
    
    const fsModule = {
      readFile: async (path: string, options?: any): Promise<string> => {
        try {
          // パスがプロジェクトルート相対の場合の処理
          let fullPath;
          if (path.startsWith('/')) {
            // 絶対パスの場合、プロジェクトディレクトリを基準とする
            fullPath = `${self.projectDir}${path}`;
          } else {
            // 相対パスの場合
            fullPath = `${self.projectDir}/${path}`;
          }
          
          console.log(`[fs.readFile] Attempting to read: ${path} -> ${fullPath}`);
          const content = await self.fs.promises.readFile(fullPath, { encoding: 'utf8' });
          return content as string;
        } catch (error) {
          console.error(`[fs.readFile] Failed to read ${path}:`, error);
          throw new Error(`ENOENT: ${path}`);
        }
      },
      writeFile: async (path: string, data: string, options?: any): Promise<void> => {
        try {
          let fullPath;
          let relativePath;
          if (path.startsWith('/')) {
            fullPath = `${self.projectDir}${path}`;
            relativePath = path;
          } else {
            fullPath = `${self.projectDir}/${path}`;
            relativePath = `/${path}`;
          }
          
          console.log(`[fs.writeFile] Writing to: ${path} -> ${fullPath}`);
          
          // 親ディレクトリが存在することを確認
          const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'));
          if (parentDir && parentDir !== self.projectDir) {
            try {
              await self.fs.promises.stat(parentDir);
            } catch {
              await self.fs.promises.mkdir(parentDir, { recursive: true } as any);
            }
          }
          
          await self.fs.promises.writeFile(fullPath, data);
          
          // ファイルシステムのキャッシュをフラッシュ（unix.tsと同様）
          await self.flushFileSystemCache();
          
          console.log(`[nodeRuntime.fs.writeFile] File written to filesystem: ${fullPath}, content length: ${data.length}`);
          
          // IndexedDBとの同期（unix.tsと同様）
          if (self.onFileOperation) {
            console.log(`[nodeRuntime.fs.writeFile] Calling onFileOperation with isNodeRuntime=true`);
            await self.onFileOperation(relativePath, 'file', data, true); // isNodeRuntime = true
            console.log(`[nodeRuntime.fs.writeFile] onFileOperation completed`);
          }
          
          self.onOutput?.(`File written: ${path}`, 'log');
        } catch (error) {
          throw new Error(`Failed to write file '${path}': ${(error as Error).message}`);
        }
      },
      readFileSync: (path: string, options?: any): string => {
        throw new Error('Synchronous file operations are not supported in browser environment. Use async versions.');
      },
      writeFileSync: (path: string, data: string, options?: any): void => {
        throw new Error('Synchronous file operations are not supported in browser environment. Use async versions.');
      },
      existsSync: async (path: string): Promise<boolean> => {
        try {
          let fullPath;
          if (path.startsWith('/')) {
            fullPath = `${self.projectDir}${path}`;
          } else {
            fullPath = `${self.projectDir}/${path}`;
          }
          
          await self.fs.promises.stat(fullPath);
          return true;
        } catch {
          return false;
        }
      },
      mkdir: async (path: string, options?: any): Promise<void> => {
        const recursive = options?.recursive || false;
        await self.unixCommands.mkdir(path, recursive);
        // unixCommandsが内部でonFileOperationを呼び出すので追加の同期は不要
      },
      readdir: async (path: string, options?: any): Promise<string[]> => {
        try {
          const fullPath = path.startsWith('/') ? path : `${self.projectDir}/${path}`;
          const files = await self.fs.promises.readdir(fullPath);
          return files.filter((file: string) => file !== '.git' && !file.startsWith('.git'));
        } catch (error) {
          throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
        }
      },
      unlink: async (path: string): Promise<void> => {
        await self.unixCommands.rm(path);
        // unixCommandsが内部でonFileOperationを呼び出すので追加の同期は不要
      },
      appendFile: async (path: string, data: string, options?: any): Promise<void> => {
        try {
          // 既存のファイル内容を読み取り
          let existingContent = '';
          try {
            existingContent = await fsModule.readFile(path);
          } catch {
            // ファイルが存在しない場合は空として扱う
          }
          
          // 既存の内容に新しいデータを追加
          const newContent = existingContent + data;
          await fsModule.writeFile(path, newContent);
        } catch (error) {
          throw new Error(`Failed to append to file '${path}': ${(error as Error).message}`);
        }
      },
      stat: async (path: string): Promise<any> => {
        try {
          let fullPath;
          if (path.startsWith('/')) {
            fullPath = `${self.projectDir}${path}`;
          } else {
            fullPath = `${self.projectDir}/${path}`;
          }
          return await self.fs.promises.stat(fullPath);
        } catch (error) {
          throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
        }
      }
    };

    // fs.promisesプロパティを追加
    (fsModule as any).promises = fsModule;
    
    return fsModule;
  }

  // path モジュールのエミュレーション
  private createPathModule() {
    return {
      join: (...paths: string[]): string => {
        return paths
          .filter(path => path)
          .join('/')
          .replace(/\/+/g, '/')
          .replace(/\/$/, '') || '/';
      },
      resolve: (...paths: string[]): string => {
        let resolved = this.projectDir;
        for (const path of paths) {
          if (path.startsWith('/')) {
            resolved = path;
          } else {
            resolved = `${resolved}/${path}`;
          }
        }
        return resolved.replace(/\/+/g, '/');
      },
      dirname: (path: string): string => {
        const lastSlash = path.lastIndexOf('/');
        return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
      },
      basename: (path: string, ext?: string): string => {
        const name = path.substring(path.lastIndexOf('/') + 1);
        return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
      },
      extname: (path: string): string => {
        const lastDot = path.lastIndexOf('.');
        const lastSlash = path.lastIndexOf('/');
        return (lastDot > lastSlash) ? path.substring(lastDot) : '';
      }
    };
  }

  // os モジュールのエミュレーション
  private createOSModule() {
    return {
      platform: () => 'browser',
      type: () => 'Browser',
      arch: () => 'x64',
      hostname: () => 'localhost',
      tmpdir: () => '/tmp',
      homedir: () => '/home/user',
      EOL: '\n'
    };
  }

  // util モジュールのエミュレーション
  private createUtilModule() {
    return {
      inspect: (obj: any, options?: any): string => {
        try {
          return JSON.stringify(obj, null, 2);
        } catch {
          return String(obj);
        }
      },
      format: (f: string, ...args: any[]): string => {
        let i = 0;
        return f.replace(/%[sdj%]/g, (x) => {
          if (x === '%%') return x;
          if (i >= args.length) return x;
          switch (x) {
            case '%s': return String(args[i++]);
            case '%d': return String(Number(args[i++]));
            case '%j':
              try {
                return JSON.stringify(args[i++]);
              } catch {
                return '[Circular]';
              }
            default:
              return x;
          }
        });
      },
      promisify: (fn: Function): Function => {
        return (...args: any[]) => {
          return new Promise((resolve, reject) => {
            fn(...args, (err: any, result: any) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
        };
      }
    };
  }

  // コードを実行用にラップ
  private wrapCodeForExecution(code: string, globals: any): string {
    // ES6 import/export を CommonJS require/module.exports に変換
    const transformedCode = this.transformESModules(code);
    
    // 確実に非同期関数として実行されるようにする
    return `
      (async function(globals) {
        // グローバル変数を設定
        const { console, process, require, module, exports, __filename, __dirname, Buffer, setTimeout, setInterval, clearTimeout, clearInterval } = globals;
        
        // ユーザーコードを実行
        ${transformedCode}
      })
    `;
  }

  // サンドボックス内でコードを実行
  private async executeInSandbox(wrappedCode: string, globals: any): Promise<string> {
    try {
      console.log('[NodeJS Runtime] Executing code:', wrappedCode.substring(0, 200) + '...');
      
      // 安全なFunction実行
      const asyncFunction = eval(wrappedCode);
      
      if (typeof asyncFunction !== 'function') {
        throw new Error('Generated function is not executable');
      }
      
      // グローバル変数を渡して実行
      const result = await asyncFunction(globals);
      
      return result !== undefined ? String(result) : '';
    } catch (error) {
      console.error('[NodeJS Runtime] Execution error:', error);
      throw new Error(`Execution error: ${(error as Error).message}`);
    }
  }

  // ファイルを実行
  async executeFile(filePath: string): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      // ファイルパスの正規化（プロジェクトルート相対）
      let fullPath;
      let relativePath;
      if (filePath.startsWith('/')) {
        // 絶対パスの場合、プロジェクトディレクトリを基準とする
        fullPath = `${this.projectDir}${filePath}`;
        relativePath = filePath;
      } else {
        // 相対パスの場合
        fullPath = `${this.projectDir}/${filePath}`;
        relativePath = `/${filePath}`;
      }
      
      // 実行時の作業ディレクトリを設定（ファイルがあるディレクトリ）
      const fileDir = relativePath.substring(0, relativePath.lastIndexOf('/')) || '/';
      const oldCwd = this.currentWorkingDirectory;
      this.currentWorkingDirectory = fileDir;
      
      console.log(`[executeFile] Reading file: ${filePath} -> ${fullPath}`);
      console.log(`[executeFile] Setting working directory to: ${fileDir}`);
      
      try {
        const code = await this.fs.promises.readFile(fullPath, { encoding: 'utf8' });
        
        this.onOutput?.(`Executing: ${filePath}`, 'log');
        const result = await this.executeNodeJS(code as string);
        
        return result;
      } finally {
        // 作業ディレクトリを元に戻す
        this.currentWorkingDirectory = oldCwd;
      }
    } catch (error) {
      const errorMessage = `Failed to execute file '${filePath}': ${(error as Error).message}`;
      console.error('[executeFile] Error:', error);
      this.onOutput?.(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  }

  // ファイルシステムのキャッシュをフラッシュしてGitに変更を認識させる
  private async flushFileSystemCache(): Promise<void> {
    try {
      // Lightning-FSのキャッシュをフラッシュ（バックエンドストレージと同期）
      if (this.fs && (this.fs as any).sync) {
        await (this.fs as any).sync();
      }
      
      // ファイルシステムの強制同期のため短縮した遅延
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn('[nodeRuntime] Failed to flush filesystem cache:', error);
    }
  }

  // モジュール解決機能
  private async resolveModule(moduleName: string): Promise<any> {
    // キャッシュから取得
    if (this.moduleCache.has(moduleName)) {
      console.log(`[resolveModule] Loading from cache: ${moduleName}`);
      return this.moduleCache.get(moduleName);
    }

    // 組み込みモジュールの場合
    if (this.isBuiltinModule(moduleName)) {
      const module = this.createBuiltinModule(moduleName);
      this.moduleCache.set(moduleName, module);
      return module;
    }

    // ローカルファイルモジュールの場合
    try {
      const moduleObj = await this.loadFileModule(moduleName);
      this.moduleCache.set(moduleName, moduleObj);
      return moduleObj;
    } catch (error) {
      console.log(`[resolveModule] Local module not found: ${moduleName}, attempting CDN...`);
      
      // NPMモジュールの場合はCDNから試す（相対パスでない場合）
      if (!moduleName.startsWith('./') && !moduleName.startsWith('../') && !moduleName.startsWith('/')) {
        try {
          const cdnCode = await this.loadFromCDN(moduleName);
          // CDNコードを実行してモジュールを取得
          const moduleObj = await this.evaluateModuleCode(cdnCode, moduleName);
          this.moduleCache.set(moduleName, moduleObj);
          return moduleObj;
        } catch (cdnError) {
          console.log(`[resolveModule] CDN loading failed for ${moduleName}:`, cdnError);
        }
      }
      
      throw new Error(`Cannot find module '${moduleName}'`);
    }
  }

  // CDNからモジュールを読み込む
  private async loadFromCDN(moduleName: string): Promise<string> {
    const cdnUrls = [
      `https://unpkg.com/${moduleName}`,
      `https://cdn.skypack.dev/${moduleName}`,
      `https://jspm.dev/${moduleName}`
    ];

    console.log(`[NodeRuntime] Attempting to load ${moduleName} from CDN...`);

    for (const url of cdnUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const content = await response.text();
          console.log(`[NodeRuntime] Successfully loaded ${moduleName} from ${url}`);
          
          // 仮想ファイルシステムにキャッシュ保存（次回は高速化）
          try {
            const modulePath = `/node_modules/${moduleName}/index.js`;
            await this.fs.promises.mkdir(`/node_modules/${moduleName}`, { recursive: true });
            await this.fs.promises.writeFile(modulePath, content, 'utf-8');
            console.log(`[NodeRuntime] Cached ${moduleName} to virtual filesystem`);
          } catch (cacheError) {
            console.warn(`[NodeRuntime] Failed to cache ${moduleName}:`, cacheError);
          }
          
          return content;
        }
      } catch (error) {
        console.log(`[NodeRuntime] Failed to load from ${url}:`, error);
      }
    }

    throw new Error(`Failed to load module ${moduleName} from CDN`);
  }

  // CDNコードを評価してモジュールオブジェクトを取得
  private async evaluateModuleCode(code: string, moduleName: string): Promise<any> {
    try {
      // モジュール用のサンドボックスを作成
      const moduleScope = {
        module: { exports: {} },
        exports: {},
        require: (name: string) => this.resolveModule(name),
        __filename: `/node_modules/${moduleName}/index.js`,
        __dirname: `/node_modules/${moduleName}`,
        console: console,
        process: {
          env: {},
          cwd: () => this.currentWorkingDirectory,
          platform: 'browser',
          version: 'v16.0.0',
          versions: { node: '16.0.0' }
        },
        Buffer: Buffer,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        global: {},
        window: undefined
      };

      // コードを実行
      const wrappedCode = `
        (function(module, exports, require, __filename, __dirname, console, process, Buffer, setTimeout, clearTimeout, setInterval, clearInterval, global) {
          ${code}
          return module.exports;
        })
      `;

      const moduleFunction = eval(wrappedCode);
      const result = await moduleFunction(
        moduleScope.module,
        moduleScope.exports,
        moduleScope.require,
        moduleScope.__filename,
        moduleScope.__dirname,
        moduleScope.console,
        moduleScope.process,
        moduleScope.Buffer,
        moduleScope.setTimeout,
        moduleScope.clearTimeout,
        moduleScope.setInterval,
        moduleScope.clearInterval,
        moduleScope.global
      );

      if (
        moduleScope.module.exports &&
        typeof moduleScope.module.exports === 'object' &&
        'default' in moduleScope.module.exports &&
        Object.keys(moduleScope.module.exports).length === 1
      ) {
        // ESM default only: promote default to exports
        moduleScope.module.exports = moduleScope.module.exports.default as any;
      }

      return result || moduleScope.module.exports || moduleScope.exports;
    } catch (error) {
      console.error(`[evaluateModuleCode] Error evaluating ${moduleName}:`, error);
      throw new Error(`Failed to evaluate module ${moduleName}: ${(error as Error).message}`);
    }
  }

  // 組み込みモジュールかチェック
  private isBuiltinModule(moduleName: string): boolean {
    const builtinModules = ['fs', 'path', 'os', 'util', 'crypto', 'http', 'url', 'querystring'];
    return builtinModules.includes(moduleName);
  }

  // 組み込みモジュールを作成
  private createBuiltinModule(moduleName: string): any {
    switch (moduleName) {
      case 'fs':
        return this.createFSModule();
      case 'path':
        return this.createPathModule();
      case 'os':
        return this.createOSModule();
      case 'util':
        return this.createUtilModule();
      default:
        throw new Error(`Built-in module '${moduleName}' not implemented`);
    }
  }

  // ファイルモジュールをロード
  private async loadFileModule(moduleName: string): Promise<any> {
    const possiblePaths = this.resolveModulePath(moduleName);
    
    console.log(`[loadFileModule] Loading module: ${moduleName}`);
    console.log(`[loadFileModule] Project directory: ${this.projectDir}`);
    
    for (const filePath of possiblePaths) {
      try {
        console.log(`[loadFileModule] Trying to load: ${filePath}`);
        
        let fullPath;
        if (filePath.startsWith('/')) {
          fullPath = `${this.projectDir}${filePath}`;
        } else {
          fullPath = `${this.projectDir}/${filePath}`;
        }

        console.log(`[loadFileModule] Full path: ${fullPath}`);

        // ファイルの存在確認
        await this.fs.promises.stat(fullPath);
        console.log(`[loadFileModule] File exists: ${fullPath}`);
        
        // ファイル内容を読み取り
        const content = await this.fs.promises.readFile(fullPath, { encoding: 'utf8' });
        console.log(`[loadFileModule] File content read successfully, length: ${(content as string).length}`);
        
        // package.jsonの場合はJSONとして解析
        if (filePath.endsWith('package.json')) {
          try {
            const packageData = JSON.parse(content as string);
            console.log(`[loadFileModule] Loaded package.json: ${moduleName}`);
            return packageData;
          } catch (error) {
            throw new Error(`Invalid JSON in package.json: ${(error as Error).message}`);
          }
        }
        
        // .jsonファイルの場合もJSONとして解析
        if (filePath.endsWith('.json')) {
          try {
            const jsonData = JSON.parse(content as string);
            console.log(`[loadFileModule] Loaded JSON file: ${moduleName}`);
            return jsonData;
          } catch (error) {
            throw new Error(`Invalid JSON in ${filePath}: ${(error as Error).message}`);
          }
        }
        
        // モジュールを実行して exports を取得
        const moduleExports = await this.executeModuleCode(content as string, filePath);
        
        console.log(`[loadFileModule] Successfully loaded module: ${moduleName} from ${filePath}`);
        return moduleExports;
        
      } catch (error) {
        console.log(`[loadFileModule] Failed to load ${filePath}: ${(error as Error).message}`);
        continue;
      }
    }
    
    // すべての候補パスを試行しても見つからない場合、利用可能なファイルを表示
    try {
      console.log(`[loadFileModule] Module not found. Listing available files in project directory:`);
      const files = await this.fs.promises.readdir(this.projectDir);
      console.log(`[loadFileModule] Available files:`, files);
      
      // サブディレクトリもチェック
      for (const file of files) {
        try {
          const filePath = `${this.projectDir}/${file}`;
          const stat = await this.fs.promises.stat(filePath);
          if (stat.isDirectory()) {
            const subFiles = await this.fs.promises.readdir(filePath);
            console.log(`[loadFileModule] Files in ${file}/:`, subFiles);
          }
        } catch {
          // ディレクトリ読み取りエラーは無視
        }
      }
    } catch (error) {
      console.log(`[loadFileModule] Could not list directory contents:`, error);
    }
    
    throw new Error(`Module file not found for '${moduleName}'. Tried paths: ${possiblePaths.join(', ')}`);
  }

  // モジュールパスを解決
  private resolveModulePath(moduleName: string): string[] {
    const paths: string[] = [];
    
    console.log(`[resolveModulePath] Resolving module: ${moduleName}`);
    console.log(`[resolveModulePath] Current working directory: ${this.currentWorkingDirectory}`);
    
    // 相対パス / 絶対パスの場合
    if (moduleName.startsWith('./') || moduleName.startsWith('../') || moduleName.startsWith('/')) {
      let basePath: string;
      
      if (moduleName.startsWith('/')) {
        basePath = moduleName;
      } else {
        // 相対パスの解決
        if (this.currentWorkingDirectory === '/') {
          basePath = moduleName.substring(2); // './file' → 'file'
        } else {
          basePath = this.currentWorkingDirectory + '/' + moduleName.substring(2);
        }
      }
      
      console.log(`[resolveModulePath] Resolved base path: ${basePath}`);
      
      // パスの正規化
      basePath = basePath.replace(/\/+/g, '/').replace(/\/$/, '');
      
      // 拡張子の候補
      paths.push(basePath);
      if (!basePath.includes('.') || basePath.endsWith('.js') === false) {
        if (!basePath.endsWith('.js')) {
          paths.push(basePath + '.js');
        }
        if (!basePath.endsWith('.json')) {
          paths.push(basePath + '.json');
        }
        // ディレクトリの場合のindex.js
        paths.push(basePath + '/index.js');
        paths.push(basePath + '/package.json');
      }
    } else {
      // node_modules風の解決（npm packages）
      paths.push(`/node_modules/${moduleName}`);
      paths.push(`/node_modules/${moduleName}.js`);
      paths.push(`/node_modules/${moduleName}/index.js`);
      paths.push(`/node_modules/${moduleName}/package.json`);
      
      // scoped packages対応 (@org/package)
      if (moduleName.includes('/')) {
        const parts = moduleName.split('/');
        if (parts.length === 2 && parts[0].startsWith('@')) {
          paths.push(`/node_modules/${moduleName}/index.js`);
          paths.push(`/node_modules/${moduleName}/package.json`);
        }
      }
      
      // プロジェクト内のファイルとしても検索
      paths.push(`/${moduleName}`);
      paths.push(`/${moduleName}.js`);
      paths.push(`/${moduleName}.json`);
    }
    
    console.log(`[resolveModulePath] Candidate paths:`, paths);
    return paths;
  }

  // モジュールコードを実行してexportsを取得（同期版）
  private executeModuleCodeSync(code: string, filePath: string): any {
    const moduleExports = {};
    const moduleObject = { exports: moduleExports };
    
    // モジュール用のグローバル環境を作成
    const moduleGlobals = {
      ...this.createNodeGlobals(),
      module: moduleObject,
      exports: moduleExports,
      __filename: filePath,
      __dirname: filePath.substring(0, filePath.lastIndexOf('/')) || '/',
      require: (reqModule: string) => {
        // 組み込みモジュールのみサポート
        if (this.isBuiltinModule(reqModule)) {
          const oldCwd = this.currentWorkingDirectory;
          this.currentWorkingDirectory = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
          try {
            if (this.moduleCache.has(reqModule)) {
              return this.moduleCache.get(reqModule);
            }
            const module = this.createBuiltinModule(reqModule);
            this.moduleCache.set(reqModule, module);
            return module;
          } finally {
            this.currentWorkingDirectory = oldCwd;
          }
        }
        
        throw new Error(`Module '${reqModule}' requires async loading in module context.`);
      }
    };

    try {
      // ES6 import/export を CommonJS require/module.exports に変換
      const transformedCode = this.transformESModules(code);
      
      console.log(`[executeModuleCodeSync] Executing module code for: ${filePath}`);
      console.log(`[executeModuleCodeSync] Transformed code:`, transformedCode);
      
      // Function コンストラクタを使用して同期実行
      const moduleFunction = new Function(
        'module', 'exports', 'require', '__filename', '__dirname', 'console', 'process', 'Buffer', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        transformedCode
      );
      
      moduleFunction.call(
        {},
        moduleObject,
        moduleObject.exports, // exportsパラメータはmodule.exportsの参照
        moduleGlobals.require,
        moduleGlobals.__filename,
        moduleGlobals.__dirname,
        moduleGlobals.console,
        moduleGlobals.process,
        moduleGlobals.Buffer,
        moduleGlobals.setTimeout,
        moduleGlobals.setInterval,
        moduleGlobals.clearTimeout,
        moduleGlobals.clearInterval
      );
      
      console.log(`[executeModuleCodeSync] Module execution completed. module.exports:`, moduleObject.exports);
      console.log(`[executeModuleCodeSync] Module exports keys:`, Object.keys(moduleObject.exports));
      
      // module.exportsを返す（CommonJSの標準的な動作）
      return moduleObject.exports;
        
    } catch (error) {
      console.error(`[executeModuleCodeSync] Error executing module ${filePath}:`, error);
      throw new Error(`Failed to execute module '${filePath}': ${(error as Error).message}`);
    }
  }

  // モジュールコードを実行してexportsを取得
  private async executeModuleCode(code: string, filePath: string): Promise<any> {
    const moduleExports = {};
    const moduleObject = { exports: moduleExports };
    
    // モジュール用のグローバル環境を作成
    const moduleGlobals = {
      ...this.createNodeGlobals(),
      module: moduleObject,
      exports: moduleExports,
      __filename: filePath,
      __dirname: filePath.substring(0, filePath.lastIndexOf('/')) || '/',
      require: async (reqModule: string) => {
        // 相対パスの解決を現在のモジュールのディレクトリから行う
        const oldCwd = this.currentWorkingDirectory;
        this.currentWorkingDirectory = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        try {
          return await this.resolveModule(reqModule);
        } finally {
          this.currentWorkingDirectory = oldCwd;
        }
      }
    };

    try {
      // ES6 import/export を CommonJS require/module.exports に変換
      const transformedCode = this.transformESModules(code);
      
      // モジュールコードをラップして実行
      const wrappedCode = this.wrapModuleCode(transformedCode, moduleGlobals);
      
      console.log(`[executeModuleCode] Executing module code for: ${filePath}`);
      console.log(`[executeModuleCode] Transformed code:`, transformedCode);
      await this.executeInSandbox(wrappedCode, moduleGlobals);
      
      console.log(`[executeModuleCode] Module execution completed. module.exports:`, moduleObject.exports);
      console.log(`[executeModuleCode] Module exports keys:`, Object.keys(moduleObject.exports));
      
      // module.exportsを返す（CommonJSの標準的な動作）
      return moduleObject.exports;
        
    } catch (error) {
      console.error(`[executeModuleCode] Error executing module ${filePath}:`, error);
      throw new Error(`Failed to execute module '${filePath}': ${(error as Error).message}`);
    }
  }

  // ES6 import/export を CommonJS に変換
  private transformESModules(code: string): string {
    let transformedCode = code;
    
    // import文を require に変換
    // import Utils, { helper } from 'module' → const _temp = require('module'); const Utils = _temp.default || _temp; const { helper } = _temp;
    transformedCode = transformedCode.replace(
      /import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g,
      (match, defaultImport, namedImports, modulePath) => {
        const tempVar = `_temp_${Math.random().toString(36).substr(2, 9)}`;
        return `const ${tempVar} = require('${modulePath}'); const ${defaultImport} = ${tempVar}.default || ${tempVar}; const { ${namedImports} } = ${tempVar};`;
      }
    );
    
    // import { something } from 'module' → const { something } = require('module')
    transformedCode = transformedCode.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g,
      'const { $1 } = require(\'$2\');'
    );
    
    // import something from 'module' → const something = require('module').default || require('module')
    transformedCode = transformedCode.replace(
      /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
      (match, varName, modulePath) => {
        const tempVar = `_temp_${Math.random().toString(36).substr(2, 9)}`;
        return `const ${tempVar} = require('${modulePath}'); const ${varName} = ${tempVar}.default || ${tempVar};`;
      }
    );
    
    // import * as something from 'module' → const something = require('module')
    transformedCode = transformedCode.replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
      'const $1 = require(\'$2\');'
    );
    
    // import 'module' → require('module')
    transformedCode = transformedCode.replace(
      /import\s+['"]([^'"]+)['"];?/g,
      'require(\'$1\');'
    );
    
    // export default something → module.exports = something; module.exports.default = something;
    transformedCode = transformedCode.replace(
      /export\s+default\s+(.+);?$/gm,
      'module.exports = $1; module.exports.default = $1;'
    );
    
    // export { something } → module.exports.something = something
    transformedCode = transformedCode.replace(
      /export\s+\{([^}]+)\};?/g,
      (match, exports) => {
        const exportList = exports.split(',').map((exp: string) => exp.trim());
        return exportList.map((exp: string) => `module.exports.${exp} = ${exp};`).join('\n');
      }
    );
    
    // export const/let/var something → const something = ...; module.exports.something = something
    transformedCode = transformedCode.replace(
      /export\s+(const|let|var)\s+(\w+)\s*=\s*([^;]+);?/g,
      '$1 $2 = $3;\nmodule.exports.$2 = $2;'
    );
    
    // export function name() {...} → function name() {...}; module.exports.name = name;
    transformedCode = transformedCode.replace(
      /export\s+function\s+(\w+)/g,
      'function $1'
    );
    
    // export class Name {...} → class Name {...}; module.exports.Name = Name; module.exports.default = Name;
    transformedCode = transformedCode.replace(
      /export\s+default\s+class\s+(\w+)/g,
      'class $1'
    );
    
    transformedCode = transformedCode.replace(
      /export\s+class\s+(\w+)/g,
      'class $1'
    );
    
    // 後処理：exportされた関数やクラスをmodule.exportsに追加
    // export function の後処理
    const exportFunctionMatches = code.match(/export\s+function\s+(\w+)/g);
    if (exportFunctionMatches) {
      exportFunctionMatches.forEach(match => {
        const funcName = match.replace(/export\s+function\s+/, '');
        if (!transformedCode.includes(`module.exports.${funcName} = ${funcName}`)) {
          transformedCode += `\nmodule.exports.${funcName} = ${funcName};`;
        }
      });
    }
    
    // export class の後処理
    const exportClassMatches = code.match(/export\s+class\s+(\w+)/g);
    if (exportClassMatches) {
      exportClassMatches.forEach(match => {
        const className = match.replace(/export\s+class\s+/, '');
        if (!transformedCode.includes(`module.exports.${className} = ${className}`)) {
          transformedCode += `\nmodule.exports.${className} = ${className};`;
        }
      });
    }
    
    // export default class の後処理
    const exportDefaultClassMatches = code.match(/export\s+default\s+class\s+(\w+)/g);
    if (exportDefaultClassMatches) {
      exportDefaultClassMatches.forEach(match => {
        const className = match.replace(/export\s+default\s+class\s+/, '');
        if (!transformedCode.includes(`module.exports = ${className}`)) {
          transformedCode += `\nmodule.exports = ${className};\nmodule.exports.default = ${className};`;
        }
      });
    }
    
    console.log('[transformESModules] Original code:', code);
    console.log('[transformESModules] Transformed code:', transformedCode);
    
    return transformedCode;
  }

  // モジュールコードをラップ
  private wrapModuleCode(code: string, globals: any): string {
    return `
      (async function(globals) {
        const { console, process, require, module, exports, __filename, __dirname, Buffer, setTimeout, setInterval, clearTimeout, clearInterval } = globals;
        
        ${code}
        
        return module.exports;
      })
    `;
  }
}
