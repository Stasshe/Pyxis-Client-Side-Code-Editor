'use client';

import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  addEditorPane,
  removeEditorPane,
  toggleEditorLayout,
  setTabsForPane,
  setActiveTabIdForPane
} from '@/hooks/pane';
import { useProjectTabResetEffect, useProjectFilesSyncEffect, useActiveTabContentRestore } from '@/hooks/tab';
import MenuBar from '@/components/MenuBar';
import LeftSidebar from '@/components/Left/LeftSidebar';
import TabBar from '@/components/Tab/TabBar';
import CodeEditor from '@/components/Tab/CodeEditor';
import DiffTab from '@/components/Tab/DiffTab';
import WebPreviewTab from '@/components/Tab/WebPreviewTab';
import AIReviewTab from '@/components/AI/AIReview/AIReviewTab';
import { useDiffTabHandlers } from '@/hooks/useDiffTabHandlers';
import BottomPanel from '@/components/Bottom/BottomPanel';
import ProjectModal from '@/components/ProjectModal';
import { useLeftSidebarResize, useBottomPanelResize, useRightSidebarResize } from '@/utils/helper/resize';
import { openFile } from '@/utils/openTab';
import { useGitMonitor } from '@/hooks/gitHooks';
import { useProject } from '@/utils/core/project';
import { Project } from '@/types';
import type { Tab,FileItem, MenuTab, EditorLayoutType, EditorPane } from '@/types';
import RightSidebar from '@/components/Right/RightSidebar';
import FileSelectModal from '@/components/FileSelect';
import { handleFileSelect, handleFilePreview } from '@/hooks/fileSelectHandlers';
import { Terminal, Search } from 'lucide-react';
import PanelRightIcon from '@/components/Right/PanelRightIcon';
import OperationWindow from '@/components/OperationWindow';


export default function Home() {
  const [activeMenuTab, setActiveMenuTab] = useState<MenuTab>('files');
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  // 右サイドバー関連
  const [rightSidebarWidth, setRightSidebarWidth] = useState(240);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const handleRightResize = useRightSidebarResize(rightSidebarWidth, setRightSidebarWidth);
  // 右サイドバーの表示切替（例: メニューやボタンでトグルする場合）
  const toggleRightSidebar = () => setIsRightSidebarVisible(v => !v);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isOperationWindowVisible, setIsOperationWindowVisible] = useState(false);
  const [gitRefreshTrigger, setGitRefreshTrigger] = useState(0);
  const [gitChangesCount, setGitChangesCount] = useState(0); // Git変更ファイル数
  const [nodeRuntimeOperationInProgress, setNodeRuntimeOperationInProgress] = useState(false); // NodeRuntime操作中フラグ
  const [externalOperationInProgress, setExternalOperationInProgress] = useState(false); // 全外部操作中フラグ（terminal, git, aiagent含む）
  const [fileSelectState, setFileSelectState] = useState<{ open: boolean, paneIdx: number|null }>({ open: false, paneIdx: null });
  const [editorLayout, setEditorLayout] = useState<EditorLayoutType>('vertical');
  const [editors, setEditors] = useState<EditorPane[]>([{ id: 'editor-1', tabs: [], activeTabId: '' }]);
  const [isRestoredFromLocalStorage, setIsRestoredFromLocalStorage] = useState(false); // localStorage復元完了フラグ
  
  // 初回レンダリング後にlocalStorageから復元（SSR/CSR不一致防止）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('pyxis-editors');
        if (saved) {
          const parsed = JSON.parse(saved);
          // データが正しい形式かチェック
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
              // タブを初期化: contentとbufferContentは空にして、後でDBから復元
              const initEditors = parsed.map((editor: any, idx: number) => {
                let newId = editor.id;
                // ...既存のID重複防止処理...
                // タブID・path生成ルールを統一
                const tabs = editor.tabs.map((tab: any) => {
                  let tabId;
                  let tabPath = tab.path;
                  if (tab.id === 'welcome') {
                    tabId = 'welcome';
                    tabPath = '/';
                  } else if (tab.preview) {
                    tabId = `${newId}:${tab.path}-preview`;
                  } else if (tab.diffProps) {
                    tabId = `${newId}:${tab.path}-diff`;
                  } else if (tab.aiReviewProps) {
                    tabId = `${newId}:${tab.path}-ai`;
                  } else {
                    tabId = `${newId}:${tab.path}`;
                  }
                  if (tabPath && !tabPath.startsWith('/')) tabPath = '/' + tabPath;
                  return {
                    ...tab,
                    id: tabId,
                    path: tabPath,
                    content: '',
                    bufferContent: undefined,
                    needsContentRestore: tabId !== 'welcome' && !tab.diffProps && !tab.webPreview && tabPath && tabPath !== '/',
                  };
                });
                // activeTabIdをtabs配列のIDと完全一致させる
                let restoredActiveTabId = '';
                if (editor.activeTabId) {
                  // 旧IDが一致するタブがあればそれを使う
                  const found = tabs.find((t: any) => t.id === editor.activeTabId);
                  if (found) restoredActiveTabId = found.id;
                  else {
                    // pathベースで一致するタブがあればそれを使う
                    const foundByPath = tabs.find((t: any) => t.path === editor.activeTabId || t.path === editor.activeTabId.replace(/^.*?:/, ''));
                    if (foundByPath) restoredActiveTabId = foundByPath.id;
                  }
                }
                // どれもなければ先頭タブ
                if (!restoredActiveTabId && tabs.length > 0) restoredActiveTabId = tabs[0].id;
                return {
                  ...editor,
                  id: newId,
                  tabs,
                  activeTabId: restoredActiveTabId
                };
              });
              console.log('[DEBUG] Restored editors from localStorage:', initEditors.map(e => ({
                id: e.id,
                tabs: e.tabs.map((t: any) => ({ id: t.id, path: t.path, needsContentRestore: t.needsContentRestore }))
              })));
              setEditors(initEditors);
              // activeTabIdを復元
              if (initEditors[0].tabs.length > 0) {
                setActiveTabId(initEditors[0].tabs[0].id);
              }
          }
        }
      } catch (e) {
        console.error('[DEBUG] Error restoring editors from localStorage:', e);
      }
      try {
        const savedLayout = window.localStorage.getItem('pyxis-editorLayout');
        if (savedLayout === 'vertical' || savedLayout === 'horizontal') {
          setEditorLayout(savedLayout as EditorLayoutType);
        }
      } catch (e) {
        console.error('[DEBUG] Error restoring editor layout from localStorage:', e);
      }
      setIsRestoredFromLocalStorage(true); // 復元完了フラグを設定
    }
  }, []);
  // editors/editorLayout変更時にlocalStorageへ保存（contentとbufferContentを除外）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // contentとbufferContentの両方を除外してlocalStorageに保存
        const editorsWithoutContent = editors.map(editor => ({
          ...editor,
          tabs: editor.tabs.map(({ content, bufferContent, ...tabRest }) => ({ 
            ...tabRest,
            // content除外、pathとisBufferArrayは保持してDBから復元できるようにする
          }))
        }));
        window.localStorage.setItem('pyxis-editors', JSON.stringify(editorsWithoutContent));
      } catch (e) {}
    }
  }, [editors]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('pyxis-editorLayout', editorLayout);
      } catch (e) {}
    }
  }, [editorLayout]);
  
  
  const { colors } = useTheme();
  
  // ペイン追加/削除/分割方向切替はpane.tsの関数を利用

  // Diffタブ関連のハンドラをカスタムフックから取得
  
  // --- 既存のタブ・ファイル操作は最初のペインに集約（初期実装） ---
  const tabs = editors[0].tabs;
  // setTabsのデバッグログを追加
  const setTabs: React.Dispatch<React.SetStateAction<Tab[]>> = (update) => {
    console.log('[DEBUG] setTabs called with update:', update);
    setTabsForPane(editors, setEditors, 0, update);
    console.log('[DEBUG] editors after setTabs:', editors);
  };
  const activeTabId = editors[0].activeTabId;
  const setActiveTabId = (id: string) => {
    setActiveTabIdForPane(editors, setEditors, 0, id);
  };
  const setTabsForAllPanes = (update: Tab[] | ((tabs: Tab[]) => Tab[])) => {
    setEditors(prevEditors => {
      return prevEditors.map(editor => {
        const updatedTabs = typeof update === 'function' ? update(editor.tabs) : update;
        return { ...editor, tabs: updatedTabs };
      });
    });
  };

  // プロジェクト管理
  const { 
    currentProject, 
    projectFiles, 
    loadProject,
    saveFile,
    deleteFile,
    createProject,
    syncTerminalFileOperation,
    refreshProjectFiles,
    clearAIReview,
  } = useProject();

  const handleLeftResize = useLeftSidebarResize(leftSidebarWidth, setLeftSidebarWidth);
  const handleBottomResize = useBottomPanelResize(bottomPanelHeight, setBottomPanelHeight);

  // Diffタブ関連のハンドラをカスタムフックから取得
  const { handleDiffFileClick, handleDiffAllFilesClick } = useDiffTabHandlers(currentProject, setTabs, setActiveTabId);

  // プロジェクト変更時のタブリセットuseEffectを分離
  useProjectTabResetEffect({
    currentProject,
    setTabs: (update) => {
      if (isRestoredFromLocalStorage) {
        setTabsForAllPanes(update);
      } else {
        console.log('[DEBUG] Skipping useProjectTabResetEffect: localStorage restoration not complete');
      }
    },
    setActiveTabId,
    pane: 0
  });

  // プロジェクトファイル更新時のタブ同期useEffectを分離
  useProjectFilesSyncEffect({
    currentProject,
    projectFiles,
    tabs,
    setTabs,
    nodeRuntimeOperationInProgress,
    externalOperationInProgress,
    isRestoredFromLocalStorage
  });

  // アクティブタブのコンテンツ復元フック（全ペイン対応）
  useActiveTabContentRestore({
    editors,
    projectFiles,
    setEditors,
    isRestoredFromLocalStorage
  });

  // Git状態監視ロジックをフックに分離
  useEffect(() => {
    const { checkGitStatus } = useGitMonitor({
      currentProject,
      loadProject,
      saveFile,
      deleteFile,
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      projectFiles,
      setGitRefreshTrigger,
      setNodeRuntimeOperationInProgress,
      refreshProjectFiles,
      setGitChangesCount,
      gitRefreshTrigger,
    });
    checkGitStatus();
    const interval = setInterval(checkGitStatus, 60000);
    return () => clearInterval(interval);
  }, [currentProject, gitRefreshTrigger]);

  const handleMenuTabClick = (tab: MenuTab) => {
    if (activeMenuTab === tab && isLeftSidebarVisible) {
      setIsLeftSidebarVisible(false);
    } else {
      setActiveMenuTab(tab);
      setIsLeftSidebarVisible(true);
    }
  };

  const toggleBottomPanel = () => {
    setIsBottomPanelVisible(!isBottomPanelVisible);
  };

  const toggleOperationWindow = () => {
    setIsOperationWindowVisible(!isOperationWindowVisible);
  };

  // Ctrl+P でOperation Windowを開く
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setIsOperationWindowVisible(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFileOpen = (file: FileItem) => {
    console.log('[handleFileOpen] Opening file:', { 
      name: file.name, 
      path: file.path, 
      contentLength: file.content?.length || 0 
    });
    // 最新のプロジェクトファイルから正しいコンテンツ・バイナリ情報を取得
    let fileToOpen = file;
    if (currentProject && projectFiles.length > 0) {
      const latestFile = projectFiles.find(f => f.path === file.path);
      if (latestFile) {
        fileToOpen = {
          ...file,
          content: latestFile.content,
          isBufferArray: (latestFile as any).isBufferArray,
          bufferContent: (latestFile as any).bufferContent
        };
      }
    }
    if (fileToOpen.isBufferArray) {
      console.log('[handleFileOpen] fileToOpen bufferContent:', fileToOpen.path, fileToOpen.bufferContent instanceof ArrayBuffer, fileToOpen.bufferContent?.byteLength);
    }
    // openFile: Tab生成時にもisBufferArray/bufferContentを渡す
    openFile(fileToOpen, tabs, setTabs, setActiveTabId);
  };

  // 保存再起動イベントリスナー
  useEffect(() => {
    const handleSaveRestart = () => {
      // editors/tabsの全てのisDirtyなタブを保存
      setEditors(prevEditors => {
        prevEditors.forEach((editor, idx) => {
          editor.tabs.forEach(async tab => {
            if (tab.isDirty && currentProject && saveFile) {
              try {
                await saveFile(tab.path, tab.content);
                // 保存後、isDirtyをfalseに
                setEditors(prev => {
                  const updated = [...prev];
                  updated[idx] = {
                    ...updated[idx],
                    tabs: updated[idx].tabs.map(t => t.id === tab.id ? { ...t, isDirty: false } : t)
                  };
                  return updated;
                });
              } catch (e) {
                console.error('[SaveRestart] Failed to save:', tab.path, e);
              }
            }
          });
        });
        return prevEditors;
      });
      // Git状態更新
      setTimeout(() => {
        setGitRefreshTrigger(prev => prev + 1);
      }, 200);
    };
    window.addEventListener('pyxis-save-restart', handleSaveRestart);
    return () => {
      window.removeEventListener('pyxis-save-restart', handleSaveRestart);
    };
  }, [saveFile]);
  

  // 即座のローカル更新専用関数
  // 即座のローカル更新: 全ペインの同じファイルタブも同期
  const handleTabContentChangeImmediate = (tabId: string, content: string) => {
    const currentTimestamp = Date.now();
    setEditors(prevEditors => {
      // 対象ファイルパスを取得
      const targetPath = (() => {
        for (const pane of prevEditors) {
          const tab = pane.tabs.find(t => t.id === tabId);
          if (tab) return tab.path;
        }
        return undefined;
      })();
      if (!targetPath) return prevEditors;
      return prevEditors.map(pane => ({
        ...pane,
        tabs: pane.tabs.map(t =>
          t.path === targetPath ? { ...t, content, isDirty: true, userChangeTimestamp: currentTimestamp } : t
        )
      }));
    });
  };

  const handleProjectSelect = async (project: Project) => {
    setTabsForAllPanes([]); // 全ペインのタブをリセット
    setActiveTabId(''); // アクティブタブIDをリセット
    setEditors([{ id: 'editor-1', tabs: [], activeTabId: '' }]); // エディタ状態を初期化
    setIsLeftSidebarVisible(true);
    localStorage.removeItem('pyxis-editors'); // localStorageのエディタ状態をクリア
    setIsRestoredFromLocalStorage(false); // 復元フラグをリセット
    await loadProject(project);
  };

  const handleProjectCreate = async (name: string, description?: string) => {
    if (createProject) {
      // 全てのタブ、ペーン、セッションをリセット
      setTabsForAllPanes([]); // 全ペインのタブをリセット
      setActiveTabId(''); // アクティブタブIDをリセット
      setEditors([{ id: 'editor-1', tabs: [], activeTabId: '' }]); // エディタ状態を初期化
      setIsLeftSidebarVisible(true);
      localStorage.removeItem('pyxis-editors'); // localStorageのエディタ状態をクリア
      setIsRestoredFromLocalStorage(false); // 復元フラグをリセット

      await createProject(name, description);
    }
  };

  const handleProjectModalOpen = () => {
    setIsProjectModalOpen(true);
  };

  // // editorsとtabsのデバッグログを追加
  // useEffect(() => {
  //   console.log('[DEBUG] Current editors state:', editors);
  //   console.log('[DEBUG] Current tabs state:', tabs);
  // }, [editors, tabs]);

  return (
    <>
    <div
      className="w-full flex justify-end items-center overflow-hidden"
      style={{
        background: colors.background,
        height: '30px',
      }}
    >
      <button
        className="absolute left-1/2 transform -translate-x-1/2 h-6 flex items-center justify-center border rounded transition-colors"
        onClick={toggleOperationWindow}
        title="ファイル検索 (Ctrl+P)"
        style={{
          zIndex: 50,
          background: isOperationWindowVisible ? colors.accentBg : colors.mutedBg,
          color: isOperationWindowVisible ? colors.primary : colors.mutedFg,
          borderColor: colors.border,
          width: '35%',
          minWidth: 180,
          maxWidth: 500,
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        <Search size={14} color={isOperationWindowVisible ? colors.primary : colors.mutedFg} />
        <span className="ml-2 truncate">{currentProject?.name} [ファイル検索]</span>
      </button>
      <button
        className={`relative right-2 h-6 px-2 flex items-center justify-center border rounded transition-colors`}
        onClick={toggleBottomPanel}
        title="ターミナル表示/非表示"
        style={{
          zIndex: 50,
          background: isBottomPanelVisible ? colors.accentBg : colors.mutedBg,
          color: isBottomPanelVisible ? colors.primary : colors.mutedFg,
          borderColor: colors.border,
        }}
      >
        <Terminal size={8} color={isBottomPanelVisible ? colors.primary : colors.mutedFg} />
      </button>
      <button
        className={`relative right-3 h-6 px-2 flex items-center justify-center border rounded transition-colors ml-1`}
        onClick={toggleRightSidebar}
        title="右パネル表示/非表示"
        style={{
          zIndex: 50,
          background: isRightSidebarVisible ? colors.accentBg : colors.mutedBg,
          color: isRightSidebarVisible ? colors.primary : colors.mutedFg,
          borderColor: colors.border,
        }}
      >
        <PanelRightIcon size={16} color={isRightSidebarVisible ? colors.primary : colors.mutedFg} />
      </button>
    </div>
    <div
      className="h-full w-full flex overflow-hidden"
      style={{
        background: colors.background,
        position: 'relative'
      }}
    >
      <MenuBar 
        activeMenuTab={activeMenuTab}
        onMenuTabClick={handleMenuTabClick}
        onProjectClick={handleProjectModalOpen}
        gitChangesCount={gitChangesCount}
      />

      {isLeftSidebarVisible && (
        <LeftSidebar
          activeMenuTab={activeMenuTab}
          leftSidebarWidth={leftSidebarWidth}
          files={projectFiles}
          currentProject={currentProject!}
          onFileOpen={handleFileOpen}
          onFilePreview={file => {
            // Markdownプレビュータブとして開く
            const previewTabId = `preview-${file.path}`;
            
            // 既存のタブがあるかチェック（最初のペインから）
            const existing = editors[0].tabs.find(tab => tab.id === previewTabId);
            if (existing) {
              setActiveTabId(previewTabId);
              return;
            }
            
            // 最新のファイル内容を取得
            let fileToPreview = file;
            if (currentProject && projectFiles.length > 0) {
              const latestFile = projectFiles.find(f => f.path === file.path);
              if (latestFile) {
                fileToPreview = { ...file, content: latestFile.content };
              }
            }
            
            const newTab = {
              id: previewTabId,
              name: fileToPreview.name,
              content: fileToPreview.content || '',
              isDirty: false,
              path: fileToPreview.path,
              fullPath: fileToPreview.path,
              preview: true
            };
            
            // 最初のペインにタブを追加
            setTabs(prevTabs => [...prevTabs, newTab]);
            setActiveTabId(previewTabId);
          }}
          onWebPreview={(file: FileItem) => {
            const previewTabId = `web-preview-${file.path}`;
            setTabs((prevTabs) => {
              const existing = prevTabs.find((tab) => tab.id === previewTabId);
              if (existing) {
                setActiveTabId(previewTabId);
                return prevTabs;
              }
              const newTab = {
                id: previewTabId,
                name: `Web Preview: ${file.name}`,
                content: file.content || '',
                isDirty: false,
                path: file.path,
                fullPath: file.path,
                preview: true,
                webPreview: true, // Custom flag for WebPreviewTab
              };
              setActiveTabId(previewTabId);
              return [...prevTabs, newTab];
            });
          }}
          onResize={handleLeftResize}
          onGitRefresh={() => {
            if (currentProject && loadProject) {
              loadProject(currentProject);
            }
          }}
          gitRefreshTrigger={gitRefreshTrigger}
          onGitStatusChange={setGitChangesCount}
          onFileOperation={async (
            path: string,
            type: 'file' | 'folder' | 'delete',
            content?: string,
            isNodeRuntime?: boolean,
            isBufferArray?: boolean,
            bufferContent?: ArrayBuffer
          ) => {
            if (isNodeRuntime) {
              setNodeRuntimeOperationInProgress(true);
            }
            // バイナリファイルの場合はsyncTerminalFileOperation等で分岐
            if (syncTerminalFileOperation) {
              // バイナリファイルの場合はbufferContentを、テキストファイルの場合はcontentを渡す
              if (isBufferArray && bufferContent) {
                await syncTerminalFileOperation(path, type, '', bufferContent);
              } else {
                await syncTerminalFileOperation(path, type, content as string || '', undefined);
              }
            }
            setGitRefreshTrigger(prev => prev + 1);
          }}
          onDiffFileClick={handleDiffFileClick}
          onDiffAllFilesClick={handleDiffAllFilesClick}
        />
      )}


      {/* メインエリア＋右サイドバー: 横並びflexで全体が動く */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0" style={{ position: 'relative' }}>
        {/* メインエディタ部 */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div
            className={editorLayout === 'vertical' ? 'flex-1 flex flex-row overflow-hidden min-h-0' : 'flex-1 flex flex-col overflow-hidden min-h-0'}
            style={{ gap: '2px' }}
          >
            {editors.map((editor, idx) => {
              const activeTab = editor.tabs.find(tab => tab.id === editor.activeTabId);
              return (
                <div
                  key={editor.id}
                  className="flex-1 flex flex-col rounded relative min-w-0 min-h-0"
                  style={{
                    background: colors.background,
                    border: `1px solid ${colors.border}`
                  }}
                >
                  <TabBar
                    tabs={editor.tabs}
                    activeTabId={editor.activeTabId}
                    onTabClick={tabId => setActiveTabIdForPane(editors, setEditors, idx, tabId)}
                    onTabClose={tabId => {
                      setTabsForPane(editors, setEditors, idx, editor.tabs.filter(t => t.id !== tabId));
                      if (editor.activeTabId === tabId) {
                        const newActive = editor.tabs.filter(t => t.id !== tabId);
                        setActiveTabIdForPane(editors, setEditors, idx, newActive.length > 0 ? newActive[0].id : '');
                      }
                    }}
                    isBottomPanelVisible={isBottomPanelVisible}
                    onToggleBottomPanel={toggleBottomPanel}
                    onAddTab={() => setFileSelectState({ open: true, paneIdx: idx })}
                    addEditorPane={() => addEditorPane(editors, setEditors)}
                    removeEditorPane={() => removeEditorPane(editors, setEditors, editor.id)}
                    toggleEditorLayout={() => toggleEditorLayout(editorLayout, setEditorLayout)}
                    editorLayout={editorLayout}
                    editorId={editor.id}
                    removeAllTabs={() => setTabsForPane(editors, setEditors, idx, [])}
                  />
                  {/* DiffTab or CodeEditor */}
                  {activeTab && (activeTab.webPreview ? (
                    <WebPreviewTab
                      filePath={activeTab.path}
                      currentProjectName={currentProject?.name}
                    />
                  ) : activeTab.aiReviewProps ? (
                    <AIReviewTab
                      tab={activeTab}
                      onApplyChanges={async (filePath: string, content: string) => {
                        if (!currentProject) return;
                        try {
                          setExternalOperationInProgress(true);
                          await saveFile(filePath, content);
                          await clearAIReview(filePath);
                          if (refreshProjectFiles) await refreshProjectFiles();
                          setGitRefreshTrigger(prev => prev + 1);
                        } catch (error) {
                          console.error('Failed to apply AI review changes:', error);
                        } finally {
                          setExternalOperationInProgress(false);
                        }
                      }}
                      onDiscardChanges={async (filePath: string) => {
                        try {
                          setExternalOperationInProgress(true);
                          await clearAIReview(filePath);
                          if (refreshProjectFiles) await refreshProjectFiles();
                        } catch (error) {
                          console.error('Failed to discard AI review changes:', error);
                        } finally {
                          setExternalOperationInProgress(false);
                        }
                      }}
                      onCloseTab={(filePath: string) => {
                        setTabsForPane(editors, setEditors, idx, 
                          editors[idx].tabs.filter(tab => 
                            !(tab.aiReviewProps?.filePath === filePath)
                          )
                        );
                      }}
                      onUpdateSuggestedContent={(tabId: string, newContent: string) => {
                        setEditors(prev => {
                          const updated = [...prev];
                          updated[idx] = {
                            ...updated[idx],
                            tabs: updated[idx].tabs.map(t => 
                              t.id === tabId && t.aiReviewProps 
                                ? { 
                                    ...t, 
                                    aiReviewProps: { 
                                      ...t.aiReviewProps, 
                                      suggestedContent: newContent 
                                    } 
                                  } 
                                : t
                            )
                          };
                          return updated;
                        });
                      }}
                    />
                  ) : activeTab.diffProps ? (
                    <DiffTab diffs={activeTab.diffProps.diffs} />
                  ) : (
                    <CodeEditor
                      activeTab={activeTab}
                      onContentChange={async (tabId, content) => {
                        const currentTimestamp = Date.now();
                        setEditors(prev => {
                          const updated = [...prev];
                          updated[idx] = {
                            ...updated[idx],
                            tabs: updated[idx].tabs.map(t => t.id === tabId ? { ...t, content, isDirty: true, userChangeTimestamp: currentTimestamp } : t)
                          };
                          return updated;
                        });
                        setEditors(currentEditors => {
                          const tab = currentEditors[idx].tabs.find(t => t.id === tabId);
                          if (!tab || !currentProject) return currentEditors;
                          (async () => {
                            try {
                              setExternalOperationInProgress(true);
                              console.log(`[Pane ${idx}] Saving file as minimum pane index:`, tab.path);
                              await saveFile(tab.path, content);
                              console.log(`[Pane ${idx}] File saved to IndexedDB:`, tab.path);
                              if (refreshProjectFiles) await refreshProjectFiles();
                              setEditors(prevEditors => {
                                const targetPath = tab.path;
                                return prevEditors.map(pane => ({
                                  ...pane,
                                  tabs: pane.tabs.map(t =>
                                    t.path === targetPath ? { ...t, isDirty: false } : t
                                  )
                                }));
                              });
                              setTimeout(() => {
                                setGitRefreshTrigger(prev => prev + 1);
                              }, 200);
                            } catch (error) {
                              console.error(`[Pane ${idx}] Failed to save file:`, error);
                            } finally {
                              setExternalOperationInProgress(false);
                            }
                          })();
                          return currentEditors;
                        })
                      }}
                      onContentChangeImmediate={handleTabContentChangeImmediate}
                      isBottomPanelVisible={isBottomPanelVisible}
                      bottomPanelHeight={bottomPanelHeight}
                      nodeRuntimeOperationInProgress={nodeRuntimeOperationInProgress}
                      isCodeMirror={activeTab?.isCodeMirror}
                      currentProjectName={currentProject?.name}
                      projectFiles={projectFiles}
                    />
                  ))}
                </div>
              );
            })}
          </div>
          {isBottomPanelVisible && (
            <BottomPanel
              height={bottomPanelHeight}
              currentProject={currentProject?.name}
              projectFiles={projectFiles}
              onResize={handleBottomResize}
              onTerminalFileOperation={async (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean, isBufferArray?: boolean, bufferContent?: ArrayBuffer) => {
                if (isNodeRuntime) {
                  setNodeRuntimeOperationInProgress(true);
                }
                // 全ての外部操作を追跡
                setExternalOperationInProgress(true);
                try {
                  if (syncTerminalFileOperation) {
                    // bufferContentが存在する場合、それを渡す
                    if (bufferContent) {
                      await syncTerminalFileOperation(path, type, '', bufferContent);
                    } else {
                      await syncTerminalFileOperation(path, type, content as string || '', undefined);
                    }
                  }
                  await refreshProjectFiles();
                  setGitRefreshTrigger(prev => prev + 1);
                } finally {
                  setExternalOperationInProgress(false);
                  if (isNodeRuntime) {
                    setNodeRuntimeOperationInProgress(false);
                  }
                }
              }}
            />
          )}
        </div>
        {/* 右サイドバー: リサイズバーを本体の左側に配置 */}
        {isRightSidebarVisible && (
          <>
            <div
              className="resizer resizer-vertical flex-shrink-0"
              onMouseDown={handleRightResize}
              onTouchStart={handleRightResize}
              style={{
                background: colors.sidebarResizerBg,
                cursor: 'col-resize',
              }}
            />
            <RightSidebar
              rightSidebarWidth={rightSidebarWidth}
              onResize={() => {}} // 右サイドバー本体には不要
              projectFiles={projectFiles}
              currentProject={currentProject}
              tabs={tabs}
              setTabs={setTabs}
              setActiveTabId={setActiveTabId}
              saveFile={saveFile}
              clearAIReview={clearAIReview}
            />
          </>
        )}
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onProjectSelect={handleProjectSelect}
        onProjectCreate={handleProjectCreate}
        currentProject={currentProject}
      />
      {/* ファイル選択モーダル */}
      <FileSelectModal
        isOpen={fileSelectState.open}
        onClose={() => setFileSelectState({ open: false, paneIdx: null })}
        files={projectFiles}
        onFileSelect={file => {
          setFileSelectState({ open: false, paneIdx: null });
          handleFileSelect({
            file,
            fileSelectState,
            currentProject,
            projectFiles,
            editors,
            setEditors
          });
        }}
        onFilePreview={file => {
          setFileSelectState({ open: false, paneIdx: null });
          handleFilePreview({
            file,
            fileSelectState,
            currentProject,
            projectFiles,
            editors,
            setEditors
          });
        }}
        onFileOperation={async (path, type, content, isNodeRuntime) => {
          // 既存のonFileOperationのロジックを流用
          if (isNodeRuntime) {
            setNodeRuntimeOperationInProgress(true);
          }
          if (syncTerminalFileOperation) {
            await syncTerminalFileOperation(path, type, content as string || '', undefined);
          }
          setGitRefreshTrigger(prev => prev + 1);
        }}
        currentProjectName={currentProject?.name || ''}
      />
      <OperationWindow
        isVisible={isOperationWindowVisible}
        onClose={() => setIsOperationWindowVisible(false)}
        projectFiles={projectFiles}
        tabs={tabs}
        setTabs={setTabs}
        setActiveTabId={setActiveTabId}
      />
    </div>
    </>
  );
}
