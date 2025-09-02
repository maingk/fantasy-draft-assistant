import { Player, OffensivePlayer, IDPPlayer, Position } from '../types'
import { parseMultipleCSVFiles } from './csvParser'
import { db } from './database'
import { createScoringEngine } from './scoringEngine'

export interface PlayerDatabaseStats {
  totalPlayers: number
  byPosition: Record<Position, number>
  dataSourceStats: {
    offensive: number
    idp: number
    teamDefense: number
    kicker: number
  }
  lastUpdated: Date
}

export interface PlayerSearchOptions {
  position?: Position | Position[]
  team?: string | string[]
  name?: string
  minVorp?: number
  maxVorp?: number
  sortBy?: 'name' | 'vorp' | 'fps' | 'adp' | 'projectedPoints'
  sortDirection?: 'asc' | 'desc'
  limit?: number
}

export interface PlayerMergeResult {
  mergedPlayers: Player[]
  duplicatesFound: number
  conflicts: Array<{
    playerId: string
    playerName: string
    conflictType: 'stats' | 'team' | 'position'
    sources: string[]
  }>
  stats: PlayerDatabaseStats
}

export class PlayerDatabase {
  private players: Map<string, Player> = new Map()
  private stats: PlayerDatabaseStats | null = null
  private scoringEngine = createScoringEngine()
  private lastUpdateTime: Date | null = null
  private initialized: Promise<void>

  constructor() {
    this.initialized = this.initializeDatabase()
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Initialize the database first
      await db.initialize()
      
      // Load existing players from IndexedDB
      const savedPlayers = await db.getAllPlayers()
      savedPlayers.forEach(player => {
        this.players.set(player.id, player)
      })
      this.updateStats()
    } catch (error) {
      console.error('Failed to initialize player database:', error)
    }
  }

  // Ensure database is ready before performing operations
  private async ensureInitialized(): Promise<void> {
    await this.initialized
  }

  // Load players from CSV files
  async loadFromCSVFiles(files: FileList | File[]): Promise<PlayerMergeResult> {
    console.log('🔍 PlayerDatabase.loadFromCSVFiles called with', files.length, 'files')
    await this.ensureInitialized()
    console.log('🔍 Database initialized, calling parseMultipleCSVFiles...')
    
    const parseResult = await parseMultipleCSVFiles(files)
    console.log('🔍 parseMultipleCSVFiles result:', parseResult)
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing errors:', parseResult.errors)
    }

    console.log('🔍 About to merge', parseResult.allPlayers.length, 'players from sources')
    const mergeResult = this.mergePlayersFromSources(parseResult.allPlayers, parseResult.fileResults.map(r => r.fileName))
    console.log('🔍 Merge result:', mergeResult)
    
    return mergeResult
  }

  // Load players from our existing data files
  async loadFromDataFiles(): Promise<PlayerMergeResult> {
    try {
      // This would read from our pre-draft_rankings folder
      // For now, we'll simulate loading from the files we know exist
      // const files = [
      //   'Overall_Offensive_Players_VORP_Ranking.csv',
      //   'FantasyPros_2025_Draft_IDP_Rankings.csv',
      //   'QB_Ranks_with_Stat_projections.csv',
      //   'RB_Ranks_with_Stat_projections.csv',
      //   'WR_Ranks_with_Stat_projections.csv',
      //   'TE_Ranks_with_Stat_projections.csv',
      // ]

      // For demo purposes, return an empty result
      // In production, this would actually read the files
      return {
        mergedPlayers: [],
        duplicatesFound: 0,
        conflicts: [],
        stats: this.getStats(),
      }
    } catch (error) {
      console.error('Failed to load from data files:', error)
      throw error
    }
  }

  // Merge players from multiple sources, handling duplicates and conflicts
  private mergePlayersFromSources(newPlayers: Player[], sources: string[]): PlayerMergeResult {
    const conflicts: PlayerMergeResult['conflicts'] = []
    const mergedPlayers: Player[] = []
    let duplicatesFound = 0

    // Create a map to track potential duplicates by normalized name
    const nameMap = new Map<string, Player[]>()
    
    newPlayers.forEach(player => {
      const normalizedName = this.normalizePlayerName(player.name)
      const existing = nameMap.get(normalizedName) || []
      existing.push(player)
      nameMap.set(normalizedName, existing)
    })

    // Process each group of potential duplicates
    nameMap.forEach((playerGroup) => {
      if (playerGroup.length === 1) {
        // No duplicates, add directly
        const player = playerGroup[0]
        this.players.set(player.id, player)
        mergedPlayers.push(player)
      } else {
        // Handle duplicates
        duplicatesFound += playerGroup.length - 1
        const mergedPlayer = this.mergePlayerData(playerGroup, conflicts, sources)
        this.players.set(mergedPlayer.id, mergedPlayer)
        mergedPlayers.push(mergedPlayer)
      }
    })

    // Save to database
    this.saveToDatabase()
    this.updateStats()

    return {
      mergedPlayers,
      duplicatesFound,
      conflicts,
      stats: this.getStats(),
    }
  }

  // Normalize player names for duplicate detection
  private normalizePlayerName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .replace(/\b(jr|sr|iii|ii|iv)\b/g, '') // Remove suffixes
      .trim()
  }

  // Merge data from multiple sources for the same player
  private mergePlayerData(
    playerGroup: Player[], 
    conflicts: PlayerMergeResult['conflicts'], 
    sources: string[]
  ): Player {
    // Use the first player as base
    const basePlayer = playerGroup[0]
    const mergedPlayer: Player = { ...basePlayer }

    // Check for conflicts and merge data
    playerGroup.slice(1).forEach(player => {
      // Check for team conflicts
      if (player.team !== basePlayer.team) {
        conflicts.push({
          playerId: basePlayer.id,
          playerName: basePlayer.name,
          conflictType: 'team',
          sources,
        })
        // Use the most recent or more complete data
        if (player.team && !mergedPlayer.team) {
          mergedPlayer.team = player.team
        }
      }

      // Check for position conflicts
      if (player.position !== basePlayer.position) {
        conflicts.push({
          playerId: basePlayer.id,
          playerName: basePlayer.name,
          conflictType: 'position',
          sources,
        })
      }

      // Merge statistical data
      if ('vorp' in player && 'vorp' in mergedPlayer) {
        const offensiveMerged = mergedPlayer as OffensivePlayer
        const offensivePlayer = player as OffensivePlayer
        
        // Use highest VORP value
        if (offensivePlayer.vorp > offensiveMerged.vorp) {
          offensiveMerged.vorp = offensivePlayer.vorp
        }

        // Merge projected stats (use non-zero values when available)
        Object.keys(offensivePlayer.projectedStats).forEach(key => {
          const statKey = key as keyof typeof offensivePlayer.projectedStats
          if (offensivePlayer.projectedStats[statKey] && !offensiveMerged.projectedStats[statKey]) {
            (offensiveMerged.projectedStats as any)[statKey] = offensivePlayer.projectedStats[statKey]
          }
        })
      }

      // Merge other position-specific data
      if ('tier' in player && 'tier' in mergedPlayer) {
        const idpMerged = mergedPlayer as IDPPlayer
        const idpPlayer = player as IDPPlayer
        
        // Use lower tier (better ranking)
        if (idpPlayer.tier < idpMerged.tier) {
          idpMerged.tier = idpPlayer.tier
        }
      }
    })

    return mergedPlayer
  }

  // Update database statistics
  private updateStats(): void {
    const byPosition: Record<Position, number> = {
      'QB': 0, 'RB': 0, 'WR': 0, 'TE': 0, 'K': 0, 'DEF': 0, 'DB': 0, 'DL': 0, 'LB': 0
    }

    const dataSourceStats = {
      offensive: 0,
      idp: 0,
      teamDefense: 0,
      kicker: 0,
    }

    this.players.forEach(player => {
      byPosition[player.position]++
      
      if (['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
        dataSourceStats.offensive++
      } else if (['DB', 'DL', 'LB'].includes(player.position)) {
        dataSourceStats.idp++
      } else if (player.position === 'DEF') {
        dataSourceStats.teamDefense++
      } else if (player.position === 'K') {
        dataSourceStats.kicker++
      }
    })

    this.stats = {
      totalPlayers: this.players.size,
      byPosition,
      dataSourceStats,
      lastUpdated: new Date(),
    }

    this.lastUpdateTime = new Date()
  }

  // Save all players to IndexedDB
  private async saveToDatabase(): Promise<void> {
    try {
      const playersArray = Array.from(this.players.values())
      await db.savePlayers(playersArray)
    } catch (error) {
      console.error('Failed to save players to database:', error)
    }
  }

  // Get all players
  getAllPlayers(): Player[] {
    return Array.from(this.players.values())
  }

  // Get player by ID
  getPlayer(id: string): Player | undefined {
    return this.players.get(id)
  }

  // Search players with various options
  searchPlayers(options: PlayerSearchOptions = {}): Player[] {
    let results = Array.from(this.players.values())

    // Filter by position
    if (options.position) {
      const positions = Array.isArray(options.position) ? options.position : [options.position]
      results = results.filter(player => positions.includes(player.position))
    }

    // Filter by team
    if (options.team) {
      const teams = Array.isArray(options.team) ? options.team : [options.team]
      results = results.filter(player => teams.includes(player.team))
    }

    // Filter by name
    if (options.name) {
      const query = options.name.toLowerCase()
      results = results.filter(player => 
        player.name.toLowerCase().includes(query)
      )
    }

    // Filter by VORP range (for offensive players)
    if (options.minVorp !== undefined || options.maxVorp !== undefined) {
      results = results.filter(player => {
        if (!('vorp' in player)) return false
        const vorp = (player as OffensivePlayer).vorp
        if (options.minVorp !== undefined && vorp < options.minVorp) return false
        if (options.maxVorp !== undefined && vorp > options.maxVorp) return false
        return true
      })
    }

    // Sort results
    if (options.sortBy) {
      results.sort((a, b) => {
        let aValue: number | string = 0
        let bValue: number | string = 0

        switch (options.sortBy) {
          case 'name':
            aValue = a.name
            bValue = b.name
            break
          case 'vorp':
            aValue = 'vorp' in a ? (a as OffensivePlayer).vorp : 0
            bValue = 'vorp' in b ? (b as OffensivePlayer).vorp : 0
            break
          case 'fps':
            aValue = 'fps' in a ? (a as OffensivePlayer).fps : 0
            bValue = 'fps' in b ? (b as OffensivePlayer).fps : 0
            break
          case 'adp':
            aValue = 'adp' in a ? (a as OffensivePlayer).adp || 999 : 999
            bValue = 'adp' in b ? (b as OffensivePlayer).adp || 999 : 999
            break
          case 'projectedPoints':
            aValue = this.scoringEngine.calculateWeeklyPoints(a)
            bValue = this.scoringEngine.calculateWeeklyPoints(b)
            break
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return options.sortDirection === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
        } else {
          return options.sortDirection === 'desc' ? (bValue as number) - (aValue as number) : (aValue as number) - (bValue as number)
        }
      })
    }

    // Limit results
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  // Get players by position
  getPlayersByPosition(position: Position): Player[] {
    return this.searchPlayers({ position })
  }

  // Get statistics
  getStats(): PlayerDatabaseStats {
    if (!this.stats) {
      this.updateStats()
    }
    return this.stats!
  }

  // Add or update a player
  addPlayer(player: Player): void {
    this.players.set(player.id, player)
    this.updateStats()
    this.saveToDatabase()
  }

  // Remove a player
  removePlayer(id: string): boolean {
    const success = this.players.delete(id)
    if (success) {
      this.updateStats()
      this.saveToDatabase()
    }
    return success
  }

  // Clear all players
  async clearAll(): Promise<void> {
    this.players.clear()
    this.stats = null
    await db.clearPlayers()
    this.updateStats()
  }

  // Export player data
  exportToJSON(): string {
    const data = {
      players: Array.from(this.players.values()),
      stats: this.getStats(),
      exportedAt: new Date().toISOString(),
    }
    return JSON.stringify(data, null, 2)
  }

  // Import player data
  async importFromJSON(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData)
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error('Invalid data format')
      }

      this.players.clear()
      data.players.forEach((player: Player) => {
        this.players.set(player.id, player)
      })

      await this.saveToDatabase()
      this.updateStats()
      return true
    } catch (error) {
      console.error('Failed to import player data:', error)
      return false
    }
  }

  // Get top performers by position
  getTopPerformers(position: Position, limit: number = 10): Player[] {
    return this.searchPlayers({
      position,
      sortBy: 'projectedPoints',
      sortDirection: 'desc',
      limit,
    })
  }

  // Get sleeper candidates (high projected points, low ADP)
  getSleeperCandidates(position?: Position, limit: number = 20): OffensivePlayer[] {
    const players = this.searchPlayers({ position }) as OffensivePlayer[]
    
    return players
      .filter(player => 'vorp' in player && player.adp && player.vorp > 0)
      .map(player => ({
        player,
        sleeperfactor: player.vorp / (player.adp || 999), // Higher VORP relative to ADP
      }))
      .sort((a, b) => b.sleeperfactor - a.sleeperfactor)
      .slice(0, limit)
      .map(item => item.player)
  }

  // Get handcuff recommendations
  getHandcuffRecommendations(rosterPlayers: Player[]): Player[] {
    const rosterRBs = rosterPlayers.filter(p => p.position === 'RB')
    const allRBs = this.getPlayersByPosition('RB')
    
    const handcuffs: Player[] = []
    
    rosterRBs.forEach(starter => {
      // Find backup RBs on the same team
      const teamBackups = allRBs.filter(rb => 
        rb.team === starter.team && 
        rb.id !== starter.id &&
        !rosterPlayers.find(rp => rp.id === rb.id)
      )
      
      handcuffs.push(...teamBackups.slice(0, 1)) // Add top backup
    })

    return handcuffs
  }

  // Update scoring settings
  updateScoringSettings(settings: any): void {
    this.scoringEngine.updateSettings(settings)
  }

  // Get last update time
  getLastUpdateTime(): Date | null {
    return this.lastUpdateTime
  }
}

// Singleton instance
export const playerDatabase = new PlayerDatabase()
export default playerDatabase