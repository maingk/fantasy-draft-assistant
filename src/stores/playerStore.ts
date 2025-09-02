import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { Player, OffensivePlayer, IDPPlayer, TeamDefensePlayer, KickerPlayer, PlayerNote, UserPreferences } from '../types'

interface PlayerStore {
  allPlayers: Player[]
  offensivePlayers: OffensivePlayer[]
  idpPlayers: IDPPlayer[]
  teamDefensePlayers: TeamDefensePlayer[]
  kickerPlayers: KickerPlayer[]
  userPreferences: UserPreferences
  isDataLoaded: boolean

  // Actions
  loadPlayersFromCSV: (csvData: any[], type: 'offensive' | 'idp' | 'teamdef' | 'kicker') => void
  setAllPlayers: (players: Player[]) => void
  addPlayerNote: (note: PlayerNote) => void
  removePlayerNote: (playerId: string) => void
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void
  getPlayerById: (id: string) => Player | undefined
  getPlayersByPosition: (position: string) => Player[]
  searchPlayers: (query: string) => Player[]
  filterAvailablePlayers: (draftedPlayerIds: string[]) => Player[]
  clearAllData: () => void
}

const initialUserPreferences: UserPreferences = {
  favoriteTeams: ['PIT'], // Default Steelers preference
  avoidTeams: ['BAL'], // Avoid Ravens except Derrick Henry
  playerNotes: [
    {
      playerId: 'lamar-jackson',
      note: 'Avoid - Baltimore Ravens player',
      isTarget: false,
      isAvoid: true,
    },
    {
      playerId: 'derrick-henry',
      note: 'Exception - Only Ravens player to consider',
      isTarget: true,
      isAvoid: false,
    },
  ],
  draftStrategy: 'balanced',
  prioritizePositions: ['RB', 'WR', 'QB'],
}

export const usePlayerStore = create<PlayerStore>()(
  devtools(
    persist(
      (set, get) => ({
        allPlayers: [],
        offensivePlayers: [],
        idpPlayers: [],
        teamDefensePlayers: [],
        kickerPlayers: [],
        userPreferences: initialUserPreferences,
        isDataLoaded: false,

        loadPlayersFromCSV: (csvData, type) => {
          const state = get()
          let newPlayers: Player[] = []

          switch (type) {
            case 'offensive':
              newPlayers = csvData.map((row, index) => ({
                id: `${type}-${index}`,
                name: row['Player'] || row['OVERALL PLAYER'] || '',
                team: row['TM'] || row['Team'] || '',
                position: row['POS'] || row['Position'] || '',
                byeWeek: parseInt(row['BYE']) || parseInt(row['BYE WEEK']) || 0,
                vorp: parseFloat(row['VORP']) || 0,
                fps: parseFloat(row['FPS']) || 0,
                projectedStats: {
                  passingYards: parseFloat(row['PASS YARDS']) || 0,
                  passingTDs: parseFloat(row['PASS TD']) || 0,
                  interceptions: parseFloat(row['INT']) || 0,
                  rushingYards: parseFloat(row['RUSH YARDS']) || 0,
                  rushingTDs: parseFloat(row['RUSH TD']) || 0,
                  receptions: parseFloat(row['REC']) || 0,
                  receivingYards: parseFloat(row['REC YARDS']) || 0,
                  receivingTDs: parseFloat(row['REC TD']) || 0,
                },
                adp: parseFloat(row['ADP']) || 0,
                auctionValue: parseFloat(row['AUC$']) || 0,
              })) as OffensivePlayer[]
              
              set({ 
                offensivePlayers: newPlayers as OffensivePlayer[],
                allPlayers: [...state.allPlayers.filter(p => !['QB', 'RB', 'WR', 'TE'].includes(p.position)), ...newPlayers]
              })
              break

            case 'idp':
              newPlayers = csvData.map((row, index) => ({
                id: `${type}-${index}`,
                name: row['PLAYER NAME'] || '',
                team: row['TEAM'] || '',
                position: row['POS']?.includes('LB') ? 'LB' : row['POS']?.includes('DE') || row['POS']?.includes('DT') ? 'DL' : 'DB',
                byeWeek: parseInt(row['BYE WEEK']) || 0,
                tier: parseInt(row['TIERS']) || 1,
                projectedStats: {
                  soloTackles: 0, // These would need to be added to CSV or calculated
                  assistTackles: 0,
                  sacks: 0,
                  interceptions: 0,
                  forcedFumbles: 0,
                  fumbleRecoveries: 0,
                  defensiveTDs: 0,
                },
              })) as IDPPlayer[]
              
              set({ 
                idpPlayers: newPlayers as IDPPlayer[],
                allPlayers: [...state.allPlayers.filter(p => !['DB', 'DL', 'LB'].includes(p.position)), ...newPlayers]
              })
              break

            case 'teamdef':
              // Handle team defense data
              break

            case 'kicker':
              // Handle kicker data
              break
          }

          set({ isDataLoaded: true })
        },

        setAllPlayers: (players) => {
          set({ 
            allPlayers: players,
            isDataLoaded: true,
          })
        },

        addPlayerNote: (note) => {
          const state = get()
          const existingNoteIndex = state.userPreferences.playerNotes.findIndex(
            n => n.playerId === note.playerId
          )
          
          const updatedNotes = existingNoteIndex >= 0
            ? state.userPreferences.playerNotes.map((n, index) => 
                index === existingNoteIndex ? note : n
              )
            : [...state.userPreferences.playerNotes, note]

          set({
            userPreferences: {
              ...state.userPreferences,
              playerNotes: updatedNotes,
            },
          })
        },

        removePlayerNote: (playerId) => {
          const state = get()
          set({
            userPreferences: {
              ...state.userPreferences,
              playerNotes: state.userPreferences.playerNotes.filter(
                note => note.playerId !== playerId
              ),
            },
          })
        },

        updateUserPreferences: (preferences) => {
          const state = get()
          set({
            userPreferences: {
              ...state.userPreferences,
              ...preferences,
            },
          })
        },

        getPlayerById: (id) => {
          return get().allPlayers.find(player => player.id === id)
        },

        getPlayersByPosition: (position) => {
          return get().allPlayers.filter(player => player.position === position)
        },

        searchPlayers: (query) => {
          const lowerQuery = query.toLowerCase()
          return get().allPlayers.filter(player =>
            player.name.toLowerCase().includes(lowerQuery) ||
            player.team.toLowerCase().includes(lowerQuery) ||
            player.position.toLowerCase().includes(lowerQuery)
          )
        },

        filterAvailablePlayers: (draftedPlayerIds) => {
          return get().allPlayers.filter(player => 
            !draftedPlayerIds.includes(player.id)
          )
        },

        clearAllData: () => {
          set({
            allPlayers: [],
            offensivePlayers: [],
            idpPlayers: [],
            teamDefensePlayers: [],
            kickerPlayers: [],
            isDataLoaded: false,
          })
        },
      }),
      {
        name: 'player-store',
        version: 1,
      }
    ),
    {
      name: 'player-store',
    }
  )
)