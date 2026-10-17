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
  RotateCcw,
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
  Zap,
  Pin,
  FolderPlus,
  FilePlus,
  Layers,
  Terminal,
  Settings,
  Sliders,
  Folders,
  Mouse,
  MoveVertical,
  Keyboard,
  Wifi,
  WifiOff,
  Undo,
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
  updateCategoryIcon,
  updateCategoryCoverPosition,
  updateCategoryCoverImage,
  getImageById,
  updateCategoriesOrder,
  updateDatasetsOrder,
  updateDatasetCategory,
} from "./lib/db";
import { FolderIconComponent, FOLDER_ICON_OPTIONS } from "./components/FolderIcon";
import { Panel, SolidButton } from "./components/ui";
import { CategoryTree } from "./components/CategoryTree";
import { CategoryExplorer } from "./components/CategoryExplorer";
import { cn } from "./lib/utils";
import { ReactSortable } from "react-sortablejs";

type ViewMode = "grid-sq" | "grid-ma" | "list" | "free";

export interface QuickStockRecord {
  id: string;
  name: string;
  createdAt: number;
  datasetId: string | null;
  categoryId: string | null;
  isCategoryImagesView?: boolean;
  datasetName?: string;
  categoryName?: string;
  viewMode: ViewMode;
  scale: number;
  gap: number;
  orientationFilter: "all" | "portrait" | "landscape";
  sortField: "name" | "size" | "type" | "date" | "custom" | "random";
  sortOrders: Record<string, "asc" | "desc">;
  showHiddenImages: boolean;
  searchQuery: string;
  scrollTop: number;
  scrollRatio: number;
  anchorImageId?: string;
}

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

      // Fast-path for JPEGs: JPEGs never have alpha transparency
      const isJpeg = blob.type.includes("jpeg") || blob.type.includes("jpg");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(fallback);

      const MAX_SIZE = 32;
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

        if (isJpeg) {
          let totalLum = 0;
          for (let i = 0; i < imageData.length; i += 4) {
            totalLum += 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
          }
          const avgBrightness = totalLum / (width * height);
          return resolveBg(avgBrightness > 128 ? "white" : "black");
        }

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

        const totalPixels = width * height;
        const hasAlpha = (transparentCount / totalPixels) > 0.001 || transparentCount > 2;

        // Check 4 corners for white background logo detection
        const checkCornerWhite = (x: number, y: number) => {
          const idx = (y * width + x) * 4;
          const r = imageData[idx];
          const g = imageData[idx + 1];
          const b = imageData[idx + 2];
          const a = imageData[idx + 3];
          return a > 240 && r >= 240 && g >= 240 && b >= 240;
        };
        const c1 = checkCornerWhite(0, 0);
        const c2 = checkCornerWhite(width - 1, 0);
        const c3 = checkCornerWhite(0, height - 1);
        const c4 = checkCornerWhite(width - 1, height - 1);
        const isWhiteBgLogo = c1 && c2 && c3 && c4 && (blob.type.includes("png") || blob.type.includes("svg") || blob.type.includes("webp") || blob.type.includes("gif"));

        if (hasAlpha || isWhiteBgLogo) {
          return resolveBg("checkerboard");
        } else {
          const avgBrightness = nonTransparentCount > 0 ? totalBrightness / nonTransparentCount : 128;
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
    "theme" | "auto" | "black" | "white" | "checker"
  >("theme");
  const isLightTheme = theme === "LIGHT" || theme === "PAPER";
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
    free: 350,
  });
  const [gaps, setGaps] = useState<Record<string, number>>({
    "grid-sq": 24,
    "grid-ma": 24,
    list: 0,
    free: 0,
  });

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredInstallPrompt(null);
    }
  };

  useEffect(() => {
    if (activeDatasetId) {
      const savedScales = localStorage.getItem(`app_scales_${activeDatasetId}`);
      if (savedScales) {
        try {
          const parsed = JSON.parse(savedScales);
          if (!parsed.free || parsed.free < 250) {
            parsed.free = 350;
          }
          setScales(parsed);
        } catch {
          setScales({
            "grid-sq": 140,
            "grid-ma": 140,
            list: 140,
            free: 350,
          });
        }
      } else {
        setScales({
          "grid-sq": 140,
          "grid-ma": 140,
          list: 140,
          free: 350,
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
        setCanvasBg("theme");
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
    document.documentElement.setAttribute("data-theme", theme);
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    let color = "#0B0C0D"; // default for BLACK
    if (theme === "TRUE_BLACK") color = "#000000";
    else if (theme === "LIGHT") color = "#e2e8f0";
    else if (theme === "PAPER") color = "#f5f5f0";
    else if (theme === "RED") color = "#0d0404";
    else if (theme === "NAVY") color = "#06090e";
    
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", color);
    } else {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = color;
      document.head.appendChild(meta);
    }
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
  const itemScale = scales[scaleKey] ?? scales[viewMode] ?? (viewMode === "free" ? 350 : 140);
  const gridGap = gaps[scaleKey] ?? gaps[viewMode] ?? 24;

  const setItemScale = (val: number) => {
    setScales((prev) => ({ ...prev, [scaleKey]: val }));
  };

  const setGridGap = (val: number) => {
    setGaps((prev) => ({ ...prev, [scaleKey]: val }));
  };

  const [selectedImage, setSelectedImage] = useState<LoadedImage | null>(null);
  const selectedImageRef = useRef<LoadedImage | null>(null);
  const isScrollTrackingUpdateRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    selectedImageRef.current = selectedImage;
  }, [selectedImage]);
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
  const [autoScrollPxPerSec, setAutoScrollPxPerSec] = useState<number>(250);
  const autoScrollDirRef = useRef<"up" | "down" | null>(null);
  const lastAutoScrollDirRef = useRef<"up" | "down">("down");
  const autoScrollPxPerSecRef = useRef<number>(250);

  // Wheel Scroll Settings (Sensitivity & Direction Invert)
  const [wheelSensitivity, setWheelSensitivity] = useState<number>(() => {
    const saved = localStorage.getItem("wheel_sensitivity");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [wheelInvert, setWheelInvert] = useState<boolean>(() => {
    return localStorage.getItem("wheel_invert") === "true";
  });
  const wheelSensitivityRef = useRef<number>(wheelSensitivity);
  const wheelInvertRef = useRef<boolean>(wheelInvert);

  useEffect(() => {
    wheelSensitivityRef.current = wheelSensitivity;
    localStorage.setItem("wheel_sensitivity", String(wheelSensitivity));
  }, [wheelSensitivity]);

  useEffect(() => {
    wheelInvertRef.current = wheelInvert;
    localStorage.setItem("wheel_invert", String(wheelInvert));
  }, [wheelInvert]);

  // Drag Scroll Direction Setting (Invert)
  const [dragInvert, setDragInvert] = useState<boolean>(() => {
    return localStorage.getItem("drag_invert") === "true";
  });
  const dragInvertRef = useRef<boolean>(dragInvert);

  useEffect(() => {
    dragInvertRef.current = dragInvert;
    localStorage.setItem("drag_invert", String(dragInvert));
  }, [dragInvert]);

  // Keyboard Scroll Stop Mode ("REVERSE" | "SAME")
  const [kbdStopMode, setKbdStopMode] = useState<"REVERSE" | "SAME">(() => {
    const saved = localStorage.getItem("kbd_stop_mode");
    return (saved as "REVERSE" | "SAME") || "SAME"; // ユーザー（カオルさま）ご指定により移動中に同じキーで停止 (SAME KEY) をデフォルト化
  });
  const kbdStopModeRef = useRef<"REVERSE" | "SAME">(kbdStopMode);

  useEffect(() => {
    kbdStopModeRef.current = kbdStopMode;
    localStorage.setItem("kbd_stop_mode", kbdStopMode);
  }, [kbdStopMode]);

  // Arrow Key Function in List View ("SPEED" | "NAVIGATE")
  const [arrowKeyMode, setArrowKeyMode] = useState<"SPEED" | "NAVIGATE">(() => {
    const saved = localStorage.getItem("arrow_key_mode");
    return (saved as "SPEED" | "NAVIGATE") || "SPEED";
  });
  const arrowKeyModeRef = useRef<"SPEED" | "NAVIGATE">(arrowKeyMode);

  useEffect(() => {
    arrowKeyModeRef.current = arrowKeyMode;
    localStorage.setItem("arrow_key_mode", arrowKeyMode);
  }, [arrowKeyMode]);

  // Track mouse hovered image ID for priority Enter key opening
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const hoveredImageIdRef = useRef<string | null>(null);

  useEffect(() => {
    hoveredImageIdRef.current = hoveredImageId;
  }, [hoveredImageId]);

  // Track last navigation source ("mouse" vs "keyboard") so Enter key prioritizes the intended target
  const lastNavSourceRef = useRef<"mouse" | "keyboard">("mouse");

  // Jog Drag States & Refs
  const [jogDragState, setJogDragState] = useState<{
    active: boolean;
    deltaY: number;
    currentSpeed: number;
    dir: "up" | "down" | null;
  }>({
    active: false,
    deltaY: 0,
    currentSpeed: 0,
    dir: null,
  });
  const isJogPointerDownRef = useRef(false);
  const jogStartYRef = useRef(0);
  const jogHasDraggedRef = useRef(false);

  // Image List Drag-to-Scroll Refs
  const isListPointerDownRef = useRef(false);
  const listDragStartYRef = useRef(0);
  const listDragStartXRef = useRef(0);
  const listHasDraggedRef = useRef(false);
  const wasAutoScrollingOnDownRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const listPointerIdRef = useRef<number | null>(null);
  const lastDragEndTimeRef = useRef(0);
  const [isListDragging, setIsListDragging] = useState(false);

  useEffect(() => {
    autoScrollPxPerSecRef.current = autoScrollPxPerSec;
  }, [autoScrollPxPerSec]);

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

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      if (scrollContainerRef.current) {
        const el = scrollContainerRef.current;
        const maxScroll = el.scrollHeight - el.clientHeight;
        const currentSpeed = autoScrollPxPerSecRef.current;
        const dirFactor = autoScrollDir === "down" ? 1 : -1;
        el.scrollBy({ top: dirFactor * currentSpeed * delta, behavior: "auto" });

        // 端に到達したら停止 (ただしユーザーが現在ドラッグ操作中の時は一時停止のみで状態クリアしない)
        if (
          (autoScrollDir === "down" && el.scrollTop >= maxScroll - 1) ||
          (autoScrollDir === "up" && el.scrollTop <= 1)
        ) {
          if (!isListPointerDownRef.current && !isJogPointerDownRef.current) {
            setAutoScrollDir(null);
            return;
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [autoScrollDir]);

  const setPresetSpeed = (level: number) => {
    const clamped = Math.max(1, Math.min(4, level));
    setAutoScrollSpeed(clamped);
    const px = clamped === 1 ? 100 : clamped === 2 ? 250 : clamped === 3 ? 500 : 1000;
    setAutoScrollPxPerSec(px);
  };

  const handleJogPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isJogPointerDownRef.current = true;
    jogStartYRef.current = e.clientY;
    jogHasDraggedRef.current = false;

    setJogDragState({
      active: true,
      deltaY: 0,
      currentSpeed: autoScrollPxPerSecRef.current,
      dir: autoScrollDirRef.current,
    });
  };

  const handleJogPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJogPointerDownRef.current) return;
    const dy = e.clientY - jogStartYRef.current;

    // 4px以上の移動でドラッグ（方向転換・速度調整）と判定
    if (Math.abs(dy) >= 4) {
      jogHasDraggedRef.current = true;
      const rawDir: "up" | "down" = dy < 0 ? "up" : "down";
      const newDir: "up" | "down" = dragInvertRef.current ? (rawDir === "up" ? "down" : "up") : rawDir;
      const dist = Math.abs(dy) - 4;

      // 微速 (75px/s) から大きくドラッグ時の超高速 (最大3600px/s) まで滑らかに加速
      const speed = Math.min(3600, Math.round(75 + Math.pow(dist, 1.45) * 3.4));

      setAutoScrollDir(newDir);
      setAutoScrollPxPerSec(speed);

      // 近似プリセット倍率も更新
      const approx = speed < 175 ? 1 : speed < 375 ? 2 : speed < 750 ? 3 : 4;
      setAutoScrollSpeed(approx);

      setJogDragState({
        active: true,
        deltaY: dy,
        currentSpeed: speed,
        dir: newDir,
      });
    } else {
      setJogDragState((prev) => ({
        ...prev,
        deltaY: dy,
      }));
    }
  };

  const handleJogPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJogPointerDownRef.current) return;
    isJogPointerDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const hadDragged = jogHasDraggedRef.current;
    setJogDragState({
      active: false,
      deltaY: 0,
      currentSpeed: 0,
      dir: null,
    });

    // 動かさずにクリックしただけの場合は「停止」（または停止中なら再開）
    if (!hadDragged) {
      if (autoScrollDirRef.current !== null) {
        setAutoScrollDir(null);
      } else {
        setAutoScrollDir(lastAutoScrollDirRef.current || "down");
      }
    }
  };

  const handleJogPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJogPointerDownRef.current) return;
    isJogPointerDownRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setJogDragState({
      active: false,
      deltaY: 0,
      currentSpeed: 0,
      dir: null,
    });
  };

  // Image List Drag-to-Scroll Handlers (掴んで上下に滑らすジョグドラッグスクロール)
  const handleListPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode === "free" || sortedImages.length === 0) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.target as HTMLElement;
    // ボタンや入力欄、カスタムUIのクリック、並び替えハンドルのドラッグは除外
    if (target.closest("button, input, select, textarea, label, [data-interactive='true'], [data-scroll-controls='true'], .image-sort-handle")) {
      return;
    }

    listPointerIdRef.current = e.pointerId;
    isListPointerDownRef.current = true;
    listDragStartYRef.current = e.clientY;
    listDragStartXRef.current = e.clientX;
    listHasDraggedRef.current = false;
    wasAutoScrollingOnDownRef.current = autoScrollDirRef.current !== null;
  };

  const processListDragMove = (clientY: number) => {
    if (!isListPointerDownRef.current) return;
    const dy = clientY - listDragStartYRef.current;

    // 4px以上の移動でドラッグ判定
    if (!listHasDraggedRef.current) {
      if (Math.abs(dy) >= 4) {
        listHasDraggedRef.current = true;
        setIsListDragging(true);
        if (listPointerIdRef.current !== null && scrollContainerRef.current) {
          try {
            scrollContainerRef.current.setPointerCapture(listPointerIdRef.current);
          } catch {
            // ignore
          }
        }
      }
    }

    if (listHasDraggedRef.current) {
      if (Math.abs(dy) < 4) {
        // デッドゾーン (開始位置付近に戻った場合は一時停止)
        setAutoScrollDir(null);
        setJogDragState({
          active: true,
          deltaY: dy,
          currentSpeed: 0,
          dir: null,
        });
        return;
      }

      const rawDir: "up" | "down" = dy < 0 ? "up" : "down";
      const newDir: "up" | "down" = dragInvertRef.current ? (rawDir === "up" ? "down" : "up") : rawDir;
      const dist = Math.max(0, Math.abs(dy) - 4);
      const sens = Math.max(0.1, wheelSensitivityRef.current || 1.0);
      // ジョグパッドと同じ無段階カーブで加速 (75px/s から最大3600px/s)
      const speed = Math.min(3600, Math.round(75 + Math.pow(dist, 1.45) * 3.2 * sens));

      setAutoScrollDir(newDir);
      setAutoScrollPxPerSec(speed);

      const approx = speed < 175 ? 1 : speed < 375 ? 2 : speed < 750 ? 3 : 4;
      setAutoScrollSpeed(approx);

      setJogDragState({
        active: true,
        deltaY: dy,
        currentSpeed: speed,
        dir: newDir,
      });
    }
  };

  const finishListDrag = () => {
    if (!isListPointerDownRef.current) return;
    isListPointerDownRef.current = false;
    setIsListDragging(false);

    if (listPointerIdRef.current !== null && scrollContainerRef.current) {
      try {
        scrollContainerRef.current.releasePointerCapture(listPointerIdRef.current);
      } catch {
        // ignore
      }
      listPointerIdRef.current = null;
    }

    if (listHasDraggedRef.current) {
      lastDragEndTimeRef.current = performance.now();
      suppressNextClickRef.current = true;
      setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 400);

      // ドラッグ終了: 現在の速度で自動スクロールを維持し、画像クリック発火を完全阻止
      setJogDragState({
        active: false,
        deltaY: 0,
        currentSpeed: 0,
        dir: null,
      });
      if (autoScrollDirRef.current) {
        triggerWheelHud(autoScrollDirRef.current, autoScrollPxPerSecRef.current);
      }
    } else {
      // ドラッグせずクリックのみの場合
      if (wasAutoScrollingOnDownRef.current) {
        // スクロール動作中だった場合はピタッと停止させ、画像オープンを防止
        setAutoScrollDir(null);
        suppressNextClickRef.current = true;
        setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 400);
      } else {
        suppressNextClickRef.current = false;
      }
    }
  };

  const handleListPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    processListDragMove(e.clientY);
  };

  const handleListPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    finishListDrag();
  };

  const handleListPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    finishListDrag();
  };

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (isListPointerDownRef.current) {
        processListDragMove(e.clientY);
      }
    };
    const handleGlobalPointerUp = () => {
      if (isListPointerDownRef.current) {
        finishListDrag();
      }
    };
    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: true });
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, []);

  // Jog Wheel (Mouse Wheel Speed & Direction Control)
  const [wheelHudVisible, setWheelHudVisible] = useState(false);
  const wheelHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelBrakeTimestampRef = useRef<number>(0);
  const wheelBrakeDirRef = useRef<"up" | "down" | null>(null);

  const triggerWheelHud = (dir: "up" | "down" | null, speed: number) => {
    setWheelHudVisible(true);
    if (wheelHudTimerRef.current) clearTimeout(wheelHudTimerRef.current);
    wheelHudTimerRef.current = setTimeout(() => {
      setWheelHudVisible(false);
    }, 1200);
  };

  const handleJogWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    let delta = e.deltaY;
    if (wheelInvertRef.current) {
      delta = -delta;
    }
    if (Math.abs(delta) < 1) return;

    const sens = Math.max(0.1, wheelSensitivityRef.current || 1.0);
    const inputDir: "up" | "down" = delta > 0 ? "down" : "up";

    // 1. 自動スクロール中に逆方向へホイールが回された場合：即座にブレーキ（停止）
    if (autoScrollDirRef.current !== null && autoScrollDirRef.current !== inputDir) {
      setAutoScrollDir(null);
      wheelBrakeTimestampRef.current = performance.now();
      wheelBrakeDirRef.current = inputDir;
      setJogDragState({
        active: false,
        deltaY: 0,
        currentSpeed: 0,
        dir: null,
      });
      triggerWheelHud(null, 0);
      return;
    }

    // 2. ブレーキ直後（250ms以内）の余韻・連続イベントを吸収（「ちょこっと止まる」タメ時間）
    const timeSinceBrake = performance.now() - wheelBrakeTimestampRef.current;
    if (timeSinceBrake < 250 && wheelBrakeDirRef.current === inputDir && autoScrollDirRef.current === null) {
      return;
    }

    // 3. 停止状態からの始動、または同方向への加速
    let currentVelocity = 0;
    if (autoScrollDirRef.current === "down") {
      currentVelocity = autoScrollPxPerSecRef.current;
    } else if (autoScrollDirRef.current === "up") {
      currentVelocity = -autoScrollPxPerSecRef.current;
    }

    // ホイール下回転 (delta > 0) -> 下方向への加速 (+方向)
    // ホイール上回転 (delta < 0) -> 上方向への加速 (-方向)
    // 1ノッチで 120〜180px/s * sens、シュッと勢いよく回した時は一気に 600〜1600px/s * sens 加速
    const absDelta = Math.abs(delta);
    const impulseMag = absDelta > 80
      ? Math.min(1600 * Math.max(1, sens), Math.round(Math.pow(absDelta, 1.28) * 1.8 * sens))
      : Math.round(absDelta * 1.5 * sens);
    const minImpulse = Math.max(20, Math.round(120 * sens));
    const impulse = Math.sign(delta) * Math.max(minImpulse, impulseMag);

    let nextVelocity = currentVelocity + impulse;

    // 停止中から回し始めた場合は初速 (240px/s * sens) で瞬時に快適スタート
    const baseStartSpeed = Math.max(40, Math.round(240 * sens));
    if (currentVelocity === 0) {
      nextVelocity = impulse > 0 ? Math.max(baseStartSpeed, impulse) : Math.min(-baseStartSpeed, impulse);
    }

    const stopThreshold = Math.max(15, Math.round(40 * Math.min(1, sens)));
    if (Math.abs(nextVelocity) < stopThreshold) {
      // 速度が相殺されて0付近になったら停止
      setAutoScrollDir(null);
      setWheelHudVisible(false);
    } else {
      const newDir: "up" | "down" = nextVelocity > 0 ? "down" : "up";
      const maxSpeed = Math.round(3600 * Math.max(1, sens));
      const minSpeed = Math.max(20, Math.round(60 * Math.min(1, sens)));
      const newSpeed = Math.min(maxSpeed, Math.max(minSpeed, Math.round(Math.abs(nextVelocity))));
      setAutoScrollDir(newDir);
      setAutoScrollPxPerSec(newSpeed);

      const approx = newSpeed < 175 ? 1 : newSpeed < 375 ? 2 : newSpeed < 750 ? 3 : 4;
      setAutoScrollSpeed(approx);

      triggerWheelHud(newDir, newSpeed);
    }
  };

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

  // Continuous Hold Rotation States & Callbacks
  const isRotatePressingRef = useRef(false);
  const rotatePressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rotateAnimFrameRef = useRef<number | null>(null);
  const rotateLastTimeRef = useRef<number>(0);
  const isContinuousRotatingRef = useRef(false);
  const wasContinuouslyRotatedRef = useRef(false);

  const startHoldRotate = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (isRotatePressingRef.current) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    isRotatePressingRef.current = true;
    isContinuousRotatingRef.current = false;
    rotateLastTimeRef.current = performance.now();

    // 200ms長押しで連続回転モード発動
    rotatePressTimerRef.current = setTimeout(() => {
      isContinuousRotatingRef.current = true;
      wasContinuouslyRotatedRef.current = true;
      rotateLastTimeRef.current = performance.now();

      const loop = (now: number) => {
        if (!isRotatePressingRef.current) return;
        const deltaSec = (now - rotateLastTimeRef.current) / 1000;
        rotateLastTimeRef.current = now;

        // 1秒間に90度回転 (滑らかにどこでも止められる)
        setFullscreenRotation((prev) => {
          const next = (prev + deltaSec * 90) % 360;
          imgControls.start({ rotate: next, transition: { duration: 0 } });
          return next;
        });

        rotateAnimFrameRef.current = requestAnimationFrame(loop);
      };

      rotateAnimFrameRef.current = requestAnimationFrame(loop);
    }, 200);
  }, [imgControls]);

  const stopHoldRotate = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isRotatePressingRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    isRotatePressingRef.current = false;

    if (rotatePressTimerRef.current) {
      clearTimeout(rotatePressTimerRef.current);
      rotatePressTimerRef.current = null;
    }

    if (rotateAnimFrameRef.current) {
      cancelAnimationFrame(rotateAnimFrameRef.current);
      rotateAnimFrameRef.current = null;
    }

    // 長押しせず短時間クリックの場合
    if (!isContinuousRotatingRef.current) {
      setFullscreenRotation((prev) => {
        const deg = ((prev % 360) + 360) % 360;
        const isCustomAngle = wasContinuouslyRotatedRef.current || Math.abs(deg % 45) > 0.01;
        let next = prev;

        if (isCustomAngle) {
          if (deg > 180) {
            // 半分(180度)を超えて回転している場合は、そのまま時計回りに前進して正位置(360度)へ
            next = prev + (360 - deg);
          } else {
            // 180度以下の場合は、そのまま反時計回りに戻って正位置(0度)へ
            next = prev - deg;
          }
        } else {
          // 通常の45度ステップ回転: 常に時計回りに+45度前進 (315度 -> 360度で逆回転せずスムーズ前進)
          next = prev + 45;
        }

        wasContinuouslyRotatedRef.current = false;
        imgControls.start({ rotate: next, transition: { duration: 0.15 } });
        return next;
      });
    } else {
      isContinuousRotatingRef.current = false;
    }
  }, [imgControls]);

  // Keyboard R Key Hold Rotation States & Callbacks
  const isKeyRPressingRef = useRef(false);
  const keyRTimerRef = useRef<NodeJS.Timeout | null>(null);
  const keyRAnimFrameRef = useRef<number | null>(null);
  const keyRLastTimeRef = useRef<number>(0);
  const isKeyRContinuousRef = useRef(false);

  const handleKeyRDown = React.useCallback(() => {
    if (isKeyRPressingRef.current) return;
    isKeyRPressingRef.current = true;
    isKeyRContinuousRef.current = false;
    keyRLastTimeRef.current = performance.now();

    // 200ms長押しでキーボード連続回転モード発動
    keyRTimerRef.current = setTimeout(() => {
      isKeyRContinuousRef.current = true;
      wasContinuouslyRotatedRef.current = true;
      keyRLastTimeRef.current = performance.now();

      const loop = (now: number) => {
        if (!isKeyRPressingRef.current) return;
        const deltaSec = (now - keyRLastTimeRef.current) / 1000;
        keyRLastTimeRef.current = now;

        setFullscreenRotation((prev) => {
          const next = (prev + deltaSec * 90) % 360;
          imgControls.start({ rotate: next, transition: { duration: 0 } });
          return next;
        });

        keyRAnimFrameRef.current = requestAnimationFrame(loop);
      };

      keyRAnimFrameRef.current = requestAnimationFrame(loop);
    }, 200);
  }, [imgControls]);

  const handleKeyRUp = React.useCallback(() => {
    if (!isKeyRPressingRef.current) return;
    isKeyRPressingRef.current = false;

    if (keyRTimerRef.current) {
      clearTimeout(keyRTimerRef.current);
      keyRTimerRef.current = null;
    }

    if (keyRAnimFrameRef.current) {
      cancelAnimationFrame(keyRAnimFrameRef.current);
      keyRAnimFrameRef.current = null;
    }

    // 長押しせず短時間タップの場合はステップ回転／正位置復元
    if (!isKeyRContinuousRef.current) {
      setFullscreenRotation((prev) => {
        const deg = ((prev % 360) + 360) % 360;
        const isCustomAngle = wasContinuouslyRotatedRef.current || Math.abs(deg % 45) > 0.01;
        let next = prev;

        if (isCustomAngle) {
          if (deg > 180) {
            next = prev + (360 - deg);
          } else {
            next = prev - deg;
          }
        } else {
          next = prev + 45;
        }

        wasContinuouslyRotatedRef.current = false;
        imgControls.start({ rotate: next, transition: { duration: 0.15 } });
        return next;
      });
    } else {
      isKeyRContinuousRef.current = false;
    }
  }, [imgControls]);


  useEffect(() => {
    setFullscreenScale(1);
    setFullscreenRotation(0);
    setFullscreenFlipX(false);
    wasContinuouslyRotatedRef.current = false;
    isKeyRPressingRef.current = false;
    if (keyRTimerRef.current) clearTimeout(keyRTimerRef.current);
    if (keyRAnimFrameRef.current) cancelAnimationFrame(keyRAnimFrameRef.current);
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

  // SCATTER (スケーター) 表示上限枚数 (10枚〜100枚可変設定・既定30枚)
  const [scatterLimit, setScatterLimit] = useState<number>(() => {
    const saved = localStorage.getItem("scatterLimit");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 10 && num <= 100) return num;
    }
    return 30; // 重なりや埋もれを防ぐ最適なデフォルト30枚
  });

  // SCATTER (スケーター) 画像枠形状モード ("natural" : アスペクト比混在長方形 | "square" : 正方形統一)
  const [scatterAspectMode, setScatterAspectMode] = useState<"natural" | "square">(
    () => {
      const saved = localStorage.getItem("scatterAspectMode");
      return (saved as "natural" | "square") || "natural"; // カオルさまのご要望に応え混在表示をデフォルトに設定
    }
  );

  // SCATTER (スケーター) 画像ランダム回転角度レンジ (既定 ±30度)
  const [scatterRotationRange, setScatterRotationRange] = useState<number>(() => {
    const saved = localStorage.getItem("scatterRotationRange");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0 && num <= 80) return num;
    }
    return 30; // 既定 ±30度（程よい動きと面白さ）
  });

  const handleUpdateScatterLimit = (limit: number) => {
    const clamped = Math.min(100, Math.max(10, limit));
    setScatterLimit(clamped);
    localStorage.setItem("scatterLimit", clamped.toString());
  };

  const handleUpdateScatterAspectMode = (mode: "natural" | "square") => {
    setScatterAspectMode(mode);
    localStorage.setItem("scatterAspectMode", mode);
  };

  const handleUpdateScatterRotationRange = (range: number) => {
    setScatterRotationRange(range);
    localStorage.setItem("scatterRotationRange", range.toString());
    // 現在の画像に新しい角度を即時反映
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        randomRotation: (Math.random() * range * 2) - range,
      }))
    );
  };

  // SCATTER (スケーター) 設定パネルの折りたたみ状態 (既定は折りたたんで下部エリアの圧迫を防止)
  const [isScatterSettingsExpanded, setIsScatterSettingsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem("isScatterSettingsExpanded");
    return saved ? saved === "true" : false; // 折りたたみをデフォルトにして下のパネルを圧迫しないように！
  });

  const toggleScatterSettingsExpanded = () => {
    setIsScatterSettingsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("isScatterSettingsExpanded", String(next));
      return next;
    });
  };

  const handleReshuffleScatter = () => {
    setRandomSeed((prev) => prev + 1);
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        randomX: Math.random() * 80 - 40,
        randomY: Math.random() * 80 - 40,
        randomRotation: (Math.random() * scatterRotationRange * 2) - scatterRotationRange,
      }))
    );
  };

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
  const [isCurrentFavorited, setIsCurrentFavorited] = useState(false);
  const [favoritedKeys, setFavoritedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    if (!favoriteDatasetId) {
      setFavoritedKeys(new Set());
      return;
    }
    getImagesByDataset(favoriteDatasetId).then((favImages) => {
      if (!isMounted) return;
      const keys = new Set<string>();
      favImages.forEach((fi) => {
        keys.add(`${fi.name}-${fi.size}-${fi.lastModified}`);
        if ((fi as any).originalDatasetId) {
          keys.add(fi.id);
        }
      });
      setFavoritedKeys(keys);
    });
    return () => {
      isMounted = false;
    };
  }, [favoriteDatasetId, images, datasets, activeDatasetId]);

  const [homeViewMode, setHomeViewMode] = useState<"text" | "popup" | "card" | "cover" | "list">(
    () => {
      const saved = localStorage.getItem("homeViewMode");
      return saved === "text" ||
        saved === "popup" ||
        saved === "card" ||
        saved === "cover" ||
        saved === "list"
        ? saved
        : "cover";
    }
  );
  const [datasetPreviewUrls, setDatasetPreviewUrls] = useState<Record<string, string>>({});
  const [categoryPreviewUrls, setCategoryPreviewUrls] = useState<Record<string, string>>({});
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

  useEffect(() => {
    let isMounted = true;
    if (!selectedImage || !favoriteDatasetId) {
      setIsCurrentFavorited(false);
      return;
    }
    if (activeDatasetId === favoriteDatasetId) {
      setIsCurrentFavorited(true);
      return;
    }
    getImagesByDataset(favoriteDatasetId).then((favImages) => {
      if (!isMounted) return;
      const exists = favImages.some(
        (fi) =>
          fi.id === `${favoriteDatasetId}-${selectedImage.name}-${selectedImage.lastModified}-${selectedImage.size}` ||
          (fi.name === selectedImage.name &&
            fi.size === selectedImage.size &&
            fi.lastModified === selectedImage.lastModified)
      );
      setIsCurrentFavorited(exists);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedImage, favoriteDatasetId, activeDatasetId]);

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
  const [sidebarFontSize, setSidebarFontSize] = useState<"xs" | "sm" | "base" | "lg" | "xl">(() => {
    const saved = localStorage.getItem("app_sidebarFontSize");
    return (saved as "xs" | "sm" | "base" | "lg" | "xl") || "sm";
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  
  useEffect(() => {
    localStorage.setItem("app_sidebarWidth", sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("app_sidebarFontSize", sidebarFontSize);
  }, [sidebarFontSize]);

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
  const [bottomPanelTab, setBottomPanelTab] = useState<"command" | "general" | "appearance" | "stock">(() => {
    const saved = localStorage.getItem("bottomPanelTab");
    if (saved === "general" || saved === "appearance" || saved === "command" || saved === "stock") return saved;
    if (saved === "settings") return "appearance";
    return "command";
  });

  // クイックストック（閲覧状態・スクロール位置スナップショット）状態
  const [quickStocks, setQuickStocks] = useState<QuickStockRecord[]>(() => {
    try {
      const saved = localStorage.getItem("app_quick_stocks");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeStockId, setActiveStockId] = useState<string | null>(() => {
    return localStorage.getItem("app_active_stock_id") || null;
  });
  const [stockDisplayMode, setStockDisplayMode] = useState<"list" | "tile">(() => {
    const saved = localStorage.getItem("app_stock_display_mode");
    return saved === "tile" ? "tile" : "list";
  });
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("app_bottom_panel_height");
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return Math.min(850, Math.max(160, val));
      }
    } catch (e) {}
    return 330;
  });
  const [isResizingBottomPanel, setIsResizingBottomPanel] = useState(false);
  const [jogControllerTheme, setJogControllerTheme] = useState<"white" | "dark" | "glass">(() => {
    try {
      const saved = localStorage.getItem("app_jog_controller_theme");
      if (saved === "white" || saved === "dark" || saved === "glass") return saved;
    } catch (e) {}
    return "white";
  });
  const [isStockPanelExpanded, setIsStockPanelExpanded] = useState<boolean>(() => {
    return localStorage.getItem("app_stock_panel_expanded") === "true";
  });
  const [isQuickStockDrawerOpen, setIsQuickStockDrawerOpen] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockName, setEditingStockName] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("app_quick_stocks", JSON.stringify(quickStocks));
    } catch (e) {
      console.error("Failed to save quick stocks", e);
    }
  }, [quickStocks]);

  useEffect(() => {
    if (activeStockId) {
      localStorage.setItem("app_active_stock_id", activeStockId);
    } else {
      localStorage.removeItem("app_active_stock_id");
    }
  }, [activeStockId]);

  useEffect(() => {
    localStorage.setItem("app_stock_display_mode", stockDisplayMode);
  }, [stockDisplayMode]);

  useEffect(() => {
    localStorage.setItem("app_bottom_panel_height", bottomPanelHeight.toString());
  }, [bottomPanelHeight]);

  useEffect(() => {
    localStorage.setItem("app_stock_panel_expanded", String(isStockPanelExpanded));
  }, [isStockPanelExpanded]);

  useEffect(() => {
    localStorage.setItem("app_jog_controller_theme", jogControllerTheme);
  }, [jogControllerTheme]);

  const pendingScrollRestoreRef = useRef<{
    scrollTop: number;
    scrollRatio: number;
    anchorImageId?: string;
    maxAttempts: number;
    count: number;
  } | null>(null);
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
  const [categoryIconInput, setCategoryIconInput] = useState<string>("folder");
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

  useEffect(() => {
    let isMounted = true;
    const fetchCategoryPreviews = async () => {
      const newUrls: Record<string, string> = {};
      for (const cat of categories) {
        if (cat.coverImageId) {
          try {
            const coverImg = await getImageById(cat.coverImageId);
            if (coverImg && coverImg.data) {
              newUrls[cat.id] = URL.createObjectURL(coverImg.data);
            }
          } catch (err) {
            console.error(`Failed to load preview for category ${cat.id}`, err);
          }
        }
      }
      if (isMounted) {
        setCategoryPreviewUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };

    fetchCategoryPreviews();

    return () => {
      isMounted = false;
    };
  }, [categories]);

  const handleSetCategoryAsCover = async (categoryId: string, imageId: string | null) => {
    try {
      await updateCategoryCoverImage(categoryId, imageId);
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, coverImageId: imageId || undefined } : c))
      );
      if (imageId) {
        const img = await getImageById(imageId);
        if (img && img.data) {
          setCategoryPreviewUrls((prev) => ({
            ...prev,
            [categoryId]: URL.createObjectURL(img.data),
          }));
        }
        showNotification(t("SET AS FOLDER COVER IMAGE", "フォルダーのカバー画像に設定しました"));
      } else {
        setCategoryPreviewUrls((prev) => {
          const next = { ...prev };
          delete next[categoryId];
          return next;
        });
        showNotification(t("RESET FOLDER COVER IMAGE TO AUTO", "フォルダーカバー画像を自動設定に戻しました"));
      }
    } catch (err) {
      console.error("Failed to update category cover image", err);
      showNotification(t("FAILED TO UPDATE COVER IMAGE", "カバー画像の設定に失敗しました"));
    }
  };

  const handleBatchReorderCategories = async (updates: { id: string; orderIndex: number }[]) => {
    try {
      await updateCategoriesOrder(updates);
      setCategories((prev) => {
        const map = new Map(updates.map((u) => [u.id, u.orderIndex]));
        return [...prev]
          .map((c) => (map.has(c.id) ? { ...c, orderIndex: map.get(c.id)! } : c))
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      });
    } catch (err) {
      console.error("Failed to batch reorder categories", err);
    }
  };

  const handleBatchReorderDatasets = async (updates: { id: string; orderIndex: number }[]) => {
    try {
      await updateDatasetsOrder(updates);
      setDatasets((prev) => {
        const map = new Map(updates.map((u) => [u.id, u.orderIndex]));
        return [...prev]
          .map((d) => (map.has(d.id) ? { ...d, orderIndex: map.get(d.id)! } : d))
          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      });
    } catch (err) {
      console.error("Failed to batch reorder datasets", err);
    }
  };

  const handleSetDatasetCoverImageById = async (datasetId: string, imageId: string | null) => {
    try {
      await updateDatasetCoverImage(datasetId, imageId);
      setDatasets((prev) =>
        prev.map((d) => (d.id === datasetId ? { ...d, coverImageId: imageId || undefined } : d))
      );
      if (imageId) {
        const img = await getImageById(imageId);
        if (img && img.data) {
          setDatasetPreviewUrls((prev) => ({
            ...prev,
            [datasetId]: URL.createObjectURL(img.data),
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

// シード依存の決定論的疑似乱数生成器 (Mulberry32)
function createPRNG(seed: number) {
  let s = (seed || 1) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
      const rng = createPRNG((randomSeed || 1) * 31);
      const shuffled = [...filteredImages];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
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
          return comparison; // カスタム順は常に0..Nの絶対配置（反転させない）
      }
      return sortOrders[sortField] === "asc" ? comparison : -comparison;
    });
  }, [images, sortField, sortOrders, randomSeed, searchQuery, orientationFilter, showHiddenImages]);

  // SCATTER (スケーター) モード時の軽量化サンプリング (10枚〜100枚の上限可変設定 & シード固定シャッフル)
  const scatterImages = useMemo(() => {
    if (viewMode !== "free") return sortedImages;
    if (sortedImages.length <= scatterLimit) return sortedImages;

    const total = sortedImages.length;
    const step = total / scatterLimit;
    const sampled: LoadedImage[] = [];
    for (let i = 0; i < scatterLimit; i++) {
      const idx = Math.min(total - 1, Math.floor(i * step));
      sampled.push(sortedImages[idx]);
    }

    const rng = createPRNG((randomSeed || 1) * 9973);
    const shuffled = [...sampled];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [sortedImages, viewMode, scatterLimit, randomSeed]);

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

      const loaded = allDbImages.map((img) => {
        const isAlphaFormat =
          img.type?.includes("png") ||
          img.type?.includes("gif") ||
          img.type?.includes("webp") ||
          img.type?.includes("svg") ||
          img.name?.toLowerCase().endsWith(".png") ||
          img.name?.toLowerCase().endsWith(".gif") ||
          img.name?.toLowerCase().endsWith(".webp") ||
          img.name?.toLowerCase().endsWith(".svg");
        const autoBg = img.autoBg ?? (isAlphaFormat ? "checkerboard" : "white");
        return {
          ...img,
          url: URL.createObjectURL(img.data),
          randomX: Math.random() * 80 - 40,
          randomY: Math.random() * 80 - 40,
          randomRotation: (Math.random() * scatterRotationRange * 2) - scatterRotationRange,
          autoBg,
          width: img.width || 300,
          height: img.height || 300,
        };
      });
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

      let favId = favoriteDatasetId;
      if (!favId || !dsList.some((d) => d.id === favId)) {
        const existingFav = dsList.find(
          (d) =>
            d.name.includes("★") ||
            d.name.toUpperCase().includes("FAVORITE") ||
            d.name.toUpperCase().includes("FAV") ||
            d.name.includes("お気に入り") ||
            d.name.includes("推し")
        );
        if (existingFav) {
          setFavoriteDatasetId(existingFav.id);
        }
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

      const loaded = dbImages.map((img) => {
        const isAlphaFormat =
          img.type?.includes("png") ||
          img.type?.includes("gif") ||
          img.type?.includes("webp") ||
          img.type?.includes("svg") ||
          img.name?.toLowerCase().endsWith(".png") ||
          img.name?.toLowerCase().endsWith(".gif") ||
          img.name?.toLowerCase().endsWith(".webp") ||
          img.name?.toLowerCase().endsWith(".svg");
        const autoBg = img.autoBg ?? (isAlphaFormat ? "checkerboard" : "white");
        return {
          ...img,
          url: URL.createObjectURL(img.data),
          randomX: Math.random() * 80 - 40,
          randomY: Math.random() * 80 - 40,
          randomRotation: (Math.random() * scatterRotationRange * 2) - scatterRotationRange,
          autoBg,
          width: img.width || 300,
          height: img.height || 300,
        };
      });

      setImages(loaded);
      setIsLoading(false);

      // 非同期バックグラウンド処理（UIロード完了後に重くならない範囲でメタデータ保存）
      setTimeout(() => {
        const unanalyzed = dbImages.filter((img) => !img.width || !img.height);
        if (unanalyzed.length > 0) {
          Promise.all(
            unanalyzed.slice(0, 20).map(async (img) => {
              try {
                const meta = await analyzeImageBlob(img.data);
                await storeImages([
                  {
                    ...img,
                    autoBg: img.autoBg || meta.bg,
                    width: img.width || meta.width,
                    height: img.height || meta.height,
                  },
                ]);
              } catch {}
            })
          ).catch(() => {});
        }
      }, 100);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  // クイックストック（閲覧状態・スクロール位置スナップショット）復元処理
  const applyScrollRestore = React.useCallback(() => {
    if (!pendingScrollRestoreRef.current) return;
    const { scrollTop, scrollRatio, anchorImageId } = pendingScrollRestoreRef.current;
    const container = scrollContainerRef.current;
    if (!container) return;

    let restored = false;

    // 1. アンカー画像があればその要素を画面中央へ
    if (anchorImageId) {
      const anchorEl = document.getElementById(`image-card-${anchorImageId}`);
      if (anchorEl) {
        anchorEl.scrollIntoView({ block: "center", behavior: "instant" });
        restored = true;
      }
    }

    // 2. アンカー画像が見つからない、または微調整として scrollTop / scrollRatio で復元
    if (!restored) {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      if (maxScroll > 0) {
        const targetTop = scrollTop <= maxScroll ? scrollTop : Math.round(scrollRatio * maxScroll);
        container.scrollTo({ top: targetTop, behavior: "instant" });
        if (Math.abs(container.scrollTop - targetTop) < 10) {
          restored = true;
        }
      } else if (scrollTop > 0) {
        container.scrollTop = scrollTop;
      }
    }

    pendingScrollRestoreRef.current.count++;
    if (pendingScrollRestoreRef.current.count < pendingScrollRestoreRef.current.maxAttempts) {
      setTimeout(applyScrollRestore, 50);
    } else {
      pendingScrollRestoreRef.current = null;
    }
  }, []);

  // 画面中央に最も近い画像を検出するヘルパー関数（同一列の縦方向まっすぐの追従を実現・超高速DOM検索）
  const getCenterImage = React.useCallback((): LoadedImage | null => {
    if (!scrollContainerRef.current || sortedImages.length === 0) return null;
    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;

    // 現在画面内にレンダリングされている画像カード要素のみを高速取得
    const cardElements = container.querySelectorAll<HTMLElement>("[id^='image-card-']");
    if (cardElements.length === 0) return sortedImages[0] || null;

    // 現在選択されている画像のX座標（センターX）を取得。なければコンテナの水平中央X
    let targetX = containerRect.left + containerRect.width / 2;
    if (selectedImageRef.current) {
      const selectedEl = document.getElementById(`image-card-${selectedImageRef.current.id}`);
      if (selectedEl) {
        const sRect = selectedEl.getBoundingClientRect();
        targetX = sRect.left + sRect.width / 2;
      }
    }

    // 画像ID -> LoadedImage オブジェクトの高速O(1)ルックアップマップ
    const imgMap = new Map<string, LoadedImage>();
    for (let i = 0; i < sortedImages.length; i++) {
      imgMap.set(sortedImages[i].id, sortedImages[i]);
    }

    interface Metric {
      img: LoadedImage;
      centerX: number;
      centerY: number;
      height: number;
      yDist: number;
    }

    const metrics: Metric[] = [];
    let bestYItem: Metric | null = null;
    let minYDist = Infinity;

    for (let i = 0; i < cardElements.length; i++) {
      const el = cardElements[i];
      const id = el.id.substring(11);
      const img = imgMap.get(id);
      if (img) {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const itemCenterY = rect.top + rect.height / 2;
        const yDist = Math.abs(centerY - itemCenterY);
        const m: Metric = {
          img,
          centerX,
          centerY: itemCenterY,
          height: rect.height,
          yDist,
        };
        metrics.push(m);
        if (yDist < minYDist) {
          minYDist = yDist;
          bestYItem = m;
        }
      }
    }

    if (!bestYItem || metrics.length === 0) return sortedImages[0] || null;

    // Y座標が画面中央の行（bestYItemと同じ行に属するアイテム群）を特定
    const rowTolerance = Math.max(35, bestYItem.height * 0.45);
    const rowItems = metrics.filter(
      (m) => Math.abs(m.centerY - bestYItem!.centerY) <= rowTolerance
    );

    // その行内で、元の画像と同じ列（X座標）に最も近い画像を直下・直上として選択
    let closestImg: LoadedImage | null = null;
    let minXDist = Infinity;

    for (let i = 0; i < rowItems.length; i++) {
      const m = rowItems[i];
      const xDist = Math.abs(m.centerX - targetX);
      if (xDist < minXDist) {
        minXDist = xDist;
        closestImg = m.img;
      }
    }

    return closestImg || bestYItem.img || sortedImages[0] || null;
  }, [sortedImages]);

  // スクロール時に画面中央の画像へ選択枠（selectedImage）をリアルタイム追従させるイベントハンドラー
  const handleContainerScroll = React.useCallback(() => {
    if (isFullscreen || viewMode === "free" || sortedImages.length === 0) return;
    isScrollingRef.current = true;
    if (scrollTimerRef.current) cancelAnimationFrame(scrollTimerRef.current);

    scrollTimerRef.current = requestAnimationFrame(() => {
      const centerImg = getCenterImage();
      if (centerImg && centerImg.id !== selectedImageRef.current?.id) {
        isScrollTrackingUpdateRef.current = true;
        setSelectedImage(centerImg);
        if (!hoveredImageIdRef.current) {
          lastNavSourceRef.current = "keyboard";
        }
      }
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 50);
    });
  }, [isFullscreen, viewMode, sortedImages.length, getCenterImage]);

  // リスト（データセット/フォルダ）切り替え時に画面中央の画像を自動選択
  useEffect(() => {
    if (sortedImages.length > 0) {
      const exists = selectedImage && sortedImages.some((img) => img.id === selectedImage.id);
      if (!exists) {
        const t1 = setTimeout(() => {
          const centerImg = getCenterImage();
          if (centerImg) {
            setSelectedImage(centerImg);
          }
        }, 60);
        const t2 = setTimeout(() => {
          const centerImg = getCenterImage();
          if (centerImg) {
            setSelectedImage(centerImg);
          }
        }, 200);
        return () => {
          clearTimeout(t1);
          clearTimeout(t2);
        };
      }
    } else {
      setSelectedImage(null);
    }
  }, [sortedImages, activeDatasetId, activeCategoryId, isCategoryImagesView, getCenterImage]);

  // 画像セット時や描画完了時にスクロール位置を確実に中段・下段へ適用
  useEffect(() => {
    if (pendingScrollRestoreRef.current) {
      applyScrollRestore();
      const t1 = setTimeout(applyScrollRestore, 40);
      const t2 = setTimeout(applyScrollRestore, 120);
      const t3 = setTimeout(applyScrollRestore, 250);
      const t4 = setTimeout(applyScrollRestore, 450);
      const t5 = setTimeout(applyScrollRestore, 700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, [images, sortedImages, applyScrollRestore]);

  // 現在の表示状態・スクロール位置をストック保存
  const handleCreateQuickStock = () => {
    const container = scrollContainerRef.current;
    const currentScrollTop = container ? container.scrollTop : 0;
    const scrollHeight = container ? container.scrollHeight : 0;
    const clientHeight = container ? container.clientHeight : 0;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const scrollRatio = Math.min(1, Math.max(0, currentScrollTop / maxScroll));

    // 画面中央付近のアンカー画像を検出
    let anchorImageId: string | undefined = undefined;
    if (container && sortedImages.length > 0) {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestDist = Infinity;
      for (const img of sortedImages) {
        const el = document.getElementById(`image-card-${img.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const itemCenterY = rect.top + rect.height / 2;
          const dist = Math.abs(centerY - itemCenterY);
          if (dist < closestDist) {
            closestDist = dist;
            anchorImageId = img.id;
          }
        }
      }
    }

    const currentDs = datasets.find((d) => d.id === activeDatasetId);
    const currentCat = categories.find((c) => c.id === activeCategoryId);

    // スクロール位置の目安テキスト（例：最上部、中段 45%、最下部）
    const pct = Math.round(scrollRatio * 100);
    let posText = `${pct}%`;
    if (pct <= 5) posText = language === "JP" ? "最上部" : "TOP";
    else if (pct >= 95) posText = language === "JP" ? "最下部" : "BTM";
    else posText = language === "JP" ? `中段 ${pct}%` : `MID ${pct}%`;

    const baseName = currentDs?.name || (isCategoryImagesView ? `${currentCat?.name || "FOLDER"} (ALL)` : "EXPLORER");
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const defaultName = `${baseName} [${posText}] ${timeStr}`;

    const newStock: QuickStockRecord = {
      id: "stock-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      name: defaultName,
      createdAt: Date.now(),
      datasetId: activeDatasetId,
      categoryId: activeCategoryId,
      isCategoryImagesView,
      datasetName: currentDs?.name,
      categoryName: currentCat?.name,
      viewMode,
      scale: scales[viewMode] || 140,
      gap: gaps[viewMode] || 0,
      orientationFilter,
      sortField,
      sortOrders: { ...sortOrders },
      showHiddenImages,
      searchQuery,
      scrollTop: currentScrollTop,
      scrollRatio,
      anchorImageId,
    };

    setQuickStocks((prev) => [newStock, ...prev]);
    setActiveStockId(newStock.id);
    showNotification(language === "JP" ? `クイックストックに保存しました (${posText})` : `Quick stock saved (${posText})`);
  };

  // ストックを復元（データセット・フォルダー・設定・スクロール位置へピタッと復元）
  const handleRestoreQuickStock = async (stock: QuickStockRecord) => {
    setActiveStockId(stock.id);
    setIsLoading(true);
    try {
      // 復元用スクロール情報をキューにセット
      pendingScrollRestoreRef.current = {
        scrollTop: stock.scrollTop,
        scrollRatio: stock.scrollRatio,
        anchorImageId: stock.anchorImageId,
        maxAttempts: 12,
        count: 0,
      };

      // 表示設定を復元
      setViewMode(stock.viewMode);
      setScales((prev) => ({ ...prev, [stock.viewMode]: stock.scale }));
      setGaps((prev) => ({ ...prev, [stock.viewMode]: stock.gap }));
      setOrientationFilter(stock.orientationFilter);
      setSortField(stock.sortField);
      setSortOrders((prev) => ({ ...prev, ...stock.sortOrders }));
      setShowHiddenImages(stock.showHiddenImages);
      setSearchQuery(stock.searchQuery);
      setSearchInput(stock.searchQuery);

      // データセット／フォルダーの移動と画像ロード
      if (stock.isCategoryImagesView && stock.categoryId) {
        await loadImagesForCategory(stock.categoryId);
      } else if (stock.datasetId) {
        setActiveDatasetId(stock.datasetId);
        if (stock.categoryId) setActiveCategoryId(stock.categoryId);
        setIsCategoryImagesView(false);
        await loadImages(stock.datasetId);
      } else {
        // エクスプローラー等
        setActiveDatasetId(null);
        setIsCategoryImagesView(false);
        if (stock.categoryId) setActiveCategoryId(stock.categoryId);
      }

      // 直後と遅延でスクロール適用を確実にキープ
      setTimeout(applyScrollRestore, 30);
      setTimeout(applyScrollRestore, 100);
      setTimeout(applyScrollRestore, 250);
      setTimeout(applyScrollRestore, 450);

      showNotification(language === "JP" ? `「${stock.name}」の位置へジャンプしました` : `Restored: ${stock.name}`);
    } catch (e) {
      console.error("Failed to restore quick stock", e);
    } finally {
      setIsLoading(false);
    }
  };

  // ストックを現在の最新位置・設定で上書き保存
  const handleUpdateQuickStock = (stockId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetId = stockId || activeStockId;
    if (!targetId) {
      showNotification(language === "JP" ? "更新対象のストックが選択されていません" : "No active stock selected");
      return;
    }

    const container = scrollContainerRef.current;
    const currentScrollTop = container ? container.scrollTop : 0;
    const scrollHeight = container ? container.scrollHeight : 0;
    const clientHeight = container ? container.clientHeight : 0;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const scrollRatio = Math.min(1, Math.max(0, currentScrollTop / maxScroll));

    let anchorImageId: string | undefined = undefined;
    if (container && sortedImages.length > 0) {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestDist = Infinity;
      for (const img of sortedImages) {
        const el = document.getElementById(`image-card-${img.id}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const dist = Math.abs(centerY - (rect.top + rect.height / 2));
          if (dist < closestDist) {
            closestDist = dist;
            anchorImageId = img.id;
          }
        }
      }
    }

    const currentDs = datasets.find((d) => d.id === activeDatasetId);
    const currentCat = categories.find((c) => c.id === activeCategoryId);

    const pct = Math.round(scrollRatio * 100);
    let posText = `${pct}%`;
    if (pct <= 5) posText = language === "JP" ? "最上部" : "TOP";
    else if (pct >= 95) posText = language === "JP" ? "最下部" : "BTM";
    else posText = language === "JP" ? `中段 ${pct}%` : `MID ${pct}%`;

    const targetStock = quickStocks.find((s) => s.id === targetId);

    setQuickStocks((prev) =>
      prev.map((s) => {
        if (s.id !== targetId) return s;
        return {
          ...s,
          datasetId: activeDatasetId,
          categoryId: activeCategoryId,
          isCategoryImagesView,
          datasetName: currentDs?.name,
          categoryName: currentCat?.name,
          viewMode,
          scale: scales[viewMode] || 140,
          gap: gaps[viewMode] || 0,
          orientationFilter,
          sortField,
          sortOrders: { ...sortOrders },
          showHiddenImages,
          searchQuery,
          scrollTop: currentScrollTop,
          scrollRatio,
          anchorImageId,
        };
      })
    );
    setActiveStockId(targetId);
    showNotification(
      language === "JP"
        ? `ストック「${targetStock?.name || ""}」を現在の位置 (${posText}) で更新しました`
        : `Quick stock updated (${posText})`
    );
  };

  // ストックの個別削除（ワンクリックで即座にサッと削除）
  const handleDeleteQuickStock = (stockId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickStocks((prev) => prev.filter((s) => s.id !== stockId));
    if (activeStockId === stockId) {
      setActiveStockId(null);
    }
    showNotification(language === "JP" ? "ストックを削除しました" : "Stock removed");
  };

  // ストックの順序移動（入れ替え）
  const handleMoveQuickStock = (stockId: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickStocks((prev) => {
      const idx = prev.findIndex((s) => s.id === stockId);
      if (idx === -1) return prev;
      if (direction === "up" && idx === 0) return prev;
      if (direction === "down" && idx === prev.length - 1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      const next = [...prev];
      const item = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = item;
      return next;
    });
  };

  // ストックの名前変更
  const handleRenameQuickStock = (stockId: string, newName: string) => {
    if (!newName.trim()) return;
    setQuickStocks((prev) =>
      prev.map((s) => (s.id === stockId ? { ...s, name: newName.trim() } : s))
    );
  };

  // ストック全削除
  const handleClearAllQuickStocks = () => {
    if (quickStocks.length === 0) return;
    setQuickStocks([]);
    showNotification(language === "JP" ? "全クイックストックをクリアしました" : "All quick stocks cleared");
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
    const ds = datasets.find((d) => d.id === id);
    setTargetCategoryIdForNewDataset(ds?.categoryId || null);
    setShowNewDatasetModal(true);
  };

  const submitDatasetForm = async () => {
    if (!datasetNameInput.trim()) return;
    if (editingDatasetId) {
      await renameDataset(
        editingDatasetId,
        datasetNameInput.trim().toUpperCase(),
      );
      await updateDatasetCategory(editingDatasetId, targetCategoryIdForNewDataset || null);
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
    setNewCategoryParentId(parentId !== null ? parentId : activeCategoryId);
    setEditingCategoryId(null);
    setCategoryNameInput("");
    setShowNewCategoryModal(true);
  };

  const handleOpenRenameCategoryModal = (e: React.MouseEvent, cat: CategoryRecord) => {
    e.stopPropagation();
    setEditingCategoryId(cat.id);
    setCategoryNameInput(cat.name);
    setNewCategoryParentId(cat.parentId || null);
    setShowNewCategoryModal(true);
  };

  const submitCategoryForm = async () => {
    if (!categoryNameInput.trim()) return;
    if (editingCategoryId) {
      await renameCategory(editingCategoryId, categoryNameInput.trim().toUpperCase());
      await updateCategoryParent(editingCategoryId, newCategoryParentId || null);
    } else {
      const newCat = await createCategory(categoryNameInput.trim().toUpperCase(), newCategoryParentId || null);
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

  const handleBulkDeleteItems = async (categoryIds: string[], datasetIds: string[]) => {
    try {
      for (const catId of categoryIds) {
        await deleteCategory(catId);
      }
      for (const dsId of datasetIds) {
        await deleteDataset(dsId);
      }
      if (activeCategoryId && categoryIds.includes(activeCategoryId)) {
        setActiveCategoryId(null);
        setIsCategoryImagesView(false);
      }
      if (activeDatasetId && datasetIds.includes(activeDatasetId)) {
        setActiveDatasetId(null);
      }
      await loadDatasets();
      const total = categoryIds.length + datasetIds.length;
      showNotification(
        language === "JP"
          ? `${total}件の項目を削除しました`
          : `Deleted ${total} item(s)`
      );
    } catch (err) {
      console.error("Failed bulk deletion", err);
      showNotification(language === "JP" ? "一括削除に失敗しました" : "Failed bulk deletion");
    }
  };

  const handleBulkMoveItems = async (
    categoryIds: string[],
    datasetIds: string[],
    targetCategoryId: string | null
  ) => {
    try {
      for (const catId of categoryIds) {
        if (catId !== targetCategoryId) {
          await updateCategoryParent(catId, targetCategoryId);
        }
      }
      for (const dsId of datasetIds) {
        await updateDatasetCategory(dsId, targetCategoryId);
      }
      if (targetCategoryId) {
        setExpandedCategoryIds((prev) => new Set([...prev, targetCategoryId]));
      }
      await loadDatasets();
      const total = categoryIds.length + datasetIds.length;
      const parentCat = targetCategoryId ? categories.find((c) => c.id === targetCategoryId) : null;
      const destName = parentCat ? parentCat.name : "ROOT";
      showNotification(
        language === "JP"
          ? `${total}件の項目を「${destName}」へ移動しました`
          : `Moved ${total} item(s) to "${destName}"`
      );
    } catch (err) {
      console.error("Failed bulk move", err);
      showNotification(language === "JP" ? "一括移動に失敗しました" : "Failed bulk move");
    }
  };

  const handleBulkRenameItems = async (
    renames: { id: string; type: "category" | "dataset"; newName: string }[]
  ) => {
    try {
      for (const item of renames) {
        if (!item.newName.trim()) continue;
        if (item.type === "category") {
          await renameCategory(item.id, item.newName.trim());
        } else {
          await renameDataset(item.id, item.newName.trim());
        }
      }
      await loadDatasets();
      showNotification(
        language === "JP"
          ? `${renames.length}件の名称を一括更新しました`
          : `Renamed ${renames.length} item(s)`
      );
    } catch (err) {
      console.error("Failed bulk rename", err);
      showNotification(language === "JP" ? "一括変更に失敗しました" : "Failed bulk rename");
    }
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

  const handleToggleFavoriteImage = async (targetImg: ImageRecord) => {
    let favId = favoriteDatasetId;
    if (!favId) {
      // Find existing favorite dataset by name or create one
      const existing = datasets.find(
        (d) =>
          d.name.includes("★") ||
          d.name.toUpperCase().includes("FAVORITE") ||
          d.name.toUpperCase().includes("FAV") ||
          d.name.includes("お気に入り") ||
          d.name.includes("推し")
      );
      if (existing) {
        favId = existing.id;
        setFavoriteDatasetId(existing.id);
      } else {
        const newDs = await createDataset("★ FAVORITES");
        favId = newDs.id;
        setFavoriteDatasetId(newDs.id);
        await loadDatasets();
      }
    }

    // 1. When currently inside the favorite dataset
    if (activeDatasetId === favId) {
      setIsLoading(true);
      await deleteImage(targetImg.id);

      // Keep the current list in memory or remove from list, but retain selectedImage in fullscreen
      const remaining = images.filter((i) => i.id !== targetImg.id);
      setImages(remaining);

      // Keep the un-favorited image in view (do not jump to next image or close fullscreen)
      setIsCurrentFavorited(false);
      await loadDatasets();
      setIsLoading(false);
      showNotification(language === "JP" ? "お気に入りから解除しました" : "Removed from favorites");
      return;
    }

    // 2. When in another dataset
    const favImages = await getImagesByDataset(favId);
    const existing = favImages.find(
      (fi) =>
        fi.id === `${favId}-${targetImg.name}-${targetImg.lastModified}-${targetImg.size}` ||
        (fi.name === targetImg.name &&
          fi.size === targetImg.size &&
          fi.lastModified === targetImg.lastModified)
    );

    if (existing) {
      // Image is already in favorite dataset -> REMOVE it!
      setIsLoading(true);
      await deleteImage(existing.id);
      setIsCurrentFavorited(false);
      setFullscreenFavorited((prev) => {
        const next = new Set(prev);
        next.delete(targetImg.id);
        return next;
      });
      await loadDatasets();
      setIsLoading(false);
      showNotification(language === "JP" ? "お気に入りから解除しました" : "Removed from favorites");
    } else {
      // Image is not yet in favorite dataset -> ADD it!
      setIsLoading(true);
      await copyImagesToDataset([targetImg.id], favId);
      setIsCurrentFavorited(true);
      setFullscreenFavorited((prev) => {
        const next = new Set(prev);
        next.add(targetImg.id);
        return next;
      });
      await loadDatasets();
      setIsLoading(false);
      showNotification(language === "JP" ? "お気に入りに追加しました" : "Added to favorites");
    }
  };

  const handleRemoveSelectedFromFavorite = async () => {
    if (selectedImageIds.size === 0) return;
    setIsLoading(true);
    for (const id of selectedImageIds) {
      await deleteImage(id);
    }
    const remaining = images.filter((i) => !selectedImageIds.has(i.id));
    setImages(remaining);
    setSelectedImageIds(new Set());
    setLastSelectedIdx(null);
    setIsSelectionMode(false);
    await loadDatasets();
    setIsLoading(false);
    showNotification(language === "JP" ? "お気に入りから解除しました" : "Removed from favorites");
  };

  const findOriginalDatasetForImage = async (img: LoadedImage | ImageRecord): Promise<{ dataset: DatasetRecord; image: ImageRecord } | null> => {
    // 1. Check if originalDatasetId is explicitly set and exists
    if ((img as any).originalDatasetId && (img as any).originalDatasetId !== img.datasetId) {
      const origDs = datasets.find((d) => d.id === (img as any).originalDatasetId);
      if (origDs) {
        const allDbImages = await getImagesByDataset(origDs.id);
        const match = allDbImages.find(
          (i) => i.name === img.name && i.size === img.size && i.lastModified === img.lastModified
        );
        if (match) return { dataset: origDs, image: match };
        if (allDbImages.length > 0) return { dataset: origDs, image: allDbImages[0] };
      }
    }

    // 2. Search across all images in IndexedDB for an image with matching name, size, lastModified in another dataset
    const allImages = await getAllImages();
    const match = allImages.find(
      (i) =>
        i.datasetId !== img.datasetId &&
        i.name === img.name &&
        i.size === img.size &&
        i.lastModified === img.lastModified
    );

    if (match) {
      const origDs = datasets.find((d) => d.id === match.datasetId);
      if (origDs) {
        return { dataset: origDs, image: match };
      }
    }

    // 3. Fallback: if img.datasetId is a valid non-favorite dataset
    if (favoriteDatasetId && img.datasetId !== favoriteDatasetId) {
      const currentDs = datasets.find((d) => d.id === img.datasetId);
      if (currentDs) {
        return { dataset: currentDs, image: img };
      }
    }

    return null;
  };

  const handleJumpToOriginalLocation = async (img: LoadedImage | ImageRecord, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    setIsLoading(true);
    try {
      const result = await findOriginalDatasetForImage(img);
      if (!result) {
        showNotification(
          language === "JP"
            ? "元のフォルダー（データセット）が見つかりませんでした"
            : "Original dataset/folder not found"
        );
        return;
      }

      const { dataset: targetDs, image: targetImg } = result;

      // 1. Expand parent category if the dataset is in a category/folder
      if (targetDs.categoryId) {
        setActiveCategoryId(targetDs.categoryId);
        setExpandedCategoryIds((prev) => {
          const next = new Set(prev);
          let cId: string | null | undefined = targetDs.categoryId;
          while (cId) {
            next.add(cId);
            const cat = categories.find((c) => c.id === cId);
            cId = cat?.parentId;
          }
          return next;
        });
      }

      // 2. Close fullscreen and category view
      setIsFullscreen(false);
      setIsCategoryImagesView(false);

      // 3. Set active dataset
      setActiveDatasetId(targetDs.id);

      // 4. Load dataset images
      await loadImages(targetDs.id);

      // 5. Select target image and scroll to it
      const targetLoaded: LoadedImage = {
        ...targetImg,
        url: URL.createObjectURL(targetImg.data),
        randomX: Math.random() * 80 - 40,
        randomY: Math.random() * 80 - 40,
        randomRotation: Math.random() * 30 - 15,
      };

      setSelectedImage(targetLoaded);

      showNotification(
        language === "JP"
          ? `「${targetDs.name}」の元の場所へジャンプしました`
          : `Jumped to location: ${targetDs.name}`
      );
    } catch (err) {
      console.error("Failed to jump to original location", err);
      showNotification(
        language === "JP"
          ? "元の場所への移動に失敗しました"
          : "Failed to jump to location"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomMove = async (direction: "top" | "bottom" | "up" | "down") => {
    if (selectedImageIds.size === 0) return;
    setIsLoading(true);

    if (sortField !== "custom" || sortOrders.custom !== "asc") {
      setSortField("custom");
      setSortOrders(prev => ({ ...prev, custom: "asc" }));
    }

    // 常に orderIndex 昇順（画面上＝0、画面下＝N）で基準配列を構築
    const currentImages = [...sortedImages].sort((a, b) => {
      const cmp = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
      return cmp !== 0 ? cmp : (a.addedAt || a.lastModified) - (b.addedAt || b.lastModified);
    });

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

    // UIを即時反映するためステートを先行同期
    setImages(prev => {
      const copy = [...prev];
      for (const update of updates) {
        const item = copy.find(c => c.id === update.id);
        if (item) item.orderIndex = update.orderIndex;
      }
      return copy;
    });

    await updateImagesOrder(updates);

    if (activeDatasetId) {
      await loadImages(activeDatasetId);
    } else if (activeCategoryId) {
      await loadImagesForCategory(activeCategoryId);
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
    lastNavSourceRef.current = "keyboard";
    if (!selectedImage || sortedImages.length <= 1) return;
    const currentIndex = sortedImages.findIndex(
      (img) => img.id === selectedImage.id,
    );
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + 1) % sortedImages.length;
    setSelectedImage(sortedImages[nextIndex]);
  }, [selectedImage, sortedImages]);

  const goToPrevImage = React.useCallback(() => {
    lastNavSourceRef.current = "keyboard";
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
    if (isScrollTrackingUpdateRef.current) {
      isScrollTrackingUpdateRef.current = false;
      return;
    }
    // 選択画像が変わったらスクロール (キーボード操作やクリックなど、スクロール追従時以外の選択で実行)
    if (selectedImage && !isFullscreen && !isScrollingRef.current) {
      const el = document.getElementById(`image-card-${selectedImage.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedImage, isFullscreen]);

  useEffect(() => {
    let shiftOnlyPressed = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== "range") ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if (e.key === "Shift") {
        shiftOnlyPressed = true;
      } else if (e.key !== "Shift") {
        shiftOnlyPressed = false;
      }

      if (!isFullscreen && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const currentDir = autoScrollDirRef.current;
        const mode = kbdStopModeRef.current;

        if (e.key === "ArrowDown") {
          if (mode === "REVERSE") {
            // [REVERSE] 上移動中に「下」を押すと停止
            if (currentDir === "up") {
              if (e.repeat) return;
              setAutoScrollDir(null);
              return;
            }
            if (currentDir === null) {
              if (e.repeat) return;
              setAutoScrollDir("down");
            }
          } else {
            // [SAME] 下移動中に「下」を押すと停止
            if (currentDir === "down") {
              if (e.repeat) return;
              setAutoScrollDir(null);
              return;
            }
            if (currentDir === null || currentDir === "up") {
              if (e.repeat) return;
              setAutoScrollDir("down");
            }
          }
        } else if (e.key === "ArrowUp") {
          if (mode === "REVERSE") {
            // [REVERSE] 下移動中に「上」を押すと停止
            if (currentDir === "down") {
              if (e.repeat) return;
              setAutoScrollDir(null);
              return;
            }
            if (currentDir === null) {
              if (e.repeat) return;
              setAutoScrollDir("up");
            }
          } else {
            // [SAME] 上移動中に「上」を押すと停止
            if (currentDir === "up") {
              if (e.repeat) return;
              setAutoScrollDir(null);
              return;
            }
            if (currentDir === null || currentDir === "down") {
              if (e.repeat) return;
              setAutoScrollDir("up");
            }
          }
        }
        return;
      }
      // 共通ショートカット
      const key = e.key;
      const code = e.code;
      
      // input などの入力中は除外（スライダー range は操作対象として許可）
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== "range") ||
        e.target instanceof HTMLTextAreaElement
      ) {
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
          setAutoScrollSpeed((s) => {
            const next = s >= 4 ? 1 : s + 1;
            const px = next === 1 ? 100 : next === 2 ? 250 : next === 3 ? 500 : 1000;
            setAutoScrollPxPerSec(px);
            return next;
          });
          return;
        }
        if (key === "k" || key === "K") {
          if (e.repeat) return;
          e.preventDefault();
          if (e.shiftKey) {
            setIsQuickStockDrawerOpen((prev) => !prev);
          } else {
            handleCreateQuickStock();
          }
          return;
        }
        // Dedicated Numpad Speed Controls (+ / -)
        if (key === "+" || code === "NumpadAdd") {
          e.preventDefault();
          setAutoScrollPxPerSec((prev) => {
            const next = Math.min(3600, prev + 50);
            const approx = next < 175 ? 1 : next < 375 ? 2 : next < 750 ? 3 : 4;
            setAutoScrollSpeed(approx);
            triggerWheelHud(autoScrollDirRef.current, next);
            return next;
          });
          return;
        }
        if (key === "-" || code === "NumpadSubtract") {
          e.preventDefault();
          setAutoScrollPxPerSec((prev) => {
            const next = Math.max(50, prev - 50);
            const approx = next < 175 ? 1 : next < 375 ? 2 : next < 750 ? 3 : 4;
            setAutoScrollSpeed(approx);
            triggerWheelHud(autoScrollDirRef.current, next);
            return next;
          });
          return;
        }

        // Dedicated Numpad 4 (Prev Image) / Numpad 6 (Next Image)
        if (code === "Numpad4" || key === "4") {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          goToPrevImage();
          return;
        }
        if (code === "Numpad6" || key === "6") {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          goToNextImage();
          return;
        }

        // Dedicated Numpad 8 (Scroll/Move Up) / Numpad 2 (Scroll/Move Down) / Numpad 5 (Stop)
        if (code === "Numpad8" || key === "8") {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          if (e.shiftKey) {
            goToPrevDataset();
          } else {
            setAutoScrollDir((prev) => (prev === "up" ? null : "up"));
          }
          return;
        }
        if (code === "Numpad2" || key === "2") {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          if (e.shiftKey) {
            goToNextDataset();
          } else {
            setAutoScrollDir((prev) => (prev === "down" ? null : "down"));
          }
          return;
        }
        if (code === "Numpad5" || key === "5") {
          e.preventDefault();
          setAutoScrollDir(null);
          return;
        }

        if (key === "ArrowRight") {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          if (arrowKeyModeRef.current === "SPEED" && !e.shiftKey) {
            setAutoScrollPxPerSec((prev) => {
              const next = Math.min(3600, prev + 50);
              const approx = next < 175 ? 1 : next < 375 ? 2 : next < 750 ? 3 : 4;
              setAutoScrollSpeed(approx);
              triggerWheelHud(autoScrollDirRef.current, next);
              return next;
            });
          } else {
            goToNextImage();
          }
        } else if (key === "ArrowLeft") {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          if (arrowKeyModeRef.current === "SPEED" && !e.shiftKey) {
            setAutoScrollPxPerSec((prev) => {
              const next = Math.max(50, prev - 50);
              const approx = next < 175 ? 1 : next < 375 ? 2 : next < 750 ? 3 : 4;
              setAutoScrollSpeed(approx);
              triggerWheelHud(autoScrollDirRef.current, next);
              return next;
            });
          } else {
            goToPrevImage();
          }
        } else if (key === "ArrowDown" && e.shiftKey) {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          goToNextDataset();
        } else if (key === "ArrowUp" && e.shiftKey) {
          e.preventDefault();
          lastNavSourceRef.current = "keyboard";
          goToPrevDataset();
        } else if (key === "Enter") {
          e.preventDefault();
          if (e.target instanceof HTMLElement) {
            e.target.blur();
          }
          let targetImg: LoadedImage | null = null;

          // 1. キーボードで枠移動した直後の場合は、枠線で選ばれている画像を最優先
          if (
            lastNavSourceRef.current === "keyboard" &&
            selectedImage &&
            sortedImages.some((img) => img.id === selectedImage.id)
          ) {
            targetImg = selectedImage;
          }

          // 2. マウス操作直後、またはキーボード選択画像が無ければ、マウスホバー中の画像を優先
          if (!targetImg && hoveredImageIdRef.current) {
            const hImg = sortedImages.find((img) => img.id === hoveredImageIdRef.current);
            if (hImg) targetImg = hImg;
          }

          // 3. ホバー画像も無ければ画面中央に最も近い画像を取得
          if (!targetImg) {
            targetImg = getCenterImage();
          }

          // 4. それでも無ければ選択中の画像
          if (!targetImg && selectedImage && sortedImages.some((img) => img.id === selectedImage.id)) {
            targetImg = selectedImage;
          }

          if (targetImg) {
            setSelectedImage(targetImg);
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
      if (key === "r" || key === "R") {
        if (e.repeat) return;
        e.preventDefault();
        handleKeyRDown();
        return;
      }
      if (key === "h" || key === "H") {
        if (e.repeat) return;
        e.preventDefault();
        setFullscreenFlipX((f) => {
          const next = !f;
          imgControls.start({ rotateY: next ? 180 : 0, transition: { duration: 0.2 } });
          return next;
        });
        return;
      }
      if (key === "Delete") {
        if (e.repeat) return;
        e.preventDefault();
        executeHideFullscreenImage();
        return;
      }
      
      if (key === "Escape" || key === "Backspace" || key === "Enter") {
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
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleKeyRUp();
        return;
      }
      if (e.key === "Shift") {
        if (shiftOnlyPressed) {
          shiftOnlyPressed = false;
          if (!isFullscreen) {
            setArrowKeyMode((prev) => {
              const next = prev === "SPEED" ? "NAVIGATE" : "SPEED";
              const label = next === "SPEED"
                ? (language === "JP" ? "左右キー機能: 速度調整 (←/→)" : "Arrow keys: SPEED CONTROL")
                : (language === "JP" ? "左右キー機能: 画像選択 (←/→)" : "Arrow keys: IMAGE SELECT");
              showNotification(label);
              triggerWheelHud(autoScrollDirRef.current, autoScrollPxPerSecRef.current);
              return next;
            });
          }
        }
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
    handleKeyRDown,
    handleKeyRUp,
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
    if (canvasBg === "theme") {
      // 透過マーク・ロゴ（checkerboard）の場合のみ、黒テーマ等で黒ロゴが消えないよう白背景 (bg-white) を適用
      if (imgBg === "checkerboard") {
        return "bg-white";
      }
      // 通常の長方形写真・イラスト画像は、画像ごとの明暗解析で混在せず選択テーマ背景色で100%完全統一！
      const curTheme = theme.toUpperCase();
      if (curTheme === "LIGHT" || curTheme === "PAPER") {
        return "bg-white"; // LIGHT・PAPER時は完全な白 (White)
      }
      if (curTheme === "NAVY") {
        return "bg-[#080c14]"; // NAVY時は落ち着いたダークネイビー
      }
      if (curTheme === "RED") {
        return "bg-[#100505]"; // RED時は落ち着いた深紅黒
      }
      if (curTheme === "BLACK") {
        return "bg-[#0e1013]"; // BLACK時はチャコールブラック
      }
      if (curTheme === "TRUE_BLACK") {
        return "bg-black"; // TRUE_BLACK時は完全なピュアブラック
      }
      return "bg-root-bg";
    }
    if (canvasBg === "auto") {
      // AUTOモード: 画像個別の自動解析結果 (white / checkerboard -> bg-white, black -> bg-black) をそのまま個別適用
      if (imgBg === "white" || imgBg === "checkerboard") return "bg-white";
      if (imgBg === "black") return "bg-black";
      return "bg-root-bg";
    }
    if (canvasBg === "black") return "bg-black";
    if (canvasBg === "white") return "bg-white";
    if (canvasBg === "checker") return "bg-checkerboard";
    return "";
  };

  const isFullscreenDarkText = (() => {
    if (canvasBg === "theme") {
      if (selectedImage?.autoBg === "checkerboard") return true;
      const curTheme = theme.toUpperCase();
      return curTheme === "LIGHT" || curTheme === "PAPER";
    }
    if (canvasBg === "auto") {
      return selectedImage?.autoBg === "white" || selectedImage?.autoBg === "checkerboard";
    }
    return canvasBg === "white" || canvasBg === "checker";
  })();

  const renderImageCard = (
    img: LoadedImage,
    i: number,
    isSelected: boolean,
    isMultiSelected: boolean,
  ) => {
    const currentDs = datasets.find(d => d.id === activeDatasetId);
    const isCover = currentDs?.coverImageId === img.id;
    const imgKey = `${img.name}-${img.size}-${img.lastModified}`;
    const isFavorited =
      (activeDatasetId && favoriteDatasetId && activeDatasetId === favoriteDatasetId) ||
      favoritedKeys.has(imgKey) ||
      favoritedKeys.has(img.id);

    const isFavoriteDatasetView =
      activeDatasetId && favoriteDatasetId && activeDatasetId === favoriteDatasetId;
    const showOriginButton =
      !isSelectionMode && (isFavoriteDatasetView || Boolean((img as any).originalDatasetId));

    return (
      <motion.div
        id={`image-card-${img.id}`}
        key={img.id}
        layout={false}
        drag={viewMode === "free"}
        dragConstraints={viewMode === "free" ? scatterContainerRef : false}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => {
          suppressNextClickRef.current = true;
        }}
        onDragEnd={(event, info) => {
          setTimeout(() => {
            suppressNextClickRef.current = false;
          }, 200);
          if (viewMode === "free" && containerWidth > 0 && containerHeight > 0) {
            const deltaXPercent = (info.offset.x / containerWidth) * 100;
            const deltaYPercent = (info.offset.y / containerHeight) * 100;
            const newX = Math.max(-45, Math.min(45, img.randomX + deltaXPercent));
            const newY = Math.max(-45, Math.min(45, img.randomY + deltaYPercent));
            setImages((prev) =>
              prev.map((item) =>
                item.id === img.id ? { ...item, randomX: newX, randomY: newY } : item
              )
            );
          }
        }}
        whileDrag={{
          scale: 1.05,
          zIndex: 100,
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
        whileHover={
          viewMode === "free" ? { scale: 1.02, zIndex: 20 } : {}
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
                x: (img.randomX * containerWidth) / 100,
                y: (img.randomY * containerHeight) / 100,
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
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
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
      onMouseEnter={() => {
        setHoveredImageId(img.id);
        lastNavSourceRef.current = "mouse";
      }}
      onMouseMove={() => {
        if (lastNavSourceRef.current !== "mouse") {
          lastNavSourceRef.current = "mouse";
        }
      }}
      onMouseLeave={() => setHoveredImageId((prev) => (prev === img.id ? null : prev))}
      onDoubleClick={() => {
        if (suppressNextClickRef.current || isSelectionMode) return;
        setSelectedImage(img);
        if (openAction === "dblclick" || viewMode === "free") {
          setIsFullscreen(true);
        }
      }}
      className={cn(
        "cursor-pointer overflow-hidden border min-w-0 min-h-0 relative transition-colors rounded-none bg-panel-bg",
        isSelected || isMultiSelected
          ? "border-2 border-accent ring-2 ring-accent/60 ring-offset-1 ring-offset-panel-bg shadow-[0_0_18px_var(--color-accent-glow)] z-10 scale-[1.01]"
          : "border border-panel-border hover:border-text-secondary z-0",
        viewMode === "grid-ma" && "w-full",
        viewMode === "grid-sq" &&
          "w-full aspect-square flex items-center justify-center",
        viewMode === "free" && "absolute shadow-xl",
        viewMode === "list" &&
          "w-full flex items-center shrink-0 group/listitem",
      )}
      style={
        viewMode === "free"
          ? (() => {
              let freeW = itemScale;
              let freeH = itemScale;
              if (scatterAspectMode === "natural") {
                const imgW = img.width && img.height ? img.width : 1;
                const imgH = img.width && img.height ? img.height : 1;
                const aspect = imgW / imgH;
                if (aspect >= 1) {
                  // 横長・長方形
                  freeW = itemScale;
                  freeH = Math.max(24, Math.round(itemScale / aspect));
                } else {
                  // 縦長・長方形
                  freeH = itemScale;
                  freeW = Math.max(24, Math.round(itemScale * aspect));
                }
              }
              return {
                opacity: img.isHidden ? 0.4 : 1,
                width: freeW,
                height: freeH,
                left: `50%`,
                top: `50%`,
                marginLeft: `-${freeW / 2}px`,
                marginTop: `-${freeH / 2}px`,
                zIndex: isSelected ? 50 : 1,
              };
            })()
          : viewMode === "list"
            ? {
                height: "auto",
                width: "100%",
                zIndex: isSelected ? 50 : 1,
                padding: gridGap === 0 ? "0px 8px" : `${Math.min(12, Math.round(gridGap / 2))}px ${Math.max(8, Math.min(16, gridGap))}px`,
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
          {(() => {
            // Masonry同様にスライダー最大（750px）まで巨大化対応。
            // 右側のメタデータ領域（最低200px確保）に合わせて画面幅内で限界までデカく拡大
            const maxBoxLimit = typeof containerWidth === "number" && containerWidth > 320
              ? Math.max(60, Math.min(itemScale, containerWidth - 200))
              : itemScale;
            const boxSize = Math.max(40, maxBoxLimit);

            return (
              <div
                className="shrink-0 border border-panel-border overflow-hidden flex items-center justify-center bg-panel-bg transition-all"
                style={{
                  width: `${boxSize}px`,
                  height: `${boxSize}px`,
                }}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center w-full h-full p-1",
                    getCanvasBgClass(img.autoBg),
                  )}
                >
                  <img
                    src={img.url}
                    draggable={false}
                    className="max-w-full max-h-full object-contain block mx-auto my-auto"
                  />
                </div>
              </div>
            );
          })()}
          <div
            className="flex-1 min-w-0 flex flex-col justify-center group/name transition-colors rounded hover:bg-panel-border/30 h-full"
            style={{
              marginLeft: gridGap === 0 ? "8px" : `${Math.max(8, Math.min(16, gridGap))}px`,
              paddingLeft: "8px",
              paddingRight: "8px",
            }}
          >
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
                {/* Favorite Star Button in List View (Not shown when viewing the favorite dataset itself) */}
                {favoriteDatasetId && activeDatasetId !== favoriteDatasetId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavoriteImage(img);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className={cn(
                      "p-1 flex items-center justify-center rounded transition-opacity flex-shrink-0 cursor-pointer",
                      isFavorited
                        ? "text-white opacity-90 hover:opacity-100"
                        : "text-text-muted/50 hover:text-white opacity-30 group-hover/name:opacity-80"
                    )}
                    title={isFavorited ? t("Remove from favorites", "お気に入りから解除") : t("Add to favorites", "お気に入りに追加")}
                  >
                    <Star size={12} strokeWidth={1.5} className="fill-none text-current" />
                  </button>
                )}

                {showOriginButton && (
                  <button
                    onClick={(e) => handleJumpToOriginalLocation(img, e)}
                    onDoubleClick={(e) => e.stopPropagation()}
                    className="p-1 flex items-center justify-center text-text-muted hover:text-white transition-opacity flex-shrink-0 opacity-0 group-hover/name:opacity-100 cursor-pointer"
                    title={t("Jump to original dataset/folder location", "この画像が本来入っている元のフォルダー（データセット）の場所へジャンプ")}
                  >
                    <RotateCcw size={12} strokeWidth={1.8} />
                  </button>
                )}
                <button
                  onClick={(e) => handleRenameFileClick(e, img.id, img.name)}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="text-text-muted hover:text-accent transition-colors flex-shrink-0 opacity-0 group-hover/name:opacity-100 px-2 flex items-center justify-center cursor-pointer"
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

      {/* Favorite Star Button on Image Cards (Not shown when viewing the favorite dataset itself) */}
      {favoriteDatasetId && activeDatasetId !== favoriteDatasetId && !isSelectionMode && viewMode !== "list" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFavoriteImage(img);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-2 z-20 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-150 backdrop-blur-xs cursor-pointer select-none",
            showOriginButton ? "right-[72px]" : "right-2",
            isFavorited
              ? "bg-black/40 border border-white/30 text-white opacity-80 hover:opacity-100"
              : "bg-black/20 hover:bg-black/40 border border-white/10 hover:border-white/25 text-white/40 hover:text-white opacity-25 group-hover:opacity-75"
          )}
          title={isFavorited ? t("Remove from favorites", "お気に入りから解除") : t("Add to favorites", "お気に入りに追加")}
        >
          <Star size={12} strokeWidth={1.5} className="fill-none text-current" />
        </button>
      )}

      {/* Jump to Original Location Button (ONLY shown when viewing Favorite Dataset or favorited item) */}
      {!isSelectionMode && viewMode !== "list" && showOriginButton && (
        <button
          onClick={(e) => handleJumpToOriginalLocation(img, e)}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-20 w-6 h-6 flex items-center justify-center rounded-full transition-all duration-150 backdrop-blur-xs cursor-pointer select-none bg-black/30 hover:bg-black/60 border border-white/20 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 shadow-sm"
          title={t("Jump to original dataset/folder location", "この画像が本来入っている元のフォルダー（データセット）の場所へジャンプ")}
        >
          <RotateCcw size={12} strokeWidth={1.8} />
        </button>
      )}

      {/* Cover Image Indicator / Set Button */}
      {(() => {
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
        <div
          className={cn(
            "absolute left-2 z-20 pointer-events-none transition-all",
            isCover ? "top-[34px]" : "top-2",
          )}
        >
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

      {/* Custom Sort Reorder Handle (カスタムソート時の並び替え用専用ハンドル) */}
      {sortField === "custom" && viewMode !== "free" && (
        <div
          className={cn(
            "image-sort-handle z-20 cursor-grab active:cursor-grabbing select-none transition-all flex items-center justify-center",
            viewMode === "list"
              ? "shrink-0 p-1.5 text-text-muted hover:text-accent rounded hover:bg-panel-border/50"
              : "absolute bottom-2 right-2 bg-black/80 hover:bg-accent text-text-muted hover:text-root-bg border border-panel-border/70 rounded-xs px-1.5 py-1 gap-1 shadow-md opacity-60 hover:opacity-100 group-hover:opacity-90 font-mono text-[9px] backdrop-blur-xs",
          )}
          title={t("Drag to reorder in Custom Sort", "ドラッグして並び替え（カスタムソート）")}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={viewMode === "list" ? 16 : 11} />
          {viewMode !== "list" && <span className="font-bold tracking-wider text-[8px]">SORT</span>}
        </div>
      )}
    </motion.div>
    );
  };

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
              <input
                type="range"
                min="60"
                max="750"
                value={itemScale}
                onChange={(e) => setItemScale(Number(e.target.value))}
                onPointerUp={(e) => (e.currentTarget as HTMLElement).blur()}
                onMouseUp={(e) => (e.currentTarget as HTMLElement).blur()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.currentTarget as HTMLElement).blur();
                  }
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-text-primary w-10 text-right">{itemScale}px</span>
          </div>

          <div className="flex items-center gap-2 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">GAP:</span>
            <div className="w-40 flex items-center">
              <input
                type="range"
                min="0"
                max="120"
                value={gridGap}
                onChange={(e) => setGridGap(Number(e.target.value))}
                onPointerUp={(e) => (e.currentTarget as HTMLElement).blur()}
                onMouseUp={(e) => (e.currentTarget as HTMLElement).blur()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.currentTarget as HTMLElement).blur();
                  }
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-text-primary w-10 text-right">{gridGap}px</span>
          </div>

          <div className="flex items-center gap-2 h-full">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">
              CANVAS:
            </span>
            <div className="flex gap-1 h-full py-2 items-center font-mono">
              <SolidButton active={canvasBg === "theme"} onClick={() => setCanvasBg("theme")} className="w-[52px] h-6 px-0 py-0 text-[10px] tracking-wider justify-center flex items-center" title={t("Blend with current UI theme", "テーマ背景になじむ色")}>THEME</SolidButton>
              <SolidButton active={canvasBg === "auto"} onClick={() => setCanvasBg("auto")} className="w-[52px] h-6 px-0 py-0 text-[10px] tracking-wider justify-center flex items-center" title={t("Auto detect image background", "画像解析オート（白・黒自動判定）")}>AUTO</SolidButton>
              <SolidButton active={canvasBg === "black"} onClick={() => setCanvasBg("black")} className="w-[52px] h-6 px-0 py-0 text-[10px] tracking-wider justify-center flex items-center" title={t("Force black background", "ブラック背景に固定")}>BLACK</SolidButton>
              <SolidButton active={canvasBg === "white"} onClick={() => setCanvasBg("white")} className="w-[52px] h-6 px-0 py-0 text-[10px] tracking-wider justify-center flex items-center" title={t("Force white background", "ホワイト背景に固定")}>WHITE</SolidButton>
              <SolidButton active={canvasBg === "checker"} onClick={() => setCanvasBg("checker")} className="w-[52px] h-6 px-0 py-0 text-[10px] tracking-widest justify-center flex items-center" title={t("Force checkerboard background", "透明格子背景に固定")}>CHK</SolidButton>
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
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[10px] font-mono tracking-wider animate-pulse select-none">
                <WifiOff size={11} />
                <span>OFFLINE</span>
              </div>
            )}
            {deferredInstallPrompt && (
              <SolidButton
                onClick={handleInstallPWA}
                className="px-2.5 py-0 h-6 text-[10px] flex items-center gap-1.5 text-accent border-accent/40 bg-accent/10 hover:bg-accent/20"
                title={t("Install app on this device", "この端末にアプリをインストール")}
              >
                <Download size={12} />
                <span>INSTALL</span>
              </SolidButton>
            )}
            {/* QUICK STOCK BUTTON */}
            <SolidButton
              onClick={() => setIsQuickStockDrawerOpen((prev) => !prev)}
              className={cn(
                "px-2.5 py-0 h-6 text-[10px] flex items-center gap-1.5 font-mono cursor-pointer transition-all",
                isQuickStockDrawerOpen
                  ? "border-accent bg-accent/20 text-accent font-bold shadow-xs"
                  : quickStocks.length > 0
                  ? "border-panel-border text-text-primary hover:border-accent hover:text-accent"
                  : "border-panel-border text-text-secondary hover:text-text-primary"
              )}
              title={t("Toggle Quick Stock Drawer (Save & restore scroll states)", "クイックストック一覧を開閉（閲覧・スクロール位置保存）")}
            >
              <Zap size={12} className={cn("shrink-0", isQuickStockDrawerOpen ? "text-accent fill-accent" : "text-text-secondary")} />
              <span>STOCK</span>
              {quickStocks.length > 0 && (
                <span className="bg-panel-border/60 text-text-muted px-1 py-0 rounded text-[9px] font-bold">
                  {quickStocks.length}
                </span>
              )}
            </SolidButton>

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

            {/* SCATTER DISPLAY COUNT LIMIT & SHUFFLE CONTROLS (COLLAPSIBLE) */}
            {viewMode === "free" && (
              <div className="mt-3 p-2 bg-panel-bg/90 border border-accent/30 rounded flex flex-col gap-2 font-mono text-[10px] shadow-xs">
                {/* Panel Header Toggle */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={toggleScatterSettingsExpanded}
                    className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider text-left"
                    title={t("Toggle SCATTER settings panel", "スケーター詳細設定パネルの展開/折りたたみ")}
                  >
                    {isScatterSettingsExpanded ? (
                      <ChevronDown size={14} className="text-accent shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-accent shrink-0" />
                    )}
                    <ScatterChart size={12} className="text-accent shrink-0" />
                    <span>{t("SCATTER SETTINGS", "スケーター詳細設定")}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-accent font-bold text-[10px] tabular-nums">
                      {scatterLimit}枚
                    </span>
                    <button
                      type="button"
                      onClick={handleReshuffleScatter}
                      className="px-1.5 py-0.5 bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent/40 rounded transition-all font-bold text-[9px] flex items-center gap-1 cursor-pointer"
                      title={t("Reshuffle layout and sampled images", "スケーター配置・抽出画像を再シャッフル")}
                    >
                      <RefreshCw size={10} />
                      <span>{t("SHUFFLE", "再シャッフル")}</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Body */}
                {isScatterSettingsExpanded && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-panel-border/60">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted uppercase tracking-wider font-bold flex items-center gap-1">
                        <ScatterChart size={12} className="text-accent" />
                        {t("SCATTER DISPLAY MAX", "SCATTER表示枚数上限")}
                      </span>
                      <span className="text-accent font-bold text-xs">{scatterLimit}枚</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={scatterLimit}
                        onChange={(e) => handleUpdateScatterLimit(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-panel-border rounded-lg appearance-none cursor-pointer accent-accent"
                        title={t("Adjust SCATTER max display count (10 - 100 images)", "SCATTER表示上限枚数を調整 (10枚〜100枚)")}
                      />
                    </div>
                    <div className="flex justify-between items-center gap-1 pt-0.5">
                      {[10, 20, 30, 50, 75, 100].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleUpdateScatterLimit(num)}
                          className={cn(
                            "flex-1 py-1 text-[9px] font-bold rounded transition-all text-center border cursor-pointer",
                            scatterLimit === num
                              ? "bg-accent border-accent text-accent-text shadow-xs"
                              : "bg-panel-bg border-panel-border/80 text-text-muted hover:text-text-primary hover:border-text-muted"
                          )}
                          title={`Set limit to ${num} images`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    {/* ASPECT RATIO MODE TOGGLE */}
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-panel-border/60">
                      <span className="text-text-muted uppercase tracking-wider font-bold text-[9px]">
                        {t("CARD RATIO (ASPECT)", "枠形状 (アスペクト比)")}
                      </span>
                      <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                        <button
                          type="button"
                          onClick={() => handleUpdateScatterAspectMode("natural")}
                          className={cn(
                            "py-1 px-1 border transition-all text-center rounded-xs cursor-pointer flex items-center justify-center gap-1",
                            scatterAspectMode === "natural"
                              ? "border-accent bg-accent/20 text-accent font-bold shadow-xs"
                              : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                          )}
                          title={t("Keep original aspect ratio (Portrait / Landscape / Square mixed)", "長方形・縦長・横長・正方形の混在表示")}
                        >
                          <Smartphone size={10} className="rotate-90 text-accent" />
                          <span>{t("MIXED / NATURAL", "縦横比混在")}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateScatterAspectMode("square")}
                          className={cn(
                            "py-1 px-1 border transition-all text-center rounded-xs cursor-pointer flex items-center justify-center gap-1",
                            scatterAspectMode === "square"
                              ? "border-accent bg-accent/20 text-accent font-bold shadow-xs"
                              : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                          )}
                          title={t("Force all cards to square", "すべての枠を正方形に統一")}
                        >
                          <Square size={10} />
                          <span>{t("SQUARE", "正方形統一")}</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-[9px] text-text-muted pt-1.5 border-t border-panel-border/60 flex items-center justify-between">
                      <span>💡 {t("Wheel to Zoom Image Scale", "ホイール回転で拡大縮小")}</span>
                      <span className="text-accent font-bold tabular-nums">{itemScale}px</span>
                    </div>

                    {/* ROTATION ANGLE RANGE TOGGLE */}
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-panel-border/60">
                      <div className="flex items-center justify-between font-mono text-[9px]">
                        <span className="text-text-muted uppercase tracking-wider font-bold">
                          {t("ROTATION ANGLE", "傾き角度範囲")}
                        </span>
                        <span className="text-accent font-bold">±{scatterRotationRange}°</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 font-mono text-[9px]">
                        {[
                          { label: "±15°", val: 15 },
                          { label: "±30°", val: 30 },
                          { label: "±45°", val: 45 },
                          { label: "±60°", val: 60 },
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => handleUpdateScatterRotationRange(item.val)}
                            className={cn(
                              "py-1 border transition-all text-center rounded-xs cursor-pointer font-bold",
                              scatterRotationRange === item.val
                                ? "border-accent bg-accent/20 text-accent shadow-xs"
                                : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                            )}
                            title={`Scatter rotation range: ±${item.val}°`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                    title={
                      <div className="flex items-center justify-between w-full pr-1">
                        <span>{t("02 DATA SETS", "02 データセット")}</span>
                        <div className="flex items-center gap-1 font-mono text-[9px] shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-text-muted text-[9px] mr-0.5">{t("SIZE:", "サイズ:")}</span>
                          {[
                            { id: "xs", label: "XS" },
                            { id: "sm", label: "SM" },
                            { id: "base", label: "MD" },
                            { id: "lg", label: "LG" },
                            { id: "xl", label: "XL" },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSidebarFontSize(f.id as any)}
                              className={cn(
                                "px-1.5 py-0.5 border transition-all text-[9px] rounded-xs cursor-pointer",
                                sidebarFontSize === f.id
                                  ? "border-accent bg-accent/30 text-accent font-bold"
                                  : "border-panel-border/60 text-text-muted hover:text-text-primary bg-panel-bg"
                              )}
                              title={`Sidebar font size: ${f.label}`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    }
                    className={cn("shrink-0 flex flex-col", isDataSetsExpanded && "flex-1 min-h-[200px]")}
                    contentClassName="flex flex-col p-4 overflow-hidden gap-3 h-full"
                    isCollapsible
                    isExpanded={isDataSetsExpanded}
                    onToggle={() => setIsDataSetsExpanded(!isDataSetsExpanded)}
                    dragHandle
                  >
                    <div className="flex gap-1.5 shrink-0">
                      <SolidButton
                        onClick={() => handleOpenNewCategoryModal(activeCategoryId)}
                        className="flex-1 justify-center text-folder-icon text-[11px] gap-1 px-1.5"
                        title={t("Create new folder", "新規フォルダーを作成")}
                      >
                        <FolderPlus size={13} />
                        <span>+ {t("NEW FOLDER", "フォルダー")}</span>
                      </SolidButton>
                      <SolidButton
                        onClick={() => handleAddDatasetClick(activeCategoryId)}
                        className="flex-1 justify-center text-accent text-[11px] gap-1 px-1.5"
                        title={t("Create new dataset", "新規データセットを作成")}
                      >
                        <FilePlus size={13} />
                        <span>+ {t("NEW SET", "セット")}</span>
                      </SolidButton>
                      <SolidButton
                        onClick={() =>
                          setDatasetViewMode((v) =>
                            v === "list" ? "dropdown" : "list",
                          )
                        }
                        className="px-2.5"
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
                        className="px-2.5"
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
                  sidebarFontSize={sidebarFontSize}
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
                    setCategoryIconInput(cat.icon || "folder");
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
                    <option value="" className="bg-white text-black">ALL IMAGE DATA ({totalImagesCount})</option>
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
                        {/* 03 COMMAND */}
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
                            "px-1.5 py-0.5 transition-all flex items-center gap-1 border rounded-xs cursor-pointer",
                            !isTrackInfoCollapsed && bottomPanelTab === "command"
                              ? "bg-accent text-accent-text font-bold border-accent shadow-xs"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                          title={t("Command Shortcut List", "ショートカット一覧")}
                        >
                          <Terminal size={11} />
                          <span>{t("03 CMD", "03 コマンド")}</span>
                        </button>

                        {/* GENERAL SETTINGS */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTrackInfoCollapsed) {
                              setIsTrackInfoCollapsed(false);
                              setBottomPanelTab("general");
                            } else if (bottomPanelTab === "general") {
                              setIsTrackInfoCollapsed(true);
                            } else {
                              setBottomPanelTab("general");
                            }
                          }}
                          className={cn(
                            "px-1.5 py-0.5 transition-all flex items-center gap-1 border rounded-xs cursor-pointer",
                            !isTrackInfoCollapsed && bottomPanelTab === "general"
                              ? "bg-accent text-accent-text font-bold border-accent shadow-xs"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                          title={t("General & Wheel Settings", "ホイール・一般設定")}
                        >
                          <Mouse size={11} />
                          <span>{t("GENERAL", "一般設定")}</span>
                        </button>

                        {/* APPEARANCE / COLOR SETTINGS */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTrackInfoCollapsed) {
                              setIsTrackInfoCollapsed(false);
                              setBottomPanelTab("appearance");
                            } else if (bottomPanelTab === "appearance") {
                              setIsTrackInfoCollapsed(true);
                            } else {
                              setBottomPanelTab("appearance");
                            }
                          }}
                          className={cn(
                            "px-1.5 py-0.5 transition-all flex items-center gap-1 border rounded-xs cursor-pointer",
                            !isTrackInfoCollapsed && bottomPanelTab === "appearance"
                              ? "bg-accent text-accent-text font-bold border-accent shadow-xs"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                          title={t("Appearance & Color Settings", "外観・カラー設定")}
                        >
                          <Palette size={11} />
                          <span>{t("COLOR", "外観・カラー")}</span>
                        </button>

                        {/* 04 QUICK STOCK */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isTrackInfoCollapsed) {
                              setIsTrackInfoCollapsed(false);
                              setBottomPanelTab("stock");
                            } else if (bottomPanelTab === "stock") {
                              setIsTrackInfoCollapsed(true);
                            } else {
                              setBottomPanelTab("stock");
                            }
                          }}
                          className={cn(
                            "px-1.5 py-0.5 transition-all flex items-center gap-1 border rounded-xs cursor-pointer",
                            !isTrackInfoCollapsed && bottomPanelTab === "stock"
                              ? "bg-accent text-accent-text font-bold border-accent shadow-xs"
                              : "border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                          title={t("Quick Stock (Save & restore scroll states)", "クイックストック（閲覧・スクロール位置保存）")}
                        >
                          <Zap size={11} className={!isTrackInfoCollapsed && bottomPanelTab === "stock" ? "fill-current" : "text-text-muted"} />
                          <span>{t("STOCK", "ストック")}</span>
                          {quickStocks.length > 0 && (
                            <span className={cn(
                              "text-[8px] px-1 py-0 rounded-full font-mono font-bold leading-none",
                              !isTrackInfoCollapsed && bottomPanelTab === "stock" ? "bg-black/20 text-accent-text" : "bg-panel-border/60 text-text-muted"
                            )}>
                              {quickStocks.length}
                            </span>
                          )}
                        </button>
                      </div>
                    }
                    headerRight={
                      !isTrackInfoCollapsed && (
                        <div className="flex items-center gap-1 font-mono text-[9px] mr-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBottomPanelHeight((prev) => (prev > 450 ? 330 : 540));
                            }}
                            className="px-1.5 py-0.5 border border-panel-border hover:border-accent hover:text-accent rounded-xs transition-colors cursor-pointer text-text-muted"
                            title={t("Toggle wide panel height (or drag top/bottom border)", "パネルの高さを拡大・縮小（枠線のドラッグでも伸縮可能）")}
                          >
                            {bottomPanelHeight > 450 ? "COMPACT" : "WIDE"}
                          </button>
                        </div>
                      )
                    }
                    className={cn(
                      "shrink-0 flex flex-col items-center min-w-0 w-full relative group/bpanel",
                      !isResizingBottomPanel && "transition-all duration-200",
                      isTrackInfoCollapsed ? "h-[34px]" : "",
                    )}
                    style={!isTrackInfoCollapsed ? { height: `${bottomPanelHeight}px` } : undefined}
                    contentClassName={cn(
                      "flex flex-col w-full min-w-0 transition-opacity duration-300 relative",
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
                      <div className="flex flex-col gap-3 h-full w-full min-w-0 overflow-y-auto pr-1 select-none text-[11px] relative">
                        {/* TOP RESIZE HANDLE (DRAG UP TO EXPAND) */}
                        <div
                          className="absolute -top-3 left-0 right-0 h-4 cursor-row-resize z-40 flex items-center justify-center opacity-0 group-hover/bpanel:opacity-100 hover:!opacity-100 transition-opacity"
                          title={t("Drag up to expand height, down to shrink (Double click to reset)", "上にドラッグして広げる、下にドラッグして縮める（ダブルクリックで切替）")}
                          onDoubleClick={() => setBottomPanelHeight((prev) => (prev > 450 ? 330 : 540))}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            setIsResizingBottomPanel(true);
                            const startY = e.clientY;
                            const startH = bottomPanelHeight;
                            const onMove = (ev: PointerEvent) => {
                              const delta = startY - ev.clientY;
                              setBottomPanelHeight(Math.min(850, Math.max(160, startH + delta)));
                            };
                            const onUp = () => {
                              setIsResizingBottomPanel(false);
                              window.removeEventListener("pointermove", onMove);
                              window.removeEventListener("pointerup", onUp);
                            };
                            window.addEventListener("pointermove", onMove);
                            window.addEventListener("pointerup", onUp);
                          }}
                        >
                          <div className="w-16 h-1 rounded-full bg-panel-border/80 hover:bg-accent transition-colors shadow-xs" />
                        </div>

                        {/* BOTTOM RESIZE HANDLE (DRAG DOWN TO EXPAND) */}
                        <div
                          className="absolute -bottom-3 left-0 right-0 h-4 cursor-row-resize z-40 flex items-center justify-center opacity-0 group-hover/bpanel:opacity-100 hover:!opacity-100 transition-opacity"
                          title={t("Drag down to expand height, up to shrink (Double click to reset)", "下にドラッグして広げる、上にドラッグして縮める（ダブルクリックで切替）")}
                          onDoubleClick={() => setBottomPanelHeight((prev) => (prev > 450 ? 330 : 540))}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            setIsResizingBottomPanel(true);
                            const startY = e.clientY;
                            const startH = bottomPanelHeight;
                            const onMove = (ev: PointerEvent) => {
                              const delta = ev.clientY - startY;
                              setBottomPanelHeight(Math.min(850, Math.max(160, startH + delta)));
                            };
                            const onUp = () => {
                              setIsResizingBottomPanel(false);
                              window.removeEventListener("pointermove", onMove);
                              window.removeEventListener("pointerup", onUp);
                            };
                            window.addEventListener("pointermove", onMove);
                            window.addEventListener("pointerup", onUp);
                          }}
                        >
                          <div className="w-16 h-1 rounded-full bg-panel-border/80 hover:bg-accent transition-colors shadow-xs" />
                        </div>
                        {bottomPanelTab === "command" && (
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
                                  Drag / Wheel
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("List Drag / Jog: Speed / Click: Stop", "一覧ドラッグ・ジョグで速度調整 / クリック停止")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  ← / → (or テンキー 4/6)
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Select Prev / Next Image", "前 / 次の画像選択 (テンキー 4/6)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-accent/40 text-accent text-center min-w-[24px]">
                                  テンキー + / -
                                </kbd>
                                <span className="text-text-secondary truncate font-bold text-accent">
                                  {t("Numpad Speed Adjust (+50px/s / -50px/s)", "テンキー速度調整 (+で加速 / -で減速)")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-btn-border text-text-primary text-center min-w-[24px]">
                                  テンキー 8 / 2 / 5
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Scroll Up / Down / Stop", "スクロール移動 (8:上 / 2:下 / 5:停止)")}
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

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-amber-500/40 text-amber-400 text-center min-w-[24px]">
                                  K
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Quick Stock Current Position", "現在位置をクイックストック保存")}
                                </span>

                                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-btn-bg border border-amber-500/40 text-amber-400 text-center min-w-[24px]">
                                  Shift + K
                                </kbd>
                                <span className="text-text-secondary truncate">
                                  {t("Open Quick Stock Drawer", "ストック一覧パネルを開閉")}
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
                                  {t("Rotate Image (Tap: Step / Hold: Free)", "画像回転 (タップ: 45°回転 / 長押し: 自由連続回転)")}
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
                        )}

                        {bottomPanelTab === "general" && (
                          <div className="flex flex-col gap-3.5 text-[11px]">
                            {/* 1. MOUSE WHEEL SENSITIVITY / SCROLL WIDTH */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Mouse size={12} className="text-accent" />
                                  <span>{t("WHEEL SENSITIVITY", "ホイール感度・移動幅")}</span>
                                </div>
                                <span className="text-accent font-bold font-mono text-[11px] tabular-nums">
                                  {wheelSensitivity.toFixed(2)}x ({Math.round(wheelSensitivity * 100)}%)
                                </span>
                              </div>

                              <div className="text-[10px] text-text-muted leading-tight">
                                {t(
                                  "Adjust wheel acceleration & scroll step size for your mouse/PC.",
                                  "マウスホイール回転時の加速率・移動幅を調整します。PCやマウスの環境に合わせて微調整できます。"
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-0.5">
                                <input
                                  type="range"
                                  min="0.1"
                                  max="2.5"
                                  step="0.05"
                                  value={wheelSensitivity}
                                  tabIndex={-1}
                                  onChange={(e) => setWheelSensitivity(parseFloat(e.target.value))}
                                  onMouseUp={(e) => (e.target as HTMLElement).blur()}
                                  onPointerUp={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full h-1.5 bg-btn-bg border border-btn-border rounded-lg appearance-none cursor-pointer accent-accent"
                                />
                              </div>

                              {/* Sensitivity Presets */}
                              <div className="flex items-center gap-1 font-mono text-[9px]">
                                {[
                                  { label: "0.3x (極低)", val: 0.3 },
                                  { label: "0.6x (控えめ)", val: 0.6 },
                                  { label: "1.0x (標準)", val: 1.0 },
                                  { label: "1.5x (高速)", val: 1.5 },
                                  { label: "2.0x (爆速)", val: 2.0 },
                                ].map((preset) => (
                                  <button
                                    key={preset.val}
                                    type="button"
                                    onClick={() => setWheelSensitivity(preset.val)}
                                    className={cn(
                                      "flex-1 py-1 border transition-all text-[9px] text-center rounded-xs cursor-pointer",
                                      Math.abs(wheelSensitivity - preset.val) < 0.01
                                        ? "border-accent bg-accent/20 text-accent font-bold shadow-xs"
                                        : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 2. WHEEL ROTATION DIRECTION (INVERT) */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <RotateCw size={12} className="text-accent" />
                                  <span>{t("WHEEL DIRECTION", "ホイール回転方向")}</span>
                                </div>
                                <span className="text-[9px] text-accent font-mono uppercase font-bold">
                                  {wheelInvert ? t("INVERTED (↑)", "反転 (上↑)") : t("NORMAL (↓)", "標準 (下↓)")}
                                </span>
                              </div>

                              <div className="text-[10px] text-text-muted leading-tight">
                                {t(
                                  "Choose whether wheel down scrolls forward/down or upward.",
                                  "ホイールを手前（下）に回した時のスクロール方向を切り替えます。"
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setWheelInvert(false)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    !wheelInvert
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <ArrowDown size={12} className="text-sky-400" />
                                    <span>{t("NORMAL", "標準 (下回転: ↓)")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">下回転で下へスクロール</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setWheelInvert(true)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    wheelInvert
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <ArrowUp size={12} className="text-amber-400" />
                                    <span>{t("INVERT", "反転 (下回転: ↑)")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">下回転で上へスクロール</span>
                                </button>
                              </div>
                            </div>

                            {/* 3. DRAG SCROLL DIRECTION (INVERT) */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <MoveVertical size={12} className="text-accent" />
                                  <span>{t("DRAG DIRECTION", "ドラッグスクロール方向")}</span>
                                </div>
                                <span className="text-[9px] text-accent font-mono uppercase font-bold">
                                  {dragInvert ? t("INVERTED (↑)", "反転 (下引: ↑)") : t("NORMAL (↓)", "標準 (下引: ↓)")}
                                </span>
                              </div>

                              <div className="text-[10px] text-text-muted leading-tight">
                                {t(
                                  "Choose whether dragging down scrolls forward/down or upward.",
                                  "一覧を掴んで下へ滑らせた時のスクロール方向を切り替えます。"
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setDragInvert(false)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    !dragInvert
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <ArrowDown size={12} className="text-sky-400" />
                                    <span>{t("NORMAL", "標準 (下ドラッグ: ↓)")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">下へ引いて下へスクロール</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDragInvert(true)}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    dragInvert
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <ArrowUp size={12} className="text-amber-400" />
                                    <span>{t("INVERT", "反転 (下ドラッグ: ↑)")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">下へ引いて上へスクロール</span>
                                </button>
                              </div>
                            </div>

                            {/* 4. KEYBOARD STOP MODE */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Keyboard size={12} className="text-accent" />
                                  <span>{t("KEYBOARD STOP MODE", "キー操作停止方式")}</span>
                                </div>
                                <span className="text-[9px] text-accent font-mono uppercase font-bold">
                                  {kbdStopMode === "REVERSE" ? t("REVERSE STOP", "対向キーで停止") : t("SAME STOP", "同キーで停止")}
                                </span>
                              </div>

                              <div className="text-[10px] text-text-muted leading-tight">
                                {t(
                                  "Select how arrow keys pause movement during list scrolling.",
                                  "一覧スクロール中、上下キー入力時にスクロールを一旦停止させる方式を選択します。"
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setKbdStopMode("REVERSE")}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    kbdStopMode === "REVERSE"
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{t("REVERSE", "対向キーで停止")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">移動中に反対キーで停止</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setKbdStopMode("SAME")}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    kbdStopMode === "SAME"
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{t("SAME KEY", "同キーで停止")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">移動中に同じキーで停止</span>
                                </button>
                              </div>
                            </div>

                            {/* 5. ARROW KEYS IN LIST VIEW */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Sliders size={12} className="text-accent" />
                                  <span>{t("LIST ARROW KEYS", "一覧での左右キー機能")}</span>
                                </div>
                                <span className="text-[9px] text-accent font-mono uppercase font-bold">
                                  {arrowKeyMode === "SPEED" ? t("SPEED CONTROL", "速度微調整") : t("IMAGE SELECT", "画像選択移動")}
                                </span>
                              </div>

                              <div className="text-[10px] text-text-muted leading-tight">
                                {t(
                                  "Choose whether left/right keys adjust scroll speed or navigate images.",
                                  "一覧表示時に左右矢印キー（←/→）でスピードを調節するか、画像選択を移動するかを切り替えます。"
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setArrowKeyMode("SPEED")}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    arrowKeyMode === "SPEED"
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{t("SPEED ADJUST", "速度調整 (←/→)")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">←で減速 / →で加速 (+50px/s)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setArrowKeyMode("NAVIGATE")}
                                  className={cn(
                                    "flex flex-col items-center justify-center p-2 border transition-all text-center rounded-xs cursor-pointer gap-0.5",
                                    arrowKeyMode === "NAVIGATE"
                                      ? "border-accent bg-accent/15 text-text-primary font-bold ring-1 ring-accent"
                                      : "border-panel-border hover:border-text-muted text-text-secondary hover:text-text-primary bg-panel-bg"
                                  )}
                                >
                                  <div className="flex items-center gap-1">
                                    <span>{t("IMAGE SELECT", "画像選択 (←/→)")}</span>
                                  </div>
                                  <span className="text-[9px] text-text-muted">←前画像 / →次画像</span>
                                </button>
                              </div>
                            </div>

                            {/* 6. AUTO SCROLL SHORTCUT HINT */}
                            <div className="flex flex-col gap-1 p-2 bg-panel-bg border border-panel-border rounded-xs">
                              <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider font-bold">
                                {t("AUTO SCROLL NOTES", "自動スクロールの操作補足")}
                              </span>
                              <div className="text-[9px] text-text-secondary leading-normal flex flex-col gap-0.5">
                                <span>• 一覧を掴んで上下にドラッグ（滑らす）で滑らかに無段階加速</span>
                                <span>• 右下のジョグパッドのドラッグやホイールでも微調整可能</span>
                                <span>• 動作中に画面や画像をクリックすると即座に安全停止（画像は開きません）</span>
                                <span>• Spaceキーで開始/一時停止、Shiftキーをポンと押すと左右キーモード切替（速度調整 ↔ 画像選択）</span>
                              </div>
                            </div>

                            {/* 5. OFFLINE & PWA CACHE STATUS */}
                            <div className="flex flex-col gap-1.5 p-2 bg-panel-bg border border-panel-border rounded-xs">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold">
                                <div className="flex items-center gap-1.5">
                                  {isOnline ? (
                                    <Wifi size={12} className="text-emerald-400" />
                                  ) : (
                                    <WifiOff size={12} className="text-amber-400 animate-pulse" />
                                  )}
                                  <span>{t("OFFLINE / PWA CACHE", "オフライン対応・キャッシュ")}</span>
                                </div>
                                <span className={cn(
                                  "text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-2xs border",
                                  isOnline
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                )}>
                                  {isOnline ? t("ONLINE", "オンライン") : t("OFFLINE MODE", "オフライン動作中")}
                                </span>
                              </div>
                              <div className="text-[9px] text-text-secondary leading-normal flex flex-col gap-0.5">
                                <span>• 全画像データは端末内部（IndexedDB）に完全保存されています</span>
                                <span>• アプリプログラム（Service Worker）もキャッシュされ、ネット非接続でも起動可能です</span>
                              </div>
                              {deferredInstallPrompt && (
                                <button
                                  type="button"
                                  onClick={handleInstallPWA}
                                  className="mt-1 w-full py-1 bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-xs"
                                >
                                  <Download size={12} />
                                  <span>{t("INSTALL AS DESKTOP APP", "アプリとして端末にインストール")}</span>
                                </button>
                              )}
                            </div>

                            {/* 6. RESET GENERAL SETTINGS */}
                            <div className="pt-1.5 border-t border-panel-border flex items-center justify-between">
                              <span className="text-[10px] text-text-muted font-mono">{t("GENERAL SETTINGS", "一般設定の初期化")}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setWheelSensitivity(1.0);
                                  setWheelInvert(false);
                                  setDragInvert(false);
                                  setKbdStopMode("REVERSE");
                                  setArrowKeyMode("SPEED");
                                }}
                                className="px-2 py-1 border border-panel-border bg-panel-bg hover:border-accent hover:text-accent text-[9px] font-mono transition-colors rounded-xs cursor-pointer"
                              >
                                {t("RESET TO DEFAULT", "標準設定に戻す")}
                              </button>
                            </div>
                          </div>
                        )}

                        {bottomPanelTab === "appearance" && (
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
                                      "flex items-center justify-between p-1.5 border transition-all text-left cursor-pointer",
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
                                  tabIndex={-1}
                                  onChange={(e) => setCoverOpacity(parseInt(e.target.value, 10))}
                                  onMouseUp={(e) => (e.target as HTMLElement).blur()}
                                  onPointerUp={(e) => (e.target as HTMLElement).blur()}
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
                                      "px-1.5 py-0.5 border transition-all text-[9px] cursor-pointer",
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
                                      "px-2 py-0.5 border text-[9px] font-mono transition-all cursor-pointer",
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
                                      "px-2 py-0.5 border text-[9px] font-mono transition-all cursor-pointer",
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

                            {/* 3. SIDEBAR FONT SIZE */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between font-mono text-[10px] text-text-muted tracking-wider uppercase font-bold border-b border-panel-border pb-1">
                                <div className="flex items-center gap-1.5">
                                  <Sliders size={12} className="text-accent" />
                                  <span>{t("SIDEBAR FONT SIZE", "サイドバー文字サイズ")}</span>
                                </div>
                                <span className="text-[9px] text-accent font-mono uppercase font-bold">{sidebarFontSize}</span>
                              </div>

                              <div className="flex items-center gap-1">
                                {[
                                  { id: "xs", label: "XS (10px)" },
                                  { id: "sm", label: "SM (11px/標準)" },
                                  { id: "base", label: "MD (12px)" },
                                  { id: "lg", label: "LG (14px)" },
                                  { id: "xl", label: "XL (16px)" },
                                ].map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setSidebarFontSize(f.id as any)}
                                    className={cn(
                                      "flex-1 py-1 border text-[9px] font-mono transition-all text-center rounded-xs cursor-pointer",
                                      sidebarFontSize === f.id
                                        ? "border-accent bg-accent/20 text-accent font-bold shadow-xs"
                                        : "border-panel-border text-text-muted hover:text-text-primary bg-panel-bg"
                                    )}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* 4. FOLDER ICON COLOR */}
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
                                    "px-1.5 py-0.5 text-[9px] border transition-colors cursor-pointer",
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

                            {/* 5. MAIN SCREEN BG COLOR OVERRIDE */}
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
                                    "px-1.5 py-0.5 text-[9px] border transition-colors cursor-pointer",
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
                                      "flex items-center justify-between p-1.5 border transition-all text-left cursor-pointer",
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

                        {bottomPanelTab === "stock" && (
                          <div className="flex flex-col gap-2.5 h-full w-full min-w-0 text-[11px]">
                            {/* ACTION BAR: CREATE, VIEW MODE (LIST/TILE), CLEAR */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={handleCreateQuickStock}
                                className="flex-1 py-1.5 px-2 bg-panel-bg hover:bg-white/5 text-text-primary border border-panel-border hover:border-accent font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 rounded-xs transition-all shadow-xs cursor-pointer"
                                title={t("Save current view and scroll position to Quick Stock", "現在の画面表示とスクロール位置をストックに保存")}
                              >
                                <Zap size={12} className="text-text-secondary" />
                                <span>{t("+ STORE POSITION", "+ 位置をストック")}</span>
                              </button>

                              {/* LIST / TILE MODE TOGGLE */}
                              <div className="flex items-center border border-panel-border rounded-xs overflow-hidden bg-panel-bg shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setStockDisplayMode("list")}
                                  className={cn(
                                    "px-2 py-1 flex items-center gap-1 text-[9px] font-mono transition-colors cursor-pointer",
                                    stockDisplayMode === "list"
                                      ? "bg-accent text-accent-text font-bold"
                                      : "text-text-muted hover:text-text-primary hover:bg-white/5"
                                  )}
                                  title={t("List view", "リスト表示")}
                                >
                                  <List size={11} />
                                  <span>LIST</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStockDisplayMode("tile")}
                                  className={cn(
                                    "px-2 py-1 flex items-center gap-1 text-[9px] font-mono transition-colors cursor-pointer",
                                    stockDisplayMode === "tile"
                                      ? "bg-accent text-accent-text font-bold"
                                      : "text-text-muted hover:text-text-primary hover:bg-white/5"
                                  )}
                                  title={t("Tile view (Compact squares)", "タイル表示（四角いストックマーク）")}
                                >
                                  <LayoutGrid size={11} />
                                  <span>TILE</span>
                                </button>
                              </div>

                              {quickStocks.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleClearAllQuickStocks}
                                  className="px-2 py-1 text-text-muted hover:text-red-400 border border-panel-border hover:border-red-400/40 text-[9px] font-mono transition-all rounded-xs cursor-pointer shrink-0"
                                  title={t("Clear all quick stocks", "全ストックを削除")}
                                >
                                  {t("CLEAR", "全消去")}
                                </button>
                              )}
                            </div>

                            {/* STOCKS CONTAINER (LIST OR TILE) */}
                            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
                              {quickStocks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted font-mono text-[10px] gap-2 border border-dashed border-panel-border/60 rounded p-4">
                                  <Zap size={20} className="text-text-muted/40" />
                                  <span>{t("NO STOCKS SAVED", "ストックがありません")}</span>
                                  <span className="text-[9px] text-text-muted/80 leading-relaxed">
                                    {t("Save scroll positions at mid or bottom and jump back anytime.", "閲覧中の中段・下段の位置を何件でも記録し、いつでもワンクリックで再現できます。")}
                                  </span>
                                </div>
                              ) : stockDisplayMode === "tile" ? (
                                /* TILE VIEW: COMPACT SQUARE PINS GRID */
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 p-1">
                                  {quickStocks.map((stk, idx) => {
                                    const pct = Math.round(stk.scrollRatio * 100);
                                    const isActive = activeStockId === stk.id;
                                    return (
                                      <button
                                        key={stk.id}
                                        type="button"
                                        onClick={() => handleRestoreQuickStock(stk)}
                                        className={cn(
                                          "group relative aspect-square flex flex-col items-center justify-center rounded-[3px] border-2 transition-all cursor-pointer select-none shadow-xs",
                                          isActive
                                            ? "border-accent bg-accent/15 ring-2 ring-accent/30 shadow-md"
                                            : "border-panel-border bg-panel-bg hover:border-accent hover:bg-white/5 hover:shadow-md"
                                        )}
                                        title={`#${idx + 1} ${stk.name}\n${stk.datasetName || stk.categoryName || "ALL"} • ${pct}% (${new Date(stk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                                      >
                                        {/* PIN MARK ICON */}
                                        <Pin
                                          size={18}
                                          className={cn(
                                            "transition-transform duration-150 group-hover:scale-115",
                                            isActive
                                              ? "text-accent fill-accent"
                                              : "text-text-primary fill-current opacity-90"
                                          )}
                                        />

                                        {/* TOP-LEFT INDEX */}
                                        <span className="absolute top-1 left-1.5 text-[8px] font-mono text-text-muted font-bold leading-none">
                                          #{idx + 1}
                                        </span>

                                        {/* BOTTOM-RIGHT PERCENT / POS */}
                                        <span className="absolute bottom-1 right-1 text-[8px] font-mono px-1 py-0.2 rounded font-bold leading-none bg-root-bg/90 text-text-secondary border border-panel-border/60">
                                          {pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`}
                                        </span>

                                        {/* HOVER DELETE BUTTON */}
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteQuickStock(stk.id);
                                          }}
                                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-xs z-10 cursor-pointer"
                                          title={t("Delete stock", "ストックを削除")}
                                        >
                                          <X size={9} />
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                /* LIST VIEW */
                                <div className="flex flex-col gap-1.5">
                                  {quickStocks.map((stk, idx) => {
                                  const isEditing = editingStockId === stk.id;
                                  const pct = Math.round(stk.scrollRatio * 100);
                                  return (
                                    <div
                                      key={stk.id}
                                      className="group flex flex-col gap-1 p-2 bg-panel-bg/90 hover:bg-panel-bg border border-panel-border hover:border-accent rounded-xs transition-all text-[10px] select-none"
                                    >
                                      {/* TOP: NAME & POSITION BADGE */}
                                      <div className="flex items-center justify-between gap-1.5">
                                        {isEditing ? (
                                          <input
                                            type="text"
                                            autoFocus
                                            value={editingStockName}
                                            onChange={(e) => setEditingStockName(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                handleRenameQuickStock(stk.id, editingStockName);
                                                setEditingStockId(null);
                                              } else if (e.key === "Escape") {
                                                setEditingStockId(null);
                                              }
                                            }}
                                            onBlur={() => {
                                              handleRenameQuickStock(stk.id, editingStockName);
                                              setEditingStockId(null);
                                            }}
                                            className="flex-1 bg-black/40 border border-accent px-1 py-0.5 text-text-primary text-[10px] rounded outline-none font-mono"
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleRestoreQuickStock(stk)}
                                            className="flex-1 text-left font-mono font-bold text-text-primary hover:text-accent truncate cursor-pointer transition-colors"
                                            title={t("Click to jump to this position", "クリックしてこの位置へジャンプ")}
                                          >
                                            {stk.name}
                                          </button>
                                        )}
                                        <span
                                          className={cn(
                                            "shrink-0 font-mono text-[9px] px-1.5 py-0.2 rounded font-bold uppercase",
                                            pct <= 5
                                              ? "bg-panel-border/50 text-text-secondary border border-panel-border"
                                              : pct >= 95
                                              ? "bg-panel-border/50 text-text-secondary border border-panel-border"
                                              : "bg-panel-border/40 text-text-secondary border border-panel-border"
                                          )}
                                        >
                                          {pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`}
                                        </span>
                                      </div>

                                      {/* BOTTOM: META INFO & ACTIONS */}
                                      <div className="flex items-center justify-between text-text-muted text-[9px] font-mono pt-0.5">
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="truncate">{stk.datasetName || stk.categoryName || "ALL"}</span>
                                          <span className="opacity-40">•</span>
                                          <span className="uppercase">{stk.viewMode.replace("grid-", "")}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {/* MOVE UP */}
                                          <button
                                            type="button"
                                            onClick={(e) => handleMoveQuickStock(stk.id, "up", e)}
                                            disabled={idx === 0}
                                            className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors"
                                            title={t("Move up in list", "上へ並び替え")}
                                          >
                                            <ArrowUp size={10} />
                                          </button>
                                          {/* MOVE DOWN */}
                                          <button
                                            type="button"
                                            onClick={(e) => handleMoveQuickStock(stk.id, "down", e)}
                                            disabled={idx === quickStocks.length - 1}
                                            className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors"
                                            title={t("Move down in list", "下へ並び替え")}
                                          >
                                            <ArrowDown size={10} />
                                          </button>
                                          {/* OVERWRITE / UPDATE */}
                                          <button
                                            type="button"
                                            onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                                            className="p-1 text-text-muted hover:text-accent transition-colors"
                                            title={t("Overwrite with current scroll position", "現在の位置で上書き更新")}
                                          >
                                            <RefreshCw size={10} />
                                          </button>
                                          {/* EDIT NAME */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingStockId(stk.id);
                                              setEditingStockName(stk.name);
                                            }}
                                            className="p-1 hover:text-text-primary transition-colors"
                                            title={t("Rename stock", "名前を変更")}
                                          >
                                            <Edit2 size={10} />
                                          </button>
                                          {/* DELETE */}
                                          <button
                                            type="button"
                                            onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                                            className="p-1 hover:text-red-400 transition-colors"
                                            title={t("Delete stock", "削除")}
                                          >
                                            <X size={10} />
                                          </button>
                                          {/* JUMP BUTTON */}
                                          <button
                                            type="button"
                                            onClick={() => handleRestoreQuickStock(stk)}
                                            className="px-1.5 py-0.5 bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent/40 rounded-xs font-bold text-[9px] transition-colors ml-0.5"
                                            title={t("Restore this view and jump to scroll position", "この位置へ復元ジャンプ")}
                                          >
                                            JUMP
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                </div>
                              )}
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
                    {favoriteDatasetId && selectedImageIds.size > 0 && (
                      activeDatasetId === favoriteDatasetId ? (
                        <button
                          onClick={handleRemoveSelectedFromFavorite}
                          className="text-[10px] uppercase font-mono tracking-wider transition-colors text-red-400 hover:text-red-300 px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 rounded mr-1 flex items-center gap-1"
                          title={t("REMOVE FROM FAVORITES", "お気に入りから解除")}
                        >
                          <Star size={12} fill="none" /> REMOVE FROM FAV
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCopySelected(favoriteDatasetId)}
                          className="text-[10px] uppercase font-mono tracking-wider transition-colors text-yellow-500 hover:text-yellow-400 px-2 py-0.5 bg-yellow-500/10 hover:bg-yellow-500/20 rounded mr-1 flex items-center gap-1"
                          title={t("COPY TO FAVORITE", "お気に入りにコピー")}
                        >
                          <Star size={12} fill="currentColor" /> COPY TO FAV
                        </button>
                      )
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
                            } else if (f === "custom") {
                              setSortField("custom");
                              setSortOrders((prev) => ({ ...prev, custom: "asc" }));
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
                            {f !== "random" && f !== "custom" && (
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
            contentClassName="p-0 overflow-hidden flex flex-col flex-1 relative"
          >
            {/* Top Fixed Opaque Breadcrumb Bar for ALL Views (Folder Explorer, Category Images, and Dataset) */}
            {(() => {
              const isExplorer = activeDatasetId === null && !isCategoryImagesView;
              const currentDataset = activeDatasetId ? datasets.find((d) => d.id === activeDatasetId) : null;
              const currentCatId = isCategoryImagesView ? activeCategoryId : (currentDataset?.categoryId || activeCategoryId || null);
              const breadcrumbs = getCategoryBreadcrumbs(currentCatId);
              const currentDepth = breadcrumbs.length;
              const canCreateSubcategory = true; // Unlimited folder nesting

              return (
                <div className="w-full bg-panel-bg border-b border-panel-border px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0 select-none z-30 shadow-xs">
                  {/* Breadcrumbs matching CategoryExplorer / Dataset view style exactly */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    {/* Root Crumb */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDatasetId(null);
                        setActiveCategoryId(null);
                        setIsCategoryImagesView(false);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const catId = e.dataTransfer.getData("application/x-category-id");
                        const dsId = e.dataTransfer.getData("application/x-dataset-id");
                        if (catId) handleMoveCategoryParent(catId, null);
                        else if (dsId) handleMoveDatasetToCategory(dsId, null);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded transition-all tracking-wide border cursor-pointer",
                        breadcrumbs.length === 0 && !currentDataset && !isCategoryImagesView
                          ? "bg-accent/15 text-accent font-bold border-accent/40 shadow-xs"
                          : "border-transparent text-text-secondary hover:text-text-primary hover:bg-panel-border/50"
                      )}
                      title={t("Return to All Image Data (Root)", "ルート一覧に戻る")}
                    >
                      <Folders size={13} className="text-accent -translate-y-[1px]" />
                      <span>ALL IMAGE DATA</span>
                    </button>

                    {/* Category Chain */}
                    {breadcrumbs.map((cat, idx) => {
                      const isCurrentActiveFolder = !currentDataset && !isCategoryImagesView && cat.id === activeCategoryId;
                      return (
                        <React.Fragment key={cat.id}>
                          <ChevronRight size={14} className="text-text-muted" />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDatasetId(null);
                              setActiveCategoryId(cat.id);
                              setIsCategoryImagesView(false);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const catId = e.dataTransfer.getData("application/x-category-id");
                              const dsId = e.dataTransfer.getData("application/x-dataset-id");
                              if (catId && catId !== cat.id) handleMoveCategoryParent(catId, cat.id);
                              else if (dsId) handleMoveDatasetToCategory(dsId, cat.id);
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded transition-all tracking-wide border cursor-pointer",
                              isCurrentActiveFolder
                                ? "bg-accent/15 text-accent font-bold border-accent/40 shadow-xs"
                                : "border-transparent text-text-secondary hover:text-text-primary hover:bg-panel-border/50"
                            )}
                            title={cat.name}
                          >
                            <FolderIconComponent
                              iconType={cat.icon}
                              isOpen={false}
                              size={13}
                              className="shrink-0 -translate-y-[1px]"
                              style={{ color: cat.color || undefined }}
                            />
                            <span>{cat.name}</span>
                          </button>
                        </React.Fragment>
                      );
                    })}

                    {/* Active Dataset Crumb */}
                    {currentDataset && (
                      <>
                        <ChevronRight size={14} className="text-text-muted" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent/15 text-accent font-bold border border-accent/40 shadow-xs">
                          <Layers size={13} className="shrink-0 text-accent -translate-y-[1px]" />
                          <span className="truncate max-w-[220px] sm:max-w-[360px]">{currentDataset.name}</span>
                          <span className="text-[10px] opacity-80 font-normal ml-1 font-mono">
                            ({sortedImages.length} {t("IMAGES", "枚")})
                          </span>
                        </div>
                      </>
                    )}

                    {/* Active Folder All-Images View Crumb */}
                    {isCategoryImagesView && (
                      <>
                        <ChevronRight size={14} className="text-text-muted" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent/15 text-accent font-bold border border-accent/40 shadow-xs">
                          <span className="text-[11px] font-mono">
                            {t("FOLDER ALL IMAGES", "フォルダ内全画像")}: {sortedImages.length} {t("IMAGES", "枚")}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Actions Bar */}
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    {isExplorer ? (
                      <>
                        {canCreateSubcategory && (
                          <button
                            type="button"
                            onClick={() => handleOpenNewCategoryModal(activeCategoryId)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-panel-bg border border-panel-border hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-[2px]"
                            title={t("Create new folder in current location", "この階層に新規フォルダーを作成")}
                          >
                            <FolderPlus size={13} className="text-folder-icon" />
                            <span>+ {t("NEW FOLDER", "新規フォルダー")}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddDatasetClick(activeCategoryId)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-panel-bg border border-panel-border hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-[2px]"
                          title={t("Create new dataset in current location", "この階層に新規データセットを作成")}
                        >
                          <FilePlus size={13} className="text-accent" />
                          <span>+ {t("NEW DATASET", "新規セット")}</span>
                        </button>
                        {activeCategoryId && getCategoryTotalImagesCount(activeCategoryId) > 0 && (
                          <button
                            type="button"
                            onClick={() => loadImagesForCategory(activeCategoryId)}
                            className="flex items-center gap-1 px-3 py-1 bg-accent text-accent-text font-bold hover:bg-accent/90 transition-colors shadow-xs cursor-pointer rounded-[2px]"
                            title={t("View all images across all datasets in this folder", "このフォルダー内の全画像を表示")}
                          >
                            <Eye size={13} />
                            <span>{t("VIEW ALL IMAGES", "全画像を表示")} ({getCategoryTotalImagesCount(activeCategoryId)})</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenNewCategoryModal(currentCatId)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-panel-bg border border-panel-border hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-[2px]"
                          title={t("Create new folder in this location", "この階層に新規フォルダーを作成")}
                        >
                          <FolderPlus size={13} className="text-folder-icon" />
                          <span>+ {t("NEW FOLDER", "新規フォルダー")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDatasetClick(currentCatId)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-panel-bg border border-panel-border hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-[2px]"
                          title={t("Create new dataset in this location", "この階層に新規データセットを作成")}
                        >
                          <FilePlus size={13} className="text-accent" />
                          <span>+ {t("NEW DATASET", "新規セット")}</span>
                        </button>
                        {/* Quick Stock Current Scroll Position */}
                        <button
                          type="button"
                          onClick={handleCreateQuickStock}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-panel-bg border border-panel-border hover:border-accent text-text-secondary hover:text-text-primary transition-colors cursor-pointer rounded-[2px]"
                          title={t("Stock current view and scroll position", "現在の画面表示とスクロール位置をストック保存")}
                        >
                          <Zap size={13} className="text-text-secondary" />
                          <span>{t("STOCK POSITION", "位置をストック")}</span>
                        </button>
                        {/* Back to Explorer Quick Action Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDatasetId(null);
                            setIsCategoryImagesView(false);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-panel-bg border border-panel-border/80 hover:border-accent hover:bg-accent/15 text-text-secondary hover:text-accent text-[11px] font-bold transition-all rounded shrink-0 shadow-2xs cursor-pointer"
                          title={t("Back to Folder Explorer", "フォルダー一覧に戻る")}
                        >
                          <ChevronLeft size={13} />
                          <span>{t("BACK TO EXPLORER", "一覧に戻る")}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            <div
              ref={scatterContainerRef}
              className={cn("w-full flex-1 relative overflow-hidden")}
              onClickCapture={(e) => {
                if (suppressNextClickRef.current) {
                  suppressNextClickRef.current = false;
                  e.stopPropagation();
                  e.preventDefault();
                  return;
                }
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
                  onPointerDown={handleListPointerDown}
                  onPointerMove={handleListPointerMove}
                  onPointerUp={handleListPointerUp}
                  onPointerCancel={handleListPointerCancel}
                  onScroll={handleContainerScroll}
                  onWheel={(e) => {
                    if (viewMode === "free") {
                      e.preventDefault();
                      let delta = e.deltaY;
                      if (wheelInvertRef.current) {
                        delta = -delta;
                      }
                      if (Math.abs(delta) < 1) return;
                      const step = Math.max(5, Math.round(15 * Math.abs(delta) / 100));
                      const change = delta > 0 ? -step : step;
                      setItemScale(Math.min(900, Math.max(40, itemScale + change)));
                      return;
                    }
                    if (autoScrollDirRef.current !== null) {
                      let delta = e.deltaY;
                      if (wheelInvertRef.current) {
                        delta = -delta;
                      }
                      if (Math.abs(delta) < 1) return;
                      const inputDir: "up" | "down" = delta > 0 ? "down" : "up";

                      // 自動スクロール中に対向方向へホイールを回した場合、即座にブレーキ・停止
                      if (autoScrollDirRef.current !== inputDir) {
                        e.preventDefault();
                        setAutoScrollDir(null);
                        wheelBrakeTimestampRef.current = performance.now();
                        wheelBrakeDirRef.current = inputDir;
                        setJogDragState({
                          active: false,
                          deltaY: 0,
                          currentSpeed: 0,
                          dir: null,
                        });
                        triggerWheelHud(null, 0);
                      }
                    }
                  }}
                  onDragStart={(e) => e.preventDefault()}
                  className={cn(
                    "w-full h-full absolute inset-0 p-4 select-none touch-pan-x",
                    (viewMode === "grid-sq" ||
                      viewMode === "grid-ma" ||
                      viewMode === "list") &&
                      "overflow-y-auto overflow-x-hidden pb-8",
                    viewMode === "free" && "overflow-hidden",
                    isListDragging && "cursor-ns-resize",
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
                          categoryPreviewUrls={categoryPreviewUrls}
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
                          onSetCategoryCoverImage={handleSetCategoryAsCover}
                          onSetDatasetCoverImage={handleSetDatasetCoverImageById}
                          onMoveDatasetToCategory={handleMoveDatasetToCategory}
                          onMoveCategoryParent={handleMoveCategoryParent}
                          onReorderDatasets={handleReorderDatasetItems}
                          onReorderCategories={handleReorderCategories}
                          onBatchReorderCategories={handleBatchReorderCategories}
                          onBatchReorderDatasets={handleBatchReorderDatasets}
                          onRequestMoveDatasetModal={handleRequestMoveDatasetModal}
                          onRequestMoveCategoryModal={handleRequestMoveCategoryModal}
                          onRequestColorCategoryModal={(cat) => {
                            setColorCategoryModalTarget(cat);
                            setColorCategoryInput(cat.color || themeFolderColors[theme] || "#fbbf24");
                            setCategoryIconInput(cat.icon || "folder");
                          }}
                          onBulkDeleteItems={handleBulkDeleteItems}
                          onBulkMoveItems={handleBulkMoveItems}
                          onBulkRenameItems={handleBulkRenameItems}
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
                      handle: ".image-sort-handle",
                    } : {};

                    return (
                      <>
                        {/* SCATTER Mode Status Badge (サイドバーへ設定を集約したためシンプルな表示に統一) */}
                        {viewMode === "free" && (
                          <div className="absolute top-3 right-4 z-40 flex items-center gap-2 pointer-events-auto">
                            <div className="bg-panel-bg/90 backdrop-blur-md border border-panel-border shadow-md rounded-full px-3 py-1 flex items-center gap-2 font-mono text-[10px] text-text-primary select-none opacity-80 hover:opacity-100 transition-opacity">
                              <ScatterChart size={12} className="text-accent shrink-0" />
                              <span className="shrink-0">
                                SCATTER: <strong className="text-accent font-bold text-xs">{scatterImages.length}</strong> / {sortedImages.length} {t("IMAGES", "枚")}
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
                                  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${itemScale}px), ${itemScale}px))`,
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
                                              ...(viewMode === "grid-sq" ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${itemScale}px), ${itemScale}px))`, gap: `${gridGap}px` } : {}),
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

                            const renderList = viewMode === "free" ? scatterImages : sortedImages;
                            return renderList.map((img, i) => {
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
                <div data-scroll-controls="true" className="absolute bottom-6 right-8 z-[60] flex flex-col items-end gap-1.5 select-none">
                  {/* Floating Drag / Wheel HUD (Appears during drag or wheel) */}
                  {(jogDragState.active || wheelHudVisible) && (
                    <div
                      className={cn(
                        "absolute right-full mr-3 bottom-0 whitespace-nowrap backdrop-blur-md px-3 py-1.5 shadow-2xl flex flex-col items-end pointer-events-none animate-in fade-in zoom-in-95 duration-100",
                        isLightTheme
                          ? "bg-white/95 text-gray-900 border border-gray-300 shadow-xl"
                          : "bg-black/90 text-white border border-gray-600/80"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-mono text-[12px] font-bold tracking-tight tabular-nums">
                        {(jogDragState.active ? jogDragState.dir : autoScrollDir) === "up" ? (
                          <span className={cn("flex items-center gap-0.5", isLightTheme ? "text-amber-600" : "text-amber-400")}>
                            <ChevronUp size={13} className="stroke-[3]" />
                            UP
                          </span>
                        ) : (jogDragState.active ? jogDragState.dir : autoScrollDir) === "down" ? (
                          <span className={cn("flex items-center gap-0.5", isLightTheme ? "text-sky-600" : "text-sky-400")}>
                            <ChevronDown size={13} className="stroke-[3]" />
                            DOWN
                          </span>
                        ) : (
                          <span className={isLightTheme ? "text-gray-500" : "text-gray-300"}>STOPPED</span>
                        )}
                        <span className={isLightTheme ? "text-gray-900" : "text-white"}>
                          {jogDragState.active ? jogDragState.currentSpeed : autoScrollPxPerSec}{" "}
                          <span className={cn("text-[10px]", isLightTheme ? "text-gray-500" : "text-gray-400")}>px/s</span>
                        </span>
                        <span className={cn("text-[11px] font-mono", isLightTheme ? "text-amber-700" : "text-amber-300")}>
                          ({((jogDragState.active ? jogDragState.currentSpeed : autoScrollPxPerSec) / 250).toFixed(1)}x)
                        </span>
                      </div>
                      <div className={cn("text-[9px] font-mono tracking-wider mt-0.5", isLightTheme ? "text-gray-500" : "text-gray-400")}>
                        WHEEL: SPEED • DRAG: SPEED • CLICK: STOP
                      </div>
                    </div>
                  )}

                  {/* Vertical Scroll Nav Bar & Jog Shuttle */}
                  <div
                    onWheel={handleJogWheel}
                    className={cn(
                      "flex flex-col items-center backdrop-blur-md shadow-md w-11 rounded-none overflow-hidden transition-colors",
                      isLightTheme
                        ? "bg-white/95 border border-gray-300 text-gray-700"
                        : "bg-[#18181b]/95 border border-gray-700/80 text-gray-300"
                    )}
                  >
                    {/* Scroll To Top */}
                    <button
                      type="button"
                      onClick={() => {
                        setAutoScrollDir(null);
                        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={cn(
                        "w-full h-7 flex items-center justify-center transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        isLightTheme
                          ? "text-gray-600 hover:text-black hover:bg-gray-100"
                          : "text-gray-300 hover:text-white hover:bg-gray-800"
                      )}
                      title="SCROLL TO TOP (一番上へジャンプ)"
                    >
                      <ChevronsUp size={14} />
                    </button>

                    {/* Standard Auto Scroll UP Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setAutoScrollDir((d) => (d === "up" ? null : "up"))}
                      className={cn(
                        "w-full h-7 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        isLightTheme ? "border-t border-gray-200" : "border-t border-gray-700/60",
                        autoScrollDir === "up"
                          ? (isLightTheme ? "bg-amber-500/20 text-amber-700 font-bold" : "bg-amber-500/20 text-amber-400 font-bold")
                          : (isLightTheme ? "text-gray-600 hover:text-black hover:bg-gray-100" : "text-gray-300 hover:text-white hover:bg-gray-800")
                      )}
                      title="AUTO SCROLL UP (上へ自動スクロール開始/停止)"
                    >
                      <ChevronUp size={14} />
                    </button>

                    {/* JOG & SHUTTLE CONTROLLER PAD (Lengthened to h-36) */}
                    <div
                      onPointerDown={handleJogPointerDown}
                      onPointerMove={handleJogPointerMove}
                      onPointerUp={handleJogPointerUp}
                      onPointerCancel={handleJogPointerCancel}
                      onWheel={handleJogWheel}
                      className={cn(
                        "w-full h-36 relative flex flex-col items-center justify-between py-2 cursor-ns-resize select-none transition-colors touch-none",
                        isLightTheme ? "border-y border-gray-200" : "border-y border-gray-700/70",
                        jogDragState.active || wheelHudVisible
                          ? (isLightTheme ? "bg-gray-100" : "bg-gray-800/90")
                          : autoScrollDir !== null
                          ? "bg-amber-500/15"
                          : (isLightTheme ? "bg-white hover:bg-gray-50" : "hover:bg-gray-800/50")
                      )}
                      title="ホイール回転 / 上下ドラッグ: 向き＆速度を無段階調整 / クリック: 停止"
                    >
                      {/* Active Tension Bar during Drag */}
                      {jogDragState.active && (
                        <div
                          className={cn(
                            "absolute left-0 right-0 pointer-events-none transition-all",
                            jogDragState.dir === "up" ? "bottom-1/2 bg-amber-500/30" : "top-1/2 bg-sky-500/30"
                          )}
                          style={{
                            height: `${Math.min(64, Math.abs(jogDragState.deltaY) * 0.4)}px`,
                          }}
                        />
                      )}

                      {/* UP Direction Indicator */}
                      <div
                        className={cn(
                          "flex flex-col items-center transition-colors pointer-events-none",
                          autoScrollDir === "up" || jogDragState.dir === "up"
                            ? (isLightTheme ? "text-amber-600 font-bold" : "text-amber-500 font-bold")
                            : (isLightTheme ? "text-gray-400" : "text-gray-500")
                        )}
                      >
                        <ChevronUp
                          size={13}
                          className={cn(
                            "stroke-[2.5]",
                            autoScrollDir === "up" && "animate-pulse"
                          )}
                        />
                      </div>

                      {/* Center Knurled Grip & State Badge */}
                      <div className="flex flex-col items-center justify-center gap-0.5 pointer-events-none z-10">
                        <div className="flex items-center gap-0.5">
                          <div className={cn("w-1 h-3.5", isLightTheme ? "bg-gray-400" : "bg-gray-500")} />
                          <div className={cn("w-1 h-3.5", isLightTheme ? "bg-gray-400" : "bg-gray-500")} />
                          <div className={cn("w-1 h-3.5", isLightTheme ? "bg-gray-400" : "bg-gray-500")} />
                        </div>
                        <span className={cn(
                          "font-mono text-[8px] font-bold tracking-tighter uppercase mt-0.5",
                          isLightTheme ? "text-gray-600" : "text-gray-400"
                        )}>
                          {jogDragState.active
                            ? "DRAG"
                            : autoScrollDir !== null
                            ? "STOP"
                            : "JOG"}
                        </span>
                      </div>

                      {/* DOWN Direction Indicator */}
                      <div
                        className={cn(
                          "flex flex-col items-center transition-colors pointer-events-none",
                          autoScrollDir === "down" || jogDragState.dir === "down"
                            ? (isLightTheme ? "text-sky-600 font-bold" : "text-sky-500 font-bold")
                            : (isLightTheme ? "text-gray-400" : "text-gray-500")
                        )}
                      >
                        <ChevronDown
                          size={13}
                          className={cn(
                            "stroke-[2.5]",
                            autoScrollDir === "down" && "animate-pulse"
                          )}
                        />
                      </div>
                    </div>

                    {/* Standard Auto Scroll DOWN Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setAutoScrollDir((d) => (d === "down" ? null : "down"))}
                      className={cn(
                        "w-full h-7 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        isLightTheme ? "border-b border-gray-200" : "border-b border-gray-700/60",
                        autoScrollDir === "down"
                          ? (isLightTheme ? "bg-sky-500/20 text-sky-700 font-bold" : "bg-sky-500/20 text-sky-400 font-bold")
                          : (isLightTheme ? "text-gray-600 hover:text-black hover:bg-gray-100" : "text-gray-300 hover:text-white hover:bg-gray-800")
                      )}
                      title="AUTO SCROLL DOWN (下へ自動スクロール開始/停止)"
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
                      className={cn(
                        "w-full h-7 flex items-center justify-center transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        isLightTheme
                          ? "text-gray-600 hover:text-black hover:bg-gray-100"
                          : "text-gray-300 hover:text-white hover:bg-gray-800"
                      )}
                      title="SCROLL TO BOTTOM (一番下へジャンプ)"
                    >
                      <ChevronsDown size={14} />
                    </button>
                  </div>

                  {/* Horizontal Speed Control Bar (Bottom) */}
                  <div
                    onWheel={handleJogWheel}
                    className={cn(
                      "flex items-center backdrop-blur-md shadow-md h-7 px-1 rounded-none transition-colors",
                      isLightTheme
                        ? "bg-white/95 border border-gray-300 text-gray-800 shadow-sm"
                        : "bg-[#18181b]/95 border border-gray-700/80 text-gray-200"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setPresetSpeed(autoScrollSpeed - 1)}
                      disabled={autoScrollSpeed <= 1 && autoScrollPxPerSec <= 100}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[12px] font-bold transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        autoScrollSpeed <= 1 && autoScrollPxPerSec <= 100
                          ? "opacity-30 cursor-not-allowed text-gray-400"
                          : isLightTheme
                          ? "hover:bg-gray-100 text-gray-700 cursor-pointer"
                          : "hover:bg-gray-700 text-gray-200 cursor-pointer"
                      )}
                      title="SPEED DOWN (-)"
                    >
                      <Minus size={11} />
                    </button>

                    <span
                      className={cn(
                        "font-mono font-bold text-[10px] tabular-nums px-1 pointer-events-none min-w-[34px] text-center select-none",
                        isLightTheme ? "text-gray-800" : "text-gray-200"
                      )}
                      title={`${autoScrollPxPerSec} px/s`}
                    >
                      {(autoScrollPxPerSec / 250).toFixed(1)}x
                    </span>

                    <button
                      type="button"
                      onClick={() => setPresetSpeed(autoScrollSpeed + 1)}
                      disabled={autoScrollSpeed >= 4 && autoScrollPxPerSec >= 1000}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center text-[12px] font-bold transition-colors outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                        autoScrollSpeed >= 4 && autoScrollPxPerSec >= 1000
                          ? "opacity-30 cursor-not-allowed text-gray-400"
                          : isLightTheme
                          ? "hover:bg-gray-100 text-gray-700 cursor-pointer"
                          : "hover:bg-gray-700 text-gray-200 cursor-pointer"
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
        {(Boolean(loadingMessage) || isReadingDirectory) && (
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
                    wasContinuouslyRotatedRef.current = false;
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
                  THEME
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasBg("auto");
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded transition-all",
                    canvasBg === "auto"
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
                  onPointerDown={startHoldRotate}
                  onPointerUp={stopHoldRotate}
                  onPointerLeave={stopHoldRotate}
                  onPointerCancel={stopHoldRotate}
                  className="p-1.5 hover:bg-white/20 rounded transition-colors touch-none cursor-pointer"
                  title={t("Rotate (Click: +45° / Press & Hold: Continuous)", "回転 (クリック: 45°回転 / 長押し: 滑らか自由回転)")}
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
              {/* Fullscreen Top Right Toolbar Group (Flex container to avoid overlapping buttons) */}
              <div className="absolute top-6 right-6 z-50 flex items-center gap-2.5 pointer-events-auto">
                {/* Jump to Original Location Button in Fullscreen */}
                {selectedImage && (activeDatasetId === favoriteDatasetId || isCurrentFavorited || Boolean((selectedImage as any).originalDatasetId)) && (
                  <button
                    onClick={(e) => handleJumpToOriginalLocation(selectedImage, e)}
                    className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-105 outline-none focus:outline-none backdrop-blur-md border shadow-md cursor-pointer",
                      isFullscreenDarkText
                        ? "bg-white/20 border-black/15 text-black hover:bg-white/40"
                        : "bg-black/30 border-white/20 text-white hover:bg-black/50"
                    )}
                    title={t("Jump to original dataset/folder location", "この画像が本来入っている元のフォルダー（データセット）の場所へジャンプ")}
                  >
                    <RotateCcw size={22} strokeWidth={1.8} />
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
                      "w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm cursor-pointer",
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

                {/* Favorite Star Button in Fullscreen */}
                {favoriteDatasetId && selectedImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavoriteImage(selectedImage);
                    }}
                    className={cn(
                      "w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-105 outline-none focus:outline-none backdrop-blur-sm border shadow-sm cursor-pointer",
                      isFullscreenDarkText
                        ? "bg-white/20 border-black/15 text-black/70 hover:text-black hover:bg-white/40"
                        : "bg-black/20 border-white/15 text-white/70 hover:text-white hover:bg-black/40",
                      isCurrentFavorited && (
                        isFullscreenDarkText
                          ? "bg-black/10 text-black border-black/30 font-bold"
                          : "bg-white/20 text-white border-white/40 font-bold"
                      )
                    )}
                    title={isCurrentFavorited ? t("REMOVE FROM FAVORITES", "お気に入りから解除") : t("ADD TO FAVORITES", "お気に入りに追加")}
                  >
                    <Star 
                      size={22} 
                      strokeWidth={1.5}
                      className={isCurrentFavorited ? (isFullscreenDarkText ? "text-black fill-none" : "text-white fill-none") : "text-inherit fill-none"} 
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
                    "w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
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
                    "w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
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
                    "w-12 h-12 flex items-center justify-center rounded-full transition-all hover:scale-110 outline-none focus:outline-none backdrop-blur-sm border shadow-sm",
                    isFullscreenDarkText
                      ? "bg-white/20 border-black/10 text-black/70 hover:text-black hover:bg-white/40"
                      : "bg-black/20 border-white/10 text-white/70 hover:text-white hover:bg-black/40"
                  )}
                  title={t("Close (Esc)", "閉じる (Esc)")}
                >
                  <X size={26} />
                </button>
              </div>

              {/* Status indicator when in favorite dataset but image was unstarred */}
              {activeDatasetId === favoriteDatasetId && !isCurrentFavorited && (
                <div className="absolute top-20 right-6 font-mono text-[11px] px-3 py-1 rounded bg-black/70 text-white border border-white/20 shadow backdrop-blur-sm pointer-events-none animate-fade-in flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span>{t("Removed from Fav (kept in view)", "お気に入り解除済み（表示維持中）")}</span>
                </div>
              )}
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
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[440px] shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text-primary uppercase flex items-center gap-2 font-bold text-sm">
                  <Layers size={18} className="text-accent" />
                  {editingDatasetId ? t("RENAME DATASET", "データセット名の変更") : t("NEW DATASET", "新規データセットの作成")}
                </h2>
                {!editingDatasetId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewDatasetModal(false);
                      handleOpenNewCategoryModal(targetCategoryIdForNewDataset);
                    }}
                    className="text-[10px] text-folder-icon hover:underline flex items-center gap-1 cursor-pointer"
                    title={t("Switch to Create Folder", "フォルダー作成に切り替え")}
                  >
                    <FolderPlus size={12} />
                    <span>{t("CREATE FOLDER INSTEAD", "フォルダー作成はこちら")}</span>
                  </button>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                    {t("DATASET NAME", "データセット名")}
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={datasetNameInput}
                    onChange={(e) => setDatasetNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitDatasetForm()}
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                    placeholder={t("ENTER DATASET NAME...", "データセット名を入力...")}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                    {t("FOLDER LOCATION", "作成先（所属フォルダー）の選択")}
                  </label>
                  <select
                    value={targetCategoryIdForNewDataset || ""}
                    onChange={(e) => setTargetCategoryIdForNewDataset(e.target.value || null)}
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">📁 {t("ALL IMAGE DATA (ROOT LEVEL)", "ALL IMAGE DATA (ルート / トップ階層)")}</option>
                    {(() => {
                      const renderCategoryOptions = (parentId: string | null = null, depth: number = 0): React.ReactNode => {
                        const subCats = categories.filter((c) => (c.parentId || null) === parentId);
                        return subCats.map((cat) => (
                          <React.Fragment key={cat.id}>
                            <option value={cat.id}>
                              {depth === 0 ? "📁 " : `${"  ".repeat(depth)}└─ 📁 `}{cat.name}
                            </option>
                            {renderCategoryOptions(cat.id, depth + 1)}
                          </React.Fragment>
                        ));
                      };

                      return renderCategoryOptions(null, 0);
                    })()}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowNewDatasetModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  {t("CANCEL", "キャンセル")}
                </SolidButton>
                <SolidButton
                  onClick={submitDatasetForm}
                  className="text-accent hover:text-accent"
                >
                  {t("CONFIRM", "確定")}
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
            <div className="bg-panel-bg border border-panel-border p-6 font-mono w-[440px] shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text-primary uppercase flex items-center gap-2 font-bold text-sm">
                  <Folder size={18} className="text-folder-icon" />
                  {editingCategoryId ? t("RENAME CATEGORY", "フォルダー名の変更") : t("NEW CATEGORY", "新規フォルダーの作成")}
                </h2>
                {!editingCategoryId && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategoryModal(false);
                      handleAddDatasetClick(newCategoryParentId);
                    }}
                    className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    title={t("Switch to Create Dataset", "データセット作成に切り替え")}
                  >
                    <FilePlus size={12} />
                    <span>{t("CREATE DATASET INSTEAD", "セット作成はこちら")}</span>
                  </button>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                    {t("FOLDER NAME", "フォルダー名")}
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={categoryNameInput}
                    onChange={(e) => setCategoryNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitCategoryForm()}
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent"
                    placeholder={t("ENTER CATEGORY NAME...", "フォルダー名を入力...")}
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-text-muted mb-1 font-bold uppercase">
                    {t("LOCATION / PARENT FOLDER", "作成先（親フォルダー）の選択")}
                  </label>
                  <select
                    value={newCategoryParentId || ""}
                    onChange={(e) => setNewCategoryParentId(e.target.value || null)}
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 text-xs font-mono outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">📁 {t("ALL IMAGE DATA (ROOT LEVEL)", "ALL IMAGE DATA (ルート / トップ階層)")}</option>
                    {(() => {
                      const isDescendant = (catId: string, potentialChildId: string): boolean => {
                        if (catId === potentialChildId) return true;
                        const children = categories.filter((c) => c.parentId === potentialChildId);
                        for (const ch of children) {
                          if (isDescendant(catId, ch.id)) return true;
                        }
                        return false;
                      };

                      const renderCategoryOptions = (parentId: string | null = null, depth: number = 0): React.ReactNode => {
                        const subCats = categories.filter((c) => (c.parentId || null) === parentId);
                        return subCats.map((cat) => {
                          const isSelfOrChild = editingCategoryId && isDescendant(cat.id, editingCategoryId);
                          return (
                            <React.Fragment key={cat.id}>
                              <option value={cat.id} disabled={!!isSelfOrChild}>
                                {depth === 0 ? "📁 " : `${"  ".repeat(depth)}└─ 📁 `}{cat.name}
                              </option>
                              {renderCategoryOptions(cat.id, depth + 1)}
                            </React.Fragment>
                          );
                        });
                      };

                      return renderCategoryOptions(null, 0);
                    })()}
                  </select>
                </div>
              </div>

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
                    <Folders size={14} className="text-accent -translate-y-[1px]" />
                    <span className="font-bold">{t("ALL IMAGE DATA (ROOT / UNCLASSIFIED)", "ALL IMAGE DATA (ルート / 未分類)")}</span>
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

      {/* Category Appearance Modal (Color & Icon) */}
      <AnimatePresence>
        {colorCategoryModalTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
          >
            <div className="bg-panel-bg border border-accent/50 p-6 font-mono w-[460px] max-w-[92vw] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <h2 className="text-accent mb-2 flex items-center gap-2 text-sm uppercase font-bold">
                <Palette size={18} /> {t("SET FOLDER APPEARANCE", "フォルダーの外観設定")}
              </h2>
              <p className="text-text-secondary text-xs mb-4 leading-relaxed">
                {t(
                  `Customize icon variation and color for folder "${colorCategoryModalTarget.name}":`,
                  `フォルダー「${colorCategoryModalTarget.name}」の表示アイコンと個別カラーを設定します：`
                )}
              </p>

              {/* 1. Folder Icon Variation Selector */}
              <div className="mb-5 border-b border-panel-border/60 pb-4">
                <span className="block text-[11px] font-mono text-text-muted mb-2 font-bold uppercase tracking-wider">
                  {t("FOLDER ICON VARIATION", "フォルダーアイコンの種類")}:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {FOLDER_ICON_OPTIONS.map((opt) => {
                    const isSelected = categoryIconInput === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCategoryIconInput(opt.id)}
                        className={cn(
                          "flex items-center gap-2 p-2 border text-xs font-mono transition-all rounded-[2px] cursor-pointer text-left select-none",
                          isSelected
                            ? "bg-accent/20 border-accent text-accent font-bold ring-1 ring-accent"
                            : "bg-root-bg/40 border-panel-border/80 text-text-secondary hover:text-text-primary hover:border-text-muted"
                        )}
                      >
                        <FolderIconComponent
                          iconType={opt.id}
                          size={16}
                          style={{ color: colorCategoryInput || undefined }}
                          className="shrink-0"
                        />
                        <span className="truncate text-[10px]">{language === "JP" ? opt.labelJp : opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Folder Color Selector */}
              <div className="flex flex-col gap-3 mb-6">
                <span className="block text-[11px] font-mono text-text-muted font-bold uppercase tracking-wider">
                  {t("FOLDER ICON COLOR", "アイコンの個別カラー")}:
                </span>
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
                    {t("Clear (Use Theme)", "標準色に戻す")}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-panel-border/60 pt-4">
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
                      await updateCategoryIcon(
                        colorCategoryModalTarget.id,
                        categoryIconInput === "folder" ? null : categoryIconInput
                      );
                      const updatedCats = await getAllCategories();
                      setCategories(updatedCats);
                      setColorCategoryModalTarget(null);
                    }
                  }}
                  className="text-accent hover:text-accent border-accent/50"
                >
                  {t("SAVE SETTINGS", "設定を保存")}
                </SolidButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Stock Drawer / Modal */}
      <AnimatePresence>
        {isQuickStockDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-root-bg/70 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setIsQuickStockDrawerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-panel-bg border border-panel-border w-[520px] max-w-[96vw] max-h-[85vh] flex flex-col font-mono shadow-2xl rounded-xs overflow-hidden"
            >
              {/* DRAWER HEADER */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border/80 bg-root-bg/60 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-xs bg-panel-bg border border-panel-border flex items-center justify-center">
                    <Zap size={13} className="text-text-secondary" />
                  </div>
                  <span className="text-sm font-bold tracking-wider text-text-primary uppercase">
                    {t("QUICK STOCK", "クイックストック")}
                  </span>
                  <span className="text-[10px] bg-panel-border/40 text-text-muted border border-panel-border px-1.5 py-0.2 rounded-full font-bold">
                    {quickStocks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickStockDrawerOpen(false)}
                  className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/5 rounded-xs transition-colors cursor-pointer"
                  title="CLOSE"
                >
                  <X size={15} />
                </button>
              </div>

              {/* ACTION BAR */}
              <div className="p-3 border-b border-panel-border/60 bg-panel-bg flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleCreateQuickStock();
                  }}
                  className="flex-1 py-2 px-3 bg-panel-bg hover:bg-white/5 text-text-primary border border-panel-border hover:border-accent text-xs font-bold flex items-center justify-center gap-2 rounded-xs transition-all shadow-xs cursor-pointer"
                  title={t("Save current view and scroll position to Quick Stock", "現在の画面表示とスクロール位置をストックに保存")}
                >
                  <Zap size={14} className="text-text-secondary" />
                  <span>{t("+ STORE CURRENT SCROLL POSITION", "+ 現在の閲覧位置をストック保存")}</span>
                </button>

                {/* LIST / TILE MODE TOGGLE */}
                <div className="flex items-center border border-panel-border rounded-xs overflow-hidden bg-root-bg shrink-0">
                  <button
                    type="button"
                    onClick={() => setStockDisplayMode("list")}
                    className={cn(
                      "px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-mono transition-colors cursor-pointer",
                      stockDisplayMode === "list"
                        ? "bg-accent text-accent-text font-bold"
                        : "text-text-muted hover:text-text-primary hover:bg-white/5"
                    )}
                    title={t("List view", "リスト表示")}
                  >
                    <List size={12} />
                    <span>LIST</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockDisplayMode("tile")}
                    className={cn(
                      "px-2.5 py-1.5 flex items-center gap-1.5 text-[10px] font-mono transition-colors cursor-pointer",
                      stockDisplayMode === "tile"
                        ? "bg-accent text-accent-text font-bold"
                        : "text-text-muted hover:text-text-primary hover:bg-white/5"
                    )}
                    title={t("Tile view (Compact squares)", "タイル表示（四角いストックマーク）")}
                  >
                    <LayoutGrid size={12} />
                    <span>TILE</span>
                  </button>
                </div>

                {quickStocks.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllQuickStocks}
                    className="px-2.5 py-2 text-text-muted hover:text-red-400 border border-panel-border hover:border-red-400/40 text-[10px] transition-all rounded-xs cursor-pointer"
                    title={t("Clear all quick stocks", "全ストックを削除")}
                  >
                    {t("CLEAR ALL", "全消去")}
                  </button>
                )}
              </div>

              {/* STOCKS LIST CONTAINER */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[160px]">
                {quickStocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted text-xs gap-2.5 border border-dashed border-panel-border/60 rounded p-6 my-auto">
                    <Zap size={28} className="text-text-muted/40" />
                    <span className="font-bold text-text-primary">{t("NO STOCKS SAVED", "ストックが記録されていません")}</span>
                    <span className="text-[11px] text-text-muted/80 max-w-sm leading-relaxed">
                      {t(
                        "Click '+ STORE CURRENT SCROLL POSITION' or use the 'STOCK POSITION' button on the breadcrumbs bar to save your exact scroll state at mid or bottom. Jump back anytime with 1 click.",
                        "一覧表示中に「+ 現在の閲覧位置をストック保存」またはパンくずバーの「位置をストック」を押すと、中段や下段のスクロール位置を何件でも記録できます。いつでもワンクリックでその場所へ復元できます。"
                      )}
                    </span>
                  </div>
                ) : stockDisplayMode === "tile" ? (
                  /* TILE VIEW: COMPACT SQUARE PINS GRID */
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 p-1">
                    {quickStocks.map((stk, idx) => {
                      const pct = Math.round(stk.scrollRatio * 100);
                      const isActive = activeStockId === stk.id;
                      return (
                        <button
                          key={stk.id}
                          type="button"
                          onClick={() => {
                            handleRestoreQuickStock(stk);
                            setIsQuickStockDrawerOpen(false);
                          }}
                          className={cn(
                            "group relative aspect-square flex flex-col items-center justify-center rounded-[3px] border-2 transition-all cursor-pointer select-none shadow-xs",
                            isActive
                              ? "border-accent bg-accent/15 ring-2 ring-accent/30 shadow-md"
                              : "border-panel-border bg-root-bg hover:border-accent hover:bg-white/5 hover:shadow-md"
                          )}
                          title={`#${idx + 1} ${stk.name}\n${stk.datasetName || stk.categoryName || "ALL"} • ${pct}% (${new Date(stk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                        >
                          {/* PIN MARK ICON */}
                          <Pin
                            size={20}
                            className={cn(
                              "transition-transform duration-150 group-hover:scale-115",
                              isActive
                                ? "text-accent fill-accent"
                                : "text-text-primary fill-current opacity-90"
                            )}
                          />

                          {/* TOP-LEFT INDEX */}
                          <span className="absolute top-1 left-1.5 text-[9px] font-mono text-text-muted font-bold leading-none">
                            #{idx + 1}
                          </span>

                          {/* BOTTOM-RIGHT PERCENT / POS */}
                          <span className="absolute bottom-1 right-1 text-[9px] font-mono px-1 py-0.2 rounded font-bold leading-none bg-panel-bg/90 text-text-secondary border border-panel-border/60">
                            {pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`}
                          </span>

                          {/* HOVER DELETE BUTTON */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuickStock(stk.id);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-xs z-10 cursor-pointer"
                            title={t("Delete stock", "ストックを削除")}
                          >
                            <X size={9} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* LIST VIEW */
                  <div className="flex flex-col gap-2">
                    {quickStocks.map((stk, idx) => {
                    const isEditing = editingStockId === stk.id;
                    const pct = Math.round(stk.scrollRatio * 100);
                    return (
                      <div
                        key={stk.id}
                        className="group flex flex-col gap-1.5 p-2.5 bg-root-bg/50 hover:bg-root-bg/80 border border-panel-border hover:border-accent rounded-xs transition-all text-[11px] select-none"
                      >
                        {/* TOP ROW: NAME & POSITION BADGE */}
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingStockName}
                              onChange={(e) => setEditingStockName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameQuickStock(stk.id, editingStockName);
                                  setEditingStockId(null);
                                } else if (e.key === "Escape") {
                                  setEditingStockId(null);
                                }
                              }}
                              onBlur={() => {
                                handleRenameQuickStock(stk.id, editingStockName);
                                setEditingStockId(null);
                              }}
                              className="flex-1 bg-black/50 border border-accent px-1.5 py-0.5 text-text-primary text-[11px] rounded outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handleRestoreQuickStock(stk);
                                setIsQuickStockDrawerOpen(false);
                              }}
                              className="flex-1 text-left font-bold text-text-primary hover:text-accent truncate cursor-pointer transition-colors"
                              title={t("Click to jump to this position", "クリックしてこの位置へジャンプ")}
                            >
                              {stk.name}
                            </button>
                          )}
                          <span
                            className={cn(
                              "shrink-0 text-[10px] px-2 py-0.5 rounded font-bold uppercase",
                              pct <= 5
                                ? "bg-panel-border/50 text-text-secondary border border-panel-border"
                                : pct >= 95
                                ? "bg-panel-border/50 text-text-secondary border border-panel-border"
                                : "bg-panel-border/40 text-text-secondary border border-panel-border"
                            )}
                          >
                            {pct <= 5 ? "TOP" : pct >= 95 ? "BTM" : `${pct}%`}
                          </span>
                        </div>

                        {/* BOTTOM ROW: META & ACTIONS */}
                        <div className="flex items-center justify-between text-text-muted text-[10px] pt-0.5">
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate text-text-secondary font-bold">
                              {stk.datasetName || stk.categoryName || "ALL"}
                            </span>
                            <span className="opacity-40">•</span>
                            <span className="uppercase">{stk.viewMode.replace("grid-", "")}</span>
                            <span className="opacity-40">•</span>
                            <span>{new Date(stk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* MOVE UP */}
                            <button
                              type="button"
                              onClick={(e) => handleMoveQuickStock(stk.id, "up", e)}
                              disabled={idx === 0}
                              className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors"
                              title={t("Move up in list", "上へ並び替え")}
                            >
                              <ArrowUp size={12} />
                            </button>
                            {/* MOVE DOWN */}
                            <button
                              type="button"
                              onClick={(e) => handleMoveQuickStock(stk.id, "down", e)}
                              disabled={idx === quickStocks.length - 1}
                              className="p-1 hover:text-text-primary disabled:opacity-20 transition-colors"
                              title={t("Move down in list", "下へ並び替え")}
                            >
                              <ArrowDown size={12} />
                            </button>
                            {/* OVERWRITE */}
                            <button
                              type="button"
                              onClick={(e) => handleUpdateQuickStock(stk.id, e)}
                              className="p-1 text-text-muted hover:text-accent transition-colors"
                              title={t("Overwrite with current scroll position", "現在の位置で上書き更新")}
                            >
                              <RefreshCw size={12} />
                            </button>
                            {/* RENAME */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStockId(stk.id);
                                setEditingStockName(stk.name);
                              }}
                              className="p-1 hover:text-text-primary transition-colors"
                              title={t("Rename stock", "名前を変更")}
                            >
                              <Edit2 size={12} />
                            </button>
                            {/* DELETE */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteQuickStock(stk.id, e)}
                              className="p-1 hover:text-red-400 transition-colors"
                              title={t("Delete stock", "削除")}
                            >
                              <X size={12} />
                            </button>
                            {/* JUMP BUTTON */}
                            <button
                              type="button"
                              onClick={() => {
                                handleRestoreQuickStock(stk);
                                setIsQuickStockDrawerOpen(false);
                              }}
                              className="px-2.5 py-0.5 bg-accent/20 hover:bg-accent text-accent hover:text-accent-text border border-accent/40 rounded-xs font-bold text-[10px] transition-colors ml-1"
                              title={t("Restore this view and jump to scroll position", "この位置へ復元ジャンプ")}
                            >
                              JUMP
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* DRAWER FOOTER */}
              <div className="px-4 py-2.5 border-t border-panel-border/80 bg-root-bg/40 flex items-center justify-between text-[10px] text-text-muted shrink-0">
                <span>{t("QUICK STOCK ENGINE", "クイックストック機能")}</span>
                <SolidButton
                  onClick={() => setIsQuickStockDrawerOpen(false)}
                  className="px-3 py-1 text-[10px] bg-transparent border-panel-border text-text-secondary hover:text-text-primary"
                >
                  {t("CLOSE", "閉じる")}
                </SolidButton>
              </div>
            </motion.div>
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
