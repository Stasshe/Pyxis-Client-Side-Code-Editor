import FS from '@isomorphic-git/lightning-fs';
import git from 'isomorphic-git';
import { GitFileSystemHelper } from './fileSystemHelper';

/**
 * Git merge操作を管理するクラス
 */
export class GitMergeOperations {
  private fs: FS;
  private dir: string;
  private onFileOperation?: (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean) => Promise<void>;

  constructor(
    fs: FS, 
    dir: string, 
    onFileOperation?: (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean) => Promise<void>
  ) {
    this.fs = fs;
    this.dir = dir;
    this.onFileOperation = onFileOperation;
  }

  // プロジェクトディレクトリの存在を確認し、なければ作成
  private async ensureProjectDirectory(): Promise<void> {
    await GitFileSystemHelper.ensureDirectory(this.fs, this.dir);
  }

  // Gitリポジトリが初期化されているかチェック
  private async ensureGitRepository(): Promise<void> {
    await this.ensureProjectDirectory();
    try {
      await this.fs.promises.stat(`${this.dir}/.git`);
    } catch {
      throw new Error('not a git repository (or any of the parent directories): .git');
    }
  }

  // 現在のブランチ名を取得
  private async getCurrentBranch(): Promise<string> {
    try {
      await this.ensureGitRepository();
      const branch = await git.currentBranch({ fs: this.fs, dir: this.dir });
      return branch || 'main';
    } catch {
      return '(no git)';
    }
  }

  // ブランチが存在するかチェック
  private async branchExists(branchName: string): Promise<boolean> {
    try {
      await git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${branchName}` });
      return true;
    } catch {
      return false;
    }
  }

  // ワーキングディレクトリがクリーンかチェック
  private async isWorkingDirectoryClean(): Promise<boolean> {
    try {
      const status = await git.statusMatrix({ fs: this.fs, dir: this.dir });
      
      // 変更されたファイルまたはステージされたファイルがあるかチェック
      for (const [filepath, HEAD, workdir, stage] of status) {
        // 変更がある場合
        if (HEAD !== workdir || stage !== HEAD) {
          return false;
        }
      }
      
      return true;
    } catch {
      return true; // エラーの場合はクリーンとみなす
    }
  }

  // すべてのファイルを取得（再帰的）
  private async getAllFiles(dirPath: string): Promise<string[]> {
    return await GitFileSystemHelper.getAllFiles(this.fs, dirPath);
  }

  // ファイルの内容を読み取り
  private async readFileContent(filepath: string): Promise<string> {
    try {
      const content = await this.fs.promises.readFile(`${this.dir}/${filepath}`, { encoding: 'utf8' });
      return content as string;
    } catch {
      return '';
    }
  }

  // マージ結果をワーキングディレクトリに反映
  private async updateWorkingDirectory(result: any): Promise<void> {
    if (!result || !result.tree) {
      return;
    }

    // 現在のファイル一覧を取得
    const currentFiles = await this.getAllFiles(this.dir);
    const currentFileSet = new Set(currentFiles);

    // マージ結果のツリーからファイル一覧を取得
    const tree = await git.readTree({ fs: this.fs, dir: this.dir, oid: result.tree });
    const newFiles = new Set<string>();

    // 新しいファイルを書き込み
    for (const entry of tree.tree) {
      if (entry.type === 'blob') {
        newFiles.add(entry.path);
        
        try {
          const { blob } = await git.readBlob({ fs: this.fs, dir: this.dir, oid: entry.oid });
          const content = new TextDecoder().decode(blob);
          
          await this.fs.promises.writeFile(`${this.dir}/${entry.path}`, content, 'utf8');
          
          // onFileOperation コールバックを呼び出し
          if (this.onFileOperation) {
            await this.onFileOperation(`/${entry.path}`, 'file', content);
          }
        } catch (error) {
          console.warn(`Failed to write file ${entry.path}:`, error);
        }
      }
    }

    // 削除されたファイルを処理
    for (const filepath of currentFileSet) {
      if (!newFiles.has(filepath)) {
        try {
          await this.fs.promises.unlink(`${this.dir}/${filepath}`);
          
          // onFileOperation コールバックを呼び出し
          if (this.onFileOperation) {
            await this.onFileOperation(`/${filepath}`, 'delete');
          }
        } catch (error) {
          console.warn(`Failed to delete file ${filepath}:`, error);
        }
      }
    }
  }

  // Fast-forward マージかチェック
  private async canFastForward(sourceBranch: string, targetBranch: string): Promise<{ canFF: boolean; sourceCommit: string; targetCommit: string }> {
    try {
      const sourceCommit = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${sourceBranch}` });
      const targetCommit = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${targetBranch}` });

      // ターゲットブランチが現在のブランチの祖先かチェック
      const isAncestor = await git.isDescendent({ 
        fs: this.fs, 
        dir: this.dir, 
        oid: targetCommit, 
        ancestor: sourceCommit 
      });

      return {
        canFF: isAncestor,
        sourceCommit,
        targetCommit
      };
    } catch (error) {
      throw new Error(`Failed to check fast-forward possibility: ${(error as Error).message}`);
    }
  }

  // git merge - ブランチをマージ
  async merge(branchName: string, options: { noFf?: boolean; message?: string } = {}): Promise<string> {
    try {
      await this.ensureGitRepository();

      // ワーキングディレクトリがクリーンかチェック
      const isClean = await this.isWorkingDirectoryClean();
      if (!isClean) {
        return 'error: Your local changes to the following files would be overwritten by merge:\nPlease commit your changes or stash them before you merge.';
      }

      // 現在のブランチを取得
      const currentBranch = await this.getCurrentBranch();
      
      // 自分自身をマージしようとした場合
      if (currentBranch === branchName) {
        return `Already up to date.`;
      }

      // マージ対象のブランチが存在するかチェック
      if (!(await this.branchExists(branchName))) {
        const branches = await git.listBranches({ fs: this.fs, dir: this.dir });
        return `merge: ${branchName} - not something we can merge\nAvailable branches: ${branches.join(', ')}`;
      }

      // Fast-forward チェック
      const { canFF, sourceCommit, targetCommit } = await this.canFastForward(currentBranch, branchName);

      // Fast-forward マージの場合
      if (canFF && !options.noFf) {
        console.log('Performing fast-forward merge');
        
        // Fast-forward マージを実行（HEADを対象ブランチに移動）
        await git.writeRef({ 
          fs: this.fs, 
          dir: this.dir, 
          ref: `refs/heads/${currentBranch}`, 
          value: targetCommit 
        });
        
        // ワーキングディレクトリを更新
        await git.checkout({ fs: this.fs, dir: this.dir, ref: currentBranch });
        
        // ファイルシステムの変更を通知
        if (this.onFileOperation) {
          await this.onFileOperation('.', 'folder');
        }
        
        const shortTarget = targetCommit.slice(0, 7);
        return `Updating ${sourceCommit.slice(0, 7)}..${shortTarget}\nFast-forward`;
      }

      // 3-way マージを実行
      console.log('Performing 3-way merge');
      
      const commitMessage = options.message || `Merge branch '${branchName}' into ${currentBranch}`;
      
      try {
        // isomorphic-git の merge 関数を使用
        const result = await git.merge({
          fs: this.fs,
          dir: this.dir,
          ours: currentBranch,
          theirs: branchName,
          author: {
            name: 'User',
            email: 'user@pyxis.dev'
          },
          committer: {
            name: 'User', 
            email: 'user@pyxis.dev'
          },
          message: commitMessage
        });

        console.log('Merge result:', result);

        // マージが成功した場合
        if (result && !result.alreadyMerged) {
          // ワーキングディレクトリを更新
          await this.updateWorkingDirectory(result);
          
          // ファイルシステムの変更を通知
          if (this.onFileOperation) {
            await this.onFileOperation('.', 'folder');
          }

          const mergeCommit = result.oid ? result.oid.slice(0, 7) : 'unknown';
          return `Merge made by the 'ort' strategy.\nMerge commit: ${mergeCommit}`;
        } else if (result && result.alreadyMerged) {
          return `Already up to date.`;
        } else {
          return `Merge completed successfully.`;
        }

      } catch (mergeError) {
        const error = mergeError as any;
        
        // マージコンフリクトの場合
        if (error.code === 'MergeNotSupportedError' || error.message?.includes('conflict')) {
          return `CONFLICT: Automatic merge failed. Please resolve conflicts manually.\nMerge conflicts detected in the following files. This CLI doesn't support conflict resolution yet.`;
        }
        
        // その他のマージエラー
        throw new Error(`Merge failed: ${error.message}`);
      }

    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // 特定のエラーは再スロー
      if (errorMessage.includes('not a git repository')) {
        throw error;
      }
      
      // その他のエラーは詳細なメッセージで包む
      throw new Error(`git merge failed: ${errorMessage}`);
    }
  }

  // git merge --abort - マージを中止（簡易実装）
  async mergeAbort(): Promise<string> {
    try {
      await this.ensureGitRepository();

      // マージ状態をチェック（MERGE_HEADファイルの存在確認）
      try {
        await this.fs.promises.stat(`${this.dir}/.git/MERGE_HEAD`);
      } catch {
        return 'fatal: There is no merge to abort (MERGE_HEAD missing).';
      }

      // MERGE_HEAD ファイルを削除してマージ状態をクリア
      try {
        await this.fs.promises.unlink(`${this.dir}/.git/MERGE_HEAD`);
        
        // MERGE_MSG ファイルも削除（存在する場合）
        try {
          await this.fs.promises.unlink(`${this.dir}/.git/MERGE_MSG`);
        } catch {
          // MERGE_MSG がない場合は無視
        }

        // 現在のブランチにハードリセット
        const currentBranch = await this.getCurrentBranch();
        await git.checkout({ fs: this.fs, dir: this.dir, ref: currentBranch, force: true });

        // ファイルシステムの変更を通知
        if (this.onFileOperation) {
          await this.onFileOperation('.', 'folder');
        }

        return `Merge aborted. Working tree has been reset.`;
      } catch (error) {
        throw new Error(`Failed to abort merge: ${(error as Error).message}`);
      }

    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('not a git repository')) {
        throw error;
      }
      
      throw new Error(`git merge --abort failed: ${errorMessage}`);
    }
  }
}
