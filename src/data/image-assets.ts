import type { ImageAsset } from '../image/image-generation'

export type StoredImageAsset = ImageAsset & { blob: Blob }

const DB_NAME = 'hw-forge-images'
const DB_VERSION = 1
const STORE_NAME = 'assets'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('entity', ['entityType', 'entityId'])
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export class LocalImageAssetRepository {
  async save(asset: StoredImageAsset): Promise<void> {
    const db = await openDb()
    try {
      const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
      await waitForRequest(store.put(asset))
    } finally {
      db.close()
    }
  }

  async get(id: string): Promise<StoredImageAsset | undefined> {
    const db = await openDb()
    try {
      const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
      return await waitForRequest(store.get(id)) as StoredImageAsset | undefined
    } finally {
      db.close()
    }
  }

  async listForEntity(entityType: ImageAsset['entityType'], entityId: string): Promise<StoredImageAsset[]> {
    const db = await openDb()
    try {
      const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
      const index = store.index('entity')
      const rows = await waitForRequest(index.getAll(IDBKeyRange.only([entityType, entityId]))) as StoredImageAsset[]
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } finally {
      db.close()
    }
  }

  async remove(id: string): Promise<void> {
    const db = await openDb()
    try {
      const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
      await waitForRequest(store.delete(id))
    } finally {
      db.close()
    }
  }
}
