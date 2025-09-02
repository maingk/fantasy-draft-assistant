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

          // Get user preferences functions (we'll access the store state directly)
          const userPreferencesStore = (window as any).userPreferencesStore
          if (!userPreferencesStore) {
            // Fallback to simple logic if preferences not available
            const topPlayers = state.availablePlayers
              .filter(p => 'vorp' in p || 'fps' in p)
              .sort((a, b) => {
                const aValue = 'vorp' in a ? (a as any).vorp : ('fps' in a ? (a as any).fps : 0)
                const bValue = 'vorp' in b ? (b as any).vorp : ('fps' in b ? (b as any).fps : 0)
                return bValue - aValue
              })
              .slice(0, 8)

            topPlayers.forEach(player => {
              const positionCount = userTeam.roster.filter(p => p.position === player.position).length
              const maxPositionCount = state.settings!.rosterPositions[player.position] || 0
              
              recommendations.push({
                player,
                reason: 'vorp' in player ? `High VORP (${(player as any).vorp.toFixed(1)})` : 'Top available',
                value: 'vorp' in player ? (player as any).vorp : ('fps' in player ? (player as any).fps : 0),
                reach: false,
                positionalNeed: positionCount < maxPositionCount ? 'high' : 'low',
              })
            })
          } else {
            // Enhanced logic with user preferences
            const userPrefs = userPreferencesStore.getState()
            
            // Calculate adjusted values and positional needs for all available players
            const rankedPlayers = state.availablePlayers
              .map(player => {
                const baseValue = 'vorp' in player ? (player as any).vorp : ('fps' in player ? (player as any).fps : 0)
                const adjustedValue = userPrefs.calculateAdjustedValue(player, baseValue)
                const customRanking = userPrefs.getCustomRanking(player.id)
                const isTarget = userPrefs.isPlayerTarget(player.id)
                const isAvoid = userPrefs.isPlayerAvoid(player.id)
                const playerNote = userPrefs.getPlayerNote(player.id)
                
                // Calculate positional need
                const positionCount = userTeam.roster.filter(p => p.position === player.position).length
                const maxPositionCount = state.settings!.rosterPositions[player.position] || 0
                const flexCount = userTeam.roster.filter(p => ['RB', 'WR', 'TE'].includes(p.position)).length
                const maxFlexCount = (state.settings!.rosterPositions['RB'] || 0) + 
                                   (state.settings!.rosterPositions['WR'] || 0) + 
                                   (state.settings!.rosterPositions['TE'] || 0) + 
                                   (state.settings!.rosterPositions['W-R-T'] || 0)
                
                const isPositionFilled = positionCount >= maxPositionCount
                const isFlexEligible = ['RB', 'WR', 'TE'].includes(player.position)
                const canFillFlex = isFlexEligible && flexCount < maxFlexCount
                const shouldFilter = isPositionFilled && (!isFlexEligible || !canFillFlex)
                
                return {
                  player,
                  baseValue,
                  adjustedValue,
                  customRanking,
                  isTarget,
                  isAvoid,
                  playerNote,
                  positionCount,
                  maxPositionCount,
                  isPositionFilled,
                  shouldFilter
                }
              })
              .filter(p => {
                // Always filter avoid players
                if (p.isAvoid) return false
                
                // Don't filter targets or custom ranked players even if position is filled
                if (p.isTarget || p.customRanking) return true
                
                // Filter out players whose position is completely filled
                return !p.shouldFilter
              })
              .sort((a, b) => {
                // Prioritize targets and custom rankings
                if (a.isTarget && !b.isTarget) return -1
                if (!a.isTarget && b.isTarget) return 1
                
                // Boost players who fill needs
                const aNeed = a.isPositionFilled ? 0 : 1
                const bNeed = b.isPositionFilled ? 0 : 1
                if (aNeed !== bNeed) return bNeed - aNeed
                
                // Then by adjusted value
                return b.adjustedValue - a.adjustedValue
              })
              .slice(0, 8)

            rankedPlayers.forEach(({ player, adjustedValue, customRanking, isTarget, playerNote, positionCount, maxPositionCount, isPositionFilled }) => {
              let reason = ''
              if (customRanking) {
                reason = `Your #${customRanking} ranking`
              } else if (isTarget) {
                reason = `Target player (${adjustedValue.toFixed(1)} adj. value)`
              } else if ('vorp' in player && (player as any).vorp > 0) {
                reason = `High VORP (${(player as any).vorp.toFixed(1)})`
              } else if ('fps' in player && (player as any).fps > 0) {
                reason = `High FPS (${(player as any).fps.toFixed(1)})`
              } else {
                reason = 'Top available'
              }
              
              // Add positional need context
              const needsPosition = positionCount < maxPositionCount
              const isFlexEligible = ['RB', 'WR', 'TE'].includes(player.position)
              
              if (needsPosition) {
                reason += ` • Need ${player.position} (${positionCount}/${maxPositionCount})`
              } else if (isFlexEligible) {
                reason += ` • Flex eligible`
              } else if (isPositionFilled) {
                reason += ` • Position filled (${positionCount}/${maxPositionCount})`
              }
              
              // Add note excerpt if available
              if (playerNote?.note) {
                const noteExcerpt = playerNote.note.length > 40 
                  ? playerNote.note.substring(0, 40) + '...' 
                  : playerNote.note
                reason += ` • "${noteExcerpt}"`
              }
              
              recommendations.push({
                player,
                reason,
                value: adjustedValue,
                reach: customRanking ? customRanking > state.currentPick : false,
                positionalNeed: needsPosition ? 'high' : isFlexEligible ? 'medium' : 'low',
              })
            })
          }

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

          // Record the pick in draft history
          const newPick: DraftPick = {
            pickNumber: state.currentPick,
            teamIndex: teamIndex,
            player: player,
            timestamp: new Date(),
          }

          // Calculate next pick based on draft type
          const nextPick = state.currentPick + 1
          let nextTeamIndex = teamIndex

          if (state.settings) {
            if (state.settings.draftType === 'snake') {
              // Snake draft logic - calculate for the NEXT pick
              const nextRound = Math.floor((nextPick - 1) / state.settings.numberOfTeams)
              const nextPositionInRound = (nextPick - 1) % state.settings.numberOfTeams
              
              if (nextRound % 2 === 0) {
                // Even rounds (0, 2, 4...): normal order (0, 1, 2, ..., n-1)
                nextTeamIndex = nextPositionInRound
              } else {
                // Odd rounds (1, 3, 5...): reverse order (n-1, n-2, ..., 1, 0)
                nextTeamIndex = state.settings.numberOfTeams - 1 - nextPositionInRound
              }
            } else {
              // Linear draft: same order every round
              nextTeamIndex = (teamIndex + 1) % state.settings.numberOfTeams
            }
          }

          set({
            availablePlayers: updatedAvailablePlayers,
            teams: updatedTeams,
            picks: [...state.picks, newPick],
            currentPick: nextPick,
            currentTeamIndex: nextTeamIndex,
            timeRemaining: state.settings?.pickTimeLimit || 120,
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