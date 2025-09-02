import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { PlayerNote, UserPreferences, Player } from '../types'

interface UserPreferencesStore extends UserPreferences {
  // Actions
  addPlayerNote: (playerId: string, note: string) => void
  updatePlayerNote: (playerId: string, updates: Partial<PlayerNote>) => void
  removePlayerNote: (playerId: string) => void
  setPlayerTarget: (playerId: string, isTarget: boolean) => void
  setPlayerAvoid: (playerId: string, isAvoid: boolean) => void
  setCustomRanking: (playerId: string, ranking: number) => void
  clearCustomRanking: (playerId: string) => void
  
  // Utility functions
  getPlayerNote: (playerId: string) => PlayerNote | undefined
  isPlayerTarget: (playerId: string) => boolean
  isPlayerAvoid: (playerId: string) => boolean
  getCustomRanking: (playerId: string) => number | undefined
  
  // Batch operations
  importPlayerNotes: (notes: PlayerNote[]) => void
  exportPlayerNotes: () => string
  clearAllNotes: () => void
  
  // Ranking calculations
  calculateAdjustedValue: (player: Player, baseValue: number) => number
}

const defaultPreferences: UserPreferences = {
  favoriteTeams: [],
  avoidTeams: [],
  playerNotes: [],
  draftStrategy: 'balanced',
  prioritizePositions: ['RB', 'WR'],
}

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...defaultPreferences,

        addPlayerNote: (playerId, note) => {
          const state = get()
          const existingNote = state.playerNotes.find(n => n.playerId === playerId)
          
          if (existingNote) {
            // Update existing note
            set({
              playerNotes: state.playerNotes.map(n =>
                n.playerId === playerId ? { ...n, note } : n
              ),
            })
          } else {
            // Add new note
            set({
              playerNotes: [
                ...state.playerNotes,
                {
                  playerId,
                  note,
                  isTarget: false,
                  isAvoid: false,
                },
              ],
            })
          }
        },

        updatePlayerNote: (playerId, updates) => {
          const state = get()
          set({
            playerNotes: state.playerNotes.map(n =>
              n.playerId === playerId ? { ...n, ...updates } : n
            ),
          })
        },

        removePlayerNote: (playerId) => {
          const state = get()
          set({
            playerNotes: state.playerNotes.filter(n => n.playerId !== playerId),
          })
        },

        setPlayerTarget: (playerId, isTarget) => {
          const state = get()
          const existingNote = state.playerNotes.find(n => n.playerId === playerId)
          
          if (existingNote) {
            get().updatePlayerNote(playerId, { isTarget, isAvoid: isTarget ? false : existingNote.isAvoid })
          } else {
            get().addPlayerNote(playerId, '')
            get().updatePlayerNote(playerId, { isTarget })
          }
        },

        setPlayerAvoid: (playerId, isAvoid) => {
          const state = get()
          const existingNote = state.playerNotes.find(n => n.playerId === playerId)
          
          if (existingNote) {
            get().updatePlayerNote(playerId, { isAvoid, isTarget: isAvoid ? false : existingNote.isTarget })
          } else {
            get().addPlayerNote(playerId, '')
            get().updatePlayerNote(playerId, { isAvoid })
          }
        },

        setCustomRanking: (playerId, ranking) => {
          const state = get()
          const existingNote = state.playerNotes.find(n => n.playerId === playerId)
          
          if (existingNote) {
            get().updatePlayerNote(playerId, { customRanking: ranking })
          } else {
            get().addPlayerNote(playerId, '')
            get().updatePlayerNote(playerId, { customRanking: ranking })
          }
        },

        clearCustomRanking: (playerId) => {
          get().updatePlayerNote(playerId, { customRanking: undefined })
        },

        // Utility functions
        getPlayerNote: (playerId) => {
          const state = get()
          return state.playerNotes.find(n => n.playerId === playerId)
        },

        isPlayerTarget: (playerId) => {
          const note = get().getPlayerNote(playerId)
          return note?.isTarget || false
        },

        isPlayerAvoid: (playerId) => {
          const note = get().getPlayerNote(playerId)
          return note?.isAvoid || false
        },

        getCustomRanking: (playerId) => {
          const note = get().getPlayerNote(playerId)
          return note?.customRanking
        },

        // Batch operations
        importPlayerNotes: (notes) => {
          set({ playerNotes: notes })
        },

        exportPlayerNotes: () => {
          const state = get()
          return JSON.stringify(state.playerNotes, null, 2)
        },

        clearAllNotes: () => {
          set({ playerNotes: [] })
        },

        // Ranking calculations
        calculateAdjustedValue: (player, baseValue) => {
          const state = get()
          const note = state.getPlayerNote(player.id)
          
          if (!note) return baseValue
          
          let adjustedValue = baseValue
          
          // Apply custom ranking if set
          if (note.customRanking !== undefined) {
            // Custom ranking overrides base value
            // Higher custom ranking = higher value
            adjustedValue = note.customRanking * 2 // Convert ranking to value scale
          }
          
          // Apply target/avoid adjustments
          if (note.isTarget) {
            adjustedValue *= 1.2 // 20% boost for targets
          } else if (note.isAvoid) {
            adjustedValue *= 0.6 // 40% penalty for avoid players
          }
          
          // Apply team preferences
          const favoriteBoost = state.favoriteTeams.includes(player.team) ? 1.1 : 1
          const avoidPenalty = state.avoidTeams.includes(player.team) ? 0.9 : 1
          
          adjustedValue *= favoriteBoost * avoidPenalty
          
          return Math.round(adjustedValue * 100) / 100
        },
      }),
      {
        name: 'user-preferences-store',
        version: 1,
      }
    ),
    {
      name: 'user-preferences-store',
    }
  )
)