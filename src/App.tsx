import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderOpen, LayoutGrid, List, ScatterChart, Trash2, Maximize2, X, Image as ImageIcon, ArrowUp, ArrowDown, ChevronDown, Check, PanelLeft, PanelRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { ImageRecord, DatasetRecord, getAllDatasets, createDataset, deleteDataset, getImagesByDataset, storeImages, clearAll, deleteImage, renameDataset, getTotalImageCount, getImageCountByDataset, updateDatasetDate } from './lib/db';
import { Panel, SolidButton } from './components/ui';
import { cn } from './lib/utils';

type ViewMode = 'grid-sq' | 'grid-ma' | 'list' | 'free';

interface LoadedImage extends ImageRecord {
  url: string;
  randomX: number;
  randomY: number;
  randomRotation: number;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function App() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetCounts, setDatasetCounts] = useState<Record<string, number>>({});
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const [datasetViewMode, setDatasetViewMode] = useState<'list' | 'dropdown'>('list');
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [totalImagesCount, setTotalImagesCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid-sq');
  const [scales, setScales] = useState<Record<ViewMode, number>>({
    'grid-sq': 140,
    'grid-ma': 140,
    'list': 140,
    'free': 140
  });
  const [gaps, setGaps] = useState<Record<ViewMode, number>>({
    'grid-sq': 24,
    'grid-ma': 24,
    'list': 8,
    'free': 0
  });
  
  const itemScale = scales[viewMode];
  const gridGap = gaps[viewMode];

  const setItemScale = (val: number) => {
    setScales(prev => ({ ...prev, [viewMode]: val }));
  };

  const setGridGap = (val: number) => {
    setGaps(prev => ({ ...prev, [viewMode]: val }));
  };

  const [selectedImage, setSelectedImage] = useState<LoadedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingDirectory, setIsReadingDirectory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

  // Custom Prompts/Modals because alert/prompt/confirm are unreliable in iframe
  const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
  const [datasetNameInput, setDatasetNameInput] = useState("");
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'size' | 'type' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [theme, setTheme] = useState<'NAVY' | 'BLACK' | 'LIGHT' | 'PAPER'>('NAVY');
  const [canvasBg, setCanvasBg] = useState<'theme' | 'black' | 'white' | 'checker'>('theme');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const scatterContainerRef = React.useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(1000);
  useEffect(() => {
    if (!scatterContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(scatterContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Load from DB on mount
  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    if (activeDatasetId) {
      loadImages(activeDatasetId);
    } else {
      setImages([]);
    }
  }, [activeDatasetId]);

  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'date':
          comparison = a.lastModified - b.lastModified;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [images, sortField, sortOrder]);

  const masonryColumns = useMemo(() => {
    if (viewMode !== 'grid-ma') return [];
    const availableWidth = containerWidth - 32 - 16; 
    const colsCount = Math.max(1, Math.floor((availableWidth + gridGap) / (itemScale + gridGap)));
    
    const columns: ImageRecord[][] = Array.from({ length: colsCount }, () => []);
    sortedImages.forEach((img, i) => {
      columns[i % colsCount].push(img);
    });
    return columns;
  }, [sortedImages, viewMode, containerWidth, itemScale, gridGap]);

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      let dsList = await getAllDatasets();
      if (dsList.length === 0) {
        // Create initial default dataset
        const ds = await createDataset('DEFAULT DATASET');
        dsList = [ds];
      }
      setDatasets(dsList);
      
      const counts: Record<string, number> = {};
      for (const ds of dsList) {
        counts[ds.id] = await getImageCountByDataset(ds.id);
      }
      setDatasetCounts(counts);

      const total = await getTotalImageCount();
      setTotalImagesCount(total);
      
      if (dsList.length > 0 && !activeDatasetId) {
        setActiveDatasetId(dsList[0].id);
      } else if (activeDatasetId && !dsList.find(d => d.id === activeDatasetId)) {
        setActiveDatasetId(dsList.length > 0 ? dsList[0].id : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadImages = async (datasetId: string) => {
    setIsLoading(true);
    try {
      const dbImages = await getImagesByDataset(datasetId);
      // Revoke old URLs
      images.forEach(img => URL.revokeObjectURL(img.url));
      
      const loaded = dbImages.map(img => ({
        ...img,
        url: URL.createObjectURL(img.data),
        randomX: Math.random() * 80 - 40, // -40% to 40%
        randomY: Math.random() * 80 - 40,
        randomRotation: Math.random() * 30 - 15, // -15 to 15 deg
      }));
      setImages(loaded);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (fileList: FileList | File[], datasetId: string) => {
    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList instanceof FileList ? fileList.item(i) : fileList[i];
      if (file && file.type.startsWith('image/')) {
        files.push(file);
      }
    }
    
    if (files.length === 0) return;
    setIsReadingDirectory(true);

    try {
      const records = files.map(f => ({
        id: `${datasetId}-${f.name}-${f.lastModified}-${f.size}`,
        datasetId,
        name: f.name,
        type: f.type,
        size: f.size,
        lastModified: f.lastModified,
        data: f
      }));
      
      await storeImages(records);
      await loadDatasets();
      if (datasetId === activeDatasetId) {
        await loadImages(datasetId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReadingDirectory(false);
    }
  };

  const handleReadDirectoryClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeDatasetId) return;
    await processFiles(e.target.files, activeDatasetId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddDatasetClick = () => {
    setDatasetNameInput("");
    setEditingDatasetId(null);
    setShowNewDatasetModal(true);
  };
  
  const handleRenameDatasetClick = (e: React.MouseEvent, id: string, oldName: string) => {
    e.stopPropagation();
    setDatasetNameInput(oldName);
    setEditingDatasetId(id);
    setShowNewDatasetModal(true);
  };

  const submitDatasetForm = async () => {
    if (!datasetNameInput.trim()) return;
    if (editingDatasetId) {
      await renameDataset(editingDatasetId, datasetNameInput.trim().toUpperCase());
    } else {
      const ds = await createDataset(datasetNameInput.trim().toUpperCase());
      setActiveDatasetId(ds.id);
    }
    setShowNewDatasetModal(false);
    await loadDatasets();
  };

  const handleMoveDatasetTop = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await updateDatasetDate(id, Date.now() + 1000);
    await loadDatasets();
  };

  const handleMoveDatasetBottom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const minDate = datasets.length > 0 ? Math.min(...datasets.map(d => d.createdAt)) : Date.now();
    await updateDatasetDate(id, minDate - 1000);
    await loadDatasets();
  };

  const handleDeleteDataset = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Use clear custom ui instead of window.confirm
    await deleteDataset(id);
    await loadDatasets();
  };
  
  const handleDeleteImage = async () => {
    if (selectedImage) {
      await deleteImage(selectedImage.id);
      setSelectedImage(null);
      await loadImages(activeDatasetId!);
      await loadDatasets();
    }
  };

  const handleDeleteSelected = async () => {
    setIsLoading(true);
    for (const id of selectedImageIds) {
      await deleteImage(id);
    }
    setSelectedImageIds(new Set());
    setIsSelectionMode(false);
    setShowDeleteSelectedModal(false);
    if (activeDatasetId) {
      await loadImages(activeDatasetId);
      await loadDatasets();
    }
    setIsLoading(false);
  };

  const handleClear = () => {
    setShowClearAllModal(true);
  };
  
  const confirmClearAll = async () => {
    await clearAll();
    await loadDatasets();
    setImages([]);
    setSelectedImage(null);
    setShowClearAllModal(false);
  };

  // Setup Global Drag & Drop on the window
  useEffect(() => {
    if (!activeDatasetId) return;

    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer && e.dataTransfer.files) {
        await processFiles(e.dataTransfer.files, activeDatasetId);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [activeDatasetId]);

  return (
    <div className="h-screen w-screen flex flex-col p-4 gap-4 box-border overflow-hidden select-none">
      
      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && activeDatasetId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-root-bg/80 backdrop-blur-sm border-2 border-dashed border-accent m-4 flex flex-col items-center justify-center font-mono pointer-events-none"
          >
            <FolderOpen size={64} className="text-accent mb-4" />
            <h2 className="text-2xl text-text-primary tracking-widest mb-2">DROP FILES HERE</h2>
            <p className="text-text-secondary">ADDING TO ACTIVE DATASET</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="flex justify-between items-center shrink-0 h-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-panel-border flex items-center justify-center rounded-sm text-accent">
            <ScatterChart size={18} />
          </div>
          <h1 className="font-sans font-semibold tracking-widest text-lg text-text-primary uppercase mr-8">
            SOLID DESKTOP IMAGE VIEWER
          </h1>
        </div>
        
        <div className="flex items-center gap-8 h-full">
          <div className="flex items-center gap-3 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">CANVAS:</span>
            <div className="flex gap-2 h-full py-1">
              <SolidButton active={canvasBg === 'theme'} onClick={() => setCanvasBg('theme')} className="px-3 py-0 text-[10px]">AUTO</SolidButton>
              <SolidButton active={canvasBg === 'black'} onClick={() => setCanvasBg('black')} className="px-3 py-0 text-[10px]">BLK</SolidButton>
              <SolidButton active={canvasBg === 'white'} onClick={() => setCanvasBg('white')} className="px-3 py-0 text-[10px]">WHT</SolidButton>
              <SolidButton active={canvasBg === 'checker'} onClick={() => setCanvasBg('checker')} className="px-3 py-0 text-[10px]">CHK</SolidButton>
            </div>
          </div>

          <div className="flex items-center gap-3 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">THEME:</span>
            <div className="flex gap-2 h-full py-1">
              <SolidButton active={theme === 'NAVY'} onClick={() => setTheme('NAVY')} className="px-3 py-0 text-[10px]">NAVY</SolidButton>
              <SolidButton active={theme === 'BLACK'} onClick={() => setTheme('BLACK')} className="px-3 py-0 text-[10px]">BLACK</SolidButton>
              <SolidButton active={theme === 'LIGHT'} onClick={() => setTheme('LIGHT')} className="px-3 py-0 text-[10px]">LIGHT</SolidButton>
              <SolidButton active={theme === 'PAPER'} onClick={() => setTheme('PAPER')} className="px-3 py-0 text-[10px]">PAPER</SolidButton>
            </div>
          </div>
          
          <span className="text-xs font-mono text-text-muted ml-4">v1.1.0 OS</span>
          
          <div className="flex items-center gap-2 h-full ml-4 border-l border-panel-border pl-4">
            <SolidButton onClick={() => setSidebarPosition(p => p === 'left' ? 'right' : 'left')} className="px-2" title="TOGGLE SIDEBAR POSITION">
              {sidebarPosition === 'left' ? <PanelLeft size={16} /> : <PanelRight size={16} />}
            </SolidButton>
          </div>
        </div>
      </header>

      <div className={cn("flex flex-1 min-h-0 relative", sidebarVisible ? "gap-4" : "", sidebarPosition === 'right' ? "flex-row-reverse" : "flex-row")}>
        
        {/* Left Sidebar */}
        <aside 
          className={cn(
            "flex flex-col gap-4 shrink-0 transition-all duration-300",
            sidebarVisible ? "w-[340px]" : "w-0 overflow-hidden opacity-0"
          )}
        >
          
          <Panel title="01 FORMATION ENGINE" className="shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <SolidButton 
                active={viewMode === 'grid-sq'} 
                onClick={() => setViewMode('grid-sq')}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="GRID: SQUARE"
              >
                <LayoutGrid size={14} /> SQUARE
              </SolidButton>
              <SolidButton 
                active={viewMode === 'grid-ma'} 
                onClick={() => setViewMode('grid-ma')}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="GRID: MASONRY"
              >
                <LayoutGrid size={14} /> MASONRY
              </SolidButton>
              <SolidButton 
                active={viewMode === 'list'} 
                onClick={() => setViewMode('list')}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="DATA LIST"
              >
                <List size={14} /> LIST
              </SolidButton>
              <SolidButton 
                active={viewMode === 'free'} 
                onClick={() => setViewMode('free')}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="FREE SCATTER"
              >
                <ScatterChart size={14} /> SCATTER
              </SolidButton>
            </div>
            
            <div className="mt-4 pt-4 border-t border-panel-border flex flex-col gap-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">IMAGE SCALE</span>
                <span className="text-[10px] font-mono text-accent">{itemScale} PX</span>
              </div>
              <input 
                type="range" 
                min="60" 
                max="350" 
                value={itemScale} 
                onChange={(e) => setItemScale(Number(e.target.value))}
              />
            </div>
            
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">GRID GAP</span>
                <span className="text-[10px] font-mono text-accent">{gridGap} PX</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="120" 
                value={gridGap} 
                onChange={(e) => setGridGap(Number(e.target.value))}
              />
            </div>
          </Panel>

          <Panel title="02 DATA SETS" className="shrink-0 flex flex-col flex-1 min-h-[200px]" contentClassName="flex flex-col p-4 overflow-hidden gap-3 h-full">
            <div className="flex gap-2 shrink-0">
              <SolidButton onClick={handleAddDatasetClick} className="flex-1 justify-center text-accent">
                + NEW SET
              </SolidButton>
              <SolidButton onClick={() => setDatasetViewMode(v => v === 'list' ? 'dropdown' : 'list')} className="px-3" title="TOGGLE VIEW MODE">
                {datasetViewMode === 'dropdown' ? <List size={16} /> : <ChevronDown size={16} />}
              </SolidButton>
              <SolidButton onClick={handleClear} className="px-3" title="CLEAR DATABASE">
                <Trash2 size={16} />
              </SolidButton>
            </div>
            
            <div className="shrink-0 flex flex-col gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                webkitdirectory="" 
                directory="" 
                multiple 
              />
              <SolidButton onClick={handleReadDirectoryClick} disabled={isLoading || isReadingDirectory || !activeDatasetId} className="w-full text-[10px] relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <FolderOpen size={14} />
                </div>
                <span className="w-full text-center tracking-widest">{isReadingDirectory ? 'READING...' : 'ADD DIR TO SET'}</span>
              </SolidButton>
              <div className="flex justify-between text-[10px] font-mono text-text-muted px-1">
                <span>TOTAL DB IMAGES:</span>
                <span className="text-text-primary">{totalImagesCount}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-panel-border overflow-y-auto flex flex-col gap-1 min-h-[80px] flex-1 scrollbar-dark pr-1">
              {datasetViewMode === 'list' ? datasets.map(ds => (
                <div 
                  key={ds.id}
                  onClick={() => setActiveDatasetId(ds.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-xs font-mono cursor-pointer border transition-colors group min-h-[32px] overflow-hidden shrink-0",
                    activeDatasetId === ds.id 
                      ? "bg-accent/10 border-accent/50 text-accent" 
                      : "border-transparent text-text-secondary hover:bg-panel-border hover:text-text-primary"
                  )}
                >
                  <span className="truncate flex-1 min-w-0 pr-2">{ds.name} <span className="text-text-muted text-[10px] ml-1">({datasetCounts[ds.id] || 0})</span></span>
                  {activeDatasetId === ds.id && (
                    <div className="flex gap-2 shrink-0 bg-transparent items-center">
                      <button 
                        onClick={(e) => handleMoveDatasetTop(e, ds.id)} 
                        className="hover:text-amber-500 opacity-50 hover:opacity-100 transition-opacity"
                        title="MOVE TO TOP"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleMoveDatasetBottom(e, ds.id)} 
                        className="hover:text-amber-500 opacity-50 hover:opacity-100 transition-opacity"
                        title="MOVE TO BOTTOM"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleRenameDatasetClick(e, ds.id, ds.name)} 
                        className="hover:text-amber-500 opacity-50 hover:opacity-100 transition-opacity"
                        title="RENAME DATASET"
                      >
                        [E]
                      </button>
                      <button 
                        onClick={(e) => handleDeleteDataset(e, ds.id)} 
                        className="hover:text-red-500 opacity-50 hover:opacity-100 transition-opacity"
                        title="DELETE DATASET"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )) : (
                <div className="flex flex-col gap-3 h-full">
                  <select 
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 outline-none text-xs font-mono"
                    value={activeDatasetId || ''}
                    onChange={(e) => setActiveDatasetId(e.target.value)}
                  >
                    {datasets.map(ds => (
                      <option key={ds.id} value={ds.id}>{ds.name} ({datasetCounts[ds.id] || 0})</option>
                    ))}
                  </select>
                  {activeDatasetId && (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-text-muted text-[10px]">ACTIONS</span>
                      <div className="flex gap-3 text-text-secondary">
                        <button onClick={(e) => handleMoveDatasetTop(e, activeDatasetId)} title="MOVE TO TOP" className="hover:text-amber-500"><ArrowUp size={14}/></button>
                        <button onClick={(e) => handleMoveDatasetBottom(e, activeDatasetId)} title="MOVE TO BOTTOM" className="hover:text-amber-500"><ArrowDown size={14}/></button>
                        <button onClick={(e) => { const ds = datasets.find(d => d.id === activeDatasetId); if(ds) handleRenameDatasetClick(e, ds.id, ds.name); }} title="RENAME DATASET" className="hover:text-amber-500 font-mono text-xs font-bold">[E]</button>
                        <button onClick={(e) => handleDeleteDataset(e, activeDatasetId)} title="DELETE DATASET" className="hover:text-red-500"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>

        <Panel 
            title="03 TRACK INFO" 
            className="shrink-0 h-[260px] flex flex-col items-center min-w-0 w-full"
            contentClassName="flex flex-col w-full min-w-0 p-4"
          >
            {selectedImage ? (
              <div className="flex flex-col gap-3 h-full w-full min-w-0 overflow-hidden">
                <div className="flex-1 min-h-0 border border-panel-border rounded-sm overflow-hidden relative flex items-center justify-center cursor-pointer group bg-panel-bg w-full" onClick={() => setIsFullscreen(true)}>
                  <div className={cn(
                    "relative flex items-center justify-center w-full h-full absolute inset-0",
                    canvasBg === 'black' ? "bg-black" : canvasBg === 'white' ? "bg-white" : canvasBg === 'checker' ? "bg-checkerboard" : ""
                  )}>
                    <img src={selectedImage.url} className="w-full h-full object-contain block p-2" />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                    <Maximize2 size={24} />
                  </div>
                </div>
                
                <div className="flex flex-col shrink-0 gap-1 w-full mt-auto mb-1 overflow-hidden">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-text-muted text-[10px] uppercase">
                      FILE SIZE: <span className="text-text-primary">{formatBytes(selectedImage.size)}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full gap-2 min-w-0">
                    <span 
                      className="text-text-primary text-[10px] truncate block min-w-0 flex-1" 
                      title={selectedImage.name}
                    >
                      {selectedImage.name}
                    </span>
                    <button 
                      onClick={handleDeleteImage}
                      title="DELETE IMAGE"
                      className="bg-transparent text-text-muted hover:text-red-500 transition-colors rounded-sm flex items-center justify-center shrink-0 w-5 h-5 pointer-events-auto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center font-mono text-text-muted text-xs uppercase tracking-widest text-center">
                AWAITING INITIALIZATION...<br/>SELECT DATA UNIT
              </div>
            )}
          </Panel>

          
        </aside>

        {/* Main Display */}
        <div className="flex-1 min-w-0 relative flex flex-col">
          {/* Sidebar Toggle Pill */}
          <div 
            onClick={() => setSidebarVisible(v => !v)}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center cursor-pointer transition-all duration-300 opacity-50 hover:opacity-100",
              "w-4 h-16 bg-panel-border/80 backdrop-blur-sm text-text-muted hover:text-text-primary rounded-full",
              sidebarPosition === 'left' ? "-left-2" : "-right-2"
            )}
          >
            {sidebarPosition === 'left' ? (sidebarVisible ? <ChevronLeft size={14} /> : <ChevronRight size={14} />) : (sidebarVisible ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
          </div>
          
          <Panel 
            title="04 DATA BANKS" 
            className="flex-1 w-full"
            contentClassName="p-0 transition-colors duration-300 relative"
            headerRight={
              isSelectionMode ? (
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase text-text-primary bg-accent/20 px-2 py-0.5 rounded-sm outline outline-1 outline-accent/50 mr-2 flex items-center gap-1 font-mono">
                  <Check size={12} className="text-accent" /> {selectedImageIds.size} SELECTED
                </span>
                <button
                  onClick={() => setShowDeleteSelectedModal(true)}
                  disabled={selectedImageIds.size === 0}
                  className={cn(
                    "text-[10px] uppercase font-mono tracking-wider transition-colors",
                    selectedImageIds.size > 0 ? "text-red-500 hover:text-red-400" : "text-text-muted cursor-not-allowed"
                  )}
                >
                  DELETE
                </button>
                <button
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedImageIds(new Set());
                  }}
                  className="text-[10px] uppercase font-mono tracking-wider text-text-secondary hover:text-text-primary"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-text-muted mr-1">SORT:</span>
                  {(['name', 'size', 'type', 'date'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => {
                        if (sortField === f) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        else { setSortField(f); setSortOrder('asc'); }
                      }}
                      className={cn(
                        "text-[10px] uppercase font-mono tracking-wider transition-colors",
                        sortField === f ? "text-accent" : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      {f} {sortField === f && (sortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsSelectionMode(true)}
                  className="text-[10px] uppercase font-mono tracking-wider text-accent transition-colors hover:text-accent border border-accent/20 hover:border-accent/50 px-2 py-0.5 rounded-sm flex items-center justify-center bg-accent/5"
                >
                  EDIT
                </button>
                <span className="text-accent pl-2 border-l border-panel-border h-4 flex items-center">{viewMode.toUpperCase()} {viewMode === 'free' ? 'BOARD' : 'VIEW'}</span>
              </div>
            )
          }
          className="flex-1 relative overflow-hidden"
        >
          <div 
            ref={scatterContainerRef}
            className={cn(
            "w-full h-full relative"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className={cn(
                  "w-full h-full absolute inset-0 p-4",
                  (viewMode === 'grid-sq' || viewMode === 'grid-ma' || viewMode === 'list') && "overflow-y-auto overflow-x-hidden pb-8",
                  viewMode === 'free' && "overflow-hidden"
                )}
              >
                <div 
                  className={cn(
                    "w-full h-auto",
                    viewMode === 'grid-sq' && "grid content-start justify-center",
                    viewMode === 'grid-ma' && "flex items-start",
                    viewMode === 'list' && "flex flex-col"
                  )}
                  style={{
                    ...(viewMode === 'grid-sq' ? { gridTemplateColumns: `repeat(auto-fill, minmax(${itemScale}px, 1fr))`, gap: `${gridGap}px` } : {}),
                    ...(viewMode === 'grid-ma' ? { gap: `${gridGap}px` } : {}),
                    ...(viewMode === 'list' ? { gap: `${gridGap}px` } : {})
                  }}
                >
                {(() => {
                  const renderImageCard = (img: ImageRecord, i: number, isSelected: boolean, isMultiSelected: boolean) => (
                    <motion.div
                      key={img.id}
                      layout={viewMode !== 'list'}
                      drag={viewMode === 'free'}
                      dragConstraints={scatterContainerRef}
                      dragElastic={0.1}
                      dragMomentum={true}
                      whileDrag={{ scale: 1.05, zIndex: 100, boxShadow: "0 20px 40px rgba(0,0,0,0.6)" }}
                      whileHover={{ scale: viewMode !== 'free' ? 1.01 : 1.02 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ 
                        opacity: isSelectionMode && !isMultiSelected ? 0.5 : 1, 
                        scale: 1,
                        x: viewMode === 'free' ? undefined : 0,
                        y: viewMode === 'free' ? undefined : 0,
                        rotate: viewMode === 'free' ? img.randomRotation : 0,
                      }}
                      transition={{ 
                        layout: { type: "spring", stiffness: 250, damping: 25 },
                        opacity: { duration: 0.1, delay: isSelectionMode ? 0 : Math.min(i * 0.015, 1.0) },
                        scale: { type: "spring", stiffness: 300, damping: 20, delay: isSelectionMode ? 0 : Math.min(i * 0.015, 1.0) }
                      }}
                      onClick={() => {
                        if (isSelectionMode) {
                          const next = new Set(selectedImageIds);
                          if (next.has(img.id)) next.delete(img.id);
                          else next.add(img.id);
                          setSelectedImageIds(next);
                        } else {
                          setSelectedImage(img);
                        }
                      }}
                      onDoubleClick={() => {
                        if (isSelectionMode) return;
                        setSelectedImage(img);
                        setIsFullscreen(true);
                      }}
                      className={cn(
                        "cursor-pointer overflow-hidden border min-w-0 min-h-0 relative transition-colors rounded-none bg-panel-bg",
                        isSelected || isMultiSelected ? "border-accent shadow-[0_0_15px_var(--color-accent-glow)] z-10" : "border-panel-border hover:border-text-secondary z-0",
                        viewMode === 'grid-ma' && "w-full",
                        viewMode === 'grid-sq' && "w-full aspect-square flex items-center justify-center",
                        viewMode === 'free' && "absolute shadow-xl",
                        viewMode === 'list' && "w-full flex items-center px-4 shrink-0 gap-4"
                      )}
                      style={viewMode === 'free' ? {
                        width: itemScale,
                        height: itemScale,
                        left: `calc(50% + ${img.randomX}%)`,
                        top: `calc(50% + ${img.randomY}%)`,
                        margin: `-${itemScale/2}px 0 0 -${itemScale/2}px`,
                        zIndex: isSelected ? 50 : 1
                      } : viewMode === 'list' ? {
                        height: Math.max(48, itemScale * 0.8),
                        width: "100%",
                        zIndex: isSelected ? 50 : 1
                      } : viewMode === 'grid-ma' ? {
                        width: "100%",
                        height: "auto",
                        zIndex: isSelected ? 50 : 1
                      } : {
                        width: "100%",
                        height: "auto",
                        zIndex: isSelected ? 50 : 1
                      }}
                    >
                      {viewMode === 'list' ? (
                        <>
                          <div 
                            className="shrink-0 border border-panel-border overflow-hidden flex items-center justify-center bg-panel-bg"
                            style={{ width: Math.max(32, itemScale * 0.65), height: Math.max(32, itemScale * 0.65) }}
                          >
                            <div className={cn(
                              "relative flex items-center justify-center max-w-full max-h-full",
                              canvasBg === 'black' ? "bg-black" : canvasBg === 'white' ? "bg-white" : canvasBg === 'checker' ? "bg-checkerboard" : ""
                            )}>
                              <img src={img.url} draggable={false} className="max-w-full max-h-full block" />
                            </div>
                          </div>
                          <div className="font-mono text-sm flex-1 truncate text-text-primary px-2">{img.name}</div>
                          <div className="font-mono text-sm text-text-muted w-24 text-right shrink-0">{formatBytes(img.size)}</div>
                        </>
                      ) : (
                        <div className={cn(
                          "w-full relative flex items-center justify-center group overflow-hidden bg-panel-bg",
                          viewMode === 'grid-sq' && "h-full"
                        )}>
                          <div className={cn(
                            "relative flex items-center justify-center w-full h-full transition-transform duration-500 will-change-transform group-hover:scale-105",
                            canvasBg === 'black' ? "bg-black" : canvasBg === 'white' ? "bg-white" : canvasBg === 'checker' ? "bg-checkerboard" : ""
                          )}>
                            <img src={img.url} draggable={false} className={cn(
                              "block",
                              viewMode === 'grid-sq' || viewMode === 'free' ? "max-w-full max-h-full object-contain" : "w-full h-auto"
                            )} />
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                      )}
                    </motion.div>
                  );

                  if (viewMode === 'grid-ma') {
                    return masonryColumns.map((col, colIdx) => (
                      <div key={colIdx} className="flex flex-col flex-1 min-w-0" style={{ gap: `${gridGap}px` }}>
                        {col.map((img) => {
                          const isSelected = selectedImage?.id === img.id;
                          const isMultiSelected = isSelectionMode && selectedImageIds.has(img.id);
                          const globalIdx = sortedImages.findIndex(sim => sim.id === img.id);
                          return renderImageCard(img, globalIdx, isSelected, isMultiSelected);
                        })}
                      </div>
                    ));
                  }

                  return sortedImages.map((img, i) => {
                    const isSelected = selectedImage?.id === img.id;
                    const isMultiSelected = isSelectionMode && selectedImageIds.has(img.id);
                    return renderImageCard(img, i, isSelected, isMultiSelected);
                  });
                })()}
                </div>
                {sortedImages.length === 0 && !isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted font-mono text-xs pointer-events-none">
                    <ImageIcon size={48} className="mb-4 opacity-20" />
                    NO DATA IN INDEX
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Panel>
        </div>

      </div>

      {/* Fullscreen Modal overlay */}
      <AnimatePresence>
        {isFullscreen && selectedImage && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(10px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="fixed inset-0 z-50 bg-root-bg/80 flex items-center justify-center p-8"
            onClick={() => setIsFullscreen(false)}
          >
            <motion.div 
              layoutId={selectedImage.id} // Seamless expand
              className="relative w-full h-full max-w-[95vw] max-h-[95vh] rounded-none overflow-hidden border border-panel-border shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center bg-panel-bg"
              onClick={e => e.stopPropagation()}
            >
              <div className={cn(
                "relative flex items-center justify-center w-full h-full",
                canvasBg === 'black' ? "bg-black" : canvasBg === 'white' ? "bg-white" : canvasBg === 'checker' ? "bg-checkerboard" : ""
              )}>
                <img src={selectedImage.url} className="w-full h-full object-contain block" />
              </div>
              
              {/* Overlay Meta */}
              <div className="absolute top-0 left-0 p-3 pointer-events-none max-w-[80%]">
                <h2 className="font-mono text-[8px] md:text-[9px] font-bold text-white mb-0.5 truncate drop-shadow-md">{selectedImage.name}</h2>
                <div className="font-mono text-white/70 text-[8px] flex gap-3 drop-shadow-md">
                  <span>{formatBytes(selectedImage.size)}</span>
                  <span>{selectedImage.type}</span>
                </div>
              </div>

              {/* Close Button */}
              <button 
                onClick={() => setIsFullscreen(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-black/50 hover:bg-accent border border-white/20 text-white flex items-center justify-center rounded-none transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New/Rename Dataset Modal */}
      <AnimatePresence>
        {showNewDatasetModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[400px]">
              <h2 className="text-text-primary mb-4 uppercase">{editingDatasetId ? 'RENAME DATASET' : 'NEW DATASET'}</h2>
              <input 
                autoFocus
                type="text" 
                value={datasetNameInput}
                onChange={e => setDatasetNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitDatasetForm()}
                className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 mb-6 outline-none focus:border-accent"
                placeholder="ENTER NAME..."
              />
              <div className="flex justify-end gap-3">
                <SolidButton onClick={() => setShowNewDatasetModal(false)} className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none">
                  CANCEL
                </SolidButton>
                <SolidButton onClick={submitDatasetForm} className="text-accent hover:text-accent">
                  CONFIRM
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear All Modal */}
      <AnimatePresence>
        {showClearAllModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2"><Trash2 size={20} /> CLEAR ENTIRE DATABASE</h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                Warning: This will delete all datasets and all {totalImagesCount} stored images. This action cannot be undone. Are you sure?
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton onClick={() => setShowClearAllModal(false)} className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none">
                  CANCEL
                </SolidButton>
                <button 
                  onClick={confirmClearAll} 
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 font-bold uppercase transition-colors outline-none"
                >
                  CONFIRM CLEAR
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Selected Modal */}
      <AnimatePresence>
        {showDeleteSelectedModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2"><Trash2 size={20} /> DELETE SELECTED IMAGES</h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                Warning: This will delete {selectedImageIds.size} selected image(s) from the database. This action cannot be undone. Are you sure?
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton onClick={() => setShowDeleteSelectedModal(false)} className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none">
                  CANCEL
                </SolidButton>
                <button 
                  onClick={handleDeleteSelected} 
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 font-bold uppercase transition-colors outline-none"
                >
                  CONFIRM
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="flex justify-between text-[10px] font-mono text-text-muted uppercase tracking-widest shrink-0">
        <span>SYSTEM_READY_</span>
        <span>ENGINE IDLE</span>
      </footer>

    </div>
  );
}
