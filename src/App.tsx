import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useAnimation,
  useMotionValue,
  Reorder,
} from "motion/react";
import JSZip from "jszip";
import {
  Download,
  ZoomIn,
  ZoomOut,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  ScatterChart,
  Trash2,
  Maximize,
  Minimize,
  GripVertical,
  X,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  ChevronsDown,
  Check,
  PanelLeft,
  PanelRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RotateCw,
  RefreshCw,
  MonitorSmartphone,
  Edit2,
  Search,
  FlipHorizontal,
  Palette,
  Star,
  Smartphone,
  RectangleHorizontal,
  ExternalLink,
  Eye,
  EyeOff,
  Play,
  Pause,
  Square,
  AlertTriangle,
  Bookmark,
  Pin,
  FolderPlus,
  Layers,
  Terminal,
  Settings,
  Sliders,
} from "lucide-react";
import {
  ImageRecord,
  DatasetRecord,
  CategoryRecord,
  getAllDatasets,
  createDataset,
  deleteDataset,
  getImagesByDataset,
  getFirstImageOfDataset,
  getCoverImageOfDataset,
  updateDatasetCoverImage,
  updateDatasetCoverPosition,
  updateDatasetPinned,
  getAllImages,
  storeImages,
  clearAll,
  deleteImage,
  updateImagesVisibility,
  renameImage,
  updateImagesDataset,
  copyImagesToDataset,
  renameDataset,
  getTotalImageCount,
  getImageCountByDataset,
  updateDatasetDate,
  updateImagesOrder,
  getAllCategories,
  createCategory,
  renameCategory,
  updateCategoryParent,
  deleteCategory,
  updateCategoryColor,
  updateCategoryCoverPosition,
  updateCategoriesOrder,
  updateDatasetsOrder,
  updateDatasetCategory,
} from "./lib/db";
import { Panel, SolidButton } from "./components/ui";
import { CategoryTree } from "./components/CategoryTree";
import { CategoryExplorer } from "./components/CategoryExplorer";
import { cn } from "./lib/utils";
import { ReactSortable } from "react-sortablejs";

type ViewMode = "grid-sq" | "grid-ma" | "list" | "free";

interface ImageMetadata {
  bg: "black" | "white" | "checkerboard";
  width: number;
  height: number;
}

const analyzeImageBlob = async (blob: Blob): Promise<ImageMetadata> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const originalWidth = img.width || 1;
      const originalHeight = img.height || 1;
      const fallback = { bg: "checkerboard" as const, width: originalWidth, height: originalHeight };
      const resolveBg = (bg: "black" | "white" | "checkerboard") => resolve({ bg, width: originalWidth, height: originalHeight });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(fallback);

      const MAX_SIZE = 64;
      let width = img.width;
      let height = img.height;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      if (width === 0 || height === 0) return resolve(fallback);
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const imageData = ctx.getImageData(0, 0, width, height).data;
        let transparentCount = 0;
        let totalBrightness = 0;
        let nonTransparentCount = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const a = imageData[i + 3];
          if (a < 250) {
            transparentCount++;
          }
          if (a > 10) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += lum;
            nonTransparentCount++;
          }
        }

        const avgBrightness = nonTransparentCount > 0 ? totalBrightness / nonTransparentCount : 128;
        const totalPixels = width * height;
        const isMostlyTransparent = (transparentCount / totalPixels) > 0.05;
        
        if (isMostlyTransparent) {
          // For transparent images (logos/marks), we want contrast against the mark.
          // If mark is bright, use black canvas. If mark is dark, use white canvas.
          return resolveBg(avgBrightness > 128 ? "black" : "white");
        } else {
          // For opaque images, we want the canvas to blend with the background.
          // The background dominates the average brightness.
          return resolveBg(avgBrightness > 128 ? "white" : "black");
        }
      } catch (e) {
        resolve(fallback);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ bg: "checkerboard", width: 1, height: 1 });
    };
    img.src = url;
  });
};

interface LoadedImage extends ImageRecord {
  url: string;
  randomX: number;
  randomY: number;
  randomRotation: number;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};


const getFilesFromDataTransferItems = async (items: DataTransferItemList) => {
  const files: File[] = [];
  const queue: any[] = [];
  const folderNames = new Set<string>();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        queue.push(entry);
        if (entry.isDirectory) {
          folderNames.add(entry.name);
        }
      } else {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  
  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => entry.file(resolve));
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      let allEntries: any[] = [];
      
      const readAll = async () => {
        return new Promise<any[]>((resolve) => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length > 0) {
              allEntries.push(...entries);
              await readAll();
            }
            resolve(allEntries);
          });
        });
      };
      
      await readAll();
      queue.push(...allEntries);
    }
  }
  
  return { files, folderNames: Array.from(folderNames) };
};

export default function App() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetCounts, setDatasetCounts] = useState<Record<string, number>>(
    {},
  );
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("app_expandedCategoryIds");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(() => {
    const saved = localStorage.getItem("app_activeCategoryId");
    return saved || null;
  });
  const [isCategoryImagesView, setIsCategoryImagesView] = useState(false);

  // Category Modals and DnD
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryRecord | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [draggedDatasetId, setDraggedDatasetId] = useState<string | null>(null);
  const [targetCategoryIdForNewDataset, setTargetCategoryIdForNewDataset] = useState<string | null>(null);

  // Move Modal State (For Category and Dataset move selection)
  const [showMoveItemModal, setShowMoveItemModal] = useState(false);
  const [itemToMove, setItemToMove] = useState<{
    type: "category" | "dataset";
    item: CategoryRecord | DatasetRecord;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem("app_expandedCategoryIds", JSON.stringify(Array.from(expandedCategoryIds)));
  }, [expandedCategoryIds]);

  useEffect(() => {
    if (activeCategoryId) {
      localStorage.setItem("app_activeCategoryId", activeCategoryId);
    } else {
      localStorage.removeItem("app_activeCategoryId");
    }
  }, [activeCategoryId]);

  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(() => {
    const saved = localStorage.getItem("app_activeDatasetId");
    if (saved === "all") return null;
    return saved || null;
  });

  useEffect(() => {
    if (activeDatasetId && activeDatasetId !== "all") {
      localStorage.setItem("app_activeDatasetId", activeDatasetId);
    } else {
      localStorage.removeItem("app_activeDatasetId");
    }
  }, [activeDatasetId]);
  const [datasetViewMode, setDatasetViewMode] = useState<"list" | "dropdown">(
    "list",
  );

  const [images, setImages] = useState<LoadedImage[]>([]);
  const [showHiddenImages, setShowHiddenImages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const total = datasets
      .reduce((acc, ds) => acc + (datasetCounts[ds.id] || 0), 0);
    setTotalImagesCount(total);
  }, [datasets, datasetCounts]);

  const [searchInput, setSearchInput] = useState("");
  const [totalImagesCount, setTotalImagesCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("app_viewMode");

  return (saved as ViewMode) || "grid-sq";
  });
  const [openAction, setOpenAction] = useState<"click" | "dblclick">(() => {
    const saved = localStorage.getItem("app_openAction");

  return (saved as "click" | "dblclick") || "dblclick";
  });
  const [appFont, setAppFont] = useState<"GOTHIC" | "MARU" | "MEIRYO" | "MONO">(() => {
    const saved = localStorage.getItem("app_font");

  return (saved as "GOTHIC" | "MARU" | "MEIRYO" | "MONO") || "GOTHIC";
  });

  useEffect(() => {
    localStorage.setItem("app_font", appFont);
    document.documentElement.setAttribute("data-font", appFont);
  }, [appFont]);

  const [theme, setTheme] = useState<"NAVY" | "BLACK" | "TRUE_BLACK" | "RED" | "LIGHT" | "PAPER">(
    () => {
      const saved = localStorage.getItem("app_theme");

  return (saved as "NAVY" | "BLACK" | "TRUE_BLACK" | "RED" | "LIGHT" | "PAPER") || "BLACK";
    }
  );
  const [canvasBg, setCanvasBg] = useState<
    "theme" | "black" | "white" | "checker"
  >("white");
  const cycleTheme = () => {
    const themes: Array<"NAVY" | "BLACK" | "TRUE_BLACK" | "RED" | "LIGHT" | "PAPER"> = ["NAVY", "BLACK", "TRUE_BLACK", "RED", "LIGHT", "PAPER"];
    setTheme((prev) => themes[(themes.indexOf(prev as any) + 1) % themes.length]);
  };

  const [sortField, setSortField] = useState<"name" | "size" | "type" | "date" | "custom" | "random">(
    "name",
  );
  const [orientationFilter, setOrientationFilter] = useState<"all" | "portrait" | "landscape">("all");
  const [randomSeed, setRandomSeed] = useState(0);
  const [sortOrders, setSortOrders] = useState<Record<string, "asc" | "desc">>({
    name: "asc",
    size: "desc",
    type: "asc",
    date: "desc",
    custom: "asc",
  });
  const [scales, setScales] = useState<Record<string, number>>({
    "grid-sq": 140,
    "grid-ma": 140,
    list: 140,
    free: 140,
  });
  const [gaps, setGaps] = useState<Record<string, number>>({
    "grid-sq": 24,
    "grid-ma": 24,
    list: 0,
    free: 0,
  });

  useEffect(() => {
    if (activeDatasetId) {
      const savedScales = localStorage.getItem(`app_scales_${activeDatasetId}`);
      if (savedScales) {
        setScales(JSON.parse(savedScales));
      } else {
        setScales({
          "grid-sq": 140,
          "grid-ma": 140,
          list: 140,
          free: 140,
        });
      }

      const savedGaps = localStorage.getItem(`app_gaps_${activeDatasetId}`);
      if (savedGaps) {
        setGaps(JSON.parse(savedGaps));
      } else {
        setGaps({
          "grid-sq": 24,
          "grid-ma": 24,
          list: 0,
          free: 0,
        });
      }

      const savedCanvasBg = localStorage.getItem(`app_canvasBg_${activeDatasetId}`);
      if (savedCanvasBg) {
        setCanvasBg(savedCanvasBg as any);
      } else {
        setCanvasBg("white");
      }

      const savedSortField = localStorage.getItem(`app_sortField_${activeDatasetId}`);
      if (savedSortField) {
        setSortField(savedSortField as any);
      } else {
        setSortField("name");
      }

      const savedSortOrders = localStorage.getItem(`app_sortOrders_${activeDatasetId}`);
      if (savedSortOrders) {
        try {
          setSortOrders({
            name: "asc",
            size: "desc",
            type: "asc",
            date: "desc",
            custom: "asc",
            ...JSON.parse(savedSortOrders)
          });
        } catch(e) {
          // ignore
        }
      } else {
        setSortOrders({
          name: "asc",
          size: "desc",
          type: "asc",
          date: "desc",
          custom: "asc",
        });
      }

      const savedRandomSeed = localStorage.getItem(`app_randomSeed_${activeDatasetId}`);
      if (savedRandomSeed) {
        setRandomSeed(parseInt(savedRandomSeed, 10));
      } else {
        setRandomSeed(0);
      }
    }
  }, [activeDatasetId]);

  useEffect(() => {
    localStorage.setItem("app_viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("app_openAction", openAction);
  }, [openAction]);

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem(`app_scales_${activeDatasetId}`, JSON.stringify(scales));
    }
  }, [scales, activeDatasetId]);

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem(`app_gaps_${activeDatasetId}`, JSON.stringify(gaps));
    }
  }, [gaps, activeDatasetId]);

  useEffect(() => {
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem(`app_canvasBg_${activeDatasetId}`, canvasBg);
    }
  }, [canvasBg, activeDatasetId]);

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem(`app_sortField_${activeDatasetId}`, sortField);
    }
  }, [sortField, activeDatasetId]);

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem(`app_sortOrders_${activeDatasetId}`, JSON.stringify(sortOrders));
    }
  }, [sortOrders, activeDatasetId]);

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem(`app_randomSeed_${activeDatasetId}`, randomSeed.toString());
    }
  }, [randomSeed, activeDatasetId]);

  const scaleKey = orientationFilter === "all" ? viewMode : `${viewMode}-${orientationFilter}`;
  const itemScale = scales[scaleKey] ?? scales[viewMode] ?? 140;
  const gridGap = gaps[scaleKey] ?? gaps[viewMode] ?? 24;

  const setItemScale = (val: number) => {
    setScales((prev) => ({ ...prev, [scaleKey]: val }));
  };

  const setGridGap = (val: number) => {
    setGaps((prev) => ({ ...prev, [scaleKey]: val }));
  };

  const [selectedImage, setSelectedImage] = useState<LoadedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [isReadingDirectory, setIsReadingDirectory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenUI, setShowFullscreenUI] = useState(true);
  const [fullscreenScale, setFullscreenScale] = useState(1);
  const [fullscreenRotation, setFullscreenRotation] = useState(0);
  const [fullscreenFlipX, setFullscreenFlipX] = useState(false);
  const imgControls = useAnimation();
  const imgX = useMotionValue(0);
  const imgY = useMotionValue(0);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingFullscreenNav = useRef<{ direction: "next" | "prev"; datasetId: string } | null>(null);

  // Auto Scroll States & Loop
  const [autoScrollDir, setAutoScrollDir] = useState<"up" | "down" | null>(null);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(2);
  const autoScrollDirRef = useRef<"up" | "down" | null>(null);
  const lastAutoScrollDirRef = useRef<"up" | "down">("down");

  useEffect(() => {
    autoScrollDirRef.current = autoScrollDir;
    if (autoScrollDir) {
      lastAutoScrollDirRef.current = autoScrollDir;
    }
  }, [autoScrollDir]);

  useEffect(() => {
    if (!autoScrollDir) return;
    let animId: number;
    let lastTime = performance.now();

    // 速度 (1x: 100px/s, 2x: 250px/s, 3x: 500px/s, 4x: 1000px/s)
    const baseSpeed =
      autoScrollSpeed === 1 ? 100 : autoScrollSpeed === 2 ? 250 : autoScrollSpeed === 3 ? 500 : 1000;
    const dirFactor = autoScrollDir === "down" ? 1 : -1;

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      if (scrollContainerRef.current) {
        const el = scrollContainerRef.current;
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollBy({ top: dirFactor * baseSpeed * delta, behavior: "auto" });

        // 端に到達したら停止
        if (
          (autoScrollDir === "down" && el.scrollTop >= maxScroll - 1) ||
          (autoScrollDir === "up" && el.scrollTop <= 1)
        ) {
          setAutoScrollDir(null);
          return;
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [autoScrollDir, autoScrollSpeed]);

  // Fullscreen Slideshow States
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [slideshowDirection, setSlideshowDirection] = useState<"fwd" | "rev">("fwd");
  const [slideshowIntervalSec, setSlideshowIntervalSec] = useState<number>(3);

  const zoomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startZoomIn = React.useCallback(() => {
    if (zoomIntervalRef.current || zoomTimeoutRef.current) return;
    setFullscreenScale((s) => {
      const newScale = Math.min(s + 0.025, 10);
      imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
      return newScale;
    });
    zoomTimeoutRef.current = setTimeout(() => {
      zoomIntervalRef.current = setInterval(() => {
        setFullscreenScale((s) => {
          const newScale = Math.min(s + 0.025, 10);
          imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          return newScale;
        });
      }, 20);
    }, 300);
  }, [imgControls]);

  const startZoomOut = React.useCallback(() => {
    if (zoomIntervalRef.current || zoomTimeoutRef.current) return;
    setFullscreenScale((s) => {
      const newScale = Math.max(0.1, s - 0.025);
      if (newScale <= 1) imgControls.start({ x: 0, y: 0, scale: newScale, transition: { duration: 0.05, ease: "linear" } });
      else imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
      return newScale;
    });
    zoomTimeoutRef.current = setTimeout(() => {
      zoomIntervalRef.current = setInterval(() => {
        setFullscreenScale((s) => {
          const newScale = Math.max(0.1, s - 0.025);
          if (newScale <= 1) imgControls.start({ x: 0, y: 0, scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          else imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          return newScale;
        });
      }, 20);
    }, 300);
  }, [imgControls]);

  const stopZooming = React.useCallback(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = null;
    }
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  }, []);


  useEffect(() => {
    setFullscreenScale(1);
    setFullscreenRotation(0);
    setFullscreenFlipX(false);
    imgX.set(0);
    imgY.set(0);
    imgControls.start({ x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0 });
    setImgDims({ w: 0, h: 0 });
  }, [isFullscreen, imgControls, imgX, imgY]);

  // When selectedImage changes (next/prev image), reset only image dimensions and wait for the onLoad trigger
  useEffect(() => {
    setImgDims({ w: 0, h: 0 });
  }, [selectedImage]);



  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">(
    "left",
  );
  const [sidebarVisible, setSidebarVisible] = useState(true);
    const [language, setLanguage] = useState<"EN" | "JP">("EN");
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<"add" | "new" | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [portraitMode, setPortraitMode] = useState<"off" | "left" | "right">("off");

  const handleToggleZoomFill = React.useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!imgDims.w || !imgDims.h) return;
    
    const cW = (portraitMode !== "off" ? window.innerHeight : window.innerWidth);
    const cH = (portraitMode !== "off" ? window.innerWidth : window.innerHeight);
    
    const aspectImg = imgDims.w / imgDims.h;
    const aspectScreen = cW / cH;
    let renderedW = cW;
    let renderedH = cH;
    if (aspectImg > aspectScreen) {
      renderedH = cW / aspectImg;
    } else {
      renderedW = cH * aspectImg;
    }
    
    let targetScaleX = cW / renderedW;
    let targetScaleY = cH / renderedH;

    const isRotated = Math.abs(fullscreenRotation % 180) === 90;
    if (isRotated) {
      // visually the width is renderedH, and height is renderedW
      targetScaleX = cW / renderedH;
      targetScaleY = cH / renderedW;
    }
    
    const targetScale = Math.max(targetScaleX, targetScaleY);

    if (fullscreenScale > 1.01) {
       // currently zoomed to fill, return to 1 (object-contain)
       setFullscreenScale(1);
       imgControls.start({ x: 0, y: 0, scale: 1, transition: { duration: 0.2, ease: "easeOut" } });
    } else {
       // zoom to fill
       setFullscreenScale(targetScale);
       imgControls.start({ x: 0, y: 0, scale: targetScale, transition: { duration: 0.2, ease: "easeOut" } });
    }
  }, [imgDims, portraitMode, isAppFullscreen, fullscreenScale, imgControls, fullscreenRotation]);
  const isPortraitMode = portraitMode !== "off";
  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Preserve scale and rotation across image switch, and clamp x/y position to the new image bounds once loaded
  useEffect(() => {
    if (isFullscreen && imgDims.w > 0 && imgDims.h > 0) {
      const currentCW = typeof window !== "undefined" ? (isPortraitMode ? window.innerHeight : window.innerWidth) : 1000;
      const currentCH = typeof window !== "undefined" ? (isPortraitMode ? window.innerWidth : window.innerHeight) : 1000;

      const aspectImg = imgDims.w / imgDims.h;
      const aspectScreen = currentCW / currentCH;
      let renderedW, renderedH;
      if (aspectImg > aspectScreen) {
        renderedW = currentCW;
        renderedH = currentCW / aspectImg;
      } else {
        renderedH = currentCH;
        renderedW = currentCH * aspectImg;
      }
      const scaledW = renderedW * fullscreenScale;
      const scaledH = renderedH * fullscreenScale;
      const rotW = Math.abs(fullscreenRotation % 180) === 90 ? scaledH : scaledW;
      const rotH = Math.abs(fullscreenRotation % 180) === 90 ? scaledW : scaledH;
      const mX = Math.max(0, (rotW - currentCW) / 2);
      const mY = Math.max(0, (rotH - currentCH) / 2);

      let currentX = imgX.get();
      let currentY = imgY.get();

      if (fullscreenScale <= 1.0) {
        currentX = 0;
        currentY = 0;
      } else {
        if (currentX > mX) currentX = mX;
        if (currentX < -mX) currentX = -mX;
        if (currentY > mY) currentY = mY;
        if (currentY < -mY) currentY = -mY;
      }

      imgX.set(currentX);
      imgY.set(currentY);
      imgControls.start({
        scale: fullscreenScale,
        rotate: fullscreenRotation,
        x: currentX,
        y: currentY,
        transition: { duration: 0 }
      });
    }
  }, [imgDims, isFullscreen, imgControls, portraitMode, isAppFullscreen]);

  const showNotification = (msg: string) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setNotification(msg);
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsAppFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

  return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleAppFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };

  const [moveTargetId, setMoveTargetId] = useState<string>("");
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [showDeleteDatasetModal, setShowDeleteDatasetModal] = useState(false);
  const [showDeleteImageModal, setShowDeleteImageModal] = useState(false);
  const [imageToDeleteContext, setImageToDeleteContext] = useState<'selected' | 'fullscreen' | null>(null);
  const [datasetToDelete, setDatasetToDelete] = useState<string | null>(null);
  const [overwriteFiles, setOverwriteFiles] = useState<{ files: File[], datasetId: string, forceLoad: boolean, existingMap: Map<string, ImageRecord> } | null>(null);
  const [favoriteDatasetId, setFavoriteDatasetId] = useState<string | null>(() => localStorage.getItem("favoriteDatasetId"));
  const [fullscreenFavorited, setFullscreenFavorited] = useState<Set<string>>(new Set());
  const [homeViewMode, setHomeViewMode] = useState<"text" | "popup" | "card" | "cover">(() => {
    const saved = localStorage.getItem("homeViewMode");
    return (saved === "text" || saved === "popup" || saved === "card" || saved === "cover") ? saved : "cover";
  });
  const [datasetPreviewUrls, setDatasetPreviewUrls] = useState<Record<string, string>>({});
  const [hoveredDatasetId, setHoveredDatasetId] = useState<string | null>(null);
  const [popupMousePos, setPopupMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    localStorage.setItem("homeViewMode", homeViewMode);
  }, [homeViewMode]);

  useEffect(() => {
    if (favoriteDatasetId) {
      localStorage.setItem("favoriteDatasetId", favoriteDatasetId);
    } else {
      localStorage.removeItem("favoriteDatasetId");
    }
  }, [favoriteDatasetId]);

  // Custom Prompts/Modals because alert/prompt/confirm are unreliable in iframe
  const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
  const [datasetNameInput, setDatasetNameInput] = useState("");
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [showRenameFileModal, setShowRenameFileModal] = useState(false);
  const [fileNameInput, setFileNameInput] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [showAllImageWarningModal, setShowAllImageWarningModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportDatasetIds, setSelectedExportDatasetIds] = useState<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fullscreenContainerRef = React.useRef<HTMLDivElement>(null);

  const scatterContainerRef = React.useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(1000);
  const [containerHeight, setContainerHeight] = useState(800);
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("app_sidebarWidth");
    return saved ? Math.max(300, parseInt(saved, 10)) : 300;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  
  useEffect(() => {
    localStorage.setItem("app_sidebarWidth", sidebarWidth.toString());
  }, [sidebarWidth]);

  const [sidebarOrder, setSidebarOrder] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebarOrder");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [{ id: "formation" }, { id: "datasets" }, { id: "trackInfo" }];
  });
  const [isFormationExpanded, setIsFormationExpanded] = useState(() => {
    const saved = localStorage.getItem("isFormationExpanded");
    return saved ? saved === "true" : true;
  });
  const [isDataSetsExpanded, setIsDataSetsExpanded] = useState(() => {
    const saved = localStorage.getItem("isDataSetsExpanded");
    return saved ? saved === "true" : true;
  });
  const [isTrackInfoCollapsed, setIsTrackInfoCollapsed] = useState(() => {
    const saved = localStorage.getItem("isTrackInfoCollapsed");
    return saved ? saved === "true" : true;
  });
  const [bottomPanelTab, setBottomPanelTab] = useState<"command" | "settings">(() => {
    return (localStorage.getItem("bottomPanelTab") as "command" | "settings") || "command";
  });
  type AppTheme = "NAVY" | "BLACK" | "TRUE_BLACK" | "RED" | "LIGHT" | "PAPER";
  const DEFAULT_THEME_FOLDER_COLORS: Record<AppTheme, string> = {
    NAVY: "#fbbf24",
    LIGHT: "#d97706",
    PAPER: "#d94f26",
    BLACK: "#fbbf24",
    TRUE_BLACK: "#fbbf24",
    RED: "#f87171",
  };
  const [themeFolderColors, setThemeFolderColors] = useState<Record<AppTheme, string>>(() => {
    const saved = localStorage.getItem("theme_folder_colors");
    if (saved) {
      try {
        return {
          NAVY: "#fbbf24",
          LIGHT: "#d97706",
          PAPER: "#d94f26",
          BLACK: "#fbbf24",
          TRUE_BLACK: "#fbbf24",
          RED: "#f87171",
          ...JSON.parse(saved),
        };
      } catch (e) {}
    }
    return {
      NAVY: "#fbbf24",
      LIGHT: "#d97706",
      PAPER: "#d94f26",
      BLACK: "#fbbf24",
      TRUE_BLACK: "#fbbf24",
      RED: "#f87171",
    };
  });
  const [colorCategoryModalTarget, setColorCategoryModalTarget] = useState<CategoryRecord | null>(null);
  const [colorCategoryInput, setColorCategoryInput] = useState<string>("#fbbf24");
  const [mainBgColorOverride, setMainBgColorOverride] = useState<string>(() => {
    return localStorage.getItem("main_bg_color_override") || "default";
  });
  const [coverOpacity, setCoverOpacity] = useState<number>(() => {
    const saved = localStorage.getItem("cover_opacity");
    return saved ? parseInt(saved, 10) : 30;
  });
  const [coverBlur, setCoverBlur] = useState<boolean>(() => {
    return localStorage.getItem("cover_blur") === "true"; // Default is false (clear)
  });

  useEffect(() => {
    localStorage.setItem("sidebarOrder", JSON.stringify(sidebarOrder));
  }, [sidebarOrder]);
  useEffect(() => {
    localStorage.setItem("isFormationExpanded", String(isFormationExpanded));
  }, [isFormationExpanded]);
  useEffect(() => {
    localStorage.setItem("isDataSetsExpanded", String(isDataSetsExpanded));
  }, [isDataSetsExpanded]);
  useEffect(() => {
    localStorage.setItem("isTrackInfoCollapsed", String(isTrackInfoCollapsed));
  }, [isTrackInfoCollapsed]);
  useEffect(() => {
    localStorage.setItem("bottomPanelTab", bottomPanelTab);
  }, [bottomPanelTab]);

  useEffect(() => {
    const curColor = themeFolderColors[theme] || DEFAULT_THEME_FOLDER_COLORS[theme] || "#fbbf24";
    document.documentElement.style.setProperty("--folder-icon-color", curColor);
    localStorage.setItem("theme_folder_colors", JSON.stringify(themeFolderColors));
  }, [theme, themeFolderColors]);

  useEffect(() => {
    if (mainBgColorOverride && mainBgColorOverride !== "default") {
      document.documentElement.style.setProperty("--color-root-bg", mainBgColorOverride);
    } else {
      document.documentElement.style.removeProperty("--color-root-bg");
    }
    localStorage.setItem("main_bg_color_override", mainBgColorOverride);
  }, [mainBgColorOverride]);

  useEffect(() => {
    const baseOp = coverOpacity / 100;
    const hoverOp = Math.min(1, baseOp + 0.15);
    document.documentElement.style.setProperty("--cover-base-op", String(baseOp));
    document.documentElement.style.setProperty("--cover-hover-op", String(hoverOp));
    localStorage.setItem("cover_opacity", String(coverOpacity));
  }, [coverOpacity]);

  useEffect(() => {
    if (coverBlur) {
      document.documentElement.style.setProperty("--cover-blur-filter", "blur(1.5px)");
    } else {
      document.documentElement.style.setProperty("--cover-blur-filter", "none");
    }
    localStorage.setItem("cover_blur", String(coverBlur));
  }, [coverBlur]);

  useEffect(() => {
    if (!scatterContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
        setContainerHeight(entries[0].contentRect.height);
      }
    });
    observer.observe(scatterContainerRef.current);

  return () => observer.disconnect();
  }, []);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load from DB on mount
  const t = (en: string, jp: string) => (language === "JP" ? jp : en);

  useEffect(() => {
    loadDatasets();
  }, []);

  useEffect(() => {
    if (activeDatasetId) {
      setIsCategoryImagesView(false);
      loadImages(activeDatasetId);
    } else if (activeCategoryId && isCategoryImagesView) {
      loadImagesForCategory(activeCategoryId);
    } else {
      setImages([]);
    }
  }, [activeDatasetId, activeCategoryId, isCategoryImagesView]);

  // Load preview thumbnails for datasets when activeDatasetId === null (HOME screen)
  useEffect(() => {
    if (activeDatasetId !== null || datasets.length === 0) return;

    let isMounted = true;
    const fetchPreviews = async () => {
      const newUrls: Record<string, string> = {};
      for (const ds of datasets) {
        try {
          const coverImg = await getCoverImageOfDataset(ds.id, ds.coverImageId);
          if (coverImg && coverImg.data) {
            newUrls[ds.id] = URL.createObjectURL(coverImg.data);
          }
        } catch (err) {
          console.error(`Failed to load preview for dataset ${ds.id}`, err);
        }
      }
      if (isMounted) {
        setDatasetPreviewUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };

    fetchPreviews();

    return () => {
      isMounted = false;
    };
  }, [activeDatasetId, datasets]);

  const handleSetAsCover = async (datasetId: string, targetImage: LoadedImage | ImageRecord) => {
    try {
      const currentDs = datasets.find((d) => d.id === datasetId);
      const isAlreadyCover = currentDs?.coverImageId === targetImage.id;
      const newCoverId = isAlreadyCover ? null : targetImage.id;

      await updateDatasetCoverImage(datasetId, newCoverId);

      setDatasets((prev) =>
        prev.map((d) => (d.id === datasetId ? { ...d, coverImageId: newCoverId || undefined } : d))
      );

      if (newCoverId) {
        const urlToUse = (targetImage as LoadedImage).url || (targetImage.data ? URL.createObjectURL(targetImage.data) : "");
        if (urlToUse) {
          setDatasetPreviewUrls((prev) => ({
            ...prev,
            [datasetId]: urlToUse,
          }));
        }
        showNotification(t("SET AS DATASET COVER IMAGE", "リストのカバー画像に設定しました"));
      } else {
        const firstImg = await getFirstImageOfDataset(datasetId);
        if (firstImg && firstImg.data) {
          setDatasetPreviewUrls((prev) => ({
            ...prev,
            [datasetId]: URL.createObjectURL(firstImg.data),
          }));
        }
        showNotification(t("RESET COVER IMAGE TO DEFAULT", "カバー画像を初期状態（先頭画像）に戻しました"));
      }
    } catch (err) {
      console.error("Failed to set cover image", err);
      showNotification(t("FAILED TO SET COVER IMAGE", "カバー画像の設定に失敗しました"));
    }
  };

  const getCoverPositionStyle = (pos?: "top" | "center" | "bottom"): string => {
    if (pos === "center") return "50% 50%";
    if (pos === "bottom") return "50% 85%";
    return "50% 15%"; // default: TOP (15% from top)
  };

  const handleCycleCoverPosition = async (datasetId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const currentDs = datasets.find((d) => d.id === datasetId);
      const currentPos = currentDs?.coverImagePosition || "top";
      const nextPos: "top" | "center" | "bottom" =
        currentPos === "top" ? "center" : currentPos === "center" ? "bottom" : "top";

      await updateDatasetCoverPosition(datasetId, nextPos);
      setDatasets((prev) =>
        prev.map((d) => (d.id === datasetId ? { ...d, coverImagePosition: nextPos } : d))
      );

      const posLabel =
        nextPos === "top"
          ? t("TOP (HEAD)", "上部寄り")
          : nextPos === "center"
          ? t("CENTER", "中央")
          : t("BOTTOM", "下部寄り");
      showNotification(t(`COVER POSITION: ${posLabel}`, `カバー表示位置: ${posLabel}`));
    } catch (err) {
      console.error("Failed to cycle cover position", err);
    }
  };

  const handleCycleCategoryCoverPosition = async (categoryId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const currentCat = categories.find((c) => c.id === categoryId);
      const currentPos = currentCat?.coverImagePosition || "top";
      const nextPos: "top" | "center" | "bottom" =
        currentPos === "top" ? "center" : currentPos === "center" ? "bottom" : "top";

      await updateCategoryCoverPosition(categoryId, nextPos);
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, coverImagePosition: nextPos } : c))
      );

      const posLabel =
        nextPos === "top"
          ? t("TOP (HEAD)", "上部寄り")
          : nextPos === "center"
          ? t("CENTER", "中央")
          : t("BOTTOM", "下部寄り");
      showNotification(t(`FOLDER COVER POSITION: ${posLabel}`, `フォルダーカバー表示位置: ${posLabel}`));
    } catch (err) {
      console.error("Failed to cycle category cover position", err);
    }
  };

  const handleTogglePinDataset = async (datasetId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const currentDs = datasets.find((d) => d.id === datasetId);
      const newPinned = !currentDs?.isPinned;
      await updateDatasetPinned(datasetId, newPinned);

      await loadDatasets();

      if (newPinned) {
        showNotification(t("PINNED DATASET TO TOP", "リストを最上部にピン留め固定しました"));
      } else {
        showNotification(t("UNPINNED DATASET", "リストのピン留めを解除しました"));
      }
    } catch (err) {
      console.error("Failed to toggle pin dataset", err);
    }
  };

  const sortedImages = useMemo(() => {
    let filteredImages = images;
    if (showHiddenImages) {
      filteredImages = filteredImages.filter(img => img.isHidden);
    } else {
      filteredImages = filteredImages.filter(img => !img.isHidden);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredImages = images.filter(img => img.name.toLowerCase().includes(q));
    }
    
    if (orientationFilter !== "all") {
      filteredImages = filteredImages.filter(img => {
        const w = img.width || 1;
        const h = img.height || 1;
        // 横幅が縦幅の1.1倍（10%増し）までは「縦・正方形」の範疇に含め、明らかな横長のみLandscapeとする
        if (orientationFilter === "portrait") {
          return w <= h * 1.1;
        } else {
          return w > h * 1.1;
        }
      });
    }

    if (sortField === "random") {
      const shuffled = [...filteredImages];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    return [...filteredImages].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "date":
          comparison = (a.addedAt || a.lastModified) - (b.addedAt || b.lastModified);
          break;
        case "custom":
          comparison = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
          if (comparison === 0) comparison = (a.addedAt || a.lastModified) - (b.addedAt || b.lastModified);
          break;
      }
      return sortOrders[sortField] === "asc" ? comparison : -comparison;
    });
  }, [images, sortField, sortOrders, randomSeed, searchQuery, orientationFilter, showHiddenImages]);

  const masonryColumns = useMemo(() => {
    if (viewMode !== "grid-ma") return [];
    const availableWidth = containerWidth - 32 - 16;
    const colsCount = Math.max(
      1,
      Math.floor((availableWidth + gridGap) / (itemScale + gridGap)),
    );

    const columns: ImageRecord[][] = Array.from(
      { length: colsCount },
      () => [],
    );
    sortedImages.forEach((img, i) => {
      columns[i % colsCount].push(img);
    });
    return columns;
  }, [sortedImages, viewMode, containerWidth, itemScale, gridGap]);

  const getCategoryDepth = (catId: string): number => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat || !cat.parentId) return 0;
    const parent = categories.find((c) => c.id === cat.parentId);
    if (!parent || !parent.parentId) return 1;
    return 2;
  };

  const getAllDatasetIdsInCategory = (catId: string): string[] => {
    const childCatIds = categories.filter((c) => c.parentId === catId).map((c) => c.id);
    const grandChildCatIds = categories
      .filter((c) => c.parentId && childCatIds.includes(c.parentId))
      .map((c) => c.id);
    const allCatIds = [catId, ...childCatIds, ...grandChildCatIds];
    return datasets
      .filter((ds) => ds.categoryId && allCatIds.includes(ds.categoryId))
      .map((ds) => ds.id);
  };

  const getCategoryTotalImagesCount = (catId: string): number => {
    const dsIds = getAllDatasetIdsInCategory(catId);
    return dsIds.reduce((sum, id) => sum + (datasetCounts[id] || 0), 0);
  };

  const getCategoryDirectDatasets = (catId: string | null): DatasetRecord[] => {
    if (!catId) {
      return datasets.filter((ds) => !ds.categoryId);
    }
    return datasets.filter((ds) => ds.categoryId === catId);
  };

  const getCategoryDirectSubcategories = (catId: string | null): CategoryRecord[] => {
    if (!catId) {
      return categories.filter((c) => !c.parentId);
    }
    return categories.filter((c) => c.parentId === catId);
  };

  const getCategoryBreadcrumbs = (catId: string | null): CategoryRecord[] => {
    if (!catId) return [];
    const crumbs: CategoryRecord[] = [];
    let currentId: string | null | undefined = catId;
    while (currentId) {
      const cat = categories.find((c) => c.id === currentId);
      if (!cat) break;
      crumbs.unshift(cat);
      currentId = cat.parentId;
    }
    return crumbs;
  };

  const getCategoryCoverPreviewUrl = (catId: string): string | null => {
    const dsIds = getAllDatasetIdsInCategory(catId);
    for (const id of dsIds) {
      if (datasetPreviewUrls[id]) return datasetPreviewUrls[id];
    }
    return null;
  };

  const loadImagesForCategory = async (catId: string) => {
    setActiveCategoryId(catId);
    setActiveDatasetId(null);
    setIsCategoryImagesView(true);
    setIsLoading(true);
    try {
      const dsIds = getAllDatasetIdsInCategory(catId);
      const allDbImages: ImageRecord[] = [];
      for (const id of dsIds) {
        const imgs = await getImagesByDataset(id);
        allDbImages.push(...imgs);
      }

      images.forEach((img) => URL.revokeObjectURL(img.url));

      const loaded = await Promise.all(
        allDbImages.map(async (img) => {
          let { autoBg, width, height } = img;
          if (!autoBg || !width || !height) {
            const meta = await analyzeImageBlob(img.data);
            autoBg = autoBg || meta.bg;
            width = width || meta.width;
            height = height || meta.height;
            storeImages([{ ...img, autoBg, width, height }]).catch(console.error);
          }
          return {
            ...img,
            url: URL.createObjectURL(img.data),
            randomX: Math.random() * 80 - 40,
            randomY: Math.random() * 80 - 40,
            randomRotation: Math.random() * 30 - 15,
            autoBg,
            width,
            height,
          };
        })
      );
      setImages(loaded);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      let dsList = await getAllDatasets();
      const catList = await getAllCategories();
      setCategories(catList);

      if (dsList.length === 0) {
        // Create initial default dataset
        const ds = await createDataset("DEFAULT DATASET");
        dsList = [ds];
      }
      setDatasets(dsList);

      const counts: Record<string, number> = {};
      for (const ds of dsList) {
        counts[ds.id] = await getImageCountByDataset(ds.id);
      }
      setDatasetCounts(counts);

      if (
        activeDatasetId &&
        activeDatasetId !== "all" &&
        !dsList.find((d) => d.id === activeDatasetId)
      ) {
        setActiveDatasetId(null);
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
      let dbImages = datasetId === "all" ? await getAllImages() : await getImagesByDataset(datasetId);

      // Revoke old URLs
      images.forEach((img) => URL.revokeObjectURL(img.url));

      const loaded = await Promise.all(
        dbImages.map(async (img) => {
          let { autoBg, width, height } = img;
          if (!autoBg || !width || !height) {
            const meta = await analyzeImageBlob(img.data);
            autoBg = autoBg || meta.bg;
            width = width || meta.width;
            height = height || meta.height;
            // Update the DB record in the background to cache it
            storeImages([{ ...img, autoBg, width, height }]).catch(console.error);
          }
          return {
            ...img,
            url: URL.createObjectURL(img.data),
            randomX: Math.random() * 80 - 40,
            randomY: Math.random() * 80 - 40,
            randomRotation: Math.random() * 30 - 15,
            autoBg,
            width,
            height,
          };
        })
      );
      setImages(loaded);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (
    fileList: FileList | File[],
    datasetId: string,
    forceLoad: boolean = false
  ) => {
    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file =
        fileList instanceof FileList ? fileList.item(i) : fileList[i];
      if (file && file.type.startsWith("image/")) {
        files.push(file);
      }
    }

    if (files.length === 0) return;
    setIsReadingDirectory(true);

    try {
      const existingImages = await getImagesByDataset(datasetId);
      const existingMap = new Map<string, ImageRecord>(existingImages.map((img) => [img.name, img]));

      const newFiles: File[] = [];
      const duplicateFiles: File[] = [];

      for (const f of files) {
        if (existingMap.has(f.name)) {
          duplicateFiles.push(f);
        } else {
          newFiles.push(f);
        }
      }

      if (newFiles.length > 0) {
        // Compute autoBg asynchronously for each file
        const records = await Promise.all(
          newFiles.map(async (f) => {
            const meta = await analyzeImageBlob(f);
            return {
              id: `${datasetId}-${f.name}-${f.lastModified}-${f.size}`,
              datasetId,
              name: f.name,
              type: f.type,
              size: f.size,
              lastModified: f.lastModified,
              addedAt: Date.now(),
              data: f,
              autoBg: meta.bg,
              width: meta.width,
              height: meta.height,
            };
          })
        );

        await storeImages(records);
        await loadDatasets();
        if (datasetId === activeDatasetId || forceLoad) {
          await loadImages(datasetId);
        }
      }

      if (duplicateFiles.length > 0) {
        setOverwriteFiles({ files: duplicateFiles, datasetId, forceLoad, existingMap });
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


  // ==========================================
  // EXPORT / IMPORT USING FILE SYSTEM ACCESS API
  // ==========================================

  const handleExportDatasets = async (targetIds: string[]) => {
    try {
      if (!('showDirectoryPicker' in window)) {
        setLoadingMessage("Your browser does not support the File System Access API.\nPlease use Chrome, Edge, or Opera.");
        setIsLoading(true);
        return;
      }
      
      const targetDatasets = datasets.filter(ds => targetIds.includes(ds.id));
      if (targetDatasets.length === 0) return;
      
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeSingleName = targetDatasets[0].name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Dataset';
      const backupDirName = targetDatasets.length === 1
        ? `ImageViewer_Backup_${safeSingleName}_${timestamp}`
        : `ImageViewer_Backup_${timestamp}`;
      const backupDirHandle = await dirHandle.getDirectoryHandle(backupDirName, { create: true });

      const metaFileHandle = await backupDirHandle.getFileHandle('datasets.json', { create: true });
      const metaWritable = await metaFileHandle.createWritable();
      await metaWritable.write(JSON.stringify(targetDatasets, null, 2));
      await metaWritable.close();

      let totalImages = 0;
      let exportedImages = 0;
      for (const ds of targetDatasets) {
        const count = await getImageCountByDataset(ds.id);
        totalImages += count;
      }

      setIsLoading(true);
      
      for (const ds of targetDatasets) {
        const dsImages = await getImagesByDataset(ds.id);
        if (dsImages.length === 0) continue;

        const safeDsName = (ds.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Dataset') + "_" + ds.id.substring(0, 4);
        const dsDirHandle = await backupDirHandle.getDirectoryHandle(safeDsName, { create: true });

        const dsMetaHandle = await dsDirHandle.getFileHandle('metadata.json', { create: true });
        const dsMetaWritable = await dsMetaHandle.createWritable();
        const metaOnly = dsImages.map(img => ({
          id: img.id,
          name: img.name,
          type: img.type,
          size: img.size,
          lastModified: img.lastModified,
          addedAt: img.addedAt,
          orderIndex: img.orderIndex,
          isHidden: Boolean(img.isHidden),
          autoBg: img.autoBg,
          width: img.width,
          height: img.height,
        }));
        await dsMetaWritable.write(JSON.stringify(metaOnly, null, 2));
        await dsMetaWritable.close();

        for (const img of dsImages) {
          try {
            const safeImgName = img.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim() || `image_${img.id.substring(0,6)}`;
            const uniqueName = `${img.id.substring(0,6)}_${safeImgName}`;
            const fileHandle = await dsDirHandle.getFileHandle(uniqueName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(img.data);
            await writable.close();
          } catch (e) {
            console.error("Failed to write image:", img.name, e);
          }
          exportedImages++;
          setLoadingMessage(`EXPORTING... ${exportedImages}/${totalImages}`);
        }
      }
      
      setLoadingMessage(`Export completed!\nFolder: ${backupDirName}\nDatasets: ${targetDatasets.length}\nImages: ${exportedImages}`);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Export failed:", error);
        if (error.message && error.message.includes("Cross origin")) {
          setLoadingMessage("【⚠️ 新しいタブで開いてください】\nプレビュー画面（iFrame）のセキュリティ制限により、フォルダ選択ダイアログを開けません。\n画面右上の「↗️ Open in New Tab（新しいタブで開く）」ボタンからアプリを別タブで開いて実行してください。");
        } else {
          setLoadingMessage("Export failed:\n" + error.message);
        }
        setIsLoading(true);
      }
    }
  };

  const handleExportAll = () => {
    if (datasets.length === 0) {
      setLoadingMessage("エクスポートできるデータセットがありません。");
      setIsLoading(true);
      return;
    }
    const initialIds = (activeDatasetId && activeDatasetId !== "all") ? [activeDatasetId] : datasets.map(d => d.id);
    setSelectedExportDatasetIds(initialIds);
    setShowExportModal(true);
  };

  const handleImportAll = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        setLoadingMessage("Your browser does not support the File System Access API.\nPlease use Chrome, Edge, or Opera.");
        setIsLoading(true);
        return;
      }
      
      const backupDirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      
      setIsLoading(true);
      setLoadingMessage("READING BACKUP...");

      let datasetsJson = null;
      try {
        const fileHandle = await backupDirHandle.getFileHandle('datasets.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        datasetsJson = JSON.parse(text);
      } catch (e) {
        setLoadingMessage("Invalid backup folder. 'datasets.json' not found.\nPlease select a valid backup folder created by EXPORT DATA.");
        setIsLoading(true);
        return;
      }

      if (!Array.isArray(datasetsJson)) {
         setLoadingMessage("Invalid datasets.json format.");
         setIsLoading(true);
         return;
      }

      let importedImages = 0;
      
      for (const dsMeta of datasetsJson) {
        const newDs = await createDataset(dsMeta.name);
        
        const safeDsName = (dsMeta.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'Dataset') + "_" + dsMeta.id.substring(0, 4);
        const legacySafeDsName = dsMeta.name.replace(/[^a-zA-Z0-9]/g, '_') + "_" + dsMeta.id.substring(0, 4);
        
        let dsDirHandle;
        try {
          dsDirHandle = await backupDirHandle.getDirectoryHandle(safeDsName);
        } catch(e) {
          try {
            dsDirHandle = await backupDirHandle.getDirectoryHandle(legacySafeDsName);
          } catch (e2) {
            continue;
          }
        }

        let imgMetaList: any[] = [];
        try {
          const mHandle = await dsDirHandle.getFileHandle('metadata.json');
          const mFile = await mHandle.getFile();
          const mText = await mFile.text();
          imgMetaList = JSON.parse(mText);
        } catch(e) {
        }

        const imagesToStore = [];
        
        for await (const entry of dsDirHandle.values()) {
          if (entry.kind === 'file' && entry.name !== 'metadata.json') {
            const fileHandle = await dsDirHandle.getFileHandle(entry.name);
            const file = await fileHandle.getFile();
            
            const idPart = entry.name.split('_')[0];
            const originalMeta = imgMetaList.find((m: any) => m.id && m.id.startsWith(idPart));
            
            const originalName = originalMeta ? originalMeta.name : file.name;
            const orderIndex = originalMeta ? originalMeta.orderIndex : Date.now();
            
            const imageRecord: ImageRecord = {
              id: `${originalName}-${file.lastModified}-${crypto.randomUUID()}`,
              datasetId: newDs.id,
              name: originalName,
              type: file.type || (originalMeta && originalMeta.type) || 'image/jpeg',
              size: file.size,
              lastModified: file.lastModified,
              addedAt: originalMeta ? originalMeta.addedAt : Date.now(),
              data: file,
              orderIndex: orderIndex,
              isHidden: Boolean(originalMeta && originalMeta.isHidden),
              autoBg: originalMeta ? originalMeta.autoBg : undefined,
              width: originalMeta ? originalMeta.width : undefined,
              height: originalMeta ? originalMeta.height : undefined,
            };
            imagesToStore.push(imageRecord);
            importedImages++;
            setLoadingMessage(`IMPORTING... ${importedImages}`);
          }
        }
        
        if (imagesToStore.length > 0) {
          imagesToStore.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
          await storeImages(imagesToStore);
        }
      }
      
      await loadDatasets();
      setLoadingMessage(`Import completed!
Images imported: ${importedImages}`);
    } catch (error: any) {
       if (error.name !== 'AbortError') {
        console.error("Import failed:", error);
        if (error.message && error.message.includes("Cross origin")) {
          setLoadingMessage("【⚠️ 新しいタブで開いてください】\nプレビュー画面（iFrame）のセキュリティ制限により、フォルダ選択ダイアログを開けません。\n画面右上の「↗️ Open in New Tab（新しいタブで開く）」ボタンからアプリを別タブで開いて実行してください。");
        } else {
          setLoadingMessage("Import failed:\n" + error.message);
        }
        setIsLoading(true);
      }
    } };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !activeDatasetId)
      return;
    await processFiles(e.target.files, activeDatasetId);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddDatasetClick = (targetCatId: string | null = null) => {
    setDatasetNameInput("");
    setEditingDatasetId(null);
    setTargetCategoryIdForNewDataset(targetCatId !== null ? targetCatId : activeCategoryId);
    setShowNewDatasetModal(true);
  };

  const handleRenameDatasetClick = (
    e: React.MouseEvent,
    id: string,
    oldName: string,
  ) => {
    e.stopPropagation();
    setDatasetNameInput(oldName);
    setEditingDatasetId(id);
    setShowNewDatasetModal(true);
  };

  const submitDatasetForm = async () => {
    if (!datasetNameInput.trim()) return;
    if (editingDatasetId) {
      await renameDataset(
        editingDatasetId,
        datasetNameInput.trim().toUpperCase(),
      );
    } else {
      const ds = await createDataset(datasetNameInput.trim().toUpperCase());
      if (targetCategoryIdForNewDataset) {
        await updateDatasetCategory(ds.id, targetCategoryIdForNewDataset);
      }
      setActiveDatasetId(ds.id);
    }
    setShowNewDatasetModal(false);
    setTargetCategoryIdForNewDataset(null);
    await loadDatasets();
  };

  const handleOpenNewCategoryModal = (parentId: string | null = null) => {
    setNewCategoryParentId(parentId);
    setEditingCategoryId(null);
    setCategoryNameInput("");
    setShowNewCategoryModal(true);
  };

  const handleOpenRenameCategoryModal = (e: React.MouseEvent, cat: CategoryRecord) => {
    e.stopPropagation();
    setEditingCategoryId(cat.id);
    setCategoryNameInput(cat.name);
    setShowNewCategoryModal(true);
  };

  const submitCategoryForm = async () => {
    if (!categoryNameInput.trim()) return;
    if (editingCategoryId) {
      await renameCategory(editingCategoryId, categoryNameInput.trim().toUpperCase());
    } else {
      const newCat = await createCategory(categoryNameInput.trim().toUpperCase(), newCategoryParentId);
      if (newCategoryParentId) {
        setExpandedCategoryIds((prev) => new Set([...prev, newCategoryParentId]));
      }
    }
    setShowNewCategoryModal(false);
    setEditingCategoryId(null);
    setCategoryNameInput("");
    await loadDatasets();
  };

  const handleDeleteCategoryClick = (e: React.MouseEvent, cat: CategoryRecord) => {
    e.stopPropagation();
    setCategoryToDelete(cat);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    await deleteCategory(categoryToDelete.id);
    if (activeCategoryId === categoryToDelete.id) {
      setActiveCategoryId(categoryToDelete.parentId || null);
      setIsCategoryImagesView(false);
    }
    setShowDeleteCategoryModal(false);
    setCategoryToDelete(null);
    await loadDatasets();
  };

  const handleMoveDatasetToCategory = async (datasetId: string, targetCategoryId: string | null) => {
    await updateDatasetCategory(datasetId, targetCategoryId);
    if (targetCategoryId) {
      setExpandedCategoryIds((prev) => new Set([...prev, targetCategoryId]));
    }
    await loadDatasets();
    const ds = datasets.find((d) => d.id === datasetId);
    const parentCat = targetCategoryId ? categories.find((c) => c.id === targetCategoryId) : null;
    showNotification(
      language === "JP"
        ? (targetCategoryId
            ? `「${ds?.name || "セット"}」を「${parentCat?.name || "フォルダー"}」へ移動しました`
            : `「${ds?.name || "セット"}」をルート（未分類）へ移動しました`)
        : (targetCategoryId
            ? `Moved "${ds?.name || "Dataset"}" to "${parentCat?.name || "Folder"}"`
            : `Moved "${ds?.name || "Dataset"}" to Root`)
    );
  };

  const handleMoveCategoryParent = async (categoryId: string, newParentId: string | null) => {
    if (categoryId === newParentId) return;
    await updateCategoryParent(categoryId, newParentId);
    if (newParentId) {
      setExpandedCategoryIds((prev) => new Set([...prev, newParentId]));
    }
    await loadDatasets();
    const cat = categories.find((c) => c.id === categoryId);
    const parentCat = newParentId ? categories.find((c) => c.id === newParentId) : null;
    showNotification(
      language === "JP"
        ? (newParentId
            ? `「${cat?.name || "フォルダー"}」を「${parentCat?.name || "フォルダー"}」の中へ移動しました`
            : `「${cat?.name || "フォルダー"}」をルート最上位へ移動しました`)
        : (newParentId
            ? `Moved folder "${cat?.name || "Folder"}" into "${parentCat?.name || "Folder"}"`
            : `Moved folder "${cat?.name || "Folder"}" to Root`)
    );
  };

  const handleReorderDatasetItems = async (
    draggedDatasetId: string,
    targetDatasetId: string | null,
    targetCategoryId: string | null
  ) => {
    const listInCat = datasets.filter(
      (d) => (d.categoryId || null) === (targetCategoryId || null)
    );
    const draggedDs = datasets.find((d) => d.id === draggedDatasetId);
    if (!draggedDs) return;

    const filtered = listInCat.filter((d) => d.id !== draggedDatasetId);

    let insertIdx = filtered.length;
    if (targetDatasetId) {
      const idx = filtered.findIndex((d) => d.id === targetDatasetId);
      if (idx !== -1) insertIdx = idx;
    }

    const updatedDs = { ...draggedDs, categoryId: targetCategoryId || undefined };
    filtered.splice(insertIdx, 0, updatedDs);

    const updates = filtered.map((d, index) => ({
      id: d.id,
      orderIndex: index,
    }));

    await updateDatasetsOrder(updates);
    if (draggedDs.categoryId !== (targetCategoryId || undefined)) {
      await updateDatasetCategory(draggedDatasetId, targetCategoryId);
    }
    await loadDatasets();
  };

  const handleReorderCategories = async (
    draggedCategoryId: string,
    targetCategoryId: string | null,
    targetParentId: string | null
  ) => {
    const listInParent = categories.filter(
      (c) => (c.parentId || null) === (targetParentId || null)
    );
    const draggedCat = categories.find((c) => c.id === draggedCategoryId);
    if (!draggedCat) return;

    const filtered = listInParent.filter((c) => c.id !== draggedCategoryId);

    let insertIdx = filtered.length;
    if (targetCategoryId) {
      const idx = filtered.findIndex((c) => c.id === targetCategoryId);
      if (idx !== -1) insertIdx = idx;
    }

    const updatedCat = { ...draggedCat, parentId: targetParentId || null };
    filtered.splice(insertIdx, 0, updatedCat);

    const updates = filtered.map((c, index) => ({
      id: c.id,
      orderIndex: index,
    }));

    await updateCategoriesOrder(updates);
    if (draggedCat.parentId !== (targetParentId || null)) {
      await updateCategoryParent(draggedCategoryId, targetParentId);
    }
    await loadDatasets();
  };

  const handleRequestMoveDatasetModal = (dataset: DatasetRecord) => {
    setItemToMove({ type: "dataset", item: dataset });
    setShowMoveItemModal(true);
  };

  const handleRequestMoveCategoryModal = (category: CategoryRecord) => {
    setItemToMove({ type: "category", item: category });
    setShowMoveItemModal(true);
  };

  const handleToggleCategoryExpand = (catId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const handleRenameFileClick = (
    e: React.MouseEvent,
    id: string,
    oldName: string,
  ) => {
    e.stopPropagation();
    setFileNameInput(oldName);
    setEditingFileId(id);
    setShowRenameFileModal(true);
  };

  const submitFileRenameForm = async () => {
    if (!fileNameInput.trim() || !editingFileId || !activeDatasetId) return;
    await renameImage(editingFileId, fileNameInput.trim());
    setShowRenameFileModal(false);
    setEditingFileId(null);
    await loadImages(activeDatasetId);
  };

  const handleMoveDatasetTop = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await updateDatasetDate(id, Date.now() + 1000);
    await loadDatasets();
  };

  const handleSortEnd = async (evt: any) => {
    if (sortField !== "custom") return;

    const oldIndex = evt.oldIndex;
    const newIndex = evt.newIndex;
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;

    let newSorted = [...sortedImages];
    const draggedItem = sortedImages[oldIndex];

    if (isSelectionMode && selectedImageIds.has(draggedItem.id) && selectedImageIds.size > 1) {
      const selectedItems = sortedImages.filter(img => selectedImageIds.has(img.id));
      const remainingItems = sortedImages.filter(img => !selectedImageIds.has(img.id));

      let simArray = [...sortedImages];
      simArray.splice(oldIndex, 1);
      simArray.splice(newIndex, 0, draggedItem);

      let unselectedCount = 0;
      for (let i = 0; i < newIndex; i++) {
        if (!selectedImageIds.has(simArray[i].id)) {
          unselectedCount++;
        }
      }

      newSorted = [...remainingItems];
      newSorted.splice(unselectedCount, 0, ...selectedItems);
    } else {
      const [moved] = newSorted.splice(oldIndex, 1);
      newSorted.splice(newIndex, 0, moved);
    }

    const updates = newSorted.map((img, idx) => ({
      id: img.id,
      orderIndex: idx,
    }));

    setImages((prev) => {
      const copy = [...prev];
      for (const update of updates) {
        const pImg = copy.find((c) => c.id === update.id);
        if (pImg) pImg.orderIndex = update.orderIndex;
      }
      return copy;
    });

    await updateImagesOrder(updates);
  };

  const handleMoveDatasetBottom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const minDate =
      datasets.length > 0
        ? Math.min(...datasets.map((d) => d.createdAt))
        : Date.now();
    await updateDatasetDate(id, minDate - 1000);
    await loadDatasets();
  };

  const handleReorderDatasets = async (newOrder: DatasetRecord[]) => {
    // Preserve pinned separation: pinned datasets remain in their pinned subset, non-pinned in their non-pinned subset
    const pinned = newOrder.filter((d) => d.isPinned);
    const unpinned = newOrder.filter((d) => !d.isPinned);
    const finalOrder = [...pinned, ...unpinned];

    setDatasets(finalOrder);
    const now = Date.now();
    for (let i = 0; i < finalOrder.length; i++) {
      await updateDatasetDate(finalOrder[i].id, now - i * 1000);
    }
  };



  const handleDeleteDataset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDatasetToDelete(id);
    setShowDeleteDatasetModal(true);
  };

  const confirmOverwrite = async () => {
    if (!overwriteFiles) return;
    setIsLoading(true);
    const data = overwriteFiles;
    setOverwriteFiles(null);
    try {
      const { files, datasetId, forceLoad, existingMap } = data;
      
      const oldIds: string[] = [];
      const newRecords: ImageRecord[] = [];

      await Promise.all(files.map(async (f) => {
        const oldImg = existingMap.get(f.name);
        if (oldImg) {
          oldIds.push(oldImg.id);
        }
        
        const meta = await analyzeImageBlob(f);
        newRecords.push({
          id: `${datasetId}-${f.name}-${f.lastModified}-${f.size}`,
          datasetId,
          name: f.name,
          type: f.type,
          size: f.size,
          lastModified: f.lastModified,
          addedAt: oldImg?.addedAt || Date.now(),
          orderIndex: oldImg?.orderIndex,
          data: f,
          autoBg: meta.bg,
          width: meta.width,
          height: meta.height,
        });
      }));

      for (const oldId of oldIds) {
        await deleteImage(oldId);
      }

      await storeImages(newRecords);
      await loadDatasets();
      if (datasetId === activeDatasetId || forceLoad) {
        await loadImages(datasetId);
      }

      showNotification(
        language === "JP"
          ? `${files.length} 件のファイルを更新しました`
          : `Updated ${files.length} file(s)`
      );

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteDataset = async () => {
    if (!datasetToDelete) return;
    setIsLoading(true);
    await deleteDataset(datasetToDelete);
    if (activeDatasetId === datasetToDelete) {
      setActiveDatasetId(null);
    }
    await loadDatasets();
    setShowDeleteDatasetModal(false);
    setDatasetToDelete(null);
    setIsLoading(false);
  };

  const handleHideSelected = async (hide: boolean) => {
    await updateImagesVisibility(Array.from(selectedImageIds), hide);
    setImages(prev => prev.map(img => 
      selectedImageIds.has(img.id) ? { ...img, isHidden: hide } : img
    ));
    setSelectedImageIds(new Set());
    setLastSelectedIdx(null);
    setIsSelectionMode(false);
    
    // Background refresh
    if (activeDatasetId) {
      loadImages(activeDatasetId).finally(() => loadDatasets());
    }
    showNotification(language === "JP" ? `${hide ? "シークレット" : "通常表示"}にしました` : `Marked as ${hide ? "secret" : "revealed"}`);
  };

  const handleDeleteSelected = () => {
    setImageToDeleteContext('selected');
    setShowDeleteImageModal(true);
  };
  
  const executeDeleteSelectedImages = async () => {
    await Promise.all(Array.from(selectedImageIds).map(id => deleteImage(id as string)));
    setImages(prev => prev.filter(img => !selectedImageIds.has(img.id)));
    setSelectedImageIds(new Set());
    setLastSelectedIdx(null);
    setIsSelectionMode(false);
    
    if (activeDatasetId) {
      loadDatasets();
    }
    showNotification(language === "JP" ? "削除しました" : "Deleted");
    setShowDeleteImageModal(false);
    setImageToDeleteContext(null);
  };

  const executeHideFullscreenImage = async () => {
    if (!selectedImage) return;
    const newHiddenState = !selectedImage.isHidden;
    await updateImagesVisibility([selectedImage.id], newHiddenState);

    setImages(prev => prev.map(img => 
      img.id === selectedImage.id ? { ...img, isHidden: newHiddenState } : img
    ));

    const shouldClose = (showHiddenImages && !newHiddenState) || (!showHiddenImages && newHiddenState);
    if (shouldClose) {
        setIsFullscreen(false);
    } else {
        setSelectedImage(prev => prev ? { ...prev, isHidden: newHiddenState } as any : null);
    }

    if (activeDatasetId) {
      loadImages(activeDatasetId).finally(() => loadDatasets());
    }
    showNotification(language === "JP" ? `${newHiddenState ? "シークレット" : "通常表示"}にしました` : `Marked as ${newHiddenState ? "secret" : "revealed"}`);
  };

  const executeDeleteFullscreenImage = () => {
    if (!selectedImage) return;
    setImageToDeleteContext('fullscreen');
    setShowDeleteImageModal(true);
  };
  
  const performDeleteFullscreenImage = async () => {
    if (!selectedImage) return;
    
    await deleteImage(selectedImage.id);
    setImages(prev => prev.filter(img => img.id !== selectedImage.id));
    
    const currentIndex = sortedImages.findIndex((img) => img.id === selectedImage.id);
    const newSorted = sortedImages.filter(img => img.id !== selectedImage.id);
    
    if (newSorted.length > 0) {
      let nextIndex = currentIndex;
      if (nextIndex >= newSorted.length) {
        nextIndex = newSorted.length - 1;
      }
      setSelectedImage(newSorted[nextIndex]);
    } else {
      setIsFullscreen(false);
      setSelectedImage(null);
    }

    if (activeDatasetId) {
      loadDatasets();
    }
    showNotification(language === "JP" ? "削除しました" : "Deleted");
    setShowDeleteImageModal(false);
    setImageToDeleteContext(null);
  };

  const handleMoveSelected = async (newDatasetId: string) => {
    setIsLoading(true);
    await updateImagesDataset(Array.from(selectedImageIds), newDatasetId);
    setSelectedImageIds(new Set());
    setLastSelectedIdx(null);
    setIsSelectionMode(false);
    if (activeDatasetId) {
      await loadImages(activeDatasetId);
      await loadDatasets();
    }
    setIsLoading(false);
  };

  const handleCopySelected = async (newDatasetId: string, customIds?: string[]) => {
    setIsLoading(true);
    const idsToCopy = customIds || Array.from(selectedImageIds);
    await copyImagesToDataset(idsToCopy, newDatasetId);
    if (!customIds) {
      setSelectedImageIds(new Set());
      setLastSelectedIdx(null);
      setIsSelectionMode(false);
    }
    if (activeDatasetId) {
      await loadImages(activeDatasetId);
      await loadDatasets();
    }
    setIsLoading(false);
    showNotification(language === "JP" ? "コピーしました" : "Copied");
  };

  const handleCustomMove = async (direction: "top" | "bottom" | "up" | "down") => {
    if (selectedImageIds.size === 0) return;
    setIsLoading(true);

    if (sortField !== "custom") {
      setSortField("custom");
      setSortOrders(prev => ({ ...prev, custom: "asc" }));
    }

    const currentImages = [...sortedImages];

    const selectedIdsArray = Array.from(selectedImageIds);
    const selectedIndexes = selectedIdsArray
      .map(id => currentImages.findIndex(img => img.id === id))
      .filter(idx => idx !== -1)
      .sort((a, b) => a - b);

    if (selectedIndexes.length === 0) {
      setIsLoading(false);
      return;
    }

    let newImages = [...currentImages];

    if (direction === "top") {
      const selected = selectedIndexes.map(idx => currentImages[idx]);
      const unselected = currentImages.filter((_, idx) => !selectedIndexes.includes(idx));
      newImages = [...selected, ...unselected];
    } else if (direction === "bottom") {
      const selected = selectedIndexes.map(idx => currentImages[idx]);
      const unselected = currentImages.filter((_, idx) => !selectedIndexes.includes(idx));
      newImages = [...unselected, ...selected];
    } else if (direction === "up") {
      for (let i = 0; i < selectedIndexes.length; i++) {
        const idx = selectedIndexes[i];
        if (idx > 0 && !selectedImageIds.has(newImages[idx - 1].id)) {
          const temp = newImages[idx - 1];
          newImages[idx - 1] = newImages[idx];
          newImages[idx] = temp;
          selectedIndexes[i] = idx - 1;
        }
      }
    } else if (direction === "down") {
      for (let i = selectedIndexes.length - 1; i >= 0; i--) {
        const idx = selectedIndexes[i];
        if (idx < newImages.length - 1 && !selectedImageIds.has(newImages[idx + 1].id)) {
          const temp = newImages[idx + 1];
          newImages[idx + 1] = newImages[idx];
          newImages[idx] = temp;
          selectedIndexes[i] = idx + 1;
        }
      }
    }

    const updates = newImages.map((img, i) => ({ id: img.id, orderIndex: i }));
    await updateImagesOrder(updates);

    if (activeDatasetId) {
      await loadImages(activeDatasetId);
    }
    setIsLoading(false);
  };

  const handleSelectAll = () => {
    if (selectedImageIds.size === sortedImages.length) {
      setSelectedImageIds(new Set());
      setLastSelectedIdx(null);
    } else {
      setSelectedImageIds(new Set(sortedImages.map((img) => img.id)));
      setLastSelectedIdx(null);
    }
  };

  const goToNextDataset = React.useCallback(() => {
    if (!activeDatasetId) return;
    const currentIndex = datasets.findIndex((d) => d.id === activeDatasetId);
    if (currentIndex < 0 || datasets.length <= 1) return;
    const nextIndex = (currentIndex + 1) % datasets.length;
    
    pendingFullscreenNav.current = { direction: "next", datasetId: datasets[nextIndex].id };
    setActiveDatasetId(datasets[nextIndex].id);
  }, [activeDatasetId, datasets]);

  const goToPrevDataset = React.useCallback(() => {
    if (!activeDatasetId) return;
    const currentIndex = datasets.findIndex((d) => d.id === activeDatasetId);
    if (currentIndex < 0 || datasets.length <= 1) return;
    const prevIndex = (currentIndex - 1 + datasets.length) % datasets.length;
    
    pendingFullscreenNav.current = { direction: "prev", datasetId: datasets[prevIndex].id };
    setActiveDatasetId(datasets[prevIndex].id);
  }, [activeDatasetId, datasets]);

  useEffect(() => {
    if (isFullscreen && pendingFullscreenNav.current) {
      const { direction, datasetId } = pendingFullscreenNav.current;
      
      const isUpdated = images.length === 0 || images.every(img => img.datasetId === datasetId);
      
      if (isUpdated) {
        if (sortedImages.length > 0) {
          if (direction === "next") {
            setSelectedImage(sortedImages[0]);
          } else if (direction === "prev") {
            setSelectedImage(sortedImages[sortedImages.length - 1]);
          }
        }
        pendingFullscreenNav.current = null;
      }
    }
  }, [sortedImages, images, isFullscreen]);

  const goToNextImage = React.useCallback(() => {
    if (!selectedImage || sortedImages.length <= 1) return;
    const currentIndex = sortedImages.findIndex(
      (img) => img.id === selectedImage.id,
    );
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + 1) % sortedImages.length;
    setSelectedImage(sortedImages[nextIndex]);
  }, [selectedImage, sortedImages]);

  const goToPrevImage = React.useCallback(() => {
    if (!selectedImage || sortedImages.length <= 1) return;
    const currentIndex = sortedImages.findIndex(
      (img) => img.id === selectedImage.id,
    );
    if (currentIndex < 0) return;
    const prevIndex =
      (currentIndex - 1 + sortedImages.length) % sortedImages.length;
    setSelectedImage(sortedImages[prevIndex]);
  }, [selectedImage, sortedImages]);

  // Fullscreen Slideshow Loop
  const [slideshowProgressKey, setSlideshowProgressKey] = useState(0);

  useEffect(() => {
    if (!isFullscreen) {
      setIsSlideshowPlaying(false);
      return;
    }
    if (!isSlideshowPlaying || sortedImages.length <= 1) return;

    setSlideshowProgressKey((k) => k + 1);

    const timer = setInterval(() => {
      setSlideshowProgressKey((k) => k + 1);
      if (slideshowDirection === "fwd") {
        goToNextImage();
      } else {
        goToPrevImage();
      }
    }, slideshowIntervalSec * 1000);

    return () => clearInterval(timer);
  }, [
    isSlideshowPlaying,
    isFullscreen,
    sortedImages.length,
    slideshowDirection,
    slideshowIntervalSec,
    goToNextImage,
    goToPrevImage,
  ]);

  useEffect(() => {
    // 選択画像が変わったらスクロール (isFullscreen時も裏側でスクロールされて良い)
    if (selectedImage && !isFullscreen) {
      const el = document.getElementById(`image-card-${selectedImage.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedImage, isFullscreen]);

  useEffect(() => {
    const pressedKeys = new Set<string>();
    let kbdScrollInterval: ReturnType<typeof setInterval> | null = null;

    const startKbdScroll = () => {
      if (kbdScrollInterval) return;
      kbdScrollInterval = setInterval(() => {
        if (!scrollContainerRef.current) return;
        let dy = 0;
        let dx = 0;
        
        // For list scrolling
        if (!isFullscreen) {
          if (pressedKeys.has("ArrowUp")) dy -= 15;
          if (pressedKeys.has("ArrowDown")) dy += 15;
        }

        if (dy !== 0 || dx !== 0) {
          scrollContainerRef.current.scrollBy({ top: dy, left: dx, behavior: "auto" });
        }
      }, 16);
    };

    const stopKbdScroll = () => {
      if (kbdScrollInterval) {
        clearInterval(kbdScrollInterval);
        kbdScrollInterval = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      pressedKeys.add(e.key);
      if (!isFullscreen && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        if (e.key === "ArrowUp") {
          setAutoScrollDir("up");
        } else if (e.key === "ArrowDown") {
          setAutoScrollDir("down");
        }
        startKbdScroll();
      }
      // 共通ショートカット
      const key = e.key;
      const code = e.code;
      
      // input などの入力中は除外
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (key === "f" || key === "F") {
        if (e.repeat) return;
        e.preventDefault();
        toggleAppFullscreen();
        return;
      }
      if (key === "p" || key === "P") {
        if (e.repeat) return;
        e.preventDefault();
        if (portraitMode === "off") setPortraitMode("left");
        else if (portraitMode === "left") setPortraitMode("right");
        else setPortraitMode("off");
        return;
      }
      if (key === "r" || key === "R") {
        if (e.repeat) return;
        e.preventDefault();
        if (isFullscreen) {
          setFullscreenRotation(r => {
            const next = r + 90;
            imgControls.start({ rotate: next, transition: { duration: 0.2 } });
            return next;
          });
        }
        return;
      }
      if (key === "h" || key === "H") {
        if (e.repeat) return;
        e.preventDefault();
        if (isFullscreen) {
          setFullscreenFlipX(flip => {
            const next = !flip;
            imgControls.start({ rotateY: next ? 180 : 0, transition: { duration: 0.2 } });
            return next;
          });
        }
        return;
      }

      if (!isFullscreen) {
        // 一覧画面での操作
        if (key === " " || code === "Space") {
          if (e.repeat) return;
          e.preventDefault();
          setAutoScrollDir((prev) => (prev !== null ? null : (lastAutoScrollDirRef.current || "down")));
          return;
        }
        if (key === "t" || key === "T") {
          if (e.repeat) return;
          e.preventDefault();
          setAutoScrollSpeed((s) => (s >= 4 ? 1 : (s + 1)));
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          goToNextImage();
        } else if (key === "ArrowLeft") {
          e.preventDefault();
          goToPrevImage();
        } else if (key === "ArrowDown" && e.shiftKey) {
          e.preventDefault();
          goToNextDataset();
        } else if (key === "ArrowUp" && e.shiftKey) {
          e.preventDefault();
          goToPrevDataset();
        } else if (key === "Enter") {
          e.preventDefault();
          if (selectedImage) {
            setIsFullscreen(true);
          }
        }
        return;
      }

      // フルスクリーン時
      if (key === " " || code === "Space") {
        if (e.repeat) return;
        e.preventDefault();
        setIsSlideshowPlaying((prev) => !prev);
        return;
      }
      if (key === "s" || key === "S") {
        if (e.repeat) return;
        e.preventDefault();
        setSlideshowDirection((d) => (d === "fwd" ? "rev" : "fwd"));
        return;
      }
      if (key === "t" || key === "T") {
        if (e.repeat) return;
        e.preventDefault();
        const intervals = [1, 2, 3, 5, 8, 10];
        setSlideshowIntervalSec((sec) => {
          const idx = intervals.indexOf(sec);
          return intervals[(idx + 1) % intervals.length];
        });
        return;
      }
      if (key === "u" || key === "U") {
        if (e.repeat) return;
        e.preventDefault();
        setShowFullscreenUI(prev => !prev);
        return;
      }
      if (key === "z" || key === "Z") {
        if (e.repeat) return;
        handleToggleZoomFill(e);
        return;
      }
      if (key === "c" || key === "C") {
        if (e.repeat) return;
        e.preventDefault();
        if (activeDatasetId && selectedImage) {
          handleSetAsCover(activeDatasetId, selectedImage);
        }
        return;
      }
      if (key === "Delete") {
        if (e.repeat) return;
        e.preventDefault();
        executeHideFullscreenImage();
        return;
      }
      
      if (key === "Escape" || key === "Backspace") {
        if (e.repeat) return;
        e.preventDefault();
        setIsFullscreen(false);
        return;
      }

      const getDragBounds = () => {
        let mX = 0;
        let mY = 0;
        const cw = (isPortraitMode ? window.innerHeight : window.innerWidth);
        const ch = (isPortraitMode ? window.innerWidth : window.innerHeight);
        if (imgDims.w > 0 && imgDims.h > 0) {
          const aspectImg = imgDims.w / imgDims.h;
          const aspectScreen = cw / ch;
          const renderedW = aspectImg > aspectScreen ? cw : ch * aspectImg;
          const renderedH = aspectImg > aspectScreen ? cw / aspectImg : ch;
          const rotW = Math.abs(fullscreenRotation % 180) === 90 ? renderedH : renderedW;
          const rotH = Math.abs(fullscreenRotation % 180) === 90 ? renderedW : renderedH;
          mX = Math.max(0, (rotW * fullscreenScale - cw) / 2);
          mY = Math.max(0, (rotH * fullscreenScale - ch) / 2);
        }
        return { mX, mY };
      };

      const panX = (delta: number) => {
        if (fullscreenScale <= 1) return;
        const { mX } = getDragBounds();
        const newX = Math.max(-mX, Math.min(mX, imgX.get() + delta));
        imgControls.start({ x: newX, transition: { duration: 0.05, ease: "linear" } });
      };
      
      const panY = (delta: number) => {
        if (fullscreenScale <= 1) return;
        const { mY } = getDragBounds();
        const newY = Math.max(-mY, Math.min(mY, imgY.get() + delta));
        imgControls.start({ y: newY, transition: { duration: 0.05, ease: "linear" } });
      };

      let isNext = key === "ArrowRight";
      let isPrev = key === "ArrowLeft";
      let isPanRight = code === "Numpad6" || key === "6";
      let isPanLeft = code === "Numpad4" || key === "4";
      let isPanUp = key === "ArrowUp" || code === "Numpad8" || key === "8";
      let isPanDown = key === "ArrowDown" || code === "Numpad2" || key === "2";

      if (portraitMode === "left") {
        isPanRight = key === "ArrowDown" || code === "Numpad2" || key === "2";
        isPanLeft = key === "ArrowUp" || code === "Numpad8" || key === "8";
        isPanUp = code === "Numpad4" || key === "4";
        isPanDown = code === "Numpad6" || key === "6";
      } else if (portraitMode === "right") {
        isPanRight = key === "ArrowUp" || code === "Numpad8" || key === "8";
        isPanLeft = key === "ArrowDown" || code === "Numpad2" || key === "2";
        isPanUp = code === "Numpad6" || key === "6";
        isPanDown = code === "Numpad4" || key === "4";
      }

      if (key === "ArrowDown" && e.shiftKey) {
        e.preventDefault();
        goToNextDataset();
        return;
      } else if (key === "ArrowUp" && e.shiftKey) {
        e.preventDefault();
        goToPrevDataset();
        return;
      }

      if (isNext) {
        e.preventDefault();
        goToNextImage();
      } else if (isPrev) {
        e.preventDefault();
        goToPrevImage();
      } else if (isPanRight) {
        e.preventDefault();
        if (portraitMode === "left") panY(20);
        else if (portraitMode === "right") panY(-20);
        else panX(-20);
      } else if (isPanLeft) {
        e.preventDefault();
        if (portraitMode === "left") panY(-20);
        else if (portraitMode === "right") panY(20);
        else panX(20);
      } else if (isPanUp) {
        e.preventDefault();
        if (portraitMode === "left") panX(20);
        else if (portraitMode === "right") panX(-20);
        else panY(20);
      } else if (isPanDown) {
        e.preventDefault();
        if (portraitMode === "left") panX(-20);
        else if (portraitMode === "right") panX(20);
        else panY(-20);
      } else if (e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault();
        if (!e.repeat) startZoomIn();
      } else if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault();
        if (!e.repeat) startZoomOut();
      } else if (e.key === "0" || e.code === "Numpad0") {
        e.preventDefault();
        setFullscreenScale(1);
        imgControls.start({ x: 0, y: 0, scale: 1, transition: { duration: 0 } });
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key);
      if (!pressedKeys.has("ArrowUp") && !pressedKeys.has("ArrowDown")) {
        stopKbdScroll();
      }
      if (e.key === "+" || e.code === "NumpadAdd" || e.key === "-" || e.code === "NumpadSubtract") {
        stopZooming();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    stopKbdScroll();
  };
  }, [
    isFullscreen,
    goToNextImage,
    goToPrevImage,
    goToNextDataset,
    goToPrevDataset,
    imgControls,
    fullscreenScale,
    fullscreenRotation,
    imgDims,
    imgX,
    imgY,
    isAppFullscreen,
    portraitMode,
    handleToggleZoomFill,
    startZoomIn,
    startZoomOut,
    stopZooming,
  ]);

  const handleDownloadImage = (image: ImageRecord) => {
    const url = URL.createObjectURL(image.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = image.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleDownloadSelected = async () => {
    const selected = images.filter(img => selectedImageIds.has(img.id));
    if (selected.length === 0) return;
    
    if (selected.length === 1) {
      handleDownloadImage(selected[0]);
      return;
    }

    const zip = new JSZip();
    selected.forEach(img => {
      zip.file(img.name, img.data);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    const ds = datasets.find(d => d.id === activeDatasetId);
    a.download = ds ? `${ds.name}.zip` : "download.zip";
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
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

  const handleFilesDrop = async (e: React.DragEvent | DragEvent, forceNewDataset: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTarget(null);
    // reset global counter by simulating drag end
    
    if (e.dataTransfer && e.dataTransfer.items) {
      setIsReadingDirectory(true);
      const { files, folderNames } = await getFilesFromDataTransferItems(e.dataTransfer.items as any);
      setIsReadingDirectory(false);
      
      if (files.length === 0) return;
      
      let targetDatasetId = activeDatasetId;
      
      if (forceNewDataset || !targetDatasetId || targetDatasetId === "all") {
        const dsName = folderNames.length > 0 ? folderNames[0] : "NEW DATASET";
        const ds = await createDataset(dsName.toUpperCase());
        targetDatasetId = ds.id;
        setActiveDatasetId(ds.id);
        await loadDatasets();
      }
      
      if (targetDatasetId && targetDatasetId !== "all") {
        await processFiles(files, targetDatasetId, forceNewDataset || !activeDatasetId || activeDatasetId === "all");
      }
    } else if (e.dataTransfer && e.dataTransfer.files) {
      if (forceNewDataset || !activeDatasetId || activeDatasetId === "all") {
         const ds = await createDataset("NEW DATASET");
         setActiveDatasetId(ds.id);
         await loadDatasets();
         await processFiles(e.dataTransfer.files, ds.id, true);
      } else {
         await processFiles(e.dataTransfer.files, activeDatasetId);
      }
    }
  };

  // Setup Global Drag & Drop on the window
  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer?.types.includes("Files")) {
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
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragging(false);
      setDragTarget(null);
      await handleFilesDrop(e, false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

  return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [activeDatasetId]);

  const cW = typeof window !== "undefined" ? (isPortraitMode ? window.innerHeight : window.innerWidth) : 1000;
  const cH = typeof window !== "undefined" ? (isPortraitMode ? window.innerWidth : window.innerHeight) : 1000;
  let maxDragX = 0;
  let maxDragY = 0;

  if (imgDims.w > 0 && imgDims.h > 0) {
    const aspectImg = imgDims.w / imgDims.h;
    const aspectScreen = cW / cH;
    let renderedW, renderedH;
    if (aspectImg > aspectScreen) {
      renderedW = cW;
      renderedH = cW / aspectImg;
    } else {
      renderedH = cH;
      renderedW = cH * aspectImg;
    }
    const scaledW = renderedW * fullscreenScale;
    const scaledH = renderedH * fullscreenScale;
    const rotW = Math.abs(fullscreenRotation % 180) === 90 ? scaledH : scaledW;
    const rotH = Math.abs(fullscreenRotation % 180) === 90 ? scaledW : scaledH;
    maxDragX = Math.max(0, (rotW - cW) / 2);
    maxDragY = Math.max(0, (rotH - cH) / 2);
  }

  const getCanvasBgClass = (imgBg?: "black" | "white" | "checkerboard") => {
    const effectiveBg = canvasBg === "theme" && imgBg ? imgBg : canvasBg;
    if (effectiveBg === "black") return "bg-black";
    if (effectiveBg === "white") return "bg-white";
    if (effectiveBg === "checker" || effectiveBg === "checkerboard") return "bg-checkerboard";
    return "";
  };

  const isFullscreenDarkText = (() => {
    if (canvasBg === "theme" && selectedImage?.autoBg) {
      return selectedImage.autoBg === "white" || selectedImage.autoBg === "checkerboard";
    }
    return canvasBg === "white" || canvasBg === "checker" || (canvasBg === "theme" && (theme.toUpperCase() === "LIGHT" || theme.toUpperCase() === "PAPER"));
  })();

  const renderImageCard = (
    img: LoadedImage,
    i: number,
    isSelected: boolean,
    isMultiSelected: boolean,
  ) => (
    <motion.div
      id={`image-card-${img.id}`}
      key={img.id}
      layout={viewMode === "grid-sq" || viewMode === "grid-ma"}
      drag={viewMode === "free"}
      dragConstraints={
        viewMode === "free" ? false : scatterContainerRef
      }
      dragElastic={0.1}
      dragMomentum={true}
      whileDrag={{
        scale: 1.05,
        zIndex: 100,
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
      }}
      whileHover={
        viewMode === "free" ? { scale: 1.02 } : {}
      }
      initial={
        viewMode === "free"
          ? {
              opacity: 0,
              scale: 0.8,
              x: (img.randomX * containerWidth) / 100,
              y: (img.randomY * containerHeight) / 100,
              rotate: img.randomRotation,
            }
          : { opacity: 0, scale: 0.8 }
      }
      animate={
        viewMode === "free"
          ? {
              opacity:
                isSelectionMode && !isMultiSelected
                  ? 0.5
                  : 1,
              scale: 1,
              rotate: img.randomRotation,
            }
          : {
              opacity:
                isSelectionMode && !isMultiSelected
                  ? 0.5
                  : 1,
              scale: 1,
              x: 0,
              y: 0,
              rotate: 0,
            }
      }
      transition={{
        layout: {
          type: "tween",
          ease: "circOut",
          duration: 0.3,
        },
        opacity: {
          duration: 0.1,
          delay: isSelectionMode
            ? 0
            : Math.min(i * 0.015, 1.0),
        },
        scale: {
          type: "tween",
          ease: "circOut",
          duration: 0.2,
          delay: isSelectionMode
            ? 0
            : Math.min(i * 0.015, 1.0),
        },
      }}
      onClick={(e) => {
        if (autoScrollDirRef.current !== null) {
          setAutoScrollDir(null);
          return;
        }
        if (isSelectionMode) {
          const next = new Set(selectedImageIds);
          
          if (e.shiftKey && lastSelectedIdx !== null) {
            const start = Math.min(lastSelectedIdx, i);
            const end = Math.max(lastSelectedIdx, i);
            for (let idx = start; idx <= end; idx++) {
              next.add(sortedImages[idx].id);
            }
          } else {
            if (next.has(img.id)) next.delete(img.id);
            else next.add(img.id);
          }
          
          setSelectedImageIds(next);
          if (!e.shiftKey || lastSelectedIdx === null) {
            setLastSelectedIdx(i);
          }
        } else {
          setSelectedImage(img);
          if (openAction === "click" && viewMode !== "free") {
            setIsFullscreen(true);
          }
        }
      }}
      onDoubleClick={() => {
        if (isSelectionMode) return;
        setSelectedImage(img);
        if (openAction === "dblclick" || viewMode === "free") {
          setIsFullscreen(true);
        }
      }}
      className={cn(
        "cursor-pointer overflow-hidden border min-w-0 min-h-0 relative transition-colors rounded-none bg-panel-bg",
        isSelected || isMultiSelected
          ? "border-accent shadow-[0_0_15px_var(--color-accent-glow)] z-10"
          : "border-panel-border hover:border-text-secondary z-0",
        viewMode === "grid-ma" && "w-full",
        viewMode === "grid-sq" &&
          "w-full aspect-square flex items-center justify-center",
        viewMode === "free" && "absolute shadow-xl",
        viewMode === "list" &&
          "w-full flex items-center px-4 shrink-0 gap-4 group/listitem",
      )}
      style={
        viewMode === "free"
          ? { opacity: img.isHidden ? 0.4 : 1,
              width: itemScale,
              height: itemScale,
              left: `50%`,
              top: `50%`,
              marginLeft: `-${itemScale / 2}px`,
              marginTop: `-${itemScale / 2}px`,
              zIndex: isSelected ? 50 : 1,
            }
          : viewMode === "list"
            ? {
                height: Math.max(48, itemScale * 0.8),
                width: "100%",
                zIndex: isSelected ? 50 : 1,
              }
            : viewMode === "grid-ma"
              ? {
                  width: "100%",
                  height: "auto",
                  zIndex: isSelected ? 50 : 1,
                }
              : { opacity: img.isHidden ? 0.4 : 1,
                  width: "100%",
                  height: "auto",
                  zIndex: isSelected ? 50 : 1,
                }
      }
    >
      {viewMode === "list" ? (
        <>
          <div
            className="shrink-0 border border-panel-border overflow-hidden flex items-center justify-center bg-panel-bg"
            style={{
              width: Math.max(32, itemScale * 0.65),
              height: Math.max(32, itemScale * 0.65),
            }}
          >
            <div
              className={cn(
                "relative flex items-center justify-center max-w-full max-h-full",
                getCanvasBgClass(img.autoBg),
              )}
            >
              <img
                src={img.url}
                draggable={false}
                className="max-w-full max-h-full block"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0 px-2 flex flex-col justify-center group/name transition-colors rounded hover:bg-panel-border/30 h-full">
            <div className="flex items-center justify-between w-full">
              <span className="font-mono text-sm text-text-primary truncate block pr-2">{img.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                {datasets.find(d => d.id === activeDatasetId)?.coverImageId === img.id ? (
                  <span className="flex items-center gap-1 bg-amber-500/90 text-black font-bold font-mono text-[9px] px-1.5 py-0.5 rounded shadow-xs">
                    <Bookmark size={10} className="fill-black" /> COVER
                  </span>
                ) : (
                  activeDatasetId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeDatasetId) handleSetAsCover(activeDatasetId, img);
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="text-text-muted hover:text-amber-400 transition-colors opacity-0 group-hover/name:opacity-100 px-1 py-0.5 flex items-center gap-1 font-mono text-[9px] rounded hover:bg-panel-border/50"
                      title={t("Set as list cover thumbnail", "この画像をリストのカバー画像に設定")}
                    >
                      <Bookmark size={12} /> COVER
                    </button>
                  )
                )}
                <button
                  onClick={(e) => handleRenameFileClick(e, img.id, img.name)}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="text-text-muted hover:text-accent transition-colors flex-shrink-0 opacity-0 group-hover/name:opacity-100 px-2 flex items-center justify-center"
                  title="RENAME FILE"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="font-mono text-sm text-text-muted w-24 text-right shrink-0">
            {formatBytes(img.size)}
          </div>
        </>
      ) : (
        <div
          className={cn(
            "w-full relative flex items-center justify-center group overflow-hidden bg-panel-bg",
            viewMode === "grid-sq" && "h-full",
          )}
        >
          <div
            className={cn(
              "relative flex items-center justify-center w-full h-full transition-transform duration-500 will-change-transform group-hover:scale-105",
              getCanvasBgClass(img.autoBg),
            )}
          >
            <img
              src={img.url}
              draggable={false}
              className={cn(
                "block",
                viewMode === "grid-sq" ||
                  viewMode === "free"
                  ? "max-w-full max-h-full object-contain"
                  : "w-full h-auto",
              )}
            />
          </div>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </div>
      )}

      {/* Cover Image Indicator / Set Button */}
      {(() => {
        const currentDs = datasets.find(d => d.id === activeDatasetId);
        const isCover = currentDs?.coverImageId === img.id;
        
        if (isCover) {
          const currentPos = currentDs?.coverImagePosition || "top";
          const posLabel = currentPos === "center" ? "MID" : currentPos === "bottom" ? "BTM" : "TOP";
          return (
            <div
              className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-amber-500/95 text-black font-bold font-mono text-[9px] px-1.5 py-0.5 rounded shadow-[0_2px_8px_rgba(0,0,0,0.5)] backdrop-blur-xs tracking-wider select-none"
              title={t("Cover Image: Click to cycle crop position (TOP -> CENTER -> BOTTOM)", "カバー画像: クリックでトリミング位置切替（上部 -> 中央 -> 下部）")}
              onClick={(e) => {
                e.stopPropagation();
                if (activeDatasetId) handleCycleCoverPosition(activeDatasetId, e);
              }}
            >
              <Bookmark size={11} className="fill-black" />
              <span>COVER</span>
              <span className="bg-black/20 text-black px-1 rounded text-[8px] ml-0.5">{posLabel}</span>
            </div>
          );
        }

        if (!isSelectionMode && activeDatasetId && viewMode !== "list") {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeDatasetId) handleSetAsCover(activeDatasetId, img);
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-150 bg-black/80 hover:bg-amber-500 text-white hover:text-black font-mono text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 border border-white/20 hover:border-amber-500 shadow-md backdrop-blur-xs tracking-wider"
              title={t("Set as list cover thumbnail", "この画像をリストのカバー画像に設定")}
            >
              <Bookmark size={11} />
              <span>SET COVER</span>
            </button>
          );
        }
        return null;
      })()}
      
      {img.isHidden && (
        <div className="absolute top-2 right-2 z-20 pointer-events-none text-amber-500/80 bg-root-bg/80 rounded p-0.5 backdrop-blur-sm" title="Secret">
          <EyeOff size={16} />
        </div>
      )}
      {isSelectionMode && (
        <div className="absolute top-2 left-2 z-20 pointer-events-none">
          <div className={cn(
            "w-5 h-5 flex items-center justify-center transition-colors shadow-sm rounded-sm outline outline-1",
            isMultiSelected 
              ? "bg-accent outline-accent text-root-bg" 
              : "bg-black/40 outline-white/50"
          )}>
            {isMultiSelected && <Check size={14} />}
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="h-screen w-screen flex flex-col p-4 gap-4 box-border overflow-hidden select-none">
      

      {/* Drag & Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-root-bg/80 backdrop-blur-sm border-2 border-dashed border-accent m-4 flex flex-col items-center justify-center font-mono pointer-events-none"
          >
            <FolderPlus size={64} className="text-accent mb-4" />
            <h2 className="text-2xl text-text-primary tracking-widest mb-2">
              {t("DROP TO ADD TO ACTIVE", "ドロップして現在のリストに追加")}
            </h2>
            <p className="text-text-secondary">
              {t("OR DRAG TO 'CREATE BY FOLDER' IN SIDEBAR", "新規リストとして作成する場合はサイドバーへ")}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            onClick={() => setNotification(null)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-panel-border text-text-primary px-4 py-2 font-mono text-sm shadow-xl flex items-center gap-2 border border-accent/20 cursor-pointer hover:border-accent/50 select-none transition-colors"
            title="Click to dismiss"
          >
            <span className="text-accent">!</span> {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="flex justify-between items-center shrink-0 h-10">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-panel-border flex items-center justify-center rounded-none text-accent">
            <ScatterChart size={18} />
          </div>
          <div className="flex flex-col mr-8 pt-0.5">
            <h1 className="font-sans font-semibold tracking-widest text-lg text-text-primary uppercase leading-none">
              SOLID DESKTOP IMAGE VIEWER
            </h1>
            <span className="text-[10px] font-mono text-text-muted mt-1 uppercase tracking-widest opacity-80">
              v1.1.0 OS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 h-full mr-4">
          <div className="flex items-center gap-2 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">SIZE:</span>
            <div className="w-40 flex items-center">
              <input type="range" min="60" max="750" value={itemScale} onChange={(e) => setItemScale(Number(e.target.value))} />
            </div>
            <span className="text-[10px] font-mono text-text-primary w-10 text-right">{itemScale}px</span>
          </div>

          <div className="flex items-center gap-2 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">GAP:</span>
            <div className="w-40 flex items-center">
              <input type="range" min="0" max="120" value={gridGap} onChange={(e) => setGridGap(Number(e.target.value))} />
            </div>
            <span className="text-[10px] font-mono text-text-primary w-10 text-right">{gridGap}px</span>
          </div>

          <div className="flex items-center gap-2 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">
              CANVAS:
            </span>
            <div className="flex gap-1 h-full py-2 items-center">
              <SolidButton active={canvasBg === "theme"} onClick={() => setCanvasBg("theme")} className="w-10 h-6 px-0 py-0 text-[10px]">AUTO</SolidButton>
              <SolidButton active={canvasBg === "black"} onClick={() => setCanvasBg("black")} className="w-10 h-6 px-0 py-0 text-[10px]">BLK</SolidButton>
              <SolidButton active={canvasBg === "white"} onClick={() => setCanvasBg("white")} className="w-10 h-6 px-0 py-0 text-[10px]">WHT</SolidButton>
              <SolidButton active={canvasBg === "checker"} onClick={() => setCanvasBg("checker")} className="w-10 h-6 px-0 py-0 text-[10px]">CHK</SolidButton>
            </div>
          </div>

          <div className="flex items-center gap-2 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">
              FONT:
            </span>
            <select
              value={appFont}
              onChange={(e) => setAppFont(e.target.value as any)}
              className="bg-panel-bg outline-none text-[10px] uppercase font-mono tracking-wider text-text-primary cursor-pointer border h-6 px-2 border-panel-border rounded"
            >
              <option value="GOTHIC">GOTHIC</option>
              <option value="MARU">MARU</option>
              <option value="MEIRYO">MEIRYO</option>
              <option value="MONO">MONO</option>
            </select>
          </div>

          <div className="flex items-center h-full">
            <SolidButton
              onClick={cycleTheme}
              className={`h-6 px-3 py-0 text-[10px] flex items-center justify-start gap-2 w-[138px] whitespace-nowrap ${
                theme === "TRUE_BLACK"
                  ? "!border-neutral-600 hover:!border-neutral-500 hover:!bg-neutral-900"
                  : ""
              }`}
            >
              <Palette size={12} className="shrink-0" /> THEME: {theme === "TRUE_BLACK" ? "T-BLACK" : theme}
            </SolidButton>
          </div>

          <div className="w-px h-6 bg-panel-border mx-1" />

          <div className="flex bg-root-bg rounded border border-panel-border overflow-hidden text-[10px] font-mono leading-none h-6 hidden sm:flex">
            <button
              className={cn(
                "px-2 transition-colors",
                language === "EN"
                  ? "bg-text-secondary text-root-bg"
                  : "bg-panel-bg text-text-muted hover:text-text-primary",
              )}
              onClick={() => setLanguage("EN")}
            >
              EN
            </button>
            <button
              className={cn(
                "px-2 transition-colors",
                language === "JP"
                  ? "bg-text-secondary text-root-bg"
                  : "bg-panel-bg text-text-muted hover:text-text-primary",
              )}
              onClick={() => setLanguage("JP")}
            >
              JP
            </button>
          </div>

          <div className="flex items-center gap-2 h-full border-l border-panel-border pl-4">
            <SolidButton
              onClick={toggleAppFullscreen}
              className="px-2"
              title="TOGGLE FULLSCREEN (F11)"
            >
              {isAppFullscreen ? (
                <Minimize size={16} />
              ) : (
                <Maximize size={16} />
              )}
            </SolidButton>
            <SolidButton
              onClick={() =>
                setSidebarPosition((p) => (p === "left" ? "right" : "left"))
              }
              className="px-2"
              title="TOGGLE SIDEBAR POSITION"
            >
              {sidebarPosition === "left" ? (
                <PanelLeft size={16} />
              ) : (
                <PanelRight size={16} />
              )}
            </SolidButton>
            <SolidButton
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-2 ml-2"
              title="OPEN IN NEW TAB"
            >
              <ExternalLink size={16} />
            </SolidButton>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "flex flex-1 min-h-0 relative",
          sidebarVisible ? "gap-4" : "",
          sidebarPosition === "right" ? "flex-row-reverse" : "flex-row",
        )}
      >
        {/* Left Sidebar */}
        <aside
          className={cn(
            "flex flex-col gap-4 shrink-0 relative",
            !isResizingSidebar && "transition-all duration-300",
            !sidebarVisible && "w-0 overflow-hidden opacity-0",
          )}
          style={sidebarVisible ? { width: `${sidebarWidth}px` } : undefined}
        >
          {sidebarVisible && (
            <div
              className={cn(
                "absolute top-0 bottom-0 w-2 cursor-col-resize z-50 hover:bg-white/5 transition-colors",
                sidebarPosition === "left" ? "-right-1" : "-left-1"
              )}
              onPointerDown={(e) => {
                e.preventDefault();
                setIsResizingSidebar(true);
                const startX = e.clientX;
                const startWidth = sidebarWidth;

                const onPointerMove = (eMove: PointerEvent) => {
                  const delta = sidebarPosition === "left" ? eMove.clientX - startX : startX - eMove.clientX;
                  setSidebarWidth(Math.min(650, Math.max(300, startWidth + delta)));
                };

                const onPointerUp = () => {
                  setIsResizingSidebar(false);
                  window.removeEventListener("pointermove", onPointerMove);
                  window.removeEventListener("pointerup", onPointerUp);
                };

                window.addEventListener("pointermove", onPointerMove);
                window.addEventListener("pointerup", onPointerUp);
              }}
            />
          )}
          <ReactSortable
            list={sidebarOrder}
            setList={setSidebarOrder}
            animation={200}
            handle=".sidebar-drag-handle"
            className="flex flex-col gap-4 h-full"
          >
            {sidebarOrder.map((section) => {
              if (section.id === "formation") {

  return (
                  <Panel
                    key="formation"
                    title={t("01 FORMATION ENGINE", "01 フォーム設定")}
                    className="shrink-0"
                    isCollapsible
                    isExpanded={isFormationExpanded}
                    onToggle={() => setIsFormationExpanded(!isFormationExpanded)}
                    dragHandle
                  >
                    <div className="grid grid-cols-2 gap-2">
              <SolidButton
                active={viewMode === "grid-sq"}
                onClick={() => setViewMode("grid-sq")}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="GRID: SQUARE"
              >
                <LayoutGrid size={14} /> SQUARE
              </SolidButton>
              <SolidButton
                active={viewMode === "grid-ma"}
                onClick={() => setViewMode("grid-ma")}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="GRID: MASONRY"
              >
                <LayoutGrid size={14} /> MASONRY
              </SolidButton>
              <SolidButton
                active={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="DATA LIST"
              >
                <List size={14} /> LIST
              </SolidButton>
              <SolidButton
                active={viewMode === "free"}
                onClick={() => setViewMode("free")}
                className="justify-center text-[10px] h-10 px-0 flex items-center justify-center gap-1"
                title="FREE SCATTER"
              >
                <ScatterChart size={14} /> SCATTER
              </SolidButton>
            </div>



            <div className="mt-4 pt-4 border-t border-panel-border flex flex-col gap-2">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">
                OPEN IMAGE ACTION
              </span>
              <div className="flex gap-2">
                <SolidButton
                  active={openAction === "click"}
                  onClick={() => setOpenAction("click")}
                  className="flex-1 justify-center text-[10px] h-8"
                >
                  SINGLE CLICK
                </SolidButton>
                <SolidButton
                  active={openAction === "dblclick"}
                  onClick={() => setOpenAction("dblclick")}
                  className="flex-1 justify-center text-[10px] h-8"
                >
                  DOUBLE CLICK
                </SolidButton>
              </div>
            </div>
            
                  </Panel>
                );
              } else if (section.id === "datasets") {

  return (
                  <Panel
                    key="datasets"
                    title={t("02 DATA SETS", "02 データセット")}
                    className={cn("shrink-0 flex flex-col", isDataSetsExpanded && "flex-1 min-h-[200px]")}
                    contentClassName="flex flex-col p-4 overflow-hidden gap-3 h-full"
                    isCollapsible
                    isExpanded={isDataSetsExpanded}
                    onToggle={() => setIsDataSetsExpanded(!isDataSetsExpanded)}
                    dragHandle
                  >
                    <div className="flex gap-2 shrink-0">
              <SolidButton
                onClick={handleAddDatasetClick}
                className="flex-1 justify-center text-accent"
              >
                + {t("NEW SET", "新規セット")}
              </SolidButton>
              <SolidButton
                onClick={() =>
                  setDatasetViewMode((v) =>
                    v === "list" ? "dropdown" : "list",
                  )
                }
                className="px-3"
                title="TOGGLE VIEW MODE"
              >
                {datasetViewMode === "dropdown" ? (
                  <List size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </SolidButton>

              <SolidButton
                onClick={handleClear}
                className="px-3"
                title="CLEAR DATABASE"
              >
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
              <SolidButton
                onClick={handleReadDirectoryClick}
                disabled={isLoading || isReadingDirectory || !activeDatasetId || activeDatasetId === "all"}
                className="w-full text-[10px] relative"
              >
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <FolderOpen size={14} />
                </div>
                <span className="w-full text-center tracking-widest">
                  {isReadingDirectory
                    ? t("READING...", "読み込み中...")
                    : t("ADD DIR TO SET", "ディレクトリ追加")}
                </span>
              </SolidButton>
              <div className="flex justify-between text-[10px] font-mono text-text-muted px-1">
                <span>{t("TOTAL DB IMAGES:", "総データ数:")}</span>
                <span className="text-text-primary">{totalImagesCount}</span>
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <SolidButton
                onClick={handleExportAll}
                className="flex-1 justify-center text-[10px]"
                title="Export all data to a local folder"
                disabled={isLoading || isReadingDirectory}
              >
                EXPORT DATA
              </SolidButton>
              <SolidButton
                onClick={handleImportAll}
                className="flex-1 justify-center text-[10px]"
                title="Import data from a local folder"
                disabled={isLoading || isReadingDirectory}
              >
                IMPORT DATA
              </SolidButton>
            </div>

            <div className="pt-3 border-t border-panel-border overflow-y-scroll flex flex-col gap-1 min-h-[80px] flex-1 scrollbar-dark pr-1">
              {datasetViewMode === "list" ? (
                <CategoryTree
                  categories={categories}
                  datasets={datasets}
                  datasetCounts={datasetCounts}
                  activeDatasetId={activeDatasetId}
                  activeCategoryId={activeCategoryId}
                  expandedCategoryIds={expandedCategoryIds}
                  favoriteDatasetId={favoriteDatasetId}
                  onSelectDataset={(id) => {
                    setActiveDatasetId(id);
                    setSearchQuery("");
                    setSearchInput("");
                  }}
                  onSelectCategory={(id) => {
                    setActiveCategoryId(id);
                    setActiveDatasetId(null);
                    setIsCategoryImagesView(false);
                    setSearchQuery("");
                    setSearchInput("");
                  }}
                  onToggleExpand={handleToggleCategoryExpand}
                  onTogglePinDataset={handleTogglePinDataset}
                  onToggleFavorite={(id, e) => {
                    e.stopPropagation();
                    setFavoriteDatasetId((prev) => (prev === id ? null : id));
                  }}
                  onExportDataset={(id) => handleExportDatasets([id])}
                  onRenameDataset={handleRenameDatasetClick}
                  onDeleteDataset={handleDeleteDataset}
                  onAddCategory={handleOpenNewCategoryModal}
                  onAddDataset={(catId) => handleAddDatasetClick(catId)}
                  onRenameCategory={handleOpenRenameCategoryModal}
                  onDeleteCategory={handleDeleteCategoryClick}
                  onMoveDatasetToCategory={handleMoveDatasetToCategory}
                  onMoveCategoryParent={handleMoveCategoryParent}
                  onReorderDatasets={handleReorderDatasetItems}
                  onReorderCategories={handleReorderCategories}
                  onRequestMoveDatasetModal={handleRequestMoveDatasetModal}
                  onRequestMoveCategoryModal={handleRequestMoveCategoryModal}
                  onRequestColorCategoryModal={(cat) => {
                    setColorCategoryModalTarget(cat);
                    setColorCategoryInput(cat.color || themeFolderColors[theme] || "#fbbf24");
                  }}
                  t={t}
                />
              ) : (
                <div className="flex flex-col gap-3 h-full">
                  <select
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 outline-none text-xs font-mono"
                    value={activeDatasetId || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveDatasetId(val === "" ? null : val);
                      setSearchQuery("");
                      setSearchInput("");
                    }}
                  >
                    <option value="" className="bg-white text-black">IMAGE DATA ({totalImagesCount})</option>
                    {/* Unclassified datasets */}
                    {datasets.filter((d) => !d.categoryId).length > 0 && (
                      <optgroup label="── ROOT / UNCLASSIFIED ──">
                        {datasets
                          .filter((d) => !d.categoryId)
                          .map((ds) => (
                            <option key={ds.id} value={ds.id} className="bg-white text-black">
                              {ds.isPinned ? "📌 " : ""}{ds.name} ({datasetCounts[ds.id] || 0})
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {/* Categorized datasets */}
                    {categories.map((cat) => {
                      const catDs = datasets.filter((d) => d.categoryId === cat.id);
                      if (catDs.length === 0) return null;
                      const catBreadcrumbs = getCategoryBreadcrumbs(cat.id)
                        .map((c) => c.name)
                        .join(" > ");
                      return (
                        <optgroup key={cat.id} label={`📁 ${catBreadcrumbs}`}>
                          {catDs.map((ds) => (
                            <option key={ds.id} value={ds.id} className="bg-white text-black">
                              {ds.isPinned ? "📌 " : ""}{ds.name} ({datasetCounts[ds.id] || 0})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  {activeDatasetId && (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-text-muted text-[10px]">
                        ACTIONS
                      </span>
                      <div className="flex gap-3 text-text-secondary">
                        <button
                          onClick={(e) =>
                            handleMoveDatasetTop(e, activeDatasetId)
                          }
                          title="MOVE TO TOP"
                          className="hover:text-amber-500"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={(e) =>
                            handleMoveDatasetBottom(e, activeDatasetId)
                          }
                          title="MOVE TO BOTTOM"
                          className="hover:text-amber-500"
                        >
                          <ArrowDown size={14} />
                        </button>
                        {activeDatasetId !== "all" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportDatasets([activeDatasetId]);
                            }}
                            title="EXPORT THIS DATASET"
                            className="hover:text-accent"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            const ds = datasets.find(
                              (d) => d.id === activeDatasetId,
                            );
                            if (ds) handleRenameDatasetClick(e, ds.id, ds.name);
                          }}
                          title="RENAME DATASET"
                          className="hover:text-amber-500 font-mono text-xs "
                        >
                          [E]
                        </button>
                        <button
                          onClick={(e) =>
                            handleDeleteDataset(e, activeDatasetId)
                          }
                          title="DELETE DATASET"
                          className="hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* DROP ZONES */}
            <div className="shrink-0 flex gap-2 pt-2 border-t border-panel-border mt-auto">
              {/* ADD TO ACTIVE DATASET AREA */}
              <div
                className={cn(
                  "flex-1 border border-dashed flex flex-col items-center justify-center transition-all duration-300 py-3 rounded cursor-pointer",
                  dragTarget === "add" ? "border-accent bg-accent/10" : "border-text-muted bg-panel-bg text-text-muted hover:border-text-secondary hover:text-text-secondary"
                )}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget("add"); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget("add"); e.dataTransfer.dropEffect = "copy"; }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
                onDrop={(e) => { 
                   e.preventDefault(); e.stopPropagation();
                   handleFilesDrop(e, false);
                   setDragTarget(null);
                }}
              >
                <FolderPlus size={16} className={dragTarget === "add" ? "text-accent mb-1" : "mb-1"} />
                <span className={cn("text-[9px] tracking-widest text-center leading-tight font-mono", dragTarget === "add" ? "text-text-primary" : "")}>
                  {t("ADD TO", "現在のリストに")}<br/>{t("ACTIVE", "追加")}
                </span>
              </div>
              
              {/* CREATE NEW DATASET AREA */}
              <div
                className={cn(
                  "flex-1 border border-dashed flex flex-col items-center justify-center transition-all duration-300 py-3 rounded cursor-pointer",
                  dragTarget === "new" ? "border-accent bg-accent/10" : "border-text-muted bg-panel-bg text-text-muted hover:border-text-secondary hover:text-text-secondary"
                )}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget("new"); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget("new"); e.dataTransfer.dropEffect = "copy"; }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragTarget(null); }}
                onDrop={(e) => {
                   e.preventDefault(); e.stopPropagation();
                   handleFilesDrop(e, true);
                   setDragTarget(null);
                }}
              >
                <FolderOpen size={16} className={dragTarget === "new" ? "text-accent mb-1" : "mb-1"} />
                <span className={cn("text-[9px] tracking-widest text-center leading-tight font-mono", dragTarget === "new" ? "text-text-primary" : "")}>
                  {t("CREATE BY", "フォルダー名で")}<br/>{t("FOLDER", "リストを作成")}
                </span>
              </div>
            </div>
                  </Panel>
                );
              } else if (section.id === "trackInfo" || section.id === "commandInfo") {
                return (
                  <Panel
                    key="commandInfo"
                    title={
                      <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTrackInfoCollapsed) {
                              setIsTrackInfoCollapsed(false);
                              setBottomPanelTab("command");
                            } else if (bottomPanelTab === "command") {
                              setIsTrackInfoCollapsed(true);
                            } else {
                              setBottomPanelTab("command");
                            }
                          }}
                          className={cn(
                            "px-2 py-0.5 transition-all flex items-center gap-1 border rounded-xs",
                            !isTrackInfoCollapsed && bottomPanelTab === "command"
                              ? "bg-accent text-accent-text font-bold border-accent shadow-xs"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                        >
                          <Terminal size={11} />
                          <span>{t("03 COMMAND", "03 コマンド一覧")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTrackInfoCollapsed) {
                              setIsTrackInfoCollapsed(false);
                              setBottomPanelTab("settings");
                            } else if (bottomPanelTab === "settings") {
                              setIsTrackInfoCollapsed(true);
                            } else {
                              setBottomPanelTab("settings");
                            }
                          }}
                          className={cn(
                            "px-2 py-0.5 transition-all flex items-center gap-1 border rounded-xs",
                            !isTrackInfoCollapsed && bottomPanelTab === "settings"
                              ? "bg-accent text-accent-text font-bold border-accent shadow-xs"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                        >
                          <Settings size={11} />
                          <span>{t("SETTING", "設定")}</span>
                        </button>
                      </div>
                    }
                    className={cn(
                      "shrink-0 flex flex-col items-center min-w-0 w-full transition-all duration-300",
                      isTrackInfoCollapsed ? "h-[34px]" : "h-[320px]",
                    )}
                    contentClassName={cn(
                      "flex flex-col w-full min-w-0 transition-opacity duration-300",
                      isTrackInfoCollapsed
                        ? "opacity-0 p-0 pointer-events-none hidden"
                        : "opacity-100 p-3 flex-1 min-h-0 overflow-hidden",
                    )}
                    isCollapsible
                    isExpanded={!isTrackInfoCollapsed}
                    onToggle={() => setIsTrackInfoCollapsed(!isTrackInfoCollapsed)}
                    dragHandle
                  >
                    {!isTrackInfoCollapsed && (
                      <div className="flex flex-col gap-3 h-full w-full min-w-0 overflow-y-auto pr-1 select-none text-[11px]">
                        {bottomPanelTab === "command" ? (
                          <>
                            {/* 一覧画面 (LIST / GRID) */}
                            <div className="flex flex-col gap-1.5">
                              <span className="font-mono text-[9px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-0.5">
                                {t("GRID / LIST MODE", "一覧画面")}
                              </span>
                              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 items-center">
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Space
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Auto Scroll Play / Stop", "自動スクロール 開始/停止")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  ↑ / ↓
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Auto Scroll / Change Dir", "自動スクロール / 向き切替")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  T
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Scroll Speed (1x - 4x)", "スクロール速度切替 (1x〜4x)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  ← / →
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Select Prev / Next Image", "前 / 次の画像選択")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Shift + ↑/↓
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Switch Dataset", "データセット切替")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Enter
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Open Fullscreen", "全画面で開く")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  P
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Portrait Rotate", "画面向き回転 (縦/横)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  F
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Browser Fullscreen", "ブラウザ全画面切替")}
                                </span>
                              </div>
                            </div>

                            {/* 全画面モード (FULLSCREEN & SLIDESHOW) */}
                            <div className="flex flex-col gap-1.5 mt-1">
                              <span className="font-mono text-[9px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-0.5">
                                {t("FULLSCREEN & SLIDESHOW", "全画面 & スライドショー")}
                              </span>
                              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 items-center">
                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Space
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Play / Stop Slideshow", "スライドショー 再生/停止")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  S
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Direction (FWD / REV)", "再生方向切替 (順/逆)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  T
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Interval (1s - 10s)", "スライド秒数切替 (1s〜10s)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Z
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Zoom to Fill / Reset", "画面フィット (ズーム切替)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  C
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Set as List Cover", "カバー画像設定/解除")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  R
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Rotate Image (+90°)", "画像を90°回転")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  H
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Flip Horizontal", "左右反転")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  U
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Toggle UI Display", "操作UIの表示/非表示")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  + / -
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Zoom In / Out", "ズーム拡大 / 縮小")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  ← / →
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Prev / Next Image", "前 / 次の画像")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Shift + ←/→
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Switch Dataset", "データセット切替")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Delete
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Hide (Secret)", "一時非表示 (シークレット)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  Esc / BS
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Close Fullscreen", "全画面を閉じる")}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col gap-4 text-[11px]">
                            {/* 1. COLOR THEME SETTING */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <Palette size={12} className="text-accent" />
                                <span>{t("THEME COLOR", "テーマカラー")}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                                {[
                                  { id: "NAVY", label: "NAVY (ネイビー)", bg: "#06090e", panel: "#0b111a", accent: "#3b82f6" },
                                  { id: "LIGHT", label: "LIGHT (ライト)", bg: "#e2e8f0", panel: "#f8fafc", accent: "#0f172a" },
                                  { id: "PAPER", label: "PAPER (セピア)", bg: "#f5f5f0", panel: "#ffffff", accent: "#d94f26" },
                                  { id: "BLACK", label: "BLACK (ブラック)", bg: "#0B0C0D", panel: "#14161A", accent: "#e2e5e9" },
                                  { id: "TRUE_BLACK", label: "TRUE BLACK (有機EL)", bg: "#000000", panel: "#0a0a0a", accent: "#ffffff" },
                                  { id: "RED", label: "RED (レッド)", bg: "#0d0404", panel: "#170707", accent: "#d33c3c" },
                                ].map((thm) => (
                                  <button
                                    key={thm.id}
                                    type="button"
                                    onClick={() => setTheme(thm.id as any)}
                                    className={cn(
                                      "flex items-center justify-between p-1.5 border transition-all text-left",
                                      theme === thm.id
                                        ? "border-accent bg-accent/10 text-text-primary font-bold ring-1 ring-accent"
                                        : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    <span className="truncate pr-1">{thm.label}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: thm.panel }} title={t("Panel Color", "パネル色")} />
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: thm.accent }} title={t("Accent Color", "アクセント色")} />
                                      <div
                                        className="w-2.5 h-2.5 rounded-full border border-white/20 ring-1 ring-black/30"
                                        style={{ backgroundColor: themeFolderColors[thm.id as AppTheme] || DEFAULT_THEME_FOLDER_COLORS[thm.id as AppTheme] }}
                                        title={t("Folder Color", "フォルダー色")}
                                      />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 2. COVER OPACITY SETTING */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Sliders size={12} className="text-accent" />
                                  <span>{t("COVER OPACITY", "カバー不透明度 (濃さ)")}</span>
                                </div>
                                <span className="text-accent font-bold font-mono text-[11px] tabular-nums">
                                  {coverOpacity}%
                                </span>
                              </div>

                              <div className="flex items-center gap-2 pt-0.5">
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  step="5"
                                  value={coverOpacity}
                                  onChange={(e) => setCoverOpacity(parseInt(e.target.value, 10))}
                                  className="w-full h-1.5 bg-btn-bg border border-btn-border rounded-lg appearance-none cursor-pointer accent-accent"
                                />
                              </div>

                              <div className="flex items-center gap-1 font-mono text-[9px] pt-0.5">
                                {[
                                  { label: "15%", val: 15 },
                                  { label: "30% (標準)", val: 30 },
                                  { label: "50%", val: 50 },
                                  { label: "70%", val: 70 },
                                  { label: "90%", val: 90 },
                                ].map((preset) => (
                                  <button
                                    key={preset.val}
                                    type="button"
                                    onClick={() => setCoverOpacity(preset.val)}
                                    className={cn(
                                      "px-1.5 py-0.5 border transition-all text-[9px]",
                                      coverOpacity === preset.val
                                        ? "border-accent bg-accent/20 text-accent font-bold"
                                        : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center justify-between text-[10px] pt-1">
                                <span className="text-text-muted font-mono">{t("COVER BLUR", "カバー背景のぼかし")}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setCoverBlur(false)}
                                    className={cn(
                                      "px-2 py-0.5 border text-[9px] font-mono transition-all",
                                      !coverBlur
                                        ? "border-accent bg-accent/20 text-accent font-bold"
                                        : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    OFF (クッキリ)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCoverBlur(true)}
                                    className={cn(
                                      "px-2 py-0.5 border text-[9px] font-mono transition-all",
                                      coverBlur
                                        ? "border-accent bg-accent/20 text-accent font-bold"
                                        : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    ON (ぼかし)
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* 3. FOLDER ICON COLOR */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Folder size={12} className="text-folder-icon" />
                                  <span>{t("FOLDER ICON COLOR", "フォルダーアイコン色")} ({theme})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setThemeFolderColors((prev) => ({
                                      ...prev,
                                      [theme]: DEFAULT_THEME_FOLDER_COLORS[theme],
                                    }));
                                  }}
                                  className={cn(
                                    "px-1.5 py-0.5 text-[9px] border transition-colors",
                                    themeFolderColors[theme] === DEFAULT_THEME_FOLDER_COLORS[theme]
                                      ? "bg-accent/20 border-accent text-accent font-bold"
                                      : "border-panel-border text-text-muted hover:text-text-primary"
                                  )}
                                >
                                  {t("RESET", "標準色に戻す")}
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {[
                                  { name: "アンバー", hex: "#fbbf24" },
                                  { name: "スカイ", hex: "#38bdf8" },
                                  { name: "ブルー", hex: "#3b82f6" },
                                  { name: "エメラルド", hex: "#10b981" },
                                  { name: "ローズ", hex: "#f43f5e" },
                                  { name: "パープル", hex: "#a855f7" },
                                  { name: "シルバー", hex: "#9ca3af" },
                                  { name: "ホワイト", hex: "#ffffff" },
                                  { name: "シアン", hex: "#06b6d4" },
                                  { name: "ピンク", hex: "#ec4899" },
                                ].map((c) => {
                                  const curColor = themeFolderColors[theme] || DEFAULT_THEME_FOLDER_COLORS[theme];
                                  const isSelected = curColor.toLowerCase() === c.hex.toLowerCase();
                                  return (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => {
                                        setThemeFolderColors((prev) => ({
                                          ...prev,
                                          [theme]: c.hex,
                                        }));
                                      }}
                                      title={c.name}
                                      className={cn(
                                        "w-5 h-5 rounded-xs border transition-transform flex items-center justify-center shrink-0 hover:scale-110 cursor-pointer",
                                        isSelected
                                          ? "border-text-primary ring-2 ring-accent ring-offset-1 scale-105"
                                          : "border-black/30"
                                      )}
                                      style={{ backgroundColor: c.hex }}
                                    >
                                      {isSelected && (
                                        <Check size={10} className="text-black drop-shadow-xs" />
                                      )}
                                    </button>
                                  );
                                })}

                                {/* Custom Color Input */}
                                <label
                                  className="flex items-center gap-1 px-1.5 py-0.5 border border-panel-border bg-panel-bg hover:border-accent text-[9px] font-mono cursor-pointer transition-colors"
                                  title={t("Pick Custom Color", "カスタム色を選択")}
                                >
                                  <input
                                    type="color"
                                    value={themeFolderColors[theme] || DEFAULT_THEME_FOLDER_COLORS[theme]}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setThemeFolderColors((prev) => ({
                                        ...prev,
                                        [theme]: val,
                                      }));
                                    }}
                                    className="w-3.5 h-3.5 cursor-pointer border-0 bg-transparent p-0"
                                  />
                                  <span>{t("CUSTOM", "カスタム")}</span>
                                </label>
                              </div>
                            </div>

                            {/* 4. MAIN SCREEN BG COLOR OVERRIDE */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <MonitorSmartphone size={12} className="text-accent" />
                                  <span>{t("MAIN SCREEN BG", "メイン画面背景色 (右カラム)")}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMainBgColorOverride("default")}
                                  className={cn(
                                    "px-1.5 py-0.5 text-[9px] border transition-colors",
                                    mainBgColorOverride === "default"
                                      ? "bg-accent/20 border-accent text-accent font-bold"
                                      : "border-panel-border text-text-muted hover:text-text-primary"
                                  )}
                                >
                                  {t("THEME DEFAULT", "テーマ標準")}
                                </button>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                                {[
                                  { label: "白 (ホワイト)", hex: "#ffffff" },
                                  { label: "オフホワイト", hex: "#f8fafc" },
                                  { label: "ダークブラック", hex: "#0B0C0D" },
                                  { label: "有機ELブラック", hex: "#000000" },
                                ].map((bgOpt) => (
                                  <button
                                    key={bgOpt.hex}
                                    type="button"
                                    onClick={() => setMainBgColorOverride(bgOpt.hex)}
                                    className={cn(
                                      "flex items-center justify-between p-1.5 border transition-all text-left",
                                      mainBgColorOverride === bgOpt.hex
                                        ? "border-accent bg-accent/10 text-text-primary font-bold ring-1 ring-accent"
                                        : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    <span className="truncate pr-1">{bgOpt.label}</span>
                                    <div
                                      className="w-3 h-3 rounded-xs border border-white/20 shrink-0"
                                      style={{ backgroundColor: bgOpt.hex }}
                                    />
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center gap-2 mt-0.5">
                                <label
                                  className="flex items-center gap-1 px-2 py-1 border border-panel-border bg-panel-bg hover:border-accent text-[10px] font-mono cursor-pointer transition-colors"
                                  title={t("Pick Custom Main BG Color", "背景色のカスタム選択")}
                                >
                                  <input
                                    type="color"
                                    value={mainBgColorOverride !== "default" ? mainBgColorOverride : "#000000"}
                                    onChange={(e) => setMainBgColorOverride(e.target.value)}
                                    className="w-3.5 h-3.5 cursor-pointer border-0 bg-transparent p-0"
                                  />
                                  <span>{t("PICK CUSTOM BG COLOR", "カスタム色で指定")}</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Panel>
                );
              }
              return null;
            })}
          </ReactSortable>
        </aside>

        {/* Main Display */}
        <div className="flex-1 min-w-0 relative flex flex-col">
          {/* Sidebar Toggle Pill */}
          <div
            onClick={() => setSidebarVisible((v) => !v)}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center cursor-pointer transition-all duration-300 opacity-50 hover:opacity-100",
              "w-4 h-16 bg-panel-border/80 backdrop-blur-sm text-text-muted hover:text-text-primary rounded-full",
              sidebarPosition === "left" ? "-left-2" : "-right-2",
            )}
          >
            {sidebarPosition === "left" ? (
              sidebarVisible ? (
                <ChevronLeft size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : sidebarVisible ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronLeft size={14} />
            )}
          </div>

          <Panel
            title={
              <>
                <span>{t("04 DATA BANKS", "04 データバンク")}</span>
                <div className="flex items-center gap-2 border border-panel-border bg-panel-bg px-2 py-1 rounded">
                  <Search size={12} className="text-text-muted" />
                  <input
                    type="text"
                    placeholder={activeDatasetId ? t("SEARCH IN LIST...", "リスト内を検索...") : t("SEARCH...", "検索...")}
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (!searchInput.trim()) {
                          setSearchInput("");
                          setSearchQuery("");
                          setActiveDatasetId(null);
                        } else {
                          setSearchQuery(searchInput);
                        }
                      }
                    }}
                    className="bg-transparent border-none outline-none text-text-primary w-40 text-[10px] placeholder:text-text-muted focus:ring-0"
                  />
                  {searchInput && (
                    <button 
                      onClick={() => { 
                        setSearchInput(""); 
                        setSearchQuery(""); 
                        setActiveDatasetId(null);
                      }} 
                      className="text-text-muted hover:text-text-primary ml-1 shrink-0"
                      title={t("Clear search (Return to Home)", "検索解除 (ホームに戻る)")}
                    >
                      <X size={12} />
                    </button>
                  )}
                  <SolidButton
                    onClick={() => {
                      if (!searchInput.trim()) {
                        setSearchInput("");
                        setSearchQuery("");
                        setActiveDatasetId(null);
                      } else {
                        setSearchQuery(searchInput);
                      }
                    }}
                    className="px-2 py-1 h-auto text-[10px] shrink-0 border-none bg-transparent hover:bg-white/10"
                  >
                    {t("SEARCH", "検索")}
                  </SolidButton>
                </div>
              </>
            }
            contentClassName="p-0 transition-colors duration-300 relative"
            headerRight={
              isSelectionMode ? (
                <div className="flex items-center gap-4">
                  <span className="text-[10px] uppercase text-text-primary bg-accent/20 px-2 py-0.5 rounded-sm outline outline-1 outline-accent/50 mr-2 flex items-center gap-1 font-mono">
                    <Check size={12} className="text-accent" />{" "}
                    {selectedImageIds.size} SELECTED
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="text-[10px] uppercase font-mono tracking-wider transition-colors text-text-secondary hover:text-text-primary"
                  >
                    {selectedImageIds.size === sortedImages.length && sortedImages.length > 0 ? "DESELECT ALL" : "SELECT ALL"}
                  </button>
                  <div className="flex items-center gap-1 border-l border-r border-panel-border px-2 mx-1">
                    <button
                      onClick={() => handleCustomMove("top")}
                      disabled={selectedImageIds.size === 0}
                      title="MOVE TO TOP"
                      className={cn(
                        "p-1 rounded transition-colors",
                        selectedImageIds.size > 0 ? "text-text-secondary hover:text-accent hover:bg-panel-border/50" : "text-text-muted cursor-not-allowed"
                      )}
                    >
                      <ChevronsUp size={14} />
                    </button>
                    <button
                      onClick={() => handleCustomMove("up")}
                      disabled={selectedImageIds.size === 0}
                      title="MOVE UP"
                      className={cn(
                        "p-1 rounded transition-colors",
                        selectedImageIds.size > 0 ? "text-text-secondary hover:text-accent hover:bg-panel-border/50" : "text-text-muted cursor-not-allowed"
                      )}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => handleCustomMove("down")}
                      disabled={selectedImageIds.size === 0}
                      title="MOVE DOWN"
                      className={cn(
                        "p-1 rounded transition-colors",
                        selectedImageIds.size > 0 ? "text-text-secondary hover:text-accent hover:bg-panel-border/50" : "text-text-muted cursor-not-allowed"
                      )}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => handleCustomMove("bottom")}
                      disabled={selectedImageIds.size === 0}
                      title="MOVE TO BOTTOM"
                      className={cn(
                        "p-1 rounded transition-colors",
                        selectedImageIds.size > 0 ? "text-text-secondary hover:text-accent hover:bg-panel-border/50" : "text-text-muted cursor-not-allowed"
                      )}
                    >
                      <ChevronsDown size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedImageIds.size === 1 && activeDatasetId && (
                      <button
                        onClick={() => {
                          const selectedId = Array.from(selectedImageIds)[0];
                          const targetImg = sortedImages.find(img => img.id === selectedId);
                          if (targetImg) {
                            handleSetAsCover(activeDatasetId, targetImg);
                          }
                        }}
                        className={cn(
                          "text-[10px] uppercase font-mono tracking-wider transition-colors px-2 py-0.5 rounded mr-1 flex items-center gap-1",
                          datasets.find(d => d.id === activeDatasetId)?.coverImageId === Array.from(selectedImageIds)[0]
                            ? "bg-amber-500/30 text-amber-300 font-bold"
                            : "text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20"
                        )}
                        title={t("SET AS DATASET COVER", "リストのカバー画像に設定")}
                      >
                        <Bookmark
                          size={12}
                          fill={datasets.find(d => d.id === activeDatasetId)?.coverImageId === Array.from(selectedImageIds)[0] ? "currentColor" : "none"}
                        />
                        {datasets.find(d => d.id === activeDatasetId)?.coverImageId === Array.from(selectedImageIds)[0] ? "COVER SET" : "SET COVER"}
                      </button>
                    )}
                    {favoriteDatasetId && favoriteDatasetId !== activeDatasetId && selectedImageIds.size > 0 && (
                      <button
                        onClick={() => handleCopySelected(favoriteDatasetId)}
                        className="text-[10px] uppercase font-mono tracking-wider transition-colors text-yellow-500 hover:text-yellow-400 px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 rounded mr-1 flex items-center gap-1"
                        title={t("COPY TO FAVORITE", "お気に入りにコピー")}
                      >
                        <Star size={12} fill="currentColor" /> COPY TO FAV
                      </button>
                    )}
                    <select
                      value={moveTargetId}
                      onChange={(e) => setMoveTargetId(e.target.value)}
                      disabled={selectedImageIds.size === 0}
                      className={cn(
                        "bg-transparent outline-none text-[10px] uppercase font-mono tracking-wider transition-colors",
                        selectedImageIds.size > 0 ? "text-text-primary cursor-pointer border py-0.5 px-1 border-panel-border rounded" : "text-text-muted cursor-not-allowed border py-0.5 px-1 border-transparent"
                      )}
                    >
                      <option value="" className="bg-white text-black">SEND TO...</option>
                      {datasets.filter(d => d.id !== activeDatasetId).map(ds => (
                        <option key={ds.id} value={ds.id} className="bg-white text-black">{ds.name}</option>
                      ))}
                    </select>
                    {moveTargetId && selectedImageIds.size > 0 && (
                      <>
                        <button
                          onClick={() => {
                            handleCopySelected(moveTargetId);
                            setMoveTargetId("");
                          }}
                          className="text-[10px] uppercase font-mono tracking-wider transition-colors text-blue-500 hover:text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded mr-1"
                        >
                          COPY
                        </button>
                        <button
                          onClick={() => {
                            handleMoveSelected(moveTargetId);
                            setMoveTargetId("");
                          }}
                          className="text-[10px] uppercase font-mono tracking-wider transition-colors text-accent hover:text-accent/80 px-2 py-0.5 bg-accent/10 rounded"
                        >
                          MOVE
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleDownloadSelected}
                    disabled={selectedImageIds.size === 0}
                    className={cn(
                      "text-[10px] uppercase font-mono tracking-wider transition-colors",
                      selectedImageIds.size > 0
                        ? "text-green-500 hover:text-green-400"
                        : "text-text-muted cursor-not-allowed",
                    )}
                  >
                    DOWNLOAD
                  </button>
                  <button
                    onClick={() => {
                      const allHidden = Array.from(selectedImageIds).every(id => {
                        const img = images.find(img => img.id === id);
                        return img?.isHidden;
                      });
                      handleHideSelected(!allHidden);
                    }}
                    disabled={selectedImageIds.size === 0}
                    className={cn(
                      "text-[10px] uppercase font-mono tracking-wider transition-colors",
                      selectedImageIds.size > 0
                        ? "text-amber-500 hover:text-amber-400"
                        : "text-text-muted cursor-not-allowed",
                    )}
                  >
                    {Array.from(selectedImageIds).every(id => {
                        const img = images.find(img => img.id === id);
                        return img?.isHidden;
                      }) ? "REVEAL" : "SECRET"}
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedImageIds.size === 0}
                    className={cn(
                      "text-[10px] uppercase font-mono tracking-wider transition-colors",
                      selectedImageIds.size > 0
                        ? "text-red-500 hover:text-red-400"
                        : "text-text-muted cursor-not-allowed",
                    )}
                  >
                    DELETE
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedImageIds(new Set());
                      setLastSelectedIdx(null);
                    }}
                    className="text-[10px] uppercase font-mono tracking-wider text-text-secondary hover:text-text-primary"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-text-muted">
                      SECRET:
                    </span>
                    <button
                      onClick={() => setShowHiddenImages(prev => !prev)}
                      className={cn(
                        "h-6 min-w-[32px] px-2 flex items-center justify-center border rounded-[2px] transition-colors",
                        showHiddenImages
                          ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                          : "border-panel-border text-text-secondary bg-panel-bg hover:text-text-primary"
                      )}
                      title={showHiddenImages ? "HIDE SECRETS" : "SHOW SECRETS"}
                    >
                      {showHiddenImages ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 mr-2">
                    <span className="text-[10px] uppercase text-text-muted">
                      ORIENT:
                    </span>
                    <div className="flex items-center border border-panel-border bg-panel-bg rounded-[2px] overflow-hidden">
                      {(["all", "portrait", "landscape"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            React.startTransition(() => {
                              setOrientationFilter(f);
                            });
                          }}
                          className={cn(
                            "h-6 min-w-[56px] flex items-center justify-center gap-1 text-[9px] uppercase font-mono tracking-wider transition-colors border-r border-panel-border last:border-r-0 px-2",
                            orientationFilter === f
                              ? "text-accent bg-accent/5"
                              : "text-text-secondary hover:text-text-primary hover:bg-root-bg",
                          )}
                        >
                          {f === "portrait" && <Smartphone size={10} />}
                          {f === "landscape" && <RectangleHorizontal size={10} />}
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-text-muted">
                      SORT:
                    </span>
                    <div className="flex items-center border border-panel-border bg-panel-bg rounded-[2px] overflow-hidden">
                      {(["name", "size", "type", "date", "custom", "random"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            if (f === "random") {
                              setSortField("random");
                              setRandomSeed((prev) => prev + 1);
                            } else if (sortField === f) {
                              setSortOrders((prev) => ({
                                ...prev,
                                [f]: prev[f] === "asc" ? "desc" : "asc",
                              }));
                            } else {
                              setSortField(f);
                            }
                          }}
                          className={cn(
                            "h-6 min-w-[72px] flex items-center justify-center text-[9px] uppercase font-mono tracking-wider transition-colors border-r border-panel-border last:border-r-0 px-2",
                            sortField === f
                              ? "text-accent bg-accent/5"
                              : "text-text-secondary hover:text-text-primary hover:bg-root-bg",
                          )}
                        >
                          <span className="relative flex items-center justify-center">
                            <span>{f}</span>
                            {f !== "random" && (
                              <span className={cn("absolute left-full ml-1 flex items-center justify-center", sortField === f ? "opacity-100" : "opacity-0")}>
                                {sortField === f ? (sortOrders[f] === "asc" ? "↑" : "↓") : "↑"}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (activeDatasetId) {
                        loadImages(activeDatasetId);
                      }
                    }}
                    title="RELOAD DATASET"
                    className="text-[10px] uppercase font-mono tracking-wider text-text-secondary transition-colors hover:text-accent border border-panel-border hover:border-accent/50 px-2 py-0.5 rounded-sm flex items-center justify-center bg-panel-bg"
                  >
                    <RefreshCw size={12} className="mr-1" /> RELOAD
                  </button>
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="text-[10px] uppercase font-mono tracking-wider text-accent transition-colors hover:text-accent border border-accent/20 hover:border-accent/50 px-2 py-0.5 rounded-sm flex items-center justify-center bg-accent/5"
                  >
                    EDIT
                  </button>
                  <span className="text-accent pl-4 border-l border-panel-border h-4 flex items-center justify-end w-[110px]">
                    {viewMode.toUpperCase()}{" "}
                    {viewMode === "free" ? "BOARD" : "VIEW"}
                  </span>
                </div>
              )
            }
            className="flex-1 relative overflow-hidden"
          >
            <div
              ref={scatterContainerRef}
              className={cn("w-full h-full relative")}
              onClickCapture={(e) => {
                if (autoScrollDirRef.current !== null) {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-scroll-controls="true"]')) {
                    return;
                  }
                  setAutoScrollDir(null);
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  ref={scrollContainerRef}
                  key={viewMode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className={cn(
                    "w-full h-full absolute inset-0 p-4",
                    (viewMode === "grid-sq" ||
                      viewMode === "grid-ma" ||
                      viewMode === "list") &&
                      "overflow-y-auto overflow-x-hidden pb-8",
                    viewMode === "free" && "overflow-hidden",
                  )}
                >
                  {(() => {
                    // 1. Home / Folder Explorer View
                    if (activeDatasetId === null && !isCategoryImagesView) {
                      return (
                        <CategoryExplorer
                          categories={categories}
                          datasets={datasets}
                          datasetCounts={datasetCounts}
                          datasetPreviewUrls={datasetPreviewUrls}
                          activeCategoryId={activeCategoryId}
                          totalImagesCount={totalImagesCount}
                          homeViewMode={homeViewMode}
                          favoriteDatasetId={favoriteDatasetId}
                          setHomeViewMode={setHomeViewMode}
                          onSelectCategory={(catId) => {
                            setActiveCategoryId(catId);
                            setActiveDatasetId(null);
                            setIsCategoryImagesView(false);
                            setSearchQuery("");
                            setSearchInput("");
                          }}
                          onSelectDataset={(dsId) => {
                            setActiveDatasetId(dsId);
                            setIsCategoryImagesView(false);
                            setSearchQuery("");
                            setSearchInput("");
                          }}
                          onViewCategoryImages={(catId) => {
                            loadImagesForCategory(catId);
                          }}
                          onAddCategory={handleOpenNewCategoryModal}
                          onAddDataset={(catId) => handleAddDatasetClick(catId)}
                          onRenameCategory={handleOpenRenameCategoryModal}
                          onDeleteCategory={handleDeleteCategoryClick}
                          onTogglePinDataset={handleTogglePinDataset}
                          onCycleCoverPosition={handleCycleCoverPosition}
                          onCycleCategoryCoverPosition={handleCycleCategoryCoverPosition}
                          onMoveDatasetToCategory={handleMoveDatasetToCategory}
                          onMoveCategoryParent={handleMoveCategoryParent}
                          onReorderDatasets={handleReorderDatasetItems}
                          onReorderCategories={handleReorderCategories}
                          onRequestMoveDatasetModal={handleRequestMoveDatasetModal}
                          onRequestMoveCategoryModal={handleRequestMoveCategoryModal}
                          onRequestColorCategoryModal={(cat) => {
                            setColorCategoryModalTarget(cat);
                            setColorCategoryInput(cat.color || themeFolderColors[theme] || "#fbbf24");
                          }}
                          t={t}
                        />
                      );
                    }

                    // 2. Empty State when in dataset/category image view
                    if (sortedImages.length === 0 && !isLoading) {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted font-mono text-xs pointer-events-none">
                          <ImageIcon size={48} className="mb-4 opacity-20" />
                          NO DATA IN INDEX
                        </div>
                      );
                    }

                    // 3. Image Grid View (Dataset or Folder All-Images View)
                    const isSortable = !searchQuery.trim() && (viewMode === "grid-sq" || viewMode === "list" || viewMode === "grid-ma") && sortField === "custom";
                    const Container: any = isSortable ? ReactSortable : "div";
                    const containerProps = isSortable ? {
                      list: sortedImages.map(img => ({ ...img, id: img.id })),
                      setList: () => {},
                      onEnd: handleSortEnd,
                      animation: 150,
                      disabled: sortOrders[sortField] !== "asc",
                      delay: 150,
                      delayOnTouchOnly: true,
                    } : {};

                    return (
                      <>
                        {/* Folder All-Images View Sticky Header */}
                        {isCategoryImagesView && (
                          <div className="sticky top-0 z-40 w-full mb-4 flex flex-wrap items-center justify-between gap-3 bg-panel-bg/95 backdrop-blur-md px-4 py-2.5 border border-panel-border shadow-md select-none">
                            <div className="flex items-center gap-3 font-mono">
                              <button
                                type="button"
                                onClick={() => setIsCategoryImagesView(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent text-xs font-bold transition-colors shadow-sm"
                              >
                                <ChevronLeft size={14} />
                                <span>{t("BACK TO FOLDER", "フォルダーに戻る")}</span>
                              </button>
                              <div className="flex items-center gap-2 text-xs">
                                <FolderOpen size={15} className="text-folder-icon" />
                                <span className="text-text-secondary">{t("FOLDER: ", "フォルダー: ")}</span>
                                <span className="font-bold text-text-primary">
                                  {categories.find((c) => c.id === activeCategoryId)?.name || "FOLDER"}
                                </span>
                                <span className="text-accent bg-accent/15 px-2 py-0.5 rounded text-[11px] font-bold">
                                  {sortedImages.length} {t("IMAGES", "枚")}
                                </span>
                              </div>
                            </div>
                            {/* Fast sub-dataset tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50%] scrollbar-none text-[11px] font-mono">
                              {getCategoryDirectDatasets(activeCategoryId).map((ds) => (
                                <button
                                  key={ds.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveDatasetId(ds.id);
                                    setIsCategoryImagesView(false);
                                  }}
                                  className="px-2 py-1 bg-panel-bg border border-panel-border/80 hover:border-accent text-text-secondary hover:text-text-primary transition-colors truncate"
                                  title={ds.name}
                                >
                                  {ds.name} ({datasetCounts[ds.id] || 0})
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Search Results Header */}
                        {searchQuery.trim() && (
                          <div className="absolute top-4 left-0 w-full z-50 flex items-center justify-center pointer-events-none mb-6">
                            <div className="bg-panel-bg/70 backdrop-blur-md border border-panel-border/50 shadow-lg rounded-full px-6 py-2.5 flex items-center gap-3">
                              <span className="font-mono text-accent uppercase tracking-widest text-xs font-bold drop-shadow-md">
                                SEARCH RESULTS: "{searchQuery}"
                              </span>
                              <div className="w-px h-4 bg-panel-border" />
                              <span className="font-mono text-text-muted text-[10px] uppercase tracking-widest drop-shadow-md">
                                {sortedImages.length} {sortedImages.length === 1 ? 'MATCH' : 'MATCHES'}
                              </span>
                            </div>
                          </div>
                        )}

                        <Container
                          {...containerProps}
                          className={cn(
                            "w-full h-auto",
                            !searchQuery.trim() && viewMode === "grid-sq" &&
                              "grid content-start justify-center",
                            !searchQuery.trim() && viewMode === "grid-ma" && "flex items-start",
                            (!searchQuery.trim() && viewMode === "list") && "flex flex-col",
                          )}
                          style={{
                            ...(!searchQuery.trim() && viewMode === "grid-sq"
                              ? {
                                  gridTemplateColumns: `repeat(auto-fill, minmax(${itemScale}px, 1fr))`,
                                  gap: `${gridGap}px`,
                                }
                              : {}),
                            ...(!searchQuery.trim() && viewMode === "grid-ma"
                              ? { gap: `${gridGap}px` }
                              : {}),
                            ...(!searchQuery.trim() && viewMode === "list" ? { gap: `${gridGap}px` } : {}),
                          }}
                        >
                          {(() => {
                            if (searchQuery.trim() && viewMode !== "free") {
                              const groupedImages: Record<string, typeof sortedImages> = {};
                              sortedImages.forEach(img => {
                                 if (!groupedImages[img.datasetId]) {
                                    groupedImages[img.datasetId] = [];
                                 }
                                 groupedImages[img.datasetId].push(img);
                              });

                              return (
                                <div className="flex flex-col w-full h-auto mt-16">
                                  <div className="flex flex-col gap-8 w-full h-auto px-4 pb-8">
                                  {Object.entries(groupedImages).map(([datasetId, imgs]) => {
                                     const dataset = datasets.find(d => d.id === datasetId);
                                     const datasetName = dataset ? dataset.name : "UNKNOWN";

                                     return (
                                       <div key={datasetId} className="flex flex-col gap-2">
                                         <div 
                                           className="bg-panel-bg border border-panel-border px-4 py-2 font-mono text-accent text-sm tracking-widest font-bold border-l-2 border-l-accent uppercase flex items-center justify-between cursor-pointer hover:bg-black/10 transition-colors group"
                                           onClick={() => {
                                              setActiveDatasetId(datasetId);
                                              setIsCategoryImagesView(false);
                                              setSearchQuery("");
                                              setSearchInput("");
                                           }}
                                           title={t("Click to open this dataset", "クリックしてこのデータセットを開く")}
                                         >
                                           <span className="group-hover:underline">{datasetName}</span>
                                           <span className="text-xs text-text-muted group-hover:text-accent transition-colors">{imgs.length} IMAGES</span>
                                         </div>
                                         <div
                                           className={cn(
                                             "w-full h-auto",
                                             viewMode === "grid-sq" && "grid content-start justify-center",
                                             viewMode === "grid-ma" && "flex items-start",
                                             viewMode === "list" && "flex flex-col",
                                           )}
                                           style={{
                                              ...(viewMode === "grid-sq" ? { gridTemplateColumns: `repeat(auto-fill, minmax(${itemScale}px, 1fr))`, gap: `${gridGap}px` } : {}),
                                              ...(viewMode === "grid-ma" ? { gap: `${gridGap}px` } : {}),
                                              ...(viewMode === "list" ? { gap: `${gridGap}px` } : {}),
                                           }}
                                         >
                                            {viewMode === "grid-ma" ? (
                                                (() => {
                                                  const colsCount = Math.max(1, Math.floor((containerWidth - 32 - 16 + gridGap) / (itemScale + gridGap)));
                                                  const columns = Array.from({ length: colsCount }, () => [] as typeof sortedImages);
                                                  imgs.forEach((img, index) => {
                                                    columns[index % colsCount].push(img);
                                                  });
                                                  return columns.map((col, colIndex) => (
                                                    <div key={colIndex} className="flex flex-col flex-1 min-w-0" style={{ gap: `${gridGap}px` }}>
                                                      {col.map(img => {
                                                        const globalIdx = sortedImages.findIndex(sim => sim.id === img.id);
                                                        return renderImageCard(img, globalIdx, selectedImage?.id === img.id, isSelectionMode && selectedImageIds.has(img.id));
                                                      })}
                                                    </div>
                                                  ));
                                                })()
                                            ) : (
                                                imgs.map(img => {
                                                   const globalIdx = sortedImages.findIndex(sim => sim.id === img.id);
                                                   return renderImageCard(img, globalIdx, selectedImage?.id === img.id, isSelectionMode && selectedImageIds.has(img.id));
                                                })
                                            )}
                                         </div>
                                       </div>
                                     );
                                  })}
                                  </div>
                                </div>
                              );
                            }

                            if (viewMode === "grid-ma") {
                              return masonryColumns.map((col, colIdx) => (
                                <div
                                  key={colIdx}
                                  className="flex flex-col flex-1 min-w-0"
                                  style={{ gap: `${gridGap}px` }}
                                >
                                  {col.map((img) => {
                                    const isSelected = selectedImage?.id === img.id;
                                    const isMultiSelected =
                                      isSelectionMode && selectedImageIds.has(img.id);
                                    const globalIdx = sortedImages.findIndex(
                                      (sim) => sim.id === img.id,
                                    );
                                    return renderImageCard(
                                      img,
                                      globalIdx,
                                      isSelected,
                                      isMultiSelected,
                                    );
                                  })}
                                </div>
                              ));
                            }

                            return sortedImages.map((img, i) => {
                              const isSelected = selectedImage?.id === img.id;
                              const isMultiSelected =
                                isSelectionMode && selectedImageIds.has(img.id);
                              return renderImageCard(
                                img,
                                i,
                                isSelected,
                                isMultiSelected,
                              );
                            });
                          })()}
                        </Container>
                      </>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
              {viewMode !== "free" && sortedImages.length > 0 && (
                <div data-scroll-controls="true" className="absolute bottom-6 right-8 z-[60] flex flex-col items-end gap-2 select-none">
                  {/* Vertical Scroll Nav Bar */}
                  <div className="flex flex-col items-center bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md border border-gray-300/80 dark:border-gray-700/80 shadow-md w-9 py-1 rounded-none">
                    {/* Scroll To Top */}
                    <button
                      type="button"
                      onClick={() => {
                        setAutoScrollDir(null);
                        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full py-1.5 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      title="SCROLL TO TOP"
                    >
                      <ChevronsUp size={14} />
                    </button>

                    {/* Auto Scroll UP Toggle */}
                    <button
                      type="button"
                      onClick={() => setAutoScrollDir((d) => (d === "up" ? null : "up"))}
                      className={cn(
                        "w-full py-1.5 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        autoScrollDir === "up"
                          ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white font-bold"
                          : "text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      title="AUTO SCROLL UP"
                    >
                      <ChevronUp size={14} />
                    </button>

                    {/* Subtle divider between UP and DOWN */}
                    <div className="w-3/4 mx-auto border-t border-gray-200 dark:border-gray-700/60 my-0.5" />

                    {/* Auto Scroll DOWN Toggle */}
                    <button
                      type="button"
                      onClick={() => setAutoScrollDir((d) => (d === "down" ? null : "down"))}
                      className={cn(
                        "w-full py-1.5 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        autoScrollDir === "down"
                          ? "bg-gray-200 dark:bg-gray-700 text-black dark:text-white font-bold"
                          : "text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      title="AUTO SCROLL DOWN"
                    >
                      <ChevronDown size={14} />
                    </button>

                    {/* Scroll To Bottom */}
                    <button
                      type="button"
                      onClick={() => {
                        setAutoScrollDir(null);
                        if (scrollContainerRef.current) {
                          scrollContainerRef.current.scrollTo({
                            top: scrollContainerRef.current.scrollHeight,
                            behavior: "smooth",
                          });
                        }
                      }}
                      className="w-full py-1.5 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      title="SCROLL TO BOTTOM"
                    >
                      <ChevronsDown size={14} />
                    </button>
                  </div>

                  {/* Horizontal Speed Control Bar (Bottom) */}
                  <div className="flex items-center bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md border border-gray-300/80 dark:border-gray-700/80 shadow-md h-7 px-1 rounded-none">
                    <button
                      type="button"
                      onClick={() => setAutoScrollSpeed((s) => Math.max(1, s - 1))}
                      disabled={autoScrollSpeed <= 1}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[12px] font-bold transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        autoScrollSpeed <= 1
                          ? "opacity-30 cursor-not-allowed text-gray-400"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
                      )}
                      title="SPEED DOWN (-)"
                    >
                      <Minus size={11} />
                    </button>

                    <span className="font-mono font-bold text-[11px] tabular-nums px-1 text-gray-800 dark:text-gray-200 pointer-events-none min-w-[22px] text-center select-none">
                      {autoScrollSpeed}x
                    </span>

                    <button
                      type="button"
                      onClick={() => setAutoScrollSpeed((s) => Math.min(4, s + 1))}
                      disabled={autoScrollSpeed >= 4}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[12px] font-bold transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        autoScrollSpeed >= 4
                          ? "opacity-30 cursor-not-allowed text-gray-400"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 cursor-pointer"
                      )}
                      title="SPEED UP (+)"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      
      {/* Export / Import Loading & Message Overlay */}
      <AnimatePresence>
        {(isLoading || loadingMessage) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div className="flex flex-col items-center gap-6 max-w-md w-full bg-panel-bg border border-panel-border p-6 rounded-lg shadow-2xl">
              {loadingMessage && (loadingMessage.includes("EXPORTING") || loadingMessage.includes("IMPORTING") || loadingMessage.includes("READING")) ? (
                <RefreshCw size={32} className="animate-spin text-accent" />
              ) : null}
              <div className="text-sm tracking-widest text-center whitespace-pre-line text-text-primary">
                {loadingMessage || "PROCESSING..."}
              </div>
              {loadingMessage && !(loadingMessage.includes("EXPORTING") || loadingMessage.includes("IMPORTING") || loadingMessage.includes("READING") || loadingMessage === "") && (
                <SolidButton 
                  onClick={() => {
                     setIsLoading(false);
                     setLoadingMessage("");
                  }} 
                  className="mt-4 px-6 py-2"
                >
                  OK
                </SolidButton>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Modal overlay */}
      <AnimatePresence>
        {isFullscreen && selectedImage && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(10px)", transition: { duration: 0.1 } }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)", transition: { duration: 0 } }}
            className={cn(
              "fixed inset-0 z-[100] bg-root-bg/90 flex items-center justify-center transition-all duration-300",
              isAppFullscreen ? "p-0" : "p-8"
            )}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsFullscreen(false);
              }
            }}
          >
            <motion.div
              className={cn(
                "relative rounded-none overflow-hidden flex items-center justify-center bg-panel-bg transition-all duration-300 origin-center",
                isAppFullscreen ? "border-0 shadow-none" : "border border-panel-border shadow-[0_0_50px_rgba(0,0,0,0.8)]",
              )}
              style={
                isPortraitMode
                  ? {
                      width: isAppFullscreen ? "100vh" : "95vh",
                      height: isAppFullscreen ? "100vw" : "95vw",
                      transform: portraitMode === "left" ? "rotate(-90deg)" : "rotate(90deg)",
                    }
                  : {
                      width: "100%",
                      height: "100%",
                      maxWidth: isAppFullscreen ? "100vw" : "95vw",
                      maxHeight: isAppFullscreen ? "100vh" : "95vh",
                    }
              }
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                ref={fullscreenContainerRef}
                className={cn(
                  "relative flex items-center justify-center w-full h-full overflow-hidden",
                  getCanvasBgClass(selectedImage.autoBg),
                )}
                onWheel={(e) => {
                  e.stopPropagation();
                  setFullscreenScale((s) => {
                    const MathMax = Math.max;
                    const MathMin = Math.min;
                    const newScale = MathMax(
                      0.1,
                      MathMin(s - e.deltaY * 0.001, 10),
                    );
                    const scaleRatio = newScale / s;

                    let targetX = imgX.get() * scaleRatio;
                    let targetY = imgY.get() * scaleRatio;

                    let newMaxX = 0;
                    let newMaxY = 0;
                    if (imgDims.w > 0 && imgDims.h > 0) {
                      const aspectImg = imgDims.w / imgDims.h;
                      const aspectScreen = cW / cH;
                      const renderedW =
                        aspectImg > aspectScreen ? cW : cH * aspectImg;
                      const renderedH =
                        aspectImg > aspectScreen ? cW / aspectImg : cH;
                      newMaxX = MathMax(0, (renderedW * newScale - cW) / 2);
                      newMaxY = MathMax(0, (renderedH * newScale - cH) / 2);
                    }

                    if (targetX > newMaxX) targetX = newMaxX;
                    if (targetX < -newMaxX) targetX = -newMaxX;
                    if (targetY > newMaxY) targetY = newMaxY;
                    if (targetY < -newMaxY) targetY = -newMaxY;

                    if (newScale <= 1.0) {
                      targetX = 0;
                      targetY = 0;
                    }

                    imgControls.start({
                      scale: newScale,
                      x: targetX,
                      y: targetY,
                    });
                    return newScale;
                  });
                }}
              >
                <motion.img
                  key={selectedImage.id}
                  src={selectedImage.url}
                  style={{ x: imgX, y: imgY }}
                  initial={{
                    scale: fullscreenScale,
                    rotate: fullscreenRotation,
                    rotateY: fullscreenFlipX ? 180 : 0,
                  }}
                  animate={imgControls}
                  className={cn(
                    "w-full h-full object-contain block select-none",
                    fullscreenScale > 1.0 ? "cursor-move" : "cursor-default",
                  )}
                  drag={fullscreenScale > 1.0}
                  draggable={false}
                  dragConstraints={{
                    left: -maxDragX,
                    right: maxDragX,
                    top: -maxDragY,
                    bottom: maxDragY,
                  }}
                  dragElastic={0.1}
                  onLoad={(e) => {
                    setImgDims({
                      w: e.currentTarget.naturalWidth,
                      h: e.currentTarget.naturalHeight,
                    });
                    imgControls.start({
                      scale: fullscreenScale,
                      rotate: fullscreenRotation,
                      rotateY: fullscreenFlipX ? 180 : 0,
                      transition: { duration: 0.05 },
                    });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setFullscreenScale(1);
                    setFullscreenRotation(0);
                    setFullscreenFlipX(false);
                    imgControls.start({ x: 0, y: 0, scale: 1, rotate: 0, rotateY: 0 });
                  }}
                  title="Drag to Move / Scroll to Zoom / Double-click to Reset"
                />
              </div>

              <AnimatePresence>
                {showFullscreenUI && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
              {/* Slideshow Pill Controls (Bottom Left) */}
              <div
                className={cn(
                  "absolute bottom-6 left-6 z-[60] flex flex-col bg-[#e4e4e7]/90 dark:bg-[#27272a]/90 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-lg rounded-full pointer-events-auto select-none overflow-hidden",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center px-2 py-1">
                  {/* Direction: FWD » or « REV (Fixed width) */}
                  <button
                    type="button"
                    onClick={() => setSlideshowDirection((d) => (d === "fwd" ? "rev" : "fwd"))}
                    className="w-[52px] inline-flex items-center justify-center font-mono text-[11px] font-bold py-1 text-gray-800 dark:text-gray-200 hover:text-black dark:hover:text-white transition-colors cursor-pointer rounded-full"
                    title={slideshowDirection === "fwd" ? "Slideshow: Forward (Click to reverse, S)" : "Slideshow: Reverse (Click to forward, S)"}
                  >
                    {slideshowDirection === "fwd" ? "FWD »" : "« REV"}
                  </button>

                  <div className="h-3.5 w-px bg-black/20 dark:bg-white/20 mx-1" />

                  {/* PLAY / STOP */}
                  <button
                    type="button"
                    onClick={() => setIsSlideshowPlaying((p) => !p)}
                    className={cn(
                      "w-[68px] flex items-center justify-center gap-1.5 py-1 rounded-full text-[11px] font-bold font-mono transition-colors cursor-pointer",
                      isSlideshowPlaying
                        ? "bg-black text-white dark:bg-white dark:text-black shadow-sm"
                        : "bg-black/10 dark:bg-white/10 text-gray-900 dark:text-gray-100 hover:bg-black/20 dark:hover:bg-white/20"
                    )}
                    title={isSlideshowPlaying ? "Stop Slideshow (Space)" : "Play Slideshow (Space)"}
                  >
                    {isSlideshowPlaying ? (
                      <>
                        <Square size={9} className="fill-current" />
                        <span>STOP</span>
                      </>
                    ) : (
                      <>
                        <Play size={10} className="fill-current ml-0.5" />
                        <span>PLAY</span>
                      </>
                    )}
                  </button>

                  <div className="h-3.5 w-px bg-black/20 dark:bg-white/20 mx-1" />

                  {/* Interval: 1s, 2s, 3s, 5s, 8s, 10s (Fixed width for 2-digits) */}
                  <button
                    type="button"
                    onClick={() => {
                      const intervals = [1, 2, 3, 5, 8, 10];
                      setSlideshowIntervalSec((sec) => {
                        const idx = intervals.indexOf(sec);
                        return intervals[(idx + 1) % intervals.length];
                      });
                    }}
                    className="w-[38px] inline-flex items-center justify-center font-mono text-[11px] font-bold py-1 tabular-nums text-gray-800 dark:text-gray-200 hover:text-black dark:hover:text-white transition-colors cursor-pointer rounded-full"
                    title="Click to change slide interval (T)"
                  >
                    {slideshowIntervalSec}s
                  </button>
                </div>

                {/* Progress Bar (Always 2px height to avoid shifting) */}
                <div className="w-full h-[2px] bg-transparent overflow-hidden">
                  {isSlideshowPlaying && (
                    <motion.div
                      key={slideshowProgressKey}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: slideshowIntervalSec, ease: "linear" }}
                      className="h-full bg-black dark:bg-white"
                    />
                  )}
                </div>
              </div>

              {/* Overlay Meta */}
              <div className="absolute top-0 left-0 p-3 pointer-events-none max-w-[80%] flex flex-col gap-1">
                <h2
                  onClick={(e) => {
                    handleRenameFileClick(e, selectedImage.id, selectedImage.name);
                  }}
                  className={cn(
                    "font-mono text-[10px] md:text-[11px] font-bold mb-0.5 truncate pointer-events-auto cursor-pointer flex items-center gap-1 group/fsname",
                    isFullscreenDarkText ? "text-black/60 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]" : "text-white/80 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]",
                  )}
                  title="RENAME FILE"
                >
                  <span className="truncate">{selectedImage.name}</span>
                  <Edit2 size={12} className="opacity-0 group-hover/fsname:opacity-100 transition-opacity flex-shrink-0" />
                </h2>
                <div
                  className={cn(
                    "font-mono text-[9px] flex gap-3 items-center pointer-events-auto",
                    isFullscreenDarkText ? "text-black/60 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]" : "text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]",
                  )}
                >
                  <span>{formatBytes(selectedImage.size)}</span>
                  <span>{selectedImage.type}</span>
                </div>
              </div>

              {/* Navigation Buttons */}
              {sortedImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToPrevImage();
                    }}
                    className={cn(
                      "absolute left-6 top-1/2 -translate-y-1/2 p-2 transition-colors drop-shadow-md hover:scale-110 outline-none focus:outline-none",
                      isFullscreenDarkText
                        ? "text-black/50 hover:text-black"
                        : "text-white/50 hover:text-white",
                    )}
                  >
                    <ChevronLeft size={48} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToNextImage();
                    }}
                    className={cn(
                      "absolute right-6 top-1/2 -translate-y-1/2 p-2 transition-colors drop-shadow-md hover:scale-110 outline-none focus:outline-none",
                      isFullscreenDarkText
                        ? "text-black/50 hover:text-black"
                        : "text-white/50 hover:text-white",
                    )}
                  >
                    <ChevronRight size={48} />
                  </button>
                </>
              )}

              <div className="absolute bottom-6 right-6 flex items-center gap-2 pointer-events-auto">
                {/* Delete Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); executeHideFullscreenImage(); }}
                  className={cn(
                    "p-1.5 flex items-center justify-center border rounded bg-black/15 backdrop-blur-sm transition-colors outline-none focus:outline-none",
                    isFullscreenDarkText
                      ? "border-black/15 text-black/60 hover:text-amber-600 hover:border-amber-600/50 hover:bg-amber-500/10"
                      : "border-white/15 text-white/60 hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-500/10",
                  )}
                  title={selectedImage?.isHidden ? "REVEAL (Del)" : "SECRET (Del)"}
                >
                  {selectedImage?.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); executeDeleteFullscreenImage(); }}
                  className={cn(
                    "p-1.5 flex items-center justify-center border rounded bg-black/15 backdrop-blur-sm transition-colors outline-none focus:outline-none",
                    isFullscreenDarkText
                      ? "border-black/15 text-black/60 hover:text-red-600 hover:border-red-600/50 hover:bg-red-500/10"
                      : "border-white/15 text-white/60 hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10",
                  )}
                  title="DELETE IMAGE"
                >
                  <Trash2 size={16} />
                </button>

                {/* BG Toggle Button Group */}
                <div
                  className={cn(
                    "flex items-center gap-1.5 font-mono text-[9px] tracking-wider border px-2 py-1.5 rounded bg-black/15 backdrop-blur-sm transition-colors",
                    isFullscreenDarkText
                      ? "border-black/15 text-black"
                      : "border-white/15 text-white",
                  )}
                >
                <span className={isFullscreenDarkText ? "text-black/60" : "text-white/60"}>BG:</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasBg("theme");
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all",
                    canvasBg === "theme"
                      ? (isFullscreenDarkText ? "bg-black text-white " : "bg-white text-black ")
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  AUTO
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasBg("white");
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all",
                    canvasBg === "white"
                      ? (isFullscreenDarkText ? "bg-black text-white " : "bg-white text-black ")
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  WHT
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasBg("black");
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all",
                    canvasBg === "black"
                      ? (isFullscreenDarkText ? "bg-black text-white " : "bg-white text-black ")
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  BLK
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasBg("checker");
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all",
                    canvasBg === "checker"
                      ? (isFullscreenDarkText ? "bg-black text-white " : "bg-white text-black ")
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  CHK
                </button>
              </div>
              </div>

              {/* Image Controls Panel */}
              <div
                className={cn(
                  "absolute bottom-[64px] right-6 flex flex-col items-center gap-1 py-1 rounded transition-colors pointer-events-auto border backdrop-blur-sm w-11",
                  isFullscreenDarkText
                    ? "bg-black/15 border-black/15 text-black"
                    : "bg-white/10 border-white/15 text-white"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="font-mono text-[9px] py-0.5 mt-0.5 w-[85%] flex items-center justify-center rounded bg-black/40 text-white/90 shadow-inner pointer-events-none">
                  {Math.round(fullscreenScale * 100)}%
                </div>
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    startZoomIn();
                  }}
                  onPointerUp={stopZooming}
                  onPointerLeave={stopZooming}
                  className="p-1 hover:bg-white/20 rounded transition-colors touch-none"
                  title="Zoom In"
                >
                  <ChevronUp size={20} />
                </button>
                <div className="h-[150px] w-8 relative flex items-center justify-center">
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.001"
                    value={Math.log10(fullscreenScale)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const newScale = Math.pow(10, val);
                      setFullscreenScale(newScale);
                      if (newScale <= 1) {
                        imgControls.start({ x: 0, y: 0, scale: newScale });
                      } else {
                        imgControls.start({ scale: newScale });
                      }
                    }}
                    className={cn(
                      "h-1.5 accent-accent rounded-lg appearance-none cursor-pointer shrink-0",
                      isFullscreenDarkText ? "bg-black/30" : "bg-white/30"
                    )}
                    style={{ width: "150px", transform: "rotate(-90deg)" }}
                  />
                </div>
                <button
                  onPointerDown={(e) => {
                    e.preventDefault();
                    startZoomOut();
                  }}
                  onPointerUp={stopZooming}
                  onPointerLeave={stopZooming}
                  className="p-1 hover:bg-white/20 rounded transition-colors touch-none"
                  title="Zoom Out"
                >
                  <ChevronDown size={20} />
                </button>
                
                <div className={cn("w-full h-px my-1", isFullscreenDarkText ? "bg-black/15" : "bg-white/15")}></div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenFlipX(f => {
                      const next = !f;
                      imgControls.start({ rotateY: next ? 180 : 0, transition: { duration: 0.2 } });
                      return next;
                    });
                  }}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors touch-none"
                  title={t("Flip Horizontal (H)", "左右反転 (H)")}
                >
                  <FlipHorizontal size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenRotation(r => {
                      const next = r + 90;
                      imgControls.start({ rotate: next, transition: { duration: 0.2 } });
                      return next;
                    });
                  }}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors touch-none"
                  title={t("Rotate 90° (R)", "90度回転 (R)")}
                >
                  <RotateCw size={18} />
                </button>
                <div className={cn("w-full h-px my-1", isFullscreenDarkText ? "bg-black/15" : "bg-white/15")}></div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedImage) handleDownloadImage(selectedImage);
                  }}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors touch-none"
                  title={t("Download", "ダウンロード")}
                >
                  <Download size={18} />
                </button>
              </div>
              {/* Favorite Button in Fullscreen */}
              {favoriteDatasetId && favoriteDatasetId !== activeDatasetId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedImage) {
                      handleCopySelected(favoriteDatasetId, [selectedImage.id]);
                      setFullscreenFavorited(prev => {
                        const next = new Set(prev);
                        next.add(selectedImage.id);
                        return next;
                      });
                    }
                  }}
                  className={cn(
                    "absolute top-6 right-[196px] w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
                    isFullscreenDarkText
                      ? "bg-white/20 border-black/10 text-black/70 hover:text-black hover:bg-white/40"
                      : "bg-black/20 border-white/10 text-white/70 hover:text-white hover:bg-black/40"
                  )}
                  title={t("COPY TO FAVORITE", "お気に入りにコピー")}
                >
                  <Star 
                    size={24} 
                    className={selectedImage && fullscreenFavorited.has(selectedImage.id) ? "text-yellow-400" : "text-inherit"} 
                    fill={selectedImage && fullscreenFavorited.has(selectedImage.id) ? "currentColor" : "none"} 
                  />
                </button>
              )}

              {/* Cover Image Set Button in Fullscreen */}
              {activeDatasetId && selectedImage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetAsCover(activeDatasetId, selectedImage);
                  }}
                  className={cn(
                    "absolute top-6 w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
                    favoriteDatasetId && favoriteDatasetId !== activeDatasetId ? "right-[256px]" : "right-[196px]",
                    isFullscreenDarkText
                      ? "bg-white/20 border-black/10 text-black/70 hover:text-black hover:bg-white/40"
                      : "bg-black/20 border-white/10 text-white/70 hover:text-white hover:bg-black/40",
                    datasets.find(d => d.id === activeDatasetId)?.coverImageId === selectedImage.id && (
                      isFullscreenDarkText
                        ? "bg-amber-400/60 text-black border-amber-500/60"
                        : "bg-amber-500/50 text-amber-300 border-amber-400/60"
                    )
                  )}
                  title={
                    datasets.find(d => d.id === activeDatasetId)?.coverImageId === selectedImage.id
                      ? t("COVER IMAGE (CLICK TO RESET)", "カバー画像に設定中（クリックで初期解除）")
                      : t("SET AS COVER IMAGE", "この画像をリストのカバー画像に設定")
                  }
                >
                  <Bookmark 
                    size={22} 
                    className={datasets.find(d => d.id === activeDatasetId)?.coverImageId === selectedImage.id ? "text-amber-400" : "text-inherit"} 
                    fill={datasets.find(d => d.id === activeDatasetId)?.coverImageId === selectedImage.id ? "currentColor" : "none"} 
                  />
                </button>
              )}
              {/* Portrait Mode Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (portraitMode === "off") setPortraitMode("left");
                  else if (portraitMode === "left") setPortraitMode("right");
                  else setPortraitMode("off");
                }}
                className={cn(
                  "absolute top-6 right-[136px] w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
                  isFullscreenDarkText
                    ? "bg-white/20 border-black/10 text-black/70 hover:text-black hover:bg-white/40"
                    : "bg-black/20 border-white/10 text-white/70 hover:text-white hover:bg-black/40",
                  portraitMode !== "off" && (isFullscreenDarkText ? "bg-white/50 text-black border-black/20" : "bg-black/50 text-white border-white/20")
                )}
                title={t("Portrait Mode (P)", "ポートレート切替 (P)")}
              >
                <MonitorSmartphone size={24} className={cn("transition-transform duration-300", portraitMode === "left" ? "-rotate-90" : portraitMode === "right" ? "rotate-90" : "")} />
              </button>

              {/* Borderless Toggle Button */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleAppFullscreen(); }}
                className={cn(
                  "absolute top-6 right-[76px] w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
                  isFullscreenDarkText
                    ? "bg-white/20 border-black/10 text-black/70 hover:text-black hover:bg-white/40"
                    : "bg-black/20 border-white/10 text-white/70 hover:text-white hover:bg-black/40",
                  isAppFullscreen && (isFullscreenDarkText ? "bg-white/50 text-black border-black/20" : "bg-black/50 text-white border-white/20")
                )}
                title={t("Borderless (F)", "ボーダレス (F)")}
              >
                {isAppFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => setIsFullscreen(false)}
                className={cn(
                  "absolute top-6 right-4 w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
                  isFullscreenDarkText
                    ? "bg-white/20 border-black/10 text-black/70 hover:text-black hover:bg-white/40"
                    : "bg-black/20 border-white/10 text-white/70 hover:text-white hover:bg-black/40"
                )}
                title={t("Close (Esc)", "閉じる (Esc)")}
              >
                <X size={26} />
              </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[400px]">
              <h2 className="text-text-primary mb-4 uppercase">
                {editingDatasetId ? "RENAME DATASET" : "NEW DATASET"}
              </h2>
              <input
                autoFocus
                type="text"
                value={datasetNameInput}
                onChange={(e) => setDatasetNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitDatasetForm()}
                className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 mb-6 outline-none focus:border-accent"
                placeholder="ENTER NAME..."
              />
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowNewDatasetModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <SolidButton
                  onClick={submitDatasetForm}
                  className="text-accent hover:text-accent"
                >
                  CONFIRM
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New/Rename Category Modal */}
      <AnimatePresence>
        {showNewCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[400px]">
              <h2 className="text-text-primary mb-4 uppercase flex items-center gap-2">
                <Folder size={18} className="text-accent" />
                {editingCategoryId ? t("RENAME CATEGORY", "カテゴリー名変更") : t("NEW CATEGORY", "新規カテゴリー作成")}
              </h2>
              <input
                autoFocus
                type="text"
                value={categoryNameInput}
                onChange={(e) => setCategoryNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCategoryForm()}
                className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 mb-6 outline-none focus:border-accent"
                placeholder={t("ENTER CATEGORY NAME...", "カテゴリー名を入力...")}
              />
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowNewCategoryModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={submitCategoryForm}
                  className="text-accent hover:text-accent"
                >
                  {t("CONFIRM", "確定")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Category Confirmation Modal */}
      <AnimatePresence>
        {showDeleteCategoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[420px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} /> {t("DELETE CATEGORY", "カテゴリーの削除")}
              </h2>
              <p className="text-text-primary text-xs mb-6 leading-relaxed">
                {t(
                  "Are you sure you want to delete this category? Any datasets inside will be moved to the parent level.",
                  "このカテゴリーを削除しますか？含まれるデータセットは親階層（またはルート）に移動されます。"
                )}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowDeleteCategoryModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <button
                  onClick={confirmDeleteCategory}
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 uppercase transition-colors outline-none"
                >
                  {t("DELETE", "削除")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move Target Selection Modal (For Folder or Dataset) */}
      <AnimatePresence>
        {showMoveItemModal && itemToMove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[460px] max-h-[85vh] flex flex-col shadow-2xl">
              <h2 className="text-text-primary mb-2 uppercase flex items-center gap-2 text-sm font-bold">
                <FolderOpen size={18} className="text-accent" />
                {itemToMove.type === "category"
                  ? t("MOVE FOLDER TO...", "フォルダーの移動先を選択")
                  : t("MOVE DATASET TO...", "データセットの移動先フォルダーを選択")}
              </h2>
              <p className="text-xs text-text-muted mb-4">
                {t("TARGET: ", "対象: ")}
                <span className="text-text-primary font-bold">{itemToMove.item.name}</span>
              </p>

              <div className="flex-1 overflow-y-auto border border-panel-border bg-root-bg p-2 flex flex-col gap-1 mb-5 max-h-[320px] scrollbar-dark">
                {/* Option 1: Root / Top level */}
                <button
                  type="button"
                  onClick={() => {
                    if (itemToMove.type === "category") {
                      handleMoveCategoryParent(itemToMove.item.id, null);
                    } else {
                      handleMoveDatasetToCategory(itemToMove.item.id, null);
                    }
                    setShowMoveItemModal(false);
                    setItemToMove(null);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between border border-panel-border/50 hover:border-accent hover:bg-accent/15 transition-colors group text-text-primary"
                >
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-accent" />
                    <span className="font-bold">{t("IMAGE DATA (ROOT / UNCLASSIFIED)", "IMAGE DATA (ルート / 未分類)")}</span>
                  </div>
                  <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 font-bold">
                    {t("SELECT →", "選択 →")}
                  </span>
                </button>

                {/* Option List: Category Tree Nodes */}
                {(() => {
                  // Recursive check for descendants if moving a category
                  const isDescendantCat = (catId: string, potentialChildId: string): boolean => {
                    if (catId === potentialChildId) return true;
                    const children = categories.filter((c) => c.parentId === potentialChildId);
                    for (const ch of children) {
                      if (isDescendantCat(catId, ch.id)) return true;
                    }
                    return false;
                  };

                  const renderTreeOptions = (parentId: string | null, depth: number): React.ReactNode => {
                    const subCats = categories.filter((c) => (c.parentId || null) === parentId);
                    return subCats.map((cat) => {
                      // Disabled if category itself or child of it (to prevent cycle)
                      const isSelfOrChild =
                        itemToMove.type === "category" &&
                        (cat.id === itemToMove.item.id || isDescendantCat(cat.id, itemToMove.item.id));
                      
                      const isCurrentParent =
                        itemToMove.type === "category"
                          ? (itemToMove.item as CategoryRecord).parentId === cat.id
                          : (itemToMove.item as DatasetRecord).categoryId === cat.id;

                      return (
                        <React.Fragment key={cat.id}>
                          <button
                            type="button"
                            disabled={isSelfOrChild || isCurrentParent}
                            onClick={() => {
                              if (itemToMove.type === "category") {
                                handleMoveCategoryParent(itemToMove.item.id, cat.id);
                              } else {
                                handleMoveDatasetToCategory(itemToMove.item.id, cat.id);
                              }
                              setShowMoveItemModal(false);
                              setItemToMove(null);
                            }}
                            style={{ paddingLeft: `${Math.max(12, depth * 16 + 12)}px` }}
                            className={cn(
                              "w-full text-left pr-3 py-2 text-xs font-mono flex items-center justify-between border transition-colors group",
                              isSelfOrChild
                                ? "opacity-30 cursor-not-allowed border-transparent text-text-muted"
                                : isCurrentParent
                                ? "border-accent/40 bg-accent/10 text-accent cursor-default font-bold"
                                : "border-panel-border/30 hover:border-accent hover:bg-accent/15 text-text-primary"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <Folder size={14} className="text-folder-icon shrink-0" />
                              <span className="truncate">{cat.name}</span>
                              {isCurrentParent && (
                                <span className="text-[9px] text-accent bg-accent/20 px-1 py-0.5 rounded font-mono shrink-0">
                                  {t("CURRENT", "現在位置")}
                                </span>
                              )}
                            </div>
                            {!isSelfOrChild && !isCurrentParent && (
                              <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 font-bold shrink-0">
                                {t("MOVE HERE →", "ここへ移動 →")}
                              </span>
                            )}
                          </button>
                          {renderTreeOptions(cat.id, depth + 1)}
                        </React.Fragment>
                      );
                    });
                  };

                  return renderTreeOptions(null, 0);
                })()}
              </div>

              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => {
                    setShowMoveItemModal(false);
                    setItemToMove(null);
                  }}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename File Modal */}
      <AnimatePresence>
        {showRenameFileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[400px]">
              <h2 className="text-text-primary mb-4 uppercase">
                RENAME FILE
              </h2>
              <input
                autoFocus
                type="text"
                value={fileNameInput}
                onChange={(e) => setFileNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitFileRenameForm()}
                className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 mb-6 outline-none focus:border-accent"
                placeholder="ENTER FILE NAME..."
              />
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowRenameFileModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <SolidButton
                  onClick={submitFileRenameForm}
                  className="text-accent hover:text-accent"
                >
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
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} /> CLEAR ENTIRE DATABASE
              </h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                Warning: This will delete all datasets and all{" "}
                {totalImagesCount} stored images. This action cannot be undone.
                Are you sure?
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowClearAllModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <button
                  onClick={confirmClearAll}
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10  uppercase transition-colors outline-none"
                >
                  CONFIRM CLEAR
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      

      {/* Overwrite Confirmation Modal */}
      <AnimatePresence>
        {overwriteFiles && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-orange-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(249,115,22,0.2)]">
              <h2 className="text-orange-500 mb-4 uppercase">
                {t("UPDATE EXISTING FILES", "既存のファイルを更新")}
              </h2>
              <p className="text-text-primary text-xs mb-6 leading-relaxed">
                {t(
                  `${overwriteFiles.files.length} file(s) already exist. Do you want to overwrite and update them?`,
                  `同じ名前の画像が ${overwriteFiles.files.length} 件あります。これらを新しい画像で上書き更新しますか？`
                )}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setOverwriteFiles(null)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={confirmOverwrite}
                  className="text-orange-500 hover:text-orange-400 border-orange-900/50"
                >
                  {t("UPDATE", "更新する")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Image(s) Modal */}
      <AnimatePresence>
        {showDeleteImageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} /> {imageToDeleteContext === 'selected' ? "DELETE IMAGES" : "DELETE IMAGE"}
              </h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                {language === "JP" 
                  ? "完全に削除してもよろしいですか？この操作は元に戻せません。"
                  : "Are you sure you want to permanently delete? This action cannot be undone."}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => {
                    setShowDeleteImageModal(false);
                    setImageToDeleteContext(null);
                  }}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={() => {
                    if (imageToDeleteContext === 'selected') {
                      executeDeleteSelectedImages();
                    } else if (imageToDeleteContext === 'fullscreen') {
                      performDeleteFullscreenImage();
                    }
                  }}
                  className="bg-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/20 border-red-500/30 hover:border-red-500/50"
                >
                  {t("DELETE", "削除する")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Dataset Modal */}
      <AnimatePresence>
        {showDeleteDatasetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-red-500/50 p-6 font-mono w-[400px] shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <h2 className="text-red-500 mb-4 uppercase">
                DELETE DATASET
              </h2>
              <p className="text-text-primary text-xs mb-6">
                Are you sure you want to delete this dataset? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => {
                    setShowDeleteDatasetModal(false);
                    setDatasetToDelete(null);
                  }}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <SolidButton
                  onClick={confirmDeleteDataset}
                  className="text-red-500 hover:text-red-400 border-red-900/50"
                >
                  DELETE DATASET
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Datasets Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-accent/50 p-6 font-mono w-[480px] max-w-[90vw] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <h2 className="text-accent mb-2 flex items-center gap-2 text-sm uppercase">
                <Download size={18} /> {t("EXPORT DATASETS", "データセットのエクスポート")}
              </h2>
              <p className="text-text-secondary text-xs mb-4 leading-relaxed">
                {t(
                  "Select the datasets to backup and export:",
                  "バックアップ（エクスポート）するリストを選択してください："
                )}
              </p>

              <div className="flex items-center justify-between text-[11px] mb-2 px-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExportDatasetIds(datasets.map(d => d.id))}
                    className="text-accent hover:underline"
                  >
                    {t("SELECT ALL", "すべて選択")}
                  </button>
                  <span className="text-text-muted">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedExportDatasetIds([])}
                    className="text-text-muted hover:text-text-primary hover:underline"
                  >
                    {t("DESELECT ALL", "全解除")}
                  </button>
                </div>
                <span className="text-text-secondary font-mono">
                  {selectedExportDatasetIds.length} / {datasets.length} {t("selected", "件選択中")}
                </span>
              </div>

              <div className="max-h-[340px] overflow-y-auto flex flex-col gap-1 pr-1 border border-panel-border/60 p-2 bg-root-bg/40 rounded-[2px] scrollbar-dark mb-6">
                {datasets.map((ds) => {
                  const isChecked = selectedExportDatasetIds.includes(ds.id);
                  const count = datasetCounts[ds.id] || 0;
                  return (
                    <div
                      key={ds.id}
                      onClick={() => {
                        setSelectedExportDatasetIds(prev =>
                          isChecked ? prev.filter(id => id !== ds.id) : [...prev, ds.id]
                        );
                      }}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-xs font-mono cursor-pointer border rounded-[2px] transition-colors select-none",
                        isChecked
                          ? "bg-accent/10 border-accent/50 text-text-primary"
                          : "border-transparent text-text-muted hover:bg-panel-border/30 hover:text-text-primary"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="accent-accent cursor-pointer"
                        />
                        <span className="truncate">{ds.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted shrink-0">
                        {count} {t("images", "枚")}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowExportModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={() => {
                    if (selectedExportDatasetIds.length === 0) return;
                    setShowExportModal(false);
                    handleExportDatasets(selectedExportDatasetIds);
                  }}
                  disabled={selectedExportDatasetIds.length === 0}
                  className={cn(
                    "text-accent hover:text-accent border-accent/50",
                    selectedExportDatasetIds.length === 0 && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {t(
                    `EXPORT (${selectedExportDatasetIds.length})`,
                    `エクスポート (${selectedExportDatasetIds.length}件)`
                  )}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Color Modal */}
      <AnimatePresence>
        {colorCategoryModalTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-accent/50 p-6 font-mono w-[420px] max-w-[90vw] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <h2 className="text-accent mb-2 flex items-center gap-2 text-sm uppercase font-bold">
                <Palette size={18} /> {t("SET FOLDER COLOR", "フォルダーカラーの設定")}
              </h2>
              <p className="text-text-secondary text-xs mb-4">
                {t(
                  `Set custom icon color for folder "${colorCategoryModalTarget.name}":`,
                  `フォルダー「${colorCategoryModalTarget.name}」の個別表示カラーを設定します：`
                )}
              </p>

              <div className="flex flex-col gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { name: "アンバー", hex: "#fbbf24" },
                    { name: "スカイ", hex: "#38bdf8" },
                    { name: "ブルー", hex: "#3b82f6" },
                    { name: "エメラルド", hex: "#10b981" },
                    { name: "ローズ", hex: "#f43f5e" },
                    { name: "パープル", hex: "#a855f7" },
                    { name: "シルバー", hex: "#9ca3af" },
                    { name: "ホワイト", hex: "#ffffff" },
                    { name: "シアン", hex: "#06b6d4" },
                    { name: "ピンク", hex: "#ec4899" },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColorCategoryInput(c.hex)}
                      title={c.name}
                      className={cn(
                        "w-6 h-6 rounded border transition-transform flex items-center justify-center cursor-pointer hover:scale-110",
                        colorCategoryInput.toLowerCase() === c.hex.toLowerCase()
                          ? "border-text-primary ring-2 ring-accent ring-offset-1 scale-105"
                          : "border-black/30"
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {colorCategoryInput.toLowerCase() === c.hex.toLowerCase() && (
                        <Check size={12} className="text-black drop-shadow-xs" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-panel-border/60 pt-3">
                  <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                    <span>{t("Custom Color", "カスタムカラー")}:</span>
                    <input
                      type="color"
                      value={colorCategoryInput || "#fbbf24"}
                      onChange={(e) => setColorCategoryInput(e.target.value)}
                      className="w-6 h-6 border-0 bg-transparent cursor-pointer p-0"
                    />
                    <span className="font-mono text-[11px] text-text-primary uppercase">{colorCategoryInput || "THEME"}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setColorCategoryInput("");
                    }}
                    className={cn(
                      "px-2 py-1 text-[10px] border transition-colors",
                      !colorCategoryInput
                        ? "bg-accent/20 border-accent text-accent font-bold"
                        : "border-panel-border text-text-muted hover:text-text-primary"
                    )}
                  >
                    {t("Clear (Use Theme)", "標準に戻す")}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setColorCategoryModalTarget(null)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={async () => {
                    if (colorCategoryModalTarget) {
                      await updateCategoryColor(colorCategoryModalTarget.id, colorCategoryInput || null);
                      const updatedCats = await getAllCategories();
                      setCategories(updatedCats);
                      setColorCategoryModalTarget(null);
                    }
                  }}
                  className="text-accent hover:text-accent border-accent/50"
                >
                  {t("SAVE COLOR", "カラーを保存")}
                </SolidButton>
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
