import { Player, DraftState, DraftSettings, LeagueSettings, PlayerNote } from '../types'

// Database configuration
const DB_NAME = 'FantasyDraftAssistantDB'
const DB_VERSION = 1

// Object store names
const STORES = {
  PLAYERS: 'players',
  DRAFT_STATE: 'draftState',
  SETTINGS: 'settings',
  PLAYER_NOTES: 'playerNotes',
  DRAFT_HISTORY: 'draftHistory',
} as const

// Database schema interface for type safety
// interface DBSchema {
//   [STORES.PLAYERS]: Player
//   [STORES.DRAFT_STATE]: DraftState & { id: 'current' }
//   [STORES.SETTINGS]: (LeagueSettings | DraftSettings) & { id: string; type: 'league' | 'draft' | 'app' }
//   [STORES.PLAYER_NOTES]: PlayerNote & { id: string }
//   [STORES.DRAFT_HISTORY]: { id: string; draftState: DraftState; timestamp: Date; name: string }
// }

class DatabaseManager {
  private db: IDBDatabase | null = null
  private readonly dbName = DB_NAME
  private readonly version = DB_VERSION

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(new Error('Failed to open database'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.PLAYERS)) {
          const playerStore = db.createObjectStore(STORES.PLAYERS, { keyPath: 'id' })
          playerStore.createIndex('position', 'position', { unique: false })
          playerStore.createIndex('team', 'team', { unique: false })
          playerStore.createIndex('name', 'name', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.DRAFT_STATE)) {
          db.createObjectStore(STORES.DRAFT_STATE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(STORES.PLAYER_NOTES)) {
          db.createObjectStore(STORES.PLAYER_NOTES, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(STORES.DRAFT_HISTORY)) {
          const historyStore = db.createObjectStore(STORES.DRAFT_HISTORY, { keyPath: 'id' })
          historyStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  private getTransaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): IDBTransaction {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db.transaction(storeNames, mode)
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    const transaction = this.getTransaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  // Player operations
  async savePlayer(player: Player): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYERS, 'readwrite')
      const request = store.put(player)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to save player'))
    })
  }

  async savePlayers(players: Player[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PLAYERS, 'readwrite')
      const store = transaction.objectStore(STORES.PLAYERS)

      let completed = 0
      const total = players.length

      if (total === 0) {
        resolve()
        return
      }

      players.forEach(player => {
        const request = store.put(player)
        request.onsuccess = () => {
          completed++
          if (completed === total) resolve()
        }
        request.onerror = () => reject(new Error('Failed to save players'))
      })
    })
  }

  async getPlayer(id: string): Promise<Player | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYERS)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(new Error('Failed to get player'))
    })
  }

  async getAllPlayers(): Promise<Player[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYERS)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(new Error('Failed to get all players'))
    })
  }

  async getPlayersByPosition(position: string): Promise<Player[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYERS)
      const index = store.index('position')
      const request = index.getAll(position)

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(new Error('Failed to get players by position'))
    })
  }

  async clearPlayers(): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYERS, 'readwrite')
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to clear players'))
    })
  }

  // Draft state operations
  async saveDraftState(draftState: DraftState): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.DRAFT_STATE, 'readwrite')
      const request = store.put({ ...draftState, id: 'current' })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to save draft state'))
    })
  }

  async getDraftState(): Promise<DraftState | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.DRAFT_STATE)
      const request = store.get('current')

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Remove the 'id' field we added for storage
          const { id, ...draftState } = result
          resolve(draftState as DraftState)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(new Error('Failed to get draft state'))
    })
  }

  // Settings operations
  async saveSettings(settings: LeagueSettings | DraftSettings, type: 'league' | 'draft' | 'app'): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SETTINGS, 'readwrite')
      const request = store.put({ ...settings, id: type, type })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to save settings'))
    })
  }

  async getSettings(type: 'league' | 'draft' | 'app'): Promise<any | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SETTINGS)
      const request = store.get(type)

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          const { id, type: _, ...settings } = result
          resolve(settings)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(new Error('Failed to get settings'))
    })
  }

  // Player notes operations
  async savePlayerNote(note: PlayerNote): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYER_NOTES, 'readwrite')
      const request = store.put({ ...note, id: note.playerId })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to save player note'))
    })
  }

  async getPlayerNote(playerId: string): Promise<PlayerNote | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYER_NOTES)
      const request = store.get(playerId)

      request.onsuccess = () => {
        const result = request.result
        if (result) {
          const { id, ...note } = result
          resolve(note as PlayerNote)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(new Error('Failed to get player note'))
    })
  }

  async getAllPlayerNotes(): Promise<PlayerNote[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYER_NOTES)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = request.result || []
        const notes = results.map(result => {
          const { id, ...note } = result
          return note as PlayerNote
        })
        resolve(notes)
      }
      request.onerror = () => reject(new Error('Failed to get all player notes'))
    })
  }

  async deletePlayerNote(playerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PLAYER_NOTES, 'readwrite')
      const request = store.delete(playerId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(new Error('Failed to delete player note'))
    })
  }

  // Draft history operations
  async saveDraftHistory(draftState: DraftState, name: string): Promise<string> {
    const id = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.DRAFT_HISTORY, 'readwrite')
      const request = store.put({
        id,
        draftState,
        timestamp: new Date(),
        name,
      })

      request.onsuccess = () => resolve(id)
      request.onerror = () => reject(new Error('Failed to save draft history'))
    })
  }

  async getDraftHistory(): Promise<Array<{ id: string; name: string; timestamp: Date }>> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.DRAFT_HISTORY)
      const index = store.index('timestamp')
      const request = index.getAll()

      request.onsuccess = () => {
        const results = request.result || []
        const history = results.map(result => ({
          id: result.id,
          name: result.name,
          timestamp: result.timestamp,
        })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        resolve(history)
      }
      request.onerror = () => reject(new Error('Failed to get draft history'))
    })
  }

  async loadDraftHistory(id: string): Promise<DraftState | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.DRAFT_HISTORY)
      const request = store.get(id)

      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.draftState : null)
      }
      request.onerror = () => reject(new Error('Failed to load draft history'))
    })
  }

  // Utility operations
  async clearAllData(): Promise<void> {
    const storeNames = Object.values(STORES)
    const promises = storeNames.map(storeName => 
      new Promise<void>((resolve, reject) => {
        const store = this.getStore(storeName, 'readwrite')
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`))
      })
    )

    await Promise.all(promises)
  }

  async exportData(): Promise<string> {
    const [players, draftState, playerNotes] = await Promise.all([
      this.getAllPlayers(),
      this.getDraftState(),
      this.getAllPlayerNotes(),
    ])

    const exportData = {
      players,
      draftState,
      playerNotes,
      exportDate: new Date().toISOString(),
      version: DB_VERSION,
    }

    return JSON.stringify(exportData, null, 2)
  }

  async importData(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData)
      
      if (data.players && Array.isArray(data.players)) {
        await this.clearPlayers()
        await this.savePlayers(data.players)
      }

      if (data.draftState) {
        await this.saveDraftState(data.draftState)
      }

      if (data.playerNotes && Array.isArray(data.playerNotes)) {
        for (const note of data.playerNotes) {
          await this.savePlayerNote(note)
        }
      }

      return true
    } catch (error) {
      console.error('Failed to import data:', error)
      return false
    }
  }
}

// Singleton instance
export const db = new DatabaseManager()

// Initialize the database
export const initializeDatabase = async (): Promise<void> => {
  await db.initialize()
}