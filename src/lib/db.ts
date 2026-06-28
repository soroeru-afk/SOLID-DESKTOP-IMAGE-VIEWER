import { openDB, DBSchema } from 'idb';

export interface DatasetRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface ImageRecord {
  id: string; // name + lastModified
  datasetId: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  data: Blob;
  orderIndex?: number;
  autoBg?: "black" | "white" | "checkerboard";
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
}

const DB_NAME = 'solid-image-viewer-db';
const DB_VERSION = 3; // upgrade to version 3
const STORE_NAME_IMAGES = 'images';
const STORE_NAME_DATASETS = 'datasets';

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
  return datasets.sort((a, b) => b.createdAt - a.createdAt);
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

export async function clearAll() {
  const db = await initDB();
  const tx = db.transaction([STORE_NAME_DATASETS, STORE_NAME_IMAGES], 'readwrite');
  await tx.objectStore(STORE_NAME_DATASETS).clear();
  await tx.objectStore(STORE_NAME_IMAGES).clear();
  await tx.done;
}
