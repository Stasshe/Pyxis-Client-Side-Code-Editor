import React, { useState } from 'react';
import FileSelectModal from './FileSelect';

import type { FileItem } from '@/types';

interface CompareTargetSelectorProps {
  originalFileName: string;
  originalContent: string;
  candidateFiles?: FileItem[]; // FileTree用の階層構造
  gitHistory?: Record<string, { commit: string; content: string }[]>;
  onSelect: (name: string, content: string) => void;
}

const CompareTargetSelector: React.FC<CompareTargetSelectorProps> = ({
  originalFileName,
  originalContent,
  candidateFiles = [],
  gitHistory = {},
  onSelect
}) => {
  const [showFileModal, setShowFileModal] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showGitFileModal, setShowGitFileModal] = useState(false);
  // projectFilesからファイルリスト生成
  const fileOptions = candidateFiles ? candidateFiles.filter(f => f.type === 'file').map(f => f.path) : [];
  const [selectedGitFile, setSelectedGitFile] = useState<string>(fileOptions[0] || '');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button className="px-2 py-1 rounded bg-accent text-white text-xs" onClick={() => setShowFileModal(true)}>
          ファイルツリーから選択
        </button>
        <button className="px-2 py-1 rounded bg-primary text-white text-xs" onClick={() => setShowGitPanel(true)}>
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
            onSelect(file.name ?? '', file.content ?? '');
            setShowFileModal(false);
          }}
        />
      )}
      {/* Git履歴パネル（FileSelectModalでファイル選択＋コミットメッセージ一覧） */}
      {showGitPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-4 min-w-[340px] max-h-[70vh] overflow-auto">
            <div className="font-bold mb-2">Git履歴（{selectedGitFile}）</div>
            <div className="mb-2 flex gap-2 items-center">
              <span className="text-xs">ファイル選択：</span>
              <button className="px-2 py-1 rounded bg-accent text-white text-xs" onClick={() => setShowGitFileModal(true)}>
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
            {(!gitHistory || !gitHistory[selectedGitFile] || gitHistory[selectedGitFile].length === 0) && <div className="text-xs text-muted-foreground">履歴がありません</div>}
            {gitHistory && gitHistory[selectedGitFile] && (
              <div className="mb-2">
                <div className="text-xs font-bold mb-1">コミット一覧</div>
                <ul className="text-xs">
                  {gitHistory[selectedGitFile].map((h, idx) => (
                    <li key={h.commit + '-' + idx} className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[11px] bg-muted px-1 rounded">{h.commit.slice(0,7)}</span>
                      <span>{h.commit}</span>
                      <button className="px-2 py-0.5 bg-primary text-white rounded text-xs" onClick={() => { onSelect(h.commit, h.content); setShowGitPanel(false); }}>
                        この内容と比較
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button className="mt-2 px-3 py-1 bg-accent text-white rounded" onClick={() => setShowGitPanel(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareTargetSelector;
