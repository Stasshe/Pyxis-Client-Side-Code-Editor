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
import { useProjectTabResetEffect, useProjectFilesSyncEffect } from '@/hooks/tab';
import MenuBar from '@/components/MenuBar';
import LeftSidebar from '@/components/Left/LeftSidebar';
import TabBar from '@/components/Tab/TabBar';
import CodeEditor from '@/components/Tab/CodeEditor';
import BottomPanel from '@/components/Bottom/BottomPanel';
import ProjectModal from '@/components/ProjectModal';
import { useLeftSidebarResize, useBottomPanelResize } from '@/utils/resize';
import { openFile } from '@/utils/tabs';
import { useGitMonitor } from '@/hooks/gitHooks';
import { useProject } from '@/utils/project';
import { Project } from '@/types';
import type { Tab,FileItem, MenuTab, EditorLayoutType, EditorPane } from '@/types';
import FileSelectModal from '@/components/FileSelect';
import { handleFileSelect, handleFilePreview } from '@/hooks/fileSelectHandlers';
import { Terminal } from 'lucide-react';


export default function Home() {
  const [activeMenuTab, setActiveMenuTab] = useState<MenuTab>('files');
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(240);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [gitRefreshTrigger, setGitRefreshTrigger] = useState(0);
  const [gitChangesCount, setGitChangesCount] = useState(0); // Git変更ファイル数
  const [nodeRuntimeOperationInProgress, setNodeRuntimeOperationInProgress] = useState(false); // NodeRuntime操作中フラグ
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
            setEditors(parsed);
            // activeTabIdを復元
            if (parsed[0].tabs.length > 0) {
              setActiveTabId(parsed[0].tabs[0].id);
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
  // editors/editorLayout変更時にlocalStorageへ保存
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('pyxis-editors', JSON.stringify(editors));
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
  } = useProject();

  // 修正: setTabsForAllPanesのupdate引数を関数として扱う
  const setTabsForAllPanes = (update: Tab[] | ((tabs: Tab[]) => Tab[])) => {
    setEditors(prevEditors => {
      return prevEditors.map(editor => {
        const updatedTabs = typeof update === 'function' ? update(editor.tabs) : update;
        return { ...editor, tabs: updatedTabs };
      });
    });
  };

  const handleLeftResize = useLeftSidebarResize(leftSidebarWidth, setLeftSidebarWidth);
  const handleBottomResize = useBottomPanelResize(bottomPanelHeight, setBottomPanelHeight);

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
    nodeRuntimeOperationInProgress
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
    const interval = setInterval(checkGitStatus, 30000); // 30秒間隔でより頻繁にチェック
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

  const handleFileOpen = (file: FileItem) => {
    console.log('[handleFileOpen] Opening file:', { 
      name: file.name, 
      path: file.path, 
      contentLength: file.content?.length || 0 
    });
    
    // 最新のプロジェクトファイルから正しいコンテンツを取得
    let fileToOpen = file;
    if (currentProject && projectFiles.length > 0) {
      const latestFile = projectFiles.find(f => f.path === file.path);
      if (latestFile) {
        fileToOpen = {
          ...file,
          content: latestFile.content
        };
      }
    }
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
      }, 50);
    };
    window.addEventListener('pyxis-save-restart', handleSaveRestart);
    return () => {
      window.removeEventListener('pyxis-save-restart', handleSaveRestart);
    };
  }, [saveFile]);
  

  // 即座のローカル更新専用関数
  // 即座のローカル更新: 全ペインの同じファイルタブも同期
  const handleTabContentChangeImmediate = (tabId: string, content: string) => {
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
          t.path === targetPath ? { ...t, content, isDirty: true } : t
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

  // editorsとtabsのデバッグログを追加
  useEffect(() => {
    console.log('[DEBUG] Current editors state:', editors);
    console.log('[DEBUG] Current tabs state:', tabs);
  }, [editors, tabs]);

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
        className={`relative right-3 h-6 px-2 flex items-center justify-center border rounded transition-colors`}
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
          // !型アサーションビミョい
          currentProject={currentProject!}
          onFileOpen={handleFileOpen}
          onFilePreview={file => {
            // Markdownプレビュータブとして開く
            const previewTabId = `preview-${file.path}`;
            setTabs(prevTabs => {
              // 既存プレビュータブがあればアクティブ化
              const existing = prevTabs.find(tab => tab.id === previewTabId);
              if (existing) {
                setActiveTabId(previewTabId);
                return prevTabs;
              }
              // 最新のファイル内容取得
              let fileToPreview = file;
              if (currentProject && projectFiles.length > 0) {
                const latestFile = projectFiles.find(f => f.path === file.path);
                if (latestFile) {
                  fileToPreview = { ...file, content: latestFile.content };
                }
              }
              // プレビュータブ追加
                const newTab = {
                  id: previewTabId,
                  name: fileToPreview.name,
                  content: fileToPreview.content || '',
                  isDirty: false,
                  path: fileToPreview.path,
                  fullPath: fileToPreview.path,
                  preview: true // プレビューフラグ
                };
                setActiveTabId(previewTabId);
                return [...prevTabs, newTab];
            });
          }}
          onResize={handleLeftResize}
          onGitRefresh={() => {
            // Git操作後にプロジェクトを再読み込み
            if (currentProject && loadProject) {
              loadProject(currentProject);
            }
          }}
          gitRefreshTrigger={gitRefreshTrigger}
          
          onGitStatusChange={setGitChangesCount}
          onFileOperation={async (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean) => {
            if (isNodeRuntime) {
              setNodeRuntimeOperationInProgress(true);
            }
            if (syncTerminalFileOperation) {
              await syncTerminalFileOperation(path, type, content);
            }
            setGitRefreshTrigger(prev => prev + 1);
          }}
          />
      )}

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
                <CodeEditor
                  activeTab={activeTab}
                  onContentChange={async (tabId, content) => {
                    // ローカル状態を更新
                    setEditors(prev => {
                      const updated = [...prev];
                      updated[idx] = {
                        ...updated[idx],
                        tabs: updated[idx].tabs.map(t => t.id === tabId ? { ...t, content, isDirty: true } : t)
                      };
                      return updated;
                    });
                    
                    // ファイルパスを取得 - 最新のエディタ状態を使用するために関数内で取得
                    setEditors(currentEditors => {
                      // 現在のタブを見つける
                      const tab = currentEditors[idx].tabs.find(t => t.id === tabId);
                      if (!tab || !currentProject) return currentEditors; // タブが見つからない場合は何もしない
                      
                      //const minPaneIdx = Math.min(...panesWithSameFile);

                      (async () => {
                        try {
                          console.log(`[Pane ${idx}] Saving file as minimum pane index:`, tab.path);
                          // IndexedDBに保存
                          await saveFile(tab.path, content);
                          console.log(`[Pane ${idx}] File saved to IndexedDB:`, tab.path);
                          
                          // 保存成功後、projectFilesを明示的に再取得
                          if (refreshProjectFiles) await refreshProjectFiles();
                          
                          // 全ペインの同じファイルタブのisDirtyをfalseに
                          setEditors(prevEditors => {
                            const targetPath = tab.path;
                            return prevEditors.map(pane => ({
                              ...pane,
                              tabs: pane.tabs.map(t =>
                                t.path === targetPath ? { ...t, isDirty: false } : t
                              )
                            }));
                          });
                          
                          // Git状態を更新
                          setTimeout(() => {
                            setGitRefreshTrigger(prev => prev + 1);
                          }, 50);
                        } catch (error) {
                          console.error(`[Pane ${idx}] Failed to save file:`, error);
                        }
                      })();
                      
                      // 元のエディタ状態を返す（setEditorsの中なので）
                      return currentEditors;
                    })
                  }}
                  onContentChangeImmediate={handleTabContentChangeImmediate}
                  isBottomPanelVisible={isBottomPanelVisible}
                  bottomPanelHeight={bottomPanelHeight}
                  nodeRuntimeOperationInProgress={nodeRuntimeOperationInProgress}
                />
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
            onTerminalFileOperation={async (path: string, type: 'file' | 'folder' | 'delete', content?: string, isNodeRuntime?: boolean) => {
              if (isNodeRuntime) {
                setNodeRuntimeOperationInProgress(true);
              }
              if (syncTerminalFileOperation) {
                await syncTerminalFileOperation(path, type, content);
              }
              setGitRefreshTrigger(prev => prev + 1);
            }}
          />
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
            await syncTerminalFileOperation(path, type, content);
          }
          setGitRefreshTrigger(prev => prev + 1);
        }}
        currentProjectName={currentProject?.name || ''}
      />
    </div>
    </>
  );
}
