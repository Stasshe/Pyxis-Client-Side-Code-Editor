import React, { useState } from 'react';
import FileSelectModal from './FileSelect';

import type { FileItem } from '@/types';

interface CompareTargetSelectorProps {
  originalFileName: string;
  originalContent: string;
  candidateFiles?: FileItem[]; // FileTree用の階層構造
  // gitHistory: { [fileName: string]: { commit: string; content: string }[] }
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
  const [selectedGitFile, setSelectedGitFile] = useState<string>(originalFileName);

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
      {/* Git履歴パネル（別ファイル選択付き） */}
      {showGitPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-4 min-w-[340px] max-h-[70vh] overflow-auto">
            <div className="font-bold mb-2">Git履歴（{selectedGitFile}）</div>
            <div className="mb-2 flex gap-2 items-center">
              <span className="text-xs">ファイル選択：</span>
              <select
                className="border rounded px-2 py-1 text-xs bg-muted"
                value={selectedGitFile}
                onChange={e => setSelectedGitFile(e.target.value)}
              >
                {Object.keys(gitHistory).map((fn, idx) => (
                  <option key={fn + '-' + idx} value={fn}>{fn}</option>
                ))}
              </select>
            </div>
            {(!gitHistory[selectedGitFile] || gitHistory[selectedGitFile].length === 0) && <div className="text-xs text-muted-foreground">履歴がありません</div>}
            {gitHistory[selectedGitFile] && gitHistory[selectedGitFile].map((h, idx) => (
              <div key={h.commit + '-' + idx} className="mb-2">
                <div className="text-xs font-bold">{h.commit}</div>
                <button className="px-2 py-1 bg-primary text-white rounded text-xs" onClick={() => { onSelect(h.commit, h.content); setShowGitPanel(false); }}>
                  このコミット内容と比較
                </button>
                {/* 差分表示はDiffEditor等で拡張可 */}
              </div>
            ))}
            <button className="mt-2 px-3 py-1 bg-accent text-white rounded" onClick={() => setShowGitPanel(false)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareTargetSelector;
