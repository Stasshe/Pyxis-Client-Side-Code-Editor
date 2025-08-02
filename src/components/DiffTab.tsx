import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { DiffEditor, Monaco } from '@monaco-editor/react';
import CompareTargetSelector from './CompareTargetSelector';
import type { FileItem } from '@/types';

interface DiffTabProps {
  originalContent: string;
  modifiedContent: string;
  originalFileName: string;
  modifiedFileName: string;
  projectFiles: FileItem[]; // FileItem型の階層構造
  gitHistory?: Record<string, { commit: string; content: string }[]>;
}

const DiffTab: React.FC<DiffTabProps> = ({
  originalContent,
  modifiedContent,
  originalFileName,
  modifiedFileName,
  projectFiles,
  gitHistory = {}
}) => {
  const { colors } = useTheme();
  const [selectedContent, setSelectedContent] = useState(modifiedContent || '');
  const [selectedName, setSelectedName] = useState(modifiedFileName || '');
  const showSelectUI = !selectedContent;

  // projectFilesをpropsで受け取る前提（FileItem型の階層構造）
  // candidateFilesにはprojectFilesをそのまま渡す
  // candidateFilesをFileItem型に変換
  // page.tsxのFileSelectModalと同じく、FileItem型の階層構造（projectFilesなど）をそのまま渡す
  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="px-4 pt-2 pb-1 border-b flex items-center gap-2" style={{ minHeight: 36 }}>
        <span className="font-bold text-sm" style={{ color: colors.foreground }}>差分</span>
        <span className="text-xs" style={{ color: colors.mutedFg }}>
          <span style={{ fontWeight: 'bold', color: '#e06c75' }}>{originalFileName}</span>
          {' '}→{' '}
          <span style={{ fontWeight: 'bold', color: '#98c379' }}>{selectedName || modifiedFileName}</span>
        </span>
      </div>
      <div className="px-4 py-1 border-b bg-muted" style={{ minHeight: 0 }}>
        <CompareTargetSelector
          originalFileName={originalFileName}
          originalContent={originalContent}
          candidateFiles={projectFiles}
          gitHistory={gitHistory}
          onSelect={(name, content) => {
            setSelectedContent(content);
            setSelectedName(name);
          }}
        />
      </div>
      <div className="flex-1 min-h-0" style={{ minHeight: 0 }}>
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
