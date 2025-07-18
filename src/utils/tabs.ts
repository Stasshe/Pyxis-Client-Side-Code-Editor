import { Tab, FileItem } from '../types';

export const createNewTab = (file: FileItem): Tab => {
  console.log('[createNewTab] Creating tab for file:', { 
    name: file.name, 
    path: file.path, 
    contentLength: file.content?.length || 0 
  });
  return {
    id: Date.now().toString(),
    name: file.name,
    content: file.content || '',
    isDirty: false,
    path: file.path
  };
};

export const openFile = (
  file: FileItem,
  tabs: Tab[],
  setTabs: (tabs: Tab[]) => void,
  setActiveTabId: (id: string) => void
) => {
  if (file.type === 'folder') return;
  
  console.log('[openFile] Opening file:', { 
    name: file.name, 
    path: file.path, 
    contentLength: file.content?.length || 0 
  });
  
  const existingTab = tabs.find(tab => tab.path === file.path);
  if (existingTab) {
    console.log('[openFile] Found existing tab:', existingTab.id);
    setActiveTabId(existingTab.id);
    return;
  }

  const newTab = createNewTab(file);
  console.log('[openFile] Created new tab:', newTab.id);
  setTabs([...tabs, newTab]);
  setActiveTabId(newTab.id);
};