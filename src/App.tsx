import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useAnimation,
  useMotionValue,
  Reorder,
} from "motion/react";
import {
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
  Check,
  PanelLeft,
  PanelRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RotateCw,
  RefreshCw,
  Edit2,
  Search,
  FlipHorizontal,
} from "lucide-react";
import {
  ImageRecord,
  DatasetRecord,
  getAllDatasets,
  createDataset,
  deleteDataset,
  getImagesByDataset,
  getAllImages,
  storeImages,
  clearAll,
  deleteImage,
  renameImage,
  updateImagesDataset,
  renameDataset,
  getTotalImageCount,
  getImageCountByDataset,
  updateDatasetDate,
  updateImagesOrder,
} from "./lib/db";
import { Panel, SolidButton } from "./components/ui";
import { cn } from "./lib/utils";
import { ReactSortable } from "react-sortablejs";

type ViewMode = "grid-sq" | "grid-ma" | "list" | "free";

const analyzeImageBlob = async (blob: Blob): Promise<"black" | "white" | "checkerboard"> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve("checkerboard");

      const MAX_SIZE = 64;
      let width = img.width;
      let height = img.height;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }
      if (width === 0 || height === 0) return resolve("checkerboard");
      
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
          return resolve(avgBrightness > 128 ? "black" : "white");
        } else {
          // For opaque images, we want the canvas to blend with the background.
          // The background dominates the average brightness.
          return resolve(avgBrightness > 128 ? "white" : "black");
        }
      } catch (e) {
        resolve("checkerboard");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("checkerboard");
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

export default function App() {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [datasetCounts, setDatasetCounts] = useState<Record<string, number>>(
    {},
  );
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(() => {
    return localStorage.getItem("app_activeDatasetId") || null;
  });

  useEffect(() => {
    if (activeDatasetId) {
      localStorage.setItem("app_activeDatasetId", activeDatasetId);
    } else {
      localStorage.removeItem("app_activeDatasetId");
    }
  }, [activeDatasetId]);
  const [datasetViewMode, setDatasetViewMode] = useState<"list" | "dropdown">(
    "list",
  );
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalImagesCount, setTotalImagesCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("app_viewMode");
    return (saved as ViewMode) || "grid-sq";
  });
  const [openAction, setOpenAction] = useState<"click" | "dblclick">(() => {
    const saved = localStorage.getItem("app_openAction");
    return (saved as "click" | "dblclick") || "dblclick";
  });
  const [theme, setTheme] = useState<"NAVY" | "BLACK" | "LIGHT" | "PAPER">(
    () => {
      const saved = localStorage.getItem("app_theme");
      return (saved as "NAVY" | "BLACK" | "LIGHT" | "PAPER") || "BLACK";
    }
  );
  const [canvasBg, setCanvasBg] = useState<
    "theme" | "black" | "white" | "checker"
  >("white");
  const [sortField, setSortField] = useState<"name" | "size" | "type" | "date" | "custom" | "random">(
    "name",
  );
  const [randomSeed, setRandomSeed] = useState(0);
  const [sortOrders, setSortOrders] = useState<Record<string, "asc" | "desc">>({
    name: "asc",
    size: "desc",
    type: "asc",
    date: "desc",
    custom: "asc",
  });
  const [scales, setScales] = useState<Record<ViewMode, number>>({
    "grid-sq": 140,
    "grid-ma": 140,
    list: 140,
    free: 140,
  });
  const [gaps, setGaps] = useState<Record<ViewMode, number>>({
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

  const itemScale = scales[viewMode];
  const gridGap = gaps[viewMode];

  const setItemScale = (val: number) => {
    setScales((prev) => ({ ...prev, [viewMode]: val }));
  };

  const setGridGap = (val: number) => {
    setGaps((prev) => ({ ...prev, [viewMode]: val }));
  };

  const [selectedImage, setSelectedImage] = useState<LoadedImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadingDirectory, setIsReadingDirectory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenScale, setFullscreenScale] = useState(1);
  const [fullscreenRotation, setFullscreenRotation] = useState(0);
  const [fullscreenFlipX, setFullscreenFlipX] = useState(false);
  const imgControls = useAnimation();
  const imgX = useMotionValue(0);
  const imgY = useMotionValue(0);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });

  const zoomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startZoomIn = () => {
    if (zoomIntervalRef.current || zoomTimeoutRef.current) return;
    setFullscreenScale((s) => {
      const newScale = Math.min(s + 0.02, 10);
      imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
      return newScale;
    });
    zoomTimeoutRef.current = setTimeout(() => {
      zoomIntervalRef.current = setInterval(() => {
        setFullscreenScale((s) => {
          const newScale = Math.min(s + 0.02, 10);
          imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          return newScale;
        });
      }, 20);
    }, 300);
  };

  const startZoomOut = () => {
    if (zoomIntervalRef.current || zoomTimeoutRef.current) return;
    setFullscreenScale((s) => {
      const newScale = Math.max(1, s - 0.02);
      if (newScale === 1) imgControls.start({ x: 0, y: 0, scale: 1, transition: { duration: 0.05, ease: "linear" } });
      else imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
      return newScale;
    });
    zoomTimeoutRef.current = setTimeout(() => {
      zoomIntervalRef.current = setInterval(() => {
        setFullscreenScale((s) => {
          const newScale = Math.max(1, s - 0.02);
          if (newScale === 1) imgControls.start({ x: 0, y: 0, scale: 1, transition: { duration: 0.05, ease: "linear" } });
          else imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          return newScale;
        });
      }, 20);
    }, 300);
  };

  const stopZooming = () => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = null;
    }
    if (zoomIntervalRef.current) {
      clearInterval(zoomIntervalRef.current);
      zoomIntervalRef.current = null;
    }
  };

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

  // Preserve scale and rotation across image switch, and clamp x/y position to the new image bounds once loaded
  useEffect(() => {
    if (isFullscreen && imgDims.w > 0 && imgDims.h > 0) {
      const currentCW = typeof window !== "undefined" ? window.innerWidth * 0.95 : 1000;
      const currentCH = typeof window !== "undefined" ? window.innerHeight * 0.95 : 1000;

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
  }, [imgDims, isFullscreen, fullscreenScale, fullscreenRotation, imgControls, imgX, imgY]);

  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">(
    "left",
  );
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isTrackInfoCollapsed, setIsTrackInfoCollapsed] = useState(true);
  const [language, setLanguage] = useState<"EN" | "JP">("EN");
  const [isDragging, setIsDragging] = useState(false);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [isAppFullscreen, setIsAppFullscreen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 3000);
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
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

  // Custom Prompts/Modals because alert/prompt/confirm are unreliable in iframe
  const [showNewDatasetModal, setShowNewDatasetModal] = useState(false);
  const [datasetNameInput, setDatasetNameInput] = useState("");
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [showRenameFileModal, setShowRenameFileModal] = useState(false);
  const [fileNameInput, setFileNameInput] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fullscreenContainerRef = React.useRef<HTMLDivElement>(null);

  const scatterContainerRef = React.useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(1000);
  const [containerHeight, setContainerHeight] = useState(800);
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
      loadImages(activeDatasetId);
    } else {
      setImages([]);
    }
  }, [activeDatasetId]);

  const sortedImages = useMemo(() => {
    let filteredImages = images;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredImages = images.filter(img => img.name.toLowerCase().includes(q));
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
  }, [images, sortField, sortOrders, randomSeed, searchQuery]);

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

  const loadDatasets = async () => {
    setIsLoading(true);
    try {
      let dsList = await getAllDatasets();
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

      const total = await getTotalImageCount();
      setTotalImagesCount(total);

      if (dsList.length > 0 && !activeDatasetId) {
        setActiveDatasetId(dsList[0].id);
      } else if (
        activeDatasetId &&
        activeDatasetId !== "all" &&
        !dsList.find((d) => d.id === activeDatasetId)
      ) {
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
      const dbImages = datasetId === "all" ? await getAllImages() : await getImagesByDataset(datasetId);
      // Revoke old URLs
      images.forEach((img) => URL.revokeObjectURL(img.url));

      const loaded = await Promise.all(
        dbImages.map(async (img) => {
          let autoBg = img.autoBg;
          if (!autoBg) {
            autoBg = await analyzeImageBlob(img.data);
            // Update the DB record in the background to cache it
            storeImages([{ ...img, autoBg }]).catch(console.error);
          }
          return {
            ...img,
            url: URL.createObjectURL(img.data),
            randomX: Math.random() * 80 - 40,
            randomY: Math.random() * 80 - 40,
            randomRotation: Math.random() * 30 - 15,
            autoBg,
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
      const existingNames = new Set(existingImages.map((img) => img.name));

      const newFiles: File[] = [];
      let skippedCount = 0;

      for (const f of files) {
        if (existingNames.has(f.name)) {
          skippedCount++;
        } else {
          newFiles.push(f);
        }
      }

      if (newFiles.length > 0) {
        // Compute autoBg asynchronously for each file
        const records = await Promise.all(
          newFiles.map(async (f) => {
            const autoBg = await analyzeImageBlob(f);
            return {
              id: `${datasetId}-${f.name}-${f.lastModified}-${f.size}`,
              datasetId,
              name: f.name,
              type: f.type,
              size: f.size,
              lastModified: f.lastModified,
              addedAt: Date.now(),
              data: f,
              autoBg,
            };
          })
        );

        await storeImages(records);
        await loadDatasets();
        if (datasetId === activeDatasetId) {
          await loadImages(datasetId);
        }
      }

      if (skippedCount > 0) {
        showNotification(
          language === "JP"
            ? `${skippedCount} 件のファイルは既に存在するためスキップしました`
            : `Skipped ${skippedCount} file(s) that already exist`
        );
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
    if (!e.target.files || e.target.files.length === 0 || !activeDatasetId)
      return;
    await processFiles(e.target.files, activeDatasetId);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddDatasetClick = () => {
    setDatasetNameInput("");
    setEditingDatasetId(null);
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
      setActiveDatasetId(ds.id);
    }
    setShowNewDatasetModal(false);
    await loadDatasets();
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
    setDatasets(newOrder);
    // Sort array implies top-to-bottom.
    // Datasets are normally sorted by createdAt descending (newest on top).
    // We update them so the first has the highest timestamp.
    const now = Date.now();
    for (let i = 0; i < newOrder.length; i++) {
      await updateDatasetDate(newOrder[i].id, now - i * 1000);
    }
  };

  const handleDeleteDataset = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this dataset?")) return;
    await deleteDataset(id);
    await loadDatasets();
  };

  const handleDeleteSelected = async () => {
    setIsLoading(true);
    for (const id of selectedImageIds) {
      await deleteImage(id);
    }
    setSelectedImageIds(new Set());
    setLastSelectedIdx(null);
    setIsSelectionMode(false);
    setShowDeleteSelectedModal(false);
    if (activeDatasetId) {
      await loadImages(activeDatasetId);
      await loadDatasets();
    }
    setIsLoading(false);
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

  const handleSelectAll = () => {
    if (selectedImageIds.size === images.length) {
      setSelectedImageIds(new Set());
      setLastSelectedIdx(null);
    } else {
      setSelectedImageIds(new Set(images.map((img) => img.id)));
      setLastSelectedIdx(null);
    }
  };

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;

      const getDragBounds = () => {
        let mX = 0;
        let mY = 0;
        const cw = window.innerWidth * 0.95;
        const ch = window.innerHeight * 0.95;
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

      if (e.key === "ArrowRight") {
        goToNextImage();
      } else if (e.key === "ArrowLeft") {
        goToPrevImage();
      } else if (e.code === "Numpad6" || e.key === "6") {
        if (fullscreenScale > 1) {
          e.preventDefault();
          const { mX } = getDragBounds();
          const newX = Math.max(imgX.get() - 20, -mX);
          imgControls.start({ x: newX, transition: { duration: 0.05, ease: "linear" } });
        }
      } else if (e.code === "Numpad4" || e.key === "4") {
        if (fullscreenScale > 1) {
          e.preventDefault();
          const { mX } = getDragBounds();
          const newX = Math.min(imgX.get() + 20, mX);
          imgControls.start({ x: newX, transition: { duration: 0.05, ease: "linear" } });
        }
      } else if (e.key === "ArrowUp" || e.code === "Numpad8" || e.key === "8") {
        e.preventDefault();
        if (fullscreenScale > 1) {
          const { mY } = getDragBounds();
          const newY = Math.min(imgY.get() + 20, mY);
          imgControls.start({ y: newY, transition: { duration: 0.05, ease: "linear" } });
        }
      } else if (e.key === "ArrowDown" || e.code === "Numpad2" || e.key === "2") {
        e.preventDefault();
        if (fullscreenScale > 1) {
          const { mY } = getDragBounds();
          const newY = Math.max(imgY.get() - 20, -mY);
          imgControls.start({ y: newY, transition: { duration: 0.05, ease: "linear" } });
        }
      } else if (e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault();
        setFullscreenScale((s) => {
          const newScale = Math.min(s + 0.02, 10);
          imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          return newScale;
        });
      } else if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault();
        setFullscreenScale((s) => {
          const newScale = Math.max(1, s - 0.02);
          if (newScale === 1) {
            imgControls.start({ x: 0, y: 0, scale: 1, transition: { duration: 0.05, ease: "linear" } });
          } else {
            imgControls.start({ scale: newScale, transition: { duration: 0.05, ease: "linear" } });
          }
          return newScale;
        });
      } else if (e.key === "0" || e.code === "Numpad0") {
        e.preventDefault();
        setFullscreenScale(1);
        imgControls.start({ x: 0, y: 0, scale: 1, transition: { duration: 0 } });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isFullscreen,
    goToNextImage,
    goToPrevImage,
    imgControls,
    fullscreenScale,
    fullscreenRotation,
    imgDims,
    imgX,
    imgY,
  ]);

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
    if (!activeDatasetId || activeDatasetId === "all") return;

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
      if (e.dataTransfer && e.dataTransfer.files) {
        await processFiles(e.dataTransfer.files, activeDatasetId);
      }
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

  const cW = typeof window !== "undefined" ? window.innerWidth * 0.95 : 1000;
  const cH = typeof window !== "undefined" ? window.innerHeight * 0.95 : 1000;
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
            <h2 className="text-2xl text-text-primary tracking-widest mb-2">
              DROP FILES HERE
            </h2>
            <p className="text-text-secondary">ADDING TO ACTIVE DATASET</p>
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-panel-border text-text-primary px-4 py-2 font-mono text-sm shadow-xl flex items-center gap-2 border border-accent/20"
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

        <div className="flex items-center gap-4 h-full">
          <div className="flex items-center gap-2 h-full mr-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">
              CANVAS:
            </span>
            <div className="flex gap-1 h-full py-1">
              <SolidButton
                active={canvasBg === "theme"}
                onClick={() => setCanvasBg("theme")}
                className="px-3 py-0 text-[10px]"
              >
                AUTO
              </SolidButton>
              <SolidButton
                active={canvasBg === "black"}
                onClick={() => setCanvasBg("black")}
                className="px-3 py-0 text-[10px]"
              >
                BLK
              </SolidButton>
              <SolidButton
                active={canvasBg === "white"}
                onClick={() => setCanvasBg("white")}
                className="px-3 py-0 text-[10px]"
              >
                WHT
              </SolidButton>
              <SolidButton
                active={canvasBg === "checker"}
                onClick={() => setCanvasBg("checker")}
                className="px-3 py-0 text-[10px]"
              >
                CHK
              </SolidButton>
            </div>
          </div>

          <div className="flex items-center gap-2 h-full mr-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted">
              THEME:
            </span>
            <div className="flex gap-1 h-full py-1">
              <SolidButton
                active={theme === "NAVY"}
                onClick={() => setTheme("NAVY")}
                className="px-3 py-0 text-[10px]"
              >
                NAVY
              </SolidButton>
              <SolidButton
                active={theme === "BLACK"}
                onClick={() => setTheme("BLACK")}
                className="px-3 py-0 text-[10px]"
              >
                BLACK
              </SolidButton>
              <SolidButton
                active={theme === "LIGHT"}
                onClick={() => setTheme("LIGHT")}
                className="px-3 py-0 text-[10px]"
              >
                LIGHT
              </SolidButton>
              <SolidButton
                active={theme === "PAPER"}
                onClick={() => setTheme("PAPER")}
                className="px-3 py-0 text-[10px]"
              >
                PAPER
              </SolidButton>
            </div>
          </div>

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
            "flex flex-col gap-4 shrink-0 transition-all duration-300",
            sidebarVisible ? "w-[300px]" : "w-0 overflow-hidden opacity-0",
          )}
        >
          <Panel
            title={t("01 FORMATION ENGINE", "01 フォーム設定")}
            className="shrink-0"
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
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
                  IMAGE SCALE
                </span>
                <span className="text-[10px] font-mono text-accent">
                  {itemScale} PX
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="600"
                value={itemScale}
                onChange={(e) => setItemScale(Number(e.target.value))}
              />
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">
                  GRID GAP
                </span>
                <span className="text-[10px] font-mono text-accent">
                  {gridGap} PX
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                value={gridGap}
                onChange={(e) => setGridGap(Number(e.target.value))}
              />
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

          <Panel
            title={t("02 DATA SETS", "02 データセット")}
            className="shrink-0 flex flex-col flex-1 min-h-[200px]"
            contentClassName="flex flex-col p-4 overflow-hidden gap-3 h-full"
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

            <div className="pt-3 border-t border-panel-border overflow-y-auto flex flex-col gap-1 min-h-[80px] flex-1 scrollbar-dark pr-1">
              {datasetViewMode === "list" ? (
                <>
                  <div
                    onClick={() => setActiveDatasetId("all")}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-xs font-mono cursor-pointer border transition-colors group min-h-[32px] overflow-hidden shrink-0",
                      activeDatasetId === "all"
                        ? "bg-accent/10 border-accent/50 text-accent"
                        : "border-transparent text-text-secondary hover:bg-panel-border hover:text-text-primary",
                    )}
                  >
                    <span className="truncate flex-1 min-w-0 pr-2">
                      {t("ALL IMAGES", "すべての画像")}
                    </span>
                    <span className="text-text-muted text-[10px] shrink-0">
                      ({totalImagesCount})
                    </span>
                  </div>
                  <Reorder.Group axis="y" values={datasets} onReorder={handleReorderDatasets} className="flex flex-col gap-1 w-full min-h-0 relative">
                    {datasets.map((ds) => (
                      <Reorder.Item
                        key={ds.id}
                        value={ds}
                        onClick={() => setActiveDatasetId(ds.id)}
                        className={cn(
                          "flex items-center px-3 py-2 text-xs font-mono cursor-grab active:cursor-grabbing border transition-colors group min-h-[32px] overflow-hidden shrink-0",
                          activeDatasetId === ds.id
                            ? "bg-accent/10 border-accent/50 text-accent"
                            : "border-transparent text-text-secondary hover:bg-panel-border hover:text-text-primary",
                        )}
                      >
                        <GripVertical size={14} className="shrink-0 mr-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                        <span className="truncate flex-1 min-w-0 pr-2 pointer-events-none">
                          {ds.name}{" "}
                          <span className="text-text-muted text-[10px] ml-1">
                            ({datasetCounts[ds.id] || 0})
                          </span>
                        </span>
                        {activeDatasetId === ds.id && (
                          <div className="flex gap-2 shrink-0 bg-transparent items-center">
                            <button
                              onClick={(e) =>
                                handleRenameDatasetClick(e, ds.id, ds.name)
                              }
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
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </>
              ) : (
                <div className="flex flex-col gap-3 h-full">
                  <select
                    className="w-full bg-root-bg border border-panel-border text-text-primary px-3 py-2 outline-none text-xs font-mono"
                    value={activeDatasetId || ""}
                    onChange={(e) => setActiveDatasetId(e.target.value)}
                  >
                    <option value="all" className="bg-white text-black">{t("ALL IMAGES", "すべての画像")}</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id} className="bg-white text-black">
                        {ds.name} ({datasetCounts[ds.id] || 0})
                      </option>
                    ))}
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
          </Panel>

          <Panel
            title={t("03 TRACK INFO", "03 トラック情報")}
            className={cn(
              "shrink-0 flex flex-col items-center min-w-0 w-full transition-all duration-300",
              isTrackInfoCollapsed ? "h-[37px]" : "h-[260px]",
            )}
            contentClassName={cn(
              "flex flex-col w-full min-w-0 transition-opacity duration-300",
              isTrackInfoCollapsed
                ? "opacity-0 p-0 pointer-events-none"
                : "opacity-100 p-4",
            )}
            headerRight={
              <button
                onClick={() => setIsTrackInfoCollapsed(!isTrackInfoCollapsed)}
                className="text-text-muted hover:text-text-primary transition-colors flex items-center justify-center -mr-2 p-1 px-2"
                title={isTrackInfoCollapsed ? "EXPAND" : "COLLAPSE"}
              >
                {isTrackInfoCollapsed ? (
                  <Plus size={14} />
                ) : (
                  <Minus size={14} />
                )}
              </button>
            }
          >
            {selectedImage && !isTrackInfoCollapsed ? (
              <div className="flex flex-col gap-3 h-full w-full min-w-0 overflow-hidden">
                <div
                  className="flex-1 min-h-0 border border-panel-border rounded-sm overflow-hidden relative flex items-center justify-center cursor-pointer group bg-panel-bg w-full"
                  onClick={() => setIsFullscreen(true)}
                >
                  <div
                    className={cn(
                      "relative flex items-center justify-center w-full h-full absolute inset-0",
                      getCanvasBgClass(selectedImage.autoBg),
                    )}
                  >
                    <img
                      src={selectedImage.url}
                      className="w-full h-full object-contain block p-2"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                    <Maximize size={24} />
                  </div>
                </div>

                <div className="flex flex-col shrink-0 gap-1 w-full mt-auto mb-1 overflow-hidden">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-text-muted text-[10px] uppercase">
                      FILE SIZE:{" "}
                      <span className="text-text-primary">
                        {formatBytes(selectedImage.size)}
                      </span>
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
                      onClick={(e) => handleRenameFileClick(e, selectedImage.id, selectedImage.name)}
                      className="text-text-muted hover:text-accent transition-colors flex-shrink-0"
                      title="RENAME FILE"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ) : !isTrackInfoCollapsed ? (
              <div className="flex flex-1 items-center justify-center font-mono text-text-muted text-xs uppercase tracking-widest text-center">
                {t("AWAITING INITIALIZATION...", "初期化待機中...")}
                <br />
                {t("SELECT DATA UNIT", "データユニットを選択してください")}
              </div>
            ) : null}
          </Panel>
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
                    placeholder={t("SEARCH ALL...", "すべての画像を検索...")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value && activeDatasetId !== "all") {
                        setActiveDatasetId("all");
                      }
                    }}
                    className="bg-transparent border-none outline-none text-text-primary w-40 text-[10px] placeholder:text-text-muted focus:ring-0"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="text-text-muted hover:text-text-primary ml-1">
                      <X size={12} />
                    </button>
                  )}
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
                    {selectedImageIds.size === images.length && images.length > 0 ? "DESELECT ALL" : "SELECT ALL"}
                  </button>
                  <div className="flex items-center gap-1">
                    <select
                      value={moveTargetId}
                      onChange={(e) => setMoveTargetId(e.target.value)}
                      disabled={selectedImageIds.size === 0}
                      className={cn(
                        "bg-transparent outline-none text-[10px] uppercase font-mono tracking-wider transition-colors",
                        selectedImageIds.size > 0 ? "text-text-primary cursor-pointer border py-0.5 px-1 border-panel-border rounded" : "text-text-muted cursor-not-allowed border py-0.5 px-1 border-transparent"
                      )}
                    >
                      <option value="" className="bg-white text-black">MOVE TO...</option>
                      {datasets.filter(d => d.id !== activeDatasetId).map(ds => (
                        <option key={ds.id} value={ds.id} className="bg-white text-black">{ds.name}</option>
                      ))}
                    </select>
                    {moveTargetId && selectedImageIds.size > 0 && (
                      <button
                        onClick={() => {
                          handleMoveSelected(moveTargetId);
                          setMoveTargetId("");
                        }}
                        className="text-[10px] uppercase font-mono tracking-wider transition-colors text-accent hover:text-accent/80 px-2 py-0.5 bg-accent/10 rounded"
                      >
                        MOVE
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowDeleteSelectedModal(true)}
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
            >
              <AnimatePresence mode="wait">
                <motion.div
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
                    const isSortable = (viewMode === "grid-sq" || viewMode === "list" || viewMode === "grid-ma") && sortField === "custom";
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
                      <Container
                        {...containerProps}
                        className={cn(
                          "w-full h-auto",
                          viewMode === "grid-sq" &&
                            "grid content-start justify-center",
                          viewMode === "grid-ma" && "flex items-start",
                          viewMode === "list" && "flex flex-col",
                        )}
                        style={{
                          ...(viewMode === "grid-sq"
                            ? {
                                gridTemplateColumns: `repeat(auto-fill, minmax(${itemScale}px, 1fr))`,
                                gap: `${gridGap}px`,
                              }
                            : {}),
                          ...(viewMode === "grid-ma"
                            ? { gap: `${gridGap}px` }
                            : {}),
                          ...(viewMode === "list" ? { gap: `${gridGap}px` } : {}),
                        }}
                      >
                    {(() => {
                      const renderImageCard = (
                        img: LoadedImage,
                        i: number,
                        isSelected: boolean,
                        isMultiSelected: boolean,
                      ) => (
                        <motion.div
                          key={img.id}
                          layout={
                            viewMode === "grid-sq" || viewMode === "grid-ma"
                          }
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
                          whileHover={{
                            scale: viewMode !== "free" ? 1.01 : 1.02,
                          }}
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
                              ? {
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
                                  : {
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
                              <div className="font-mono text-sm flex-1 min-w-0 text-text-primary px-2 flex items-center justify-between group/name transition-colors rounded hover:bg-panel-border/30">
                                <span className="truncate block pr-2">{img.name}</span>
                                <button
                                  onClick={(e) => handleRenameFileClick(e, img.id, img.name)}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  className="text-text-muted hover:text-accent transition-colors flex-shrink-0 opacity-0 group-hover/name:opacity-100 px-2 flex items-center justify-center"
                                  title="RENAME FILE"
                                >
                                  <Edit2 size={14} />
                                </button>
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
                    );
                  })()}
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
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(10px)", transition: { duration: 0.1 } }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)", transition: { duration: 0 } }}
            className="fixed inset-0 z-50 bg-root-bg/80 flex items-center justify-center p-8"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                setIsFullscreen(false);
              }
            }}
          >
            <motion.div
              className="relative w-full h-full max-w-[95vw] max-h-[95vh] rounded-none overflow-hidden border border-panel-border shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center bg-panel-bg"
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
                      1,
                      MathMin(s - e.deltaY * 0.001, 10),
                    ); // 1未満には縮小しないようにし、迷子を完全に防ぐ
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
                  initial={{ scale: fullscreenScale, rotate: fullscreenRotation, rotateY: fullscreenFlipX ? 180 : 0 }}
                  className={cn(
                    "max-w-full max-h-full object-contain block",
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
                  }}
                  animate={imgControls}
                  transition={{ duration: 0.1, ease: "easeOut" }}
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

              {/* BG Toggle Button Group */}
              <div
                className={cn(
                  "absolute bottom-6 right-6 flex items-center gap-1.5 font-mono text-[9px] tracking-wider border px-2 py-1.5 rounded bg-black/15 backdrop-blur-sm transition-colors pointer-events-auto",
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
                    min="0"
                    max="1"
                    step="0.001"
                    value={Math.log10(fullscreenScale)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const newScale = Math.pow(10, val);
                      setFullscreenScale(newScale);
                      if (newScale === 1) {
                        imgControls.start({ x: 0, y: 0, scale: 1 });
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
                  title="Flip Horizontal"
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
                  title="Rotate 90°"
                >
                  <RotateCw size={18} />
                </button>
              </div>
              {/* Close Button */}
              <button
                onClick={() => setIsFullscreen(false)}
                className={cn(
                  "absolute top-6 right-6 p-2 transition-colors drop-shadow-md hover:scale-110 outline-none focus:outline-none",
                  isFullscreenDarkText
                    ? "text-black/50 hover:text-black"
                    : "text-white/50 hover:text-white",
                )}
              >
                <X size={32} />
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

      {/* Rename File Modal */}
      <AnimatePresence>
        {showRenameFileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
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
            className="fixed inset-0 z-[60] bg-root-bg/80 flex items-center justify-center p-8 backdrop-blur-sm"
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
              <h2 className="text-red-500 mb-4 flex items-center gap-2">
                <Trash2 size={20} />{" "}
                {t("DELETE SELECTED IMAGES", "選択した画像を削除")}
              </h2>
              <p className="text-text-secondary text-sm mb-6 uppercase leading-relaxed">
                {language === "JP" ? (
                  <>
                    警告: {selectedImageIds.size}{" "}
                    個の画像を選択したデータベースから削除します。
                    <br />
                    <br />
                    <span className="text-accent">
                      (※実際のデバイス上のファイルは削除されません)
                    </span>
                  </>
                ) : (
                  <>
                    Warning: This will delete {selectedImageIds.size} selected
                    image(s) from the database.
                    <br />
                    <br />
                    <span className="text-accent">
                      (※ Actual files on your device will NOT be deleted)
                    </span>
                  </>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <SolidButton
                  onClick={() => setShowDeleteSelectedModal(false)}
                  className="bg-transparent border-transparent text-text-secondary hover:text-text-primary shadow-none"
                >
                  CANCEL
                </SolidButton>
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10  uppercase transition-colors outline-none"
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
