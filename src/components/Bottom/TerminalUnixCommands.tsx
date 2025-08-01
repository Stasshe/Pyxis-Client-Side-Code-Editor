// TerminalUnixCommands.tsx
// Terminalのunixコマンド処理部分を分割

import type { UnixCommands } from "@/utils/filesystem";

export async function handleUnixCommand(
  cmd: string,
  args: string[],
  unixCommandsRef: React.RefObject<UnixCommands | null>,
  currentProject: string,
  writeOutput: (output: string) => Promise<void>,
) {
  // Handle additional Unix commands
  switch (cmd) {
    case "pwd":
      if (unixCommandsRef.current) {
        const result = unixCommandsRef.current.pwd();
        await writeOutput(result);
      }
      break;

    case "ls":
      if (unixCommandsRef.current) {
        const result = await unixCommandsRef.current.ls(args[0]);
        await writeOutput(result);
      }
      break;

    case "cd":
      if (unixCommandsRef.current && args[0]) {
        const result = await unixCommandsRef.current.cd(args[0]);
        await writeOutput(result);
      } else if (unixCommandsRef.current && !args[0]) {
        // cdのみの場合はプロジェクトルートに移動
        const projectRoot = `/projects/${currentProject}`;
        unixCommandsRef.current.setCurrentDir(projectRoot);
        await writeOutput(`Changed directory to ${projectRoot}`);
      } else {
        await writeOutput("cd: missing argument");
      }
      break;

    case "mkdir":
      if (unixCommandsRef.current && args[0]) {
        const recursive = args.includes("-p");
        const dirName = args.find((arg) => !arg.startsWith("-")) || args[0];
        const result = await unixCommandsRef.current.mkdir(dirName, recursive);
        await writeOutput(result);
      } else {
        await writeOutput("mkdir: missing argument");
      }
      break;

    case "touch":
      if (unixCommandsRef.current && args[0]) {
        const result = await unixCommandsRef.current.touch(args[0]);
        await writeOutput(result);
      } else {
        await writeOutput("touch: missing argument");
      }
      break;

    case "rm":
      if (unixCommandsRef.current && args[0]) {
        const recursive = args.includes("-r") || args.includes("-rf");
        const fileName =
          args.find((arg) => !arg.startsWith("-")) || args[args.length - 1];
        const result = await unixCommandsRef.current.rm(fileName, recursive);
        await writeOutput(result);
      } else {
        await writeOutput("rm: missing argument");
      }
      break;

    case "cat":
      if (unixCommandsRef.current && args[0]) {
        const result = await unixCommandsRef.current.cat(args[0]);
        await writeOutput(result);
      } else {
        await writeOutput("cat: missing argument");
      }
      break;

    case "echo":
      if (unixCommandsRef.current) {
        const redirectIndex = args.indexOf(">");
        if (redirectIndex !== -1 && args[redirectIndex + 1]) {
          const text = args.slice(0, redirectIndex).join(" ");
          const fileName = args[redirectIndex + 1];
          const result = await unixCommandsRef.current.echo(text, fileName);
          await writeOutput(result);
        } else {
          const text = args.join(" ");
          const result = await unixCommandsRef.current.echo(text);
          await writeOutput(result);
        }
      }
      break;
    case "help":
      await writeOutput('\r\n=== 利用可能なコマンド ===');
      await writeOutput('Basic Commands:');
      await writeOutput('  clear     - 画面をクリア');
      await writeOutput('  help      - このヘルプを表示');
      await writeOutput('  date      - 現在の日時を表示');
      await writeOutput('  whoami    - ユーザー名を表示');
      await writeOutput('');
      await writeOutput('Navigation:');
      await writeOutput('  ↑/↓ 矢印キー - コマンド履歴を操作');
      await writeOutput('  Ctrl+C    - 現在のコマンドをキャンセル');
      await writeOutput('');
      await writeOutput('File System Commands:');
      await writeOutput('  pwd       - 現在のディレクトリを表示');
      await writeOutput('  ls [path] - ワークスペースファイルをツリー形式で表示');
      await writeOutput('  cd <path> - ディレクトリを変更 (プロジェクト内のみ)');
      await writeOutput('  cd        - プロジェクトルートに戻る');
      await writeOutput('  mkdir <name> [-p] - ディレクトリを作成');
      await writeOutput('  touch <file> - ファイルを作成');
      await writeOutput('  rm <file> [-r] - ファイルを削除 (ワイルドカード対応: rm *.txt)');
      await writeOutput('  cat <file> - ファイル内容を表示');
      await writeOutput('  echo <text> [> file] - テキストを出力/ファイルに書き込み');
      await writeOutput('');
      await writeOutput('Git Commands:');
      await writeOutput('  git status  - ステータスを確認');
      await writeOutput('  git add <file|.|*> - ファイルをステージング');
      await writeOutput('    git add .     - 全ファイルを追加');
      await writeOutput('    git add *     - カレントディレクトリのファイルを追加');
      await writeOutput('  git commit -m "message" - コミット');
      await writeOutput('  git log     - コミット履歴を表示');
      await writeOutput('  git branch [name] [-d] - ブランチ操作');
      await writeOutput('    git branch        - ブランチ一覧');
      await writeOutput('    git branch <name> - ブランチ作成');
      await writeOutput('    git branch -d <name> - ブランチ削除');
      await writeOutput('  git checkout <branch> [-b] - ブランチ切り替え');
      await writeOutput('    git checkout <name>   - ブランチ切り替え');
      await writeOutput('    git checkout -b <name> - ブランチ作成&切り替え');
      await writeOutput('  git merge <branch> - ブランチをマージ');
      await writeOutput('    git merge <name>      - 指定ブランチをマージ');
      await writeOutput('    git merge --no-ff <name> - Fast-forwardを無効にしてマージ');
      await writeOutput('    git merge --abort     - マージを中止');
      await writeOutput('  git revert <commit> - コミットを取り消し');
      await writeOutput('  git reset [file] - ファイルのアンステージング');
      await writeOutput('  git reset --hard <commit> - 指定コミットまでハードリセット');
      await writeOutput('    git reset         - 全ファイルをアンステージング');
      await writeOutput('    git reset <file>  - 特定ファイルをアンステージング');
      await writeOutput('    git reset --hard <hash> - 危険！すべて破棄してコミットに戻る');
      await writeOutput('  git diff [options] [file] - 変更差分を表示');
      await writeOutput('    git diff          - ワーキングディレクトリの変更');
      await writeOutput('    git diff --staged - ステージされた変更');
      await writeOutput('    git diff <commit1> <commit2> - コミット間の差分');
      await writeOutput('');
      await writeOutput('NPM Commands:開発中、利用できません');
      await writeOutput('  npm init [--force] - package.jsonを作成');
      await writeOutput('  npm install [package] [flags] - パッケージのインストール');
      await writeOutput('    npm install        - 全依存関係をインストール');
      await writeOutput('    npm install <pkg>  - パッケージをインストール');
      await writeOutput('    npm install <pkg> --save-dev - 開発依存関係としてインストール');
      await writeOutput('  npm uninstall <package> - パッケージをアンインストール');
      await writeOutput('  npm list           - インストール済みパッケージ一覧');
      await writeOutput('  npm run <script>   - package.jsonのスクリプトを実行');
      await writeOutput('');
      await writeOutput('Note: Gitリポジトリの初期化は左下の「プロジェクト管理」から');
      await writeOutput('新規プロジェクトを作成することで自動的に行われます。');
      break;
    default:
      await writeOutput('不明なコマンドです。');
  }
}
