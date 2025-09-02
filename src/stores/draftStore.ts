import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { 
  DraftState, 
  DraftSettings, 
  DraftTeam, 
  DraftPick, 
  Player, 
  PlayerRecommendation 
} from '../types'

interface DraftStore extends DraftState {
  settings: DraftSettings | null
  availablePlayers: Player[]
  recommendations: PlayerRecommendation[]
  
  // Actions
  initializeDraft: (settings: DraftSettings, teams: DraftTeam[], players: Player[]) => void
  startDraft: () => void
  pauseDraft: () => void
  makePick: (player: Player) => void
  undoLastPick: () => void
  updateTimer: (timeRemaining: number) => void
  generateRecommendations: () => void
  markPlayerAsDrafted: (player: Player, teamIndex: number) => void
  resetDraft: () => void
}

const initialState: DraftState = {
  isActive: false,
  currentPick: 1,
  currentTeamIndex: 0,
  picks: [],
  timeRemaining: 120, // 2 minutes default
  teams: [],
}

export const useDraftStore = create<DraftStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        settings: null,
        availablePlayers: [],
        recommendations: [],

        initializeDraft: (settings, teams, players) => {
          set({
            settings,
            teams,
            availablePlayers: players,
            picks: [],
            currentPick: 1,
            currentTeamIndex: 0,
            timeRemaining: settings.pickTimeLimit,
            isActive: false,
          })
          get().generateRecommendations()
        },

        startDraft: () => {
          set({ isActive: true })
        },

        pauseDraft: () => {
          set({ isActive: false })
        },

        makePick: (player) => {
          const state = get()
          if (!state.settings) return

          const newPick: DraftPick = {
            pickNumber: state.currentPick,
            teamIndex: state.currentTeamIndex,
            player,
            timestamp: new Date(),
          }

          // Add player to team roster
          const updatedTeams = state.teams.map((team, index) => {
            if (index === state.currentTeamIndex) {
              return {
                ...team,
                roster: [...team.roster, player],
              }
            }
            return team
          })

          // Remove player from available players
          const updatedAvailablePlayers = state.availablePlayers.filter(
            p => p.id !== player.id
          )

          // Calculate next pick
          const totalTeams = state.settings.numberOfTeams
          let nextPick = state.currentPick + 1
          let nextTeamIndex: number

          if (state.settings.draftType === 'snake') {
            const round = Math.ceil(state.currentPick / totalTeams)
            const pickInRound = ((state.currentPick - 1) % totalTeams) + 1
            
            if (round % 2 === 1) {
              // Odd round: 1, 2, 3, ..., totalTeams
              nextTeamIndex = pickInRound === totalTeams ? totalTeams - 1 : pickInRound
            } else {
              // Even round: totalTeams, totalTeams-1, ..., 1
              nextTeamIndex = pickInRound === totalTeams ? 0 : totalTeams - pickInRound
            }
          } else {
            // Linear draft
            nextTeamIndex = (state.currentTeamIndex + 1) % totalTeams
          }

          set({
            picks: [...state.picks, newPick],
            teams: updatedTeams,
            availablePlayers: updatedAvailablePlayers,
            currentPick: nextPick,
            currentTeamIndex: nextTeamIndex,
            timeRemaining: state.settings.pickTimeLimit,
          })

          get().generateRecommendations()
        },

        undoLastPick: () => {
          const state = get()
          if (state.picks.length === 0) return

          const lastPick = state.picks[state.picks.length - 1]
          if (!lastPick.player) return

          // Remove last pick
          const updatedPicks = state.picks.slice(0, -1)
          
          // Remove player from team roster
          const updatedTeams = state.teams.map((team, index) => {
            if (index === lastPick.teamIndex) {
              return {
                ...team,
                roster: team.roster.filter(p => p.id !== lastPick.player!.id),
              }
            }
            return team
          })

          // Add player back to available players
          const updatedAvailablePlayers = [...state.availablePlayers, lastPick.player]
            .sort((a, b) => a.name.localeCompare(b.name))

          set({
            picks: updatedPicks,
            teams: updatedTeams,
            availablePlayers: updatedAvailablePlayers,
            currentPick: lastPick.pickNumber,
            currentTeamIndex: lastPick.teamIndex,
          })

          get().generateRecommendations()
        },

        updateTimer: (timeRemaining) => {
          set({ timeRemaining })
        },

        generateRecommendations: () => {
          const state = get()
          if (!state.settings || state.teams.length === 0) return

          const userTeam = state.teams[state.settings.userTeamIndex]
          const recommendations: PlayerRecommendation[] = []

          // Simple recommendation logic (to be enhanced later)
          const topPlayers = state.availablePlayers
            .filter(p => 'vorp' in p)
            .sort((a, b) => {
              const aVorp = 'vorp' in a ? a.vorp : 0
              const bVorp = 'vorp' in b ? b.vorp : 0
              return bVorp - aVorp
            })
            .slice(0, 5)

          topPlayers.forEach(player => {
            const positionCount = userTeam.roster.filter(p => p.position === player.position).length
            const maxPositionCount = state.settings!.rosterPositions[player.position] || 0
            
            recommendations.push({
              player,
              reason: 'vorp' in player ? `High VORP (${player.vorp.toFixed(1)})` : 'Top available',
              value: 'vorp' in player ? player.vorp : 0,
              reach: false,
              positionalNeed: positionCount < maxPositionCount ? 'high' : 'low',
            })
          })

          set({ recommendations })
        },

        markPlayerAsDrafted: (player, teamIndex) => {
          const state = get()
          
          // Remove from available players
          const updatedAvailablePlayers = state.availablePlayers.filter(
            p => p.id !== player.id
          )

          // Add to team roster if teamIndex is provided
          let updatedTeams = state.teams
          if (teamIndex >= 0 && teamIndex < state.teams.length) {
            updatedTeams = state.teams.map((team, index) => {
              if (index === teamIndex) {
                return {
                  ...team,
                  roster: [...team.roster, player],
                }
              }
              return team
            })
          }

          set({
            availablePlayers: updatedAvailablePlayers,
            teams: updatedTeams,
          })

          get().generateRecommendations()
        },

        resetDraft: () => {
          set({
            ...initialState,
            settings: null,
            availablePlayers: [],
            recommendations: [],
          })
        },
      }),
      {
        name: 'draft-store',
        version: 1,
      }
    ),
    {
      name: 'draft-store',
    }
  )
)