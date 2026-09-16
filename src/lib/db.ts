import { openDB, DBSchema } from 'idb';

export interface CategoryRecord {
  id: string;
  name: string;
  parentId?: string | null; // null for top-level, or id of parent category (up to 3 levels)
  createdAt: number;
  orderIndex?: number;
  color?: string | null;
  coverImagePosition?: "top" | "center" | "bottom";
}

export interface DatasetRecord {
  id: string;
  name: string;
  createdAt: number;
  categoryId?: string | null; // category/folder ID (or null/undefined if uncategorized)
  isHidden?: boolean;
  isPinned?: boolean;
  coverImageId?: string;
  coverImagePosition?: "top" | "center" | "bottom";
  orderIndex?: number;
}

export interface ImageRecord {
  id: string; // name + lastModified
  datasetId: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  addedAt?: number;
  data: Blob;
  orderIndex?: number;
  autoBg?: "black" | "white" | "checkerboard";
  width?: number;
  height?: number;
  isHidden?: boolean;
}

interface ImageViewerDB extends DBSchema {
  datasets: {
    key: string;
    value: DatasetRecord;
  };
  images: {
    key: string;
    value: ImageRecord;
    indexes: { 'by-dataset': string };
  };
  categories: {
    key: string;
    value: CategoryRecord;
    indexes: { 'by-parent': string };
  };
}

const DB_NAME = 'solid-image-viewer-db';
const DB_VERSION = 11; // upgrade to version 4 for categories
const STORE_NAME_IMAGES = 'images';
const STORE_NAME_DATASETS = 'datasets';
const STORE_NAME_CATEGORIES = 'categories';

export async function initDB() {
  return openDB<ImageViewerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        // Initial creation
        db.createObjectStore(STORE_NAME_DATASETS, { keyPath: 'id' });
        const imgStore = db.createObjectStore(STORE_NAME_IMAGES, { keyPath: 'id' });
        imgStore.createIndex('by-dataset', 'datasetId');
      } else if (oldVersion < 2) {
        // Upgrade from version 1 to 2
        db.createObjectStore(STORE_NAME_DATASETS, { keyPath: 'id' });
        const imgStore = transaction.objectStore(STORE_NAME_IMAGES);
        imgStore.createIndex('by-dataset', 'datasetId');
      }
      // v3 adds autoBg to ImageRecord, no schema changes needed
      // v4 adds categories store
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORE_NAME_CATEGORIES)) {
          const catStore = db.createObjectStore(STORE_NAME_CATEGORIES, { keyPath: 'id' });
          catStore.createIndex('by-parent', 'parentId');
        }
      }
    },
  });
}

// Dataset APIs
export async function createDataset(name: string): Promise<DatasetRecord> {
  const db = await initDB();
  const ds: DatasetRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
  };
  await db.put(STORE_NAME_DATASETS, ds);
  return ds;
}

export async function getAllDatasets(): Promise<DatasetRecord[]> {
  const db = await initDB();
  const datasets = await db.getAll(STORE_NAME_DATASETS);
  return datasets.sort((a, b) => {
    // Pinned datasets always come first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
      return a.orderIndex - b.orderIndex;
    }
    if (a.orderIndex !== undefined) return -1;
    if (b.orderIndex !== undefined) return 1;
    // Within same pin status, sort by createdAt descending
    return b.createdAt - a.createdAt;
  });
}

export async function toggleDatasetVisibility(id: string, isHidden: boolean) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(id);
  if (ds) {
    ds.isHidden = isHidden;
    await store.put(ds);
  }
  await tx.done;
}

export async function renameDataset(id: string, newName: string) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(id);
  if (ds) {
    ds.name = newName;
    await store.put(ds);
  }
  await tx.done;
}

export async function updateDatasetDate(id: string, newDate: number) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(id);
  if (ds) {
    ds.createdAt = newDate;
    await store.put(ds);
  }
  await tx.done;
}

export async function updateDatasetCoverImage(id: string, coverImageId: string | null) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(id);
  if (ds) {
    if (coverImageId) {
      ds.coverImageId = coverImageId;
    } else {
      delete ds.coverImageId;
      delete ds.coverImagePosition;
    }
    await store.put(ds);
  }
  await tx.done;
}

export async function updateDatasetCoverPosition(id: string, position: "top" | "center" | "bottom") {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(id);
  if (ds) {
    ds.coverImagePosition = position;
    await store.put(ds);
  }
  await tx.done;
}

export async function updateDatasetPinned(id: string, isPinned: boolean) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(id);
  if (ds) {
    ds.isPinned = isPinned;
    await store.put(ds);
  }
  await tx.done;
}

export async function deleteDataset(id: string) {
  const db = await initDB();
  const tx = db.transaction([STORE_NAME_DATASETS, STORE_NAME_IMAGES], 'readwrite');
  await tx.objectStore(STORE_NAME_DATASETS).delete(id);
  
  // also delete images linked to this dataset
  const imgStore = tx.objectStore(STORE_NAME_IMAGES);
  const index = imgStore.index('by-dataset');
  let cursor = await index.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// Image APIs
export async function storeImages(images: ImageRecord[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readwrite');
  await Promise.all([
    ...images.map(img => tx.store.put(img)),
    tx.done
  ]);
}

export async function getImagesByDataset(datasetId: string): Promise<ImageRecord[]> {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME_IMAGES, 'by-dataset', datasetId);
}

export async function getImageById(id: string): Promise<ImageRecord | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME_IMAGES, id);
}

export async function getFirstImageOfDataset(datasetId: string): Promise<ImageRecord | null> {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readonly');
  const index = tx.store.index('by-dataset');
  let cursor = await index.openCursor(datasetId);
  if (cursor) {
    return cursor.value;
  }
  return null;
}

export async function getCoverImageOfDataset(datasetId: string, coverImageId?: string): Promise<ImageRecord | null> {
  const db = await initDB();
  if (coverImageId) {
    const img = await db.get(STORE_NAME_IMAGES, coverImageId);
    if (img && img.datasetId === datasetId) {
      return img;
    }
  }
  return getFirstImageOfDataset(datasetId);
}

export async function getAllImages(): Promise<ImageRecord[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME_IMAGES);
}

export async function getTotalImageCount(): Promise<number> {
  const db = await initDB();
  return db.count(STORE_NAME_IMAGES);
}

export async function getImageCountByDataset(datasetId: string): Promise<number> {
  const db = await initDB();
  return db.countFromIndex(STORE_NAME_IMAGES, 'by-dataset', datasetId);
}

export async function copyImagesToDataset(imageIds: string[], newDatasetId: string) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readwrite');
  
  for (const id of imageIds) {
    const img = await tx.store.get(id);
    if (img) {
      const newImg = { ...img, datasetId: newDatasetId, id: `${newDatasetId}-${img.name}-${img.lastModified}-${img.size}` };
      await tx.store.put(newImg);
    }
  }
  await tx.done;
}

export async function updateImagesDataset(imageIds: string[], newDatasetId: string) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readwrite');
  
  for (const id of imageIds) {
    const img = await tx.store.get(id);
    if (img) {
      img.datasetId = newDatasetId;
      await tx.store.put(img);
    }
  }
  await tx.done;
}

export async function updateImagesVisibility(ids: string[], isHidden: boolean) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_IMAGES);
  
  for (const id of ids) {
    const img = await store.get(id);
    if (img) {
      img.isHidden = isHidden;
      await store.put(img);
    }
  }
  await tx.done;
}

export async function deleteImage(id: string) {
  const db = await initDB();
  return db.delete(STORE_NAME_IMAGES, id);
}

export async function renameImage(id: string, newName: string) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_IMAGES);
  const img = await store.get(id);
  if (img) {
    img.name = newName;
    await store.put(img);
  }
  await tx.done;
}

export async function updateImagesOrder(updates: {id: string, orderIndex: number}[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_IMAGES, 'readwrite');
  for (const { id, orderIndex } of updates) {
    const img = await tx.store.get(id);
    if (img) {
      img.orderIndex = orderIndex;
      await tx.store.put(img);
    }
  }
  await tx.done;
}

export async function updateDatasetCategory(datasetId: string, categoryId: string | null) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  const ds = await store.get(datasetId);
  if (ds) {
    ds.categoryId = categoryId || undefined;
    await store.put(ds);
  }
  await tx.done;
}

// Category APIs
export async function createCategory(name: string, parentId?: string | null): Promise<CategoryRecord> {
  const db = await initDB();
  const cat: CategoryRecord = {
    id: crypto.randomUUID(),
    name,
    parentId: parentId || null,
    createdAt: Date.now(),
  };
  await db.put(STORE_NAME_CATEGORIES, cat);
  return cat;
}

export async function getAllCategories(): Promise<CategoryRecord[]> {
  const db = await initDB();
  const categories = await db.getAll(STORE_NAME_CATEGORIES);
  return categories.sort((a, b) => {
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
      return a.orderIndex - b.orderIndex;
    }
    return a.createdAt - b.createdAt;
  });
}

export async function renameCategory(id: string, newName: string) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_CATEGORIES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_CATEGORIES);
  const cat = await store.get(id);
  if (cat) {
    cat.name = newName;
    await store.put(cat);
  }
  await tx.done;
}

export async function updateCategoryParent(id: string, parentId: string | null) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_CATEGORIES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_CATEGORIES);
  const cat = await store.get(id);
  if (cat) {
    cat.parentId = parentId || null;
    await store.put(cat);
  }
  await tx.done;
}

export async function updateCategoryColor(id: string, color: string | null) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_CATEGORIES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_CATEGORIES);
  const cat = await store.get(id);
  if (cat) {
    if (color) {
      cat.color = color;
    } else {
      delete cat.color;
    }
    await store.put(cat);
  }
  await tx.done;
}

export async function updateCategoryCoverPosition(id: string, position: "top" | "center" | "bottom") {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_CATEGORIES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_CATEGORIES);
  const cat = await store.get(id);
  if (cat) {
    cat.coverImagePosition = position;
    await store.put(cat);
  }
  await tx.done;
}

export async function deleteCategory(id: string) {
  const db = await initDB();
  const tx = db.transaction([STORE_NAME_CATEGORIES, STORE_NAME_DATASETS], 'readwrite');
  const catStore = tx.objectStore(STORE_NAME_CATEGORIES);
  const dsStore = tx.objectStore(STORE_NAME_DATASETS);

  const targetCat = await catStore.get(id);
  const parentId = targetCat?.parentId || null;

  // Move direct subcategories to this category's parent (or null)
  const allCats = await catStore.getAll();
  for (const cat of allCats) {
    if (cat.parentId === id) {
      cat.parentId = parentId;
      await catStore.put(cat);
    }
  }

  // Move datasets in this category to this category's parent (or null)
  const allDatasets = await dsStore.getAll();
  for (const ds of allDatasets) {
    if (ds.categoryId === id) {
      ds.categoryId = parentId || undefined;
      await dsStore.put(ds);
    }
  }

  await catStore.delete(id);
  await tx.done;
}

export async function updateDatasetsOrder(updates: { id: string; orderIndex: number }[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_DATASETS, 'readwrite');
  const store = tx.objectStore(STORE_NAME_DATASETS);
  for (const { id, orderIndex } of updates) {
    const ds = await store.get(id);
    if (ds) {
      ds.orderIndex = orderIndex;
      await store.put(ds);
    }
  }
  await tx.done;
}

export async function updateCategoriesOrder(updates: { id: string; orderIndex: number }[]) {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME_CATEGORIES, 'readwrite');
  const store = tx.objectStore(STORE_NAME_CATEGORIES);
  for (const { id, orderIndex } of updates) {
    const cat = await store.get(id);
    if (cat) {
      cat.orderIndex = orderIndex;
      await store.put(cat);
    }
  }
  await tx.done;
}

export async function clearAll() {
  const db = await initDB();
  const tx = db.transaction([STORE_NAME_DATASETS, STORE_NAME_IMAGES, STORE_NAME_CATEGORIES], 'readwrite');
  await tx.objectStore(STORE_NAME_DATASETS).clear();
  await tx.objectStore(STORE_NAME_IMAGES).clear();
  await tx.objectStore(STORE_NAME_CATEGORIES).clear();
  await tx.done;
}
