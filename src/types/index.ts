// Player types and interfaces
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'DB' | 'DL' | 'LB'

export interface BasePlayer {
  id: string
  name: string
  team: string
  position: Position
  byeWeek: number
}

export interface OffensivePlayer extends BasePlayer {
  position: 'QB' | 'RB' | 'WR' | 'TE'
  vorp: number
  fps: number
  projectedStats: {
    passingYards?: number
    passingTDs?: number
    interceptions?: number
    rushingYards?: number
    rushingTDs?: number
    receptions?: number
    receivingYards?: number
    receivingTDs?: number
    fumbles?: number
  }
  adp?: number
  auctionValue?: number
}

export interface IDPPlayer extends BasePlayer {
  position: 'DB' | 'DL' | 'LB'
  tier: number
  projectedStats: {
    soloTackles?: number
    assistTackles?: number
    sacks?: number
    interceptions?: number
    forcedFumbles?: number
    fumbleRecoveries?: number
    defensiveTDs?: number
  }
}

export interface TeamDefensePlayer extends BasePlayer {
  position: 'DEF'
  projectedStats: {
    sacks?: number
    interceptions?: number
    fumbleRecoveries?: number
    defensiveTDs?: number
    safeties?: number
    pointsAllowed?: number
  }
}

export interface KickerPlayer extends BasePlayer {
  position: 'K'
  projectedStats: {
    fieldGoals?: number
    fieldGoalAttempts?: number
    extraPoints?: number
    extraPointAttempts?: number
  }
}

export type Player = OffensivePlayer | IDPPlayer | TeamDefensePlayer | KickerPlayer

// Draft state interfaces
export interface DraftPick {
  pickNumber: number
  teamIndex: number
  player?: Player
  timestamp?: Date
}

export interface DraftTeam {
  id: string
  name: string
  roster: Player[]
  isUser: boolean
}

export interface DraftSettings {
  numberOfTeams: number
  userTeamIndex: number
  draftType: 'snake' | 'linear'
  pickTimeLimit: number // in seconds
  rosterPositions: {
    QB: number
    RB: number
    WR: number
    TE: number
    'W-R-T': number // flex positions
    K: number
    DEF: number
    DB: number
    DL: number
    LB: number
    BN: number // bench
    IR: number // injured reserve
  }
}

export interface LeagueSettings {
  scoringSystem: {
    passing: {
      yardsPerPoint: number
      tdPoints: number
      interceptionPenalty: number
      yardBonus: { threshold: number; points: number }[]
    }
    rushing: {
      yardsPerPoint: number
      tdPoints: number
      yardBonus: { threshold: number; points: number }[]
    }
    receiving: {
      yardsPerPoint: number
      tdPoints: number
      receptionPoints: number
      yardBonus: { threshold: number; points: number }[]
    }
    kicking: {
      fieldGoals: { minYards: number; maxYards: number; points: number }[]
      missedFieldGoals: { minYards: number; maxYards: number; penalty: number }[]
      extraPoints: number
    }
    teamDefense: {
      sack: number
      interception: number
      fumbleRecovery: number
      touchdown: number
      safety: number
      pointsAllowed: { minPoints: number; maxPoints: number; points: number }[]
    }
    idp: {
      soloTackle: number
      assistTackle: number
      sack: number
      interception: number
      forcedFumble: number
      fumbleRecovery: number
      touchdown: number
      safety: number
    }
  }
}

// Draft state and recommendations
export interface DraftState {
  isActive: boolean
  currentPick: number
  currentTeamIndex: number
  picks: DraftPick[]
  timeRemaining: number
  teams: DraftTeam[]
}

export interface PlayerRecommendation {
  player: Player
  reason: string
  value: number
  reach: boolean
  positionalNeed: 'high' | 'medium' | 'low'
  handcuffOf?: string
  stacksWith?: string
}

// User preferences and notes
export interface PlayerNote {
  playerId: string
  note: string
  isTarget: boolean
  isAvoid: boolean
  customRanking?: number
}

export interface UserPreferences {
  favoriteTeams: string[]
  avoidTeams: string[]
  playerNotes: PlayerNote[]
  draftStrategy: 'conservative' | 'balanced' | 'aggressive'
  prioritizePositions: Position[]
}