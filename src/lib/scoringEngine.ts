import { Player, OffensivePlayer, IDPPlayer, TeamDefensePlayer, KickerPlayer, LeagueSettings } from '../types'

export interface WeeklyProjection {
  playerId: string
  week: number
  projectedPoints: number
  breakdown: {
    passing?: number
    rushing?: number
    receiving?: number
    kicking?: number
    defense?: number
    idp?: number
  }
}

export interface SeasonProjection {
  playerId: string
  totalPoints: number
  averagePoints: number
  breakdown: {
    passing: number
    rushing: number
    receiving: number
    kicking: number
    defense: number
    idp: number
  }
}

export class ScoringEngine {
  private settings: LeagueSettings

  constructor(settings: LeagueSettings) {
    this.settings = settings
  }

  // Calculate projected points for a single week
  calculateWeeklyPoints(player: Player, _week: number = 1): number {
    switch (player.position) {
      case 'QB':
      case 'RB':
      case 'WR':
      case 'TE':
        return this.calculateOffensivePoints(player as OffensivePlayer)
      case 'K':
        return this.calculateKickerPoints(player as KickerPlayer)
      case 'DEF':
        return this.calculateDefensePoints(player as TeamDefensePlayer)
      case 'DB':
      case 'DL':
      case 'LB':
        return this.calculateIDPPoints(player as IDPPlayer)
      default:
        return 0
    }
  }

  // Calculate season-long projected points
  calculateSeasonPoints(player: Player, gamesPlayed: number = 17): SeasonProjection {
    const weeklyPoints = this.calculateWeeklyPoints(player)
    const totalPoints = weeklyPoints * gamesPlayed
    
    const breakdown = {
      passing: 0,
      rushing: 0,
      receiving: 0,
      kicking: 0,
      defense: 0,
      idp: 0,
    }

    // Calculate breakdown based on position
    switch (player.position) {
      case 'QB':
        const qb = player as OffensivePlayer
        breakdown.passing = this.calculatePassingPoints(qb.projectedStats) * gamesPlayed
        breakdown.rushing = this.calculateRushingPoints(qb.projectedStats) * gamesPlayed
        break
      case 'RB':
        const rb = player as OffensivePlayer
        breakdown.rushing = this.calculateRushingPoints(rb.projectedStats) * gamesPlayed
        breakdown.receiving = this.calculateReceivingPoints(rb.projectedStats) * gamesPlayed
        break
      case 'WR':
      case 'TE':
        const receiver = player as OffensivePlayer
        breakdown.receiving = this.calculateReceivingPoints(receiver.projectedStats) * gamesPlayed
        break
      case 'K':
        breakdown.kicking = totalPoints
        break
      case 'DEF':
        breakdown.defense = totalPoints
        break
      case 'DB':
      case 'DL':
      case 'LB':
        breakdown.idp = totalPoints
        break
    }

    return {
      playerId: player.id,
      totalPoints,
      averagePoints: weeklyPoints,
      breakdown,
    }
  }

  private calculateOffensivePoints(player: OffensivePlayer): number {
    const stats = player.projectedStats
    let points = 0

    // Passing points
    points += this.calculatePassingPoints(stats)
    
    // Rushing points  
    points += this.calculateRushingPoints(stats)
    
    // Receiving points
    points += this.calculateReceivingPoints(stats)
    
    // Fumbles
    points += (stats.fumbles || 0) * -2

    return Math.round(points * 100) / 100
  }

  private calculatePassingPoints(stats: any): number {
    let points = 0
    const scoring = this.settings.scoringSystem.passing

    // Passing yards
    if (stats.passingYards) {
      points += Math.floor(stats.passingYards / scoring.yardsPerPoint)
      
      // Yard bonuses
      scoring.yardBonus.forEach(bonus => {
        if (stats.passingYards >= bonus.threshold) {
          points += bonus.points
        }
      })
    }

    // Passing TDs
    points += (stats.passingTDs || 0) * scoring.tdPoints

    // Interceptions
    points += (stats.interceptions || 0) * scoring.interceptionPenalty

    return points
  }

  private calculateRushingPoints(stats: any): number {
    let points = 0
    const scoring = this.settings.scoringSystem.rushing

    // Rushing yards
    if (stats.rushingYards) {
      points += Math.floor(stats.rushingYards / scoring.yardsPerPoint)
      
      // Yard bonuses
      scoring.yardBonus.forEach(bonus => {
        if (stats.rushingYards >= bonus.threshold) {
          points += bonus.points
        }
      })
    }

    // Rushing TDs
    points += (stats.rushingTDs || 0) * scoring.tdPoints

    return points
  }

  private calculateReceivingPoints(stats: any): number {
    let points = 0
    const scoring = this.settings.scoringSystem.receiving

    // Receptions (PPR)
    points += (stats.receptions || 0) * scoring.receptionPoints

    // Receiving yards
    if (stats.receivingYards) {
      points += Math.floor(stats.receivingYards / scoring.yardsPerPoint)
      
      // Yard bonuses
      scoring.yardBonus.forEach(bonus => {
        if (stats.receivingYards >= bonus.threshold) {
          points += bonus.points
        }
      })
    }

    // Receiving TDs
    points += (stats.receivingTDs || 0) * scoring.tdPoints

    return points
  }

  private calculateKickerPoints(player: KickerPlayer): number {
    const stats = player.projectedStats
    let points = 0
    const scoring = this.settings.scoringSystem.kicking

    // Field goals (estimate distribution by distance)
    const fieldGoals = stats.fieldGoals || 0
    const shortFG = Math.round(fieldGoals * 0.5) // 50% short (0-39)
    const mediumFG = Math.round(fieldGoals * 0.35) // 35% medium (40-49)
    const longFG = Math.round(fieldGoals * 0.15) // 15% long (50+)

    scoring.fieldGoals.forEach(range => {
      if (range.minYards === 0) points += shortFG * range.points
      else if (range.minYards === 40) points += mediumFG * range.points
      else if (range.minYards === 50) points += longFG * range.points
    })

    // Extra points
    points += (stats.extraPoints || 0) * scoring.extraPoints

    // Missed field goal penalties (estimate 10% miss rate)
    const missedFG = Math.round((stats.fieldGoalAttempts || fieldGoals) * 0.1)
    const shortMissed = Math.round(missedFG * 0.3)
    const mediumMissed = Math.round(missedFG * 0.7)

    scoring.missedFieldGoals.forEach(range => {
      if (range.minYards === 0) points += shortMissed * range.penalty
      else if (range.minYards === 20) points += mediumMissed * range.penalty
    })

    return Math.round(points * 100) / 100
  }

  private calculateDefensePoints(player: TeamDefensePlayer): number {
    const stats = player.projectedStats
    let points = 0
    const scoring = this.settings.scoringSystem.teamDefense

    // Big plays
    points += (stats.sacks || 0) * scoring.sack
    points += (stats.interceptions || 0) * scoring.interception
    points += (stats.fumbleRecoveries || 0) * scoring.fumbleRecovery
    points += (stats.defensiveTDs || 0) * scoring.touchdown
    points += (stats.safeties || 0) * scoring.safety

    // Points allowed (use average points allowed per game)
    const pointsAllowed = stats.pointsAllowed || 21 // default average
    scoring.pointsAllowed.forEach(range => {
      if (pointsAllowed >= range.minPoints && pointsAllowed <= range.maxPoints) {
        points += range.points
      }
    })

    return Math.round(points * 100) / 100
  }

  private calculateIDPPoints(player: IDPPlayer): number {
    const stats = player.projectedStats
    let points = 0
    const scoring = this.settings.scoringSystem.idp

    // Basic IDP scoring
    points += (stats.soloTackles || 0) * scoring.soloTackle
    points += (stats.assistTackles || 0) * scoring.assistTackle
    points += (stats.sacks || 0) * scoring.sack
    points += (stats.interceptions || 0) * scoring.interception
    points += (stats.forcedFumbles || 0) * scoring.forcedFumble
    points += (stats.fumbleRecoveries || 0) * scoring.fumbleRecovery
    points += (stats.defensiveTDs || 0) * scoring.touchdown

    return Math.round(points * 100) / 100
  }

  // Calculate Value Over Replacement Player (VORP)
  calculateVORP(player: Player, positionPlayers: Player[]): number {
    const playerPoints = this.calculateWeeklyPoints(player)
    
    // Find replacement level (average of players ranked 24-36 at position for 14-team league)
    const sortedByPoints = positionPlayers
      .map(p => ({ player: p, points: this.calculateWeeklyPoints(p) }))
      .sort((a, b) => b.points - a.points)
    
    const startIndex = Math.max(0, Math.min(23, sortedByPoints.length - 13))
    const endIndex = Math.max(startIndex + 1, Math.min(35, sortedByPoints.length - 1))
    
    const replacementLevelPlayers = sortedByPoints.slice(startIndex, endIndex + 1)
    const replacementLevel = replacementLevelPlayers.length > 0 
      ? replacementLevelPlayers.reduce((sum, p) => sum + p.points, 0) / replacementLevelPlayers.length
      : 0

    return Math.round((playerPoints - replacementLevel) * 100) / 100
  }

  // Calculate positional scarcity factor
  calculatePositionalScarcity(position: string, totalTeams: number = 14): number {
    const positionDemand = {
      'QB': totalTeams * 1.5, // 1 starter + some backup
      'RB': totalTeams * 3, // 1 starter + flex + backup
      'WR': totalTeams * 4, // 2 starters + flex + backup  
      'TE': totalTeams * 1.5, // 1 starter + flex possibility
      'K': totalTeams * 1.2, // 1 starter + minimal backup
      'DEF': totalTeams * 1.2, // 1 starter + minimal backup
      'DB': totalTeams * 1.2, // 1 starter + minimal backup
      'DL': totalTeams * 1.2, // 1 starter + minimal backup
      'LB': totalTeams * 1.2, // 1 starter + minimal backup
    }

    return positionDemand[position as keyof typeof positionDemand] || totalTeams
  }

  // Advanced analytics for recommendation engine
  calculatePlayerValue(
    player: Player, 
    allPlayers: Player[], 
    currentRoster: Player[],
    totalTeams: number = 14
  ): {
    basePoints: number
    vorp: number
    scarcityFactor: number
    rosterNeed: number
    finalValue: number
  } {
    const basePoints = this.calculateWeeklyPoints(player)
    const positionPlayers = allPlayers.filter(p => p.position === player.position)
    const vorp = this.calculateVORP(player, positionPlayers)
    const scarcityFactor = this.calculatePositionalScarcity(player.position, totalTeams)
    
    // Calculate roster need (higher number = greater need)
    const positionCount = currentRoster.filter(p => p.position === player.position).length
    const positionMax = this.getMaxPositionCount(player.position)
    const rosterNeed = Math.max(0, (positionMax - positionCount) / positionMax)
    
    // Combine factors for final value
    const finalValue = (basePoints * 0.4) + (vorp * 0.4) + (scarcityFactor * 0.1) + (rosterNeed * 0.1)
    
    return {
      basePoints,
      vorp,
      scarcityFactor,
      rosterNeed,
      finalValue: Math.round(finalValue * 100) / 100,
    }
  }

  private getMaxPositionCount(position: string): number {
    const maxCounts = {
      'QB': 2, // 1 starter + 1 backup
      'RB': 4, // 1 starter + flex + 2 backup
      'WR': 5, // 2 starter + flex + 2 backup
      'TE': 2, // 1 starter + 1 backup
      'K': 1, // 1 starter
      'DEF': 1, // 1 starter
      'DB': 1, // 1 starter
      'DL': 1, // 1 starter
      'LB': 1, // 1 starter
    }

    return maxCounts[position as keyof typeof maxCounts] || 1
  }

  // Update settings
  updateSettings(newSettings: LeagueSettings): void {
    this.settings = newSettings
  }

  // Export/Import functionality
  exportScoringSettings(): string {
    return JSON.stringify(this.settings, null, 2)
  }

  importScoringSettings(settingsJson: string): boolean {
    try {
      const newSettings = JSON.parse(settingsJson)
      this.settings = newSettings
      return true
    } catch (error) {
      console.error('Failed to import scoring settings:', error)
      return false
    }
  }
}

// Factory function to create scoring engine with default settings
export const createScoringEngine = (customSettings?: Partial<LeagueSettings>): ScoringEngine => {
  const defaultSettings: LeagueSettings = {
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
        receptionPoints: 0.5,
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

  const mergedSettings = customSettings 
    ? { ...defaultSettings, ...customSettings }
    : defaultSettings

  return new ScoringEngine(mergedSettings)
}

export default ScoringEngine