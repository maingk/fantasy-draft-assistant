import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { LeagueSettings, DraftSettings } from '../types'

interface SettingsStore {
  leagueSettings: LeagueSettings
  draftSettings: DraftSettings | null
  appSettings: {
    theme: 'dark' | 'light'
    soundEnabled: boolean
    notificationsEnabled: boolean
    autoAdvance: boolean
    showRecommendationReasons: boolean
    defaultPickTime: number
  }

  // Actions
  updateLeagueSettings: (settings: Partial<LeagueSettings>) => void
  updateDraftSettings: (settings: Partial<DraftSettings>) => void
  updateAppSettings: (settings: Partial<SettingsStore['appSettings']>) => void
  resetToDefaults: () => void
  exportSettings: () => string
  importSettings: (settingsJson: string) => boolean
}

const defaultLeagueSettings: LeagueSettings = {
  scoringSystem: {
    passing: {
      yardsPerPoint: 50,
      tdPoints: 6,
      interceptionPenalty: -2,
      yardBonus: [{ threshold: 300, points: 2 }],
    },
    rushing: {
      yardsPerPoint: 15,
      tdPoints: 6,
      yardBonus: [{ threshold: 100, points: 1 }],
    },
    receiving: {
      yardsPerPoint: 15,
      tdPoints: 6,
      receptionPoints: 0.5, // Half-PPR
      yardBonus: [{ threshold: 100, points: 1 }],
    },
    kicking: {
      fieldGoals: [
        { minYards: 0, maxYards: 39, points: 3 },
        { minYards: 40, maxYards: 49, points: 4 },
        { minYards: 50, maxYards: 99, points: 5 },
      ],
      missedFieldGoals: [
        { minYards: 0, maxYards: 19, penalty: -3 },
        { minYards: 20, maxYards: 29, penalty: -2 },
        { minYards: 30, maxYards: 39, penalty: -1 },
      ],
      extraPoints: 1,
    },
    teamDefense: {
      sack: 2,
      interception: 2,
      fumbleRecovery: 2,
      touchdown: 6,
      safety: 2,
      pointsAllowed: [
        { minPoints: 0, maxPoints: 0, points: 10 },
        { minPoints: 1, maxPoints: 6, points: 7 },
        { minPoints: 7, maxPoints: 13, points: 4 },
        { minPoints: 14, maxPoints: 20, points: 1 },
        { minPoints: 21, maxPoints: 27, points: 0 },
        { minPoints: 28, maxPoints: 34, points: -1 },
        { minPoints: 35, maxPoints: 999, points: -4 },
      ],
    },
    idp: {
      soloTackle: 1,
      assistTackle: 0.5,
      sack: 3,
      interception: 3.5,
      forcedFumble: 1,
      fumbleRecovery: 1,
      touchdown: 6,
      safety: 2,
    },
  },
}

const defaultDraftSettings: DraftSettings = {
  numberOfTeams: 14,
  userTeamIndex: 0,
  draftType: 'snake',
  pickTimeLimit: 120, // 2 minutes
  rosterPositions: {
    QB: 1,
    RB: 1,
    WR: 2,
    TE: 1,
    'W-R-T': 2, // flex positions
    K: 1,
    DEF: 1,
    DB: 1,
    DL: 1,
    LB: 1,
    BN: 6, // bench
    IR: 1, // injured reserve
  },
}

const defaultAppSettings = {
  theme: 'dark' as const,
  soundEnabled: true,
  notificationsEnabled: true,
  autoAdvance: false,
  showRecommendationReasons: true,
  defaultPickTime: 120,
}

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set, get) => ({
        leagueSettings: defaultLeagueSettings,
        draftSettings: defaultDraftSettings,
        appSettings: defaultAppSettings,

        updateLeagueSettings: (settings) => {
          const current = get().leagueSettings
          set({
            leagueSettings: {
              ...current,
              ...settings,
              scoringSystem: {
                ...current.scoringSystem,
                ...(settings.scoringSystem && {
                  passing: { ...current.scoringSystem.passing, ...settings.scoringSystem.passing },
                  rushing: { ...current.scoringSystem.rushing, ...settings.scoringSystem.rushing },
                  receiving: { ...current.scoringSystem.receiving, ...settings.scoringSystem.receiving },
                  kicking: { ...current.scoringSystem.kicking, ...settings.scoringSystem.kicking },
                  teamDefense: { ...current.scoringSystem.teamDefense, ...settings.scoringSystem.teamDefense },
                  idp: { ...current.scoringSystem.idp, ...settings.scoringSystem.idp },
                }),
              },
            },
          })
        },

        updateDraftSettings: (settings) => {
          const current = get().draftSettings || defaultDraftSettings
          set({
            draftSettings: {
              ...current,
              ...settings,
              rosterPositions: {
                ...current.rosterPositions,
                ...(settings.rosterPositions || {}),
              },
            },
          })
        },

        updateAppSettings: (settings) => {
          set({
            appSettings: {
              ...get().appSettings,
              ...settings,
            },
          })
        },

        resetToDefaults: () => {
          set({
            leagueSettings: defaultLeagueSettings,
            draftSettings: defaultDraftSettings,
            appSettings: defaultAppSettings,
          })
        },

        exportSettings: () => {
          const state = get()
          return JSON.stringify({
            leagueSettings: state.leagueSettings,
            draftSettings: state.draftSettings,
            appSettings: state.appSettings,
          }, null, 2)
        },

        importSettings: (settingsJson) => {
          try {
            const parsed = JSON.parse(settingsJson)
            if (parsed.leagueSettings) {
              get().updateLeagueSettings(parsed.leagueSettings)
            }
            if (parsed.draftSettings) {
              get().updateDraftSettings(parsed.draftSettings)
            }
            if (parsed.appSettings) {
              get().updateAppSettings(parsed.appSettings)
            }
            return true
          } catch (error) {
            console.error('Failed to import settings:', error)
            return false
          }
        },
      }),
      {
        name: 'settings-store',
        version: 1,
      }
    ),
    {
      name: 'settings-store',
    }
  )
)