import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { DiffEditor, Monaco } from '@monaco-editor/react';

interface DiffTabProps {
  originalContent: string;
  modifiedContent: string;
  originalFileName: string;
  modifiedFileName: string;
  // 比較先候補ファイルリスト（オプション）
  candidateFiles?: { name: string; content: string }[];
}

const DiffTab: React.FC<DiffTabProps> = ({
  originalContent,
  modifiedContent,
  originalFileName,
  modifiedFileName,
  candidateFiles = []
}) => {
  const { colors } = useTheme();
  const [selectedContent, setSelectedContent] = useState(modifiedContent || '');
  const [selectedName, setSelectedName] = useState(modifiedFileName || '');
  const [inputMode, setInputMode] = useState<'select' | 'text'>('select');

  const showSelectUI = !selectedContent;

  return (
    <div className="p-4 overflow-auto h-full w-full">
      <div className="font-bold text-lg mb-2">
        差分表示
      </div>
      <div className="mb-2 text-sm" style={{ color: colors.mutedFg }}>
        <span style={{ fontWeight: 'bold', color: '#e06c75' }}>{originalFileName}</span>
        {' '}→{' '}
        <span style={{ fontWeight: 'bold', color: '#98c379' }}>{selectedName || modifiedFileName}</span>
      </div>
      {showSelectUI ? (
        <div className="mb-4">
          <div className="mb-2 text-xs">比較先を選択してください：</div>
          <div className="flex gap-2 mb-2">
            <button className={`px-2 py-1 rounded ${inputMode === 'select' ? 'bg-accent text-white' : 'bg-muted'}`} onClick={() => setInputMode('select')}>ファイルから選択</button>
            <button className={`px-2 py-1 rounded ${inputMode === 'text' ? 'bg-accent text-white' : 'bg-muted'}`} onClick={() => setInputMode('text')}>テキスト入力</button>
          </div>
          {inputMode === 'select' ? (
            <div className="max-h-40 overflow-auto border rounded p-2 bg-muted">
              {candidateFiles.length === 0 && <div className="text-xs text-muted-foreground">候補ファイルがありません</div>}
              {candidateFiles.map(f => (
                <div key={f.name} className="mb-1 flex items-center gap-2">
                  <button className="px-2 py-1 text-xs bg-primary text-white rounded" onClick={() => { setSelectedContent(f.content); setSelectedName(f.name); }}>
                    {f.name}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <textarea
                className="w-full border rounded p-2 text-sm bg-muted"
                rows={6}
                placeholder="比較先のテキストを入力..."
                value={selectedContent}
                onChange={e => { setSelectedContent(e.target.value); setSelectedName('手入力'); }}
              />
              <button className="mt-2 px-3 py-1 bg-primary text-white rounded" onClick={() => setSelectedName('手入力')}>この内容で比較</button>
            </div>
          )}
        </div>
      ) : null}
      <div style={{ height: 'calc(100vh - 120px)' }}>
        <DiffEditor
          height="100%"
          theme="pyxis-custom"
          language="plaintext"
          original={originalContent}
          modified={selectedContent}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            renderWhitespace: 'selection',
            wordWrap: 'on',
          }}
          loading={<div className="h-full flex items-center justify-center text-muted-foreground">Loading diff...</div>}
        />
      </div>
    </div>
  );
};

export default DiffTab;
