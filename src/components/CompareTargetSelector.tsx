import React, { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { getFileHistory } from '@/utils/cmd/git';
import FileSelectModal from './FileSelect';

import type { FileItem } from '@/types';

interface CompareTargetSelectorProps {
  originalFileName: string;
  originalContent: string;
  candidateFiles?: FileItem[]; // FileTree用の階層構造
  currentProject: string;
  onSelect: (name: string, content: string) => void;
}

const CompareTargetSelector: React.FC<CompareTargetSelectorProps> = ({
  originalFileName,
  originalContent,
  candidateFiles = [],
  currentProject,
  onSelect
}) => {
  const [showFileModal, setShowFileModal] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showGitFileModal, setShowGitFileModal] = useState(false);
  // projectFilesからファイルリスト生成
  const fileOptions = candidateFiles ? candidateFiles.filter(f => f.type === 'file').map(f => f.path) : [];
  // originalFileNameがfileOptionsに含まれていればそれを初期値に
  const [selectedGitFile, setSelectedGitFile] = useState<string>(originalFileName);
  const [selectedContent, setSelectedContent] = useState<string>(originalContent);
  const [gitFileHistory, setGitFileHistory] = useState<{ commit: string; content: string }[]>([]);

  useEffect(() => {
    if (!selectedGitFile || !currentProject) {
      setGitFileHistory([]);
      return;
    }
    // 履歴取得
    (async () => {
      try {
        const history = await getFileHistory(selectedGitFile, currentProject);
        setGitFileHistory(history || []);
      } catch (e) {
        setGitFileHistory([]);
      }
    })();
  }, [selectedGitFile, currentProject]);

  const { colors } = useTheme();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            background: colors.accentBg,
            color: colors.accentFg,
            border: `1px solid ${colors.border}`,
          }}
          onClick={() => setShowFileModal(true)}
        >
          ファイルツリーから選択
        </button>
        <button
          className="px-3 py-1 rounded text-xs font-semibold"
          style={{
            background: colors.primary,
            color: colors.background,
            border: `1px solid ${colors.border}`,
          }}
          onClick={() => setShowGitPanel(true)}
        >
          Git履歴から選択
        </button>
      </div>
      {/* FileTreeモーダル（FileSelectModalを利用） */}
      {showFileModal && (
        <FileSelectModal
          isOpen={showFileModal}
          onClose={() => setShowFileModal(false)}
          files={candidateFiles}
          onFileSelect={file => {
            setSelectedGitFile(file.path);
            setSelectedContent(file.content ?? '');
            onSelect(file.name ?? '', file.content ?? '');
            setShowFileModal(false);
          }}
        />
      )}
      {/* Git履歴パネル（FileSelectModalでファイル選択＋コミットメッセージ一覧） */}
      {showGitPanel && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: colors.background + 'CC' }} // 80%透明度
        >
          <div
            className="rounded shadow-lg p-5 min-w-[340px] max-h-[70vh] overflow-auto border"
            style={{
              background: colors.cardBg,
              color: colors.foreground,
              borderColor: colors.border,
            }}
          >
            <div className="font-bold mb-3 text-base" style={{ color: colors.primary }}>
              Git履歴（{selectedGitFile}）
            </div>
            <div className="mb-3 flex gap-2 items-center">
              <span className="text-xs" style={{ color: colors.mutedFg }}>ファイル選択：</span>
              <button
                className="px-2 py-1 rounded text-xs font-semibold"
                style={{
                  background: colors.accentBg,
                  color: colors.accentFg,
                  border: `1px solid ${colors.border}`,
                }}
                onClick={() => setShowGitFileModal(true)}
              >
                ファイルツリーから選択
              </button>
            </div>
            {showGitFileModal && (
              <FileSelectModal
                isOpen={showGitFileModal}
                onClose={() => setShowGitFileModal(false)}
                files={candidateFiles}
                onFileSelect={file => {
                  setSelectedGitFile(file.path);
                  setShowGitFileModal(false);
                }}
              />
            )}
            {/* コミットメッセージ一覧 */}
            {(gitFileHistory.length === 0) && (
              <div className="text-xs mb-2" style={{ color: colors.mutedFg }}>
                履歴がありません
              </div>
            )}
            {(gitFileHistory.length > 0) && (
              <div className="mb-2">
                <div className="text-xs font-bold mb-1" style={{ color: colors.accentFg }}>
                  コミット一覧
                </div>
                <ul className="text-xs">
                  {gitFileHistory.map((h, idx) => (
                    <li key={h.commit + '-' + idx} className="mb-1 flex items-center gap-2">
                      <span
                        className="font-mono text-[11px] px-1 rounded"
                        style={{ background: colors.mutedBg, color: colors.primary }}
                      >
                        {h.commit.slice(0,7)}
                      </span>
                      <span style={{ color: colors.foreground }}>
                        {h.commit.length > 30 ? h.commit.slice(0, 30) + '...' : h.commit}
                      </span>
                      <button
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: colors.primary,
                          color: colors.background,
                          border: `1px solid ${colors.border}`,
                        }}
                        onClick={() => {
                          setSelectedGitFile(selectedGitFile);
                          setSelectedContent(h.content);
                          onSelect(selectedGitFile, h.content);
                          setShowGitPanel(false);
                        }}
                      >
                        この内容と比較
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              className="mt-2 px-3 py-1 rounded font-semibold"
              style={{
                background: colors.accentBg,
                color: colors.accentFg,
                border: `1px solid ${colors.border}`,
              }}
              onClick={() => setShowGitPanel(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareTargetSelector;
