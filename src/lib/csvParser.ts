import Papa from 'papaparse'
import { Player, OffensivePlayer, IDPPlayer, TeamDefensePlayer, KickerPlayer } from '../types'

export type CSVDataType = 'offensive' | 'offensive-vorp' | 'idp' | 'team-defense' | 'kicker'

interface ParsedCSVResult {
  players: Player[]
  errors: string[]
  type: CSVDataType
}

// Helper function to generate unique player IDs
const generatePlayerId = (name: string, team: string, position: string): string => {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${team.toLowerCase()}-${position.toLowerCase()}`
}

// Helper function to safely parse numbers
const safeParseFloat = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

const safeParseInt = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = parseInt(String(value).replace(/[^\d-]/g, ''), 10)
  return isNaN(parsed) ? 0 : parsed
}

// Team name normalization map
const TEAM_ABBREVIATIONS: { [key: string]: string } = {
  'ARI': 'ARI', 'ARZ': 'ARI', 'ARIZ': 'ARI',
  'ATL': 'ATL',
  'BAL': 'BAL', 'BALT': 'BAL',
  'BUF': 'BUF',
  'CAR': 'CAR',
  'CHI': 'CHI',
  'CIN': 'CIN',
  'CLE': 'CLE', 'CLEV': 'CLE',
  'DAL': 'DAL',
  'DEN': 'DEN', 'DENV': 'DEN',
  'DET': 'DET',
  'GB': 'GB', 'GBP': 'GB', 'GNBY': 'GB',
  'HOU': 'HOU',
  'IND': 'IND',
  'JAC': 'JAC', 'JAX': 'JAC',
  'KC': 'KC', 'KAN': 'KC',
  'LV': 'LV', 'LVR': 'LV', 'RAI': 'LV',
  'LAC': 'LAC', 'LACH': 'LAC', 'SD': 'LAC',
  'LAR': 'LAR', 'LARM': 'LAR', 'STL': 'LAR',
  'MIA': 'MIA',
  'MIN': 'MIN', 'MINN': 'MIN',
  'NE': 'NE', 'NEP': 'NE', 'NWE': 'NE',
  'NO': 'NO', 'NOR': 'NO', 'NOLA': 'NO',
  'NYG': 'NYG', 'NYGI': 'NYG',
  'NYJ': 'NYJ', 'NYJE': 'NYJ',
  'PHI': 'PHI', 'PHIL': 'PHI',
  'PIT': 'PIT', 'PITT': 'PIT',
  'SF': 'SF', 'SFO': 'SF',
  'SEA': 'SEA', 'SEAT': 'SEA',
  'TB': 'TB', 'TAM': 'TB',
  'TEN': 'TEN', 'TENN': 'TEN',
  'WAS': 'WAS', 'WSH': 'WAS', 'WASH': 'WAS',
}

const normalizeTeam = (team: string): string => {
  const upperTeam = String(team).toUpperCase().trim()
  return TEAM_ABBREVIATIONS[upperTeam] || upperTeam
}

// Position normalization
const normalizePosition = (position: string): string => {
  const pos = String(position).toUpperCase().trim()
  
  // Handle position with numbers (e.g., "RB1" -> "RB")
  const cleanPos = pos.replace(/\d+$/, '')
  
  // Handle IDP positions
  if (cleanPos.includes('LB') || cleanPos === 'MLB' || cleanPos === 'OLB' || cleanPos === 'ILB') return 'LB'
  if (cleanPos.includes('DE') || cleanPos.includes('DT') || cleanPos === 'NT' || cleanPos === 'DL') return 'DL'
  if (cleanPos.includes('DB') || cleanPos === 'CB' || cleanPos === 'S' || cleanPos === 'SS' || cleanPos === 'FS') return 'DB'
  
  // Handle defense and kicker
  if (cleanPos.includes('DEF') || cleanPos === 'DST' || cleanPos === 'D/ST') return 'DEF'
  if (cleanPos === 'K' || cleanPos === 'PK') return 'K'
  
  // Standard offensive positions
  if (cleanPos === 'QB') return 'QB'
  if (cleanPos === 'RB' || cleanPos === 'FB') return 'RB'
  if (cleanPos === 'WR') return 'WR'
  if (cleanPos === 'TE') return 'TE'
  
  return cleanPos
}

// Parse offensive players (VORP rankings and stat projections)
const parseOffensivePlayers = (data: any[]): OffensivePlayer[] => {
  return data.map((row) => {
    const name = String(row['Player'] || row['OVERALL PLAYER'] || row['PLAYER NAME'] || row['QUARTERBACK'] || row['RUNNING BACK'] || row['WIDE RECEIVER'] || row['TIGHT END'] || '').trim()
    const team = normalizeTeam(row['TM'] || row['Team'] || row['TEAM'] || '')
    let position = normalizePosition(row['POS'] || row['Position'] || '')
    
    // Infer position from column headers if not specified
    if (!position || !['QB', 'RB', 'WR', 'TE'].includes(position)) {
      if (row['QUARTERBACK'] !== undefined) position = 'QB'
      else if (row['RUNNING BACK'] !== undefined) position = 'RB'  
      else if (row['WIDE RECEIVER'] !== undefined) position = 'WR'
      else if (row['TIGHT END'] !== undefined) position = 'TE'
    }
    
    // Debug logging for first few rows
    if (row['RK'] && parseInt(row['RK']) <= 3) {
      console.log(`🏈 Parsing row ${row['RK']}: name="${name}", position="${position}", team="${team}"`)
      console.log('🏈 Available columns:', Object.keys(row))
    }
    
    if (!name || !['QB', 'RB', 'WR', 'TE'].includes(position)) {
      if (row['RK'] && parseInt(row['RK']) <= 3) {
        console.log(`🚫 Rejecting row: name="${name}", position="${position}"`)
      }
      return null
    }

    const player: OffensivePlayer = {
      id: generatePlayerId(name, team, position),
      name,
      team,
      position: position as 'QB' | 'RB' | 'WR' | 'TE',
      byeWeek: safeParseInt(row['BYE'] || row['BYE WEEK'] || 0),
      vorp: safeParseFloat(row['VORP'] || 0),
      fps: safeParseFloat(row['FPS'] || 0),
      projectedStats: {
        passingYards: safeParseFloat(row['PASS YARDS'] || row['PASS ATT'] || 0),
        passingTDs: safeParseFloat(row['PASS TD'] || row['PASS TDS'] || 0),
        interceptions: safeParseFloat(row['INT'] || 0),
        rushingYards: safeParseFloat(row['RUSH YARDS'] || 0),
        rushingTDs: safeParseFloat(row['RUSH TD'] || row['RUSH TDS'] || 0),
        receptions: safeParseFloat(row['REC'] || row['RECEPTIONS'] || 0),
        receivingYards: safeParseFloat(row['REC YARDS'] || row['RECEIVING YARDS'] || 0),
        receivingTDs: safeParseFloat(row['REC TD'] || row['REC TDS'] || 0),
        fumbles: safeParseFloat(row['FUM'] || row['FUMBLES'] || 0),
      },
      adp: safeParseFloat(row['ADP'] || 0),
      auctionValue: safeParseFloat(row['AUC$'] || row['AUCTION'] || 0),
    }

    return player
  }).filter(Boolean) as OffensivePlayer[]
}

// Parse IDP players
const parseIDPPlayers = (data: any[]): IDPPlayer[] => {
  return data.map((row) => {
    const name = String(row['PLAYER NAME'] || row['Player'] || '').trim()
    const team = normalizeTeam(row['TEAM'] || row['TM'] || '')
    const position = normalizePosition(row['POS'] || row['Position'] || '')
    
    if (!name || !['DB', 'DL', 'LB'].includes(position)) {
      return null
    }

    const player: IDPPlayer = {
      id: generatePlayerId(name, team, position),
      name,
      team,
      position: position as 'DB' | 'DL' | 'LB',
      byeWeek: safeParseInt(row['BYE WEEK'] || row['BYE'] || 0),
      tier: safeParseInt(row['TIERS'] || row['TIER'] || 1),
      projectedStats: {
        soloTackles: safeParseFloat(row['SOLO'] || row['SOLO TACKLES'] || 0),
        assistTackles: safeParseFloat(row['AST'] || row['ASSIST TACKLES'] || 0),
        sacks: safeParseFloat(row['SACKS'] || row['SACK'] || 0),
        interceptions: safeParseFloat(row['INT'] || row['INTERCEPTIONS'] || 0),
        forcedFumbles: safeParseFloat(row['FF'] || row['FORCED FUMBLES'] || 0),
        fumbleRecoveries: safeParseFloat(row['FR'] || row['FUMBLE RECOVERIES'] || 0),
        defensiveTDs: safeParseFloat(row['TD'] || row['TOUCHDOWNS'] || 0),
      },
    }

    return player
  }).filter(Boolean) as IDPPlayer[]
}

// Parse team defense players
const parseTeamDefensePlayers = (data: any[]): TeamDefensePlayer[] => {
  return data.map((row) => {
    // Extract team name from Player column (e.g., "Buffalo Bills" -> "BUF")
    const playerName = String(row['Player'] || row['TEAM'] || row['Team'] || row['TM'] || '').trim()
    const team = normalizeTeam(playerName.split(' ')[0] + ' ' + playerName.split(' ')[1] || playerName) // Handle "Buffalo Bills" format
    const name = playerName.includes('Defense') ? playerName : `${playerName} Defense`
    
    if (!playerName) return null

    const player: TeamDefensePlayer = {
      id: generatePlayerId(name, team, 'DEF'),
      name,
      team,
      position: 'DEF',
      byeWeek: safeParseInt(row['BYE'] || row['BYE WEEK'] || 0),
      projectedStats: {
        sacks: safeParseFloat(row['SACKS'] || 0),
        interceptions: safeParseFloat(row['INT'] || 0),
        fumbleRecoveries: safeParseFloat(row['FR'] || 0),
        defensiveTDs: safeParseFloat(row['TD'] || 0),
        safeties: safeParseFloat(row['SAFETY'] || 0),
        pointsAllowed: safeParseFloat(row['PA'] || row['POINTS ALLOWED'] || 0),
      },
    }
    
    // Add FPS data if available (extend the base interface)
    if (row['FPS']) {
      (player as any).fps = safeParseFloat(row['FPS'])
    }

    return player
  }).filter(Boolean) as TeamDefensePlayer[]
}

// Parse kicker players
const parseKickerPlayers = (data: any[]): KickerPlayer[] => {
  return data.map((row, index) => {
    // Parse kicker data with standard headers: rank, kicker, team
    const name = String(row['Player'] || row['PLAYER'] || row['PLAYER NAME'] || row['Kicker'] || row['kicker'] || '').trim()
    const team = normalizeTeam(row['Team'] || row['TEAM'] || row['TM'] || row['team'] || '')
    const rank = safeParseInt(row['Rank'] || row['RK'] || row['RANK'] || row['rank'] || index + 1)
    
    if (!name) return null

    // Generate estimated stats based on rank if no actual stats provided
    let fieldGoals = safeParseFloat(row['FG'] || row['FIELD GOALS'] || 0)
    let fieldGoalAttempts = safeParseFloat(row['FGA'] || row['FG ATTEMPTS'] || 0)
    let extraPoints = safeParseFloat(row['XP'] || row['EXTRA POINTS'] || 0)
    let extraPointAttempts = safeParseFloat(row['XPA'] || row['XP ATTEMPTS'] || 0)
    
    // If no stats provided, estimate based on ranking
    if (fieldGoals === 0 && rank > 0) {
      // Top kickers (rank 1-5): ~25 FG, ~45 XP per season
      // Mid kickers (rank 6-20): ~20 FG, ~35 XP per season  
      // Lower kickers (rank 21+): ~15 FG, ~25 XP per season
      if (rank <= 5) {
        fieldGoals = 25
        fieldGoalAttempts = 30
        extraPoints = 45
        extraPointAttempts = 47
      } else if (rank <= 20) {
        fieldGoals = 20
        fieldGoalAttempts = 25
        extraPoints = 35
        extraPointAttempts = 37
      } else {
        fieldGoals = 15
        fieldGoalAttempts = 20
        extraPoints = 25
        extraPointAttempts = 27
      }
    }

    const player: KickerPlayer = {
      id: generatePlayerId(name, team || 'UNK', 'K'),
      name,
      team: team || 'UNK',
      position: 'K',
      byeWeek: safeParseInt(row['BYE'] || row['BYE WEEK'] || 0),
      projectedStats: {
        fieldGoals,
        fieldGoalAttempts,
        extraPoints,
        extraPointAttempts,
      },
    }
    
    // Add rank and estimated weekly points for reference
    ;(player as any).rank = rank
    ;(player as any).estimatedWeeklyPoints = Math.round(((fieldGoals * 3.5) + (extraPoints * 1)) / 17 * 10) / 10

    return player
  }).filter(Boolean) as KickerPlayer[]
}

// Detect CSV type based on headers
const detectCSVType = (headers: string[]): CSVDataType => {
  const headerStr = headers.join(' ').toLowerCase()
  console.log('🔍 CSV Headers detected:', headers)
  console.log('🔍 Header string for detection:', headerStr)
  
  if (headerStr.includes('vorp') && (headerStr.includes('overall player') || headerStr.includes('player') || headerStr.includes('quarterback') || headerStr.includes('running back') || headerStr.includes('wide receiver') || headerStr.includes('tight end'))) {
    console.log('🔍 Detected type: offensive-vorp')
    return 'offensive-vorp'
  }
  
  // Check for kickers first (before team detection that might conflict)
  if (headerStr.includes('field goal') || headerStr.includes('kicker') || 
      (headerStr.includes('rank') && headerStr.includes('kicker')) ||
      (headerStr.includes('rank') && headerStr.includes('player'))) {
    console.log('🔍 Detected type: kicker (via headers)')
    console.log('🔍 Kicker detection matched on:', {
      hasFieldGoal: headerStr.includes('field goal'),
      hasKicker: headerStr.includes('kicker'),
      hasRankAndKicker: headerStr.includes('rank') && headerStr.includes('kicker'),
      hasRankAndPlayer: headerStr.includes('rank') && headerStr.includes('player')
    })
    return 'kicker'
  }

  if (headerStr.includes('player name') && headerStr.includes('tiers')) {
    return 'idp'
  }
  
  if (headerStr.includes('team') && !headerStr.includes('player') && !headerStr.includes('kicker')) {
    return 'team-defense'
  }
  
  // Check for team defense by looking for FPS and team names without individual player stats
  if (headerStr.includes('player') && headerStr.includes('fps') && headerStr.includes('bye') && 
      !headerStr.includes('vorp') && !headerStr.includes('pass') && !headerStr.includes('rush')) {
    console.log('🔍 Detected type: team-defense (via FPS + Player format)')
    return 'team-defense'
  }
  
  // Default to offensive if it has standard offensive stats
  if (headerStr.includes('player') && (headerStr.includes('pass') || headerStr.includes('rush') || headerStr.includes('rec'))) {
    return 'offensive'
  }
  
  return 'offensive-vorp' // Default fallback
}

// Main CSV parsing function
export const parseCSVData = async (file: File): Promise<ParsedCSVResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        const errors: string[] = []
        
        // Add any parsing errors
        if (results.errors.length > 0) {
          errors.push(...results.errors.map(err => `Row ${err.row}: ${err.message}`))
        }
        
        const data = results.data as any[]
        if (data.length === 0) {
          resolve({
            players: [],
            errors: ['No data found in CSV file'],
            type: 'offensive-vorp',
          })
          return
        }
        
        // Detect CSV type
        const headers = Object.keys(data[0])
        const csvType = detectCSVType(headers)
        
        let players: Player[] = []
        
        try {
          console.log('🔍 Starting to parse with type:', csvType)
          switch (csvType) {
            case 'offensive':
            case 'offensive-vorp':
              console.log('🔍 Calling parseOffensivePlayers...')
              players = parseOffensivePlayers(data)
              console.log('🔍 parseOffensivePlayers returned:', players.length, 'players')
              break
            case 'idp':
              players = parseIDPPlayers(data)
              break
            case 'team-defense':
              players = parseTeamDefensePlayers(data)
              break
            case 'kicker':
              players = parseKickerPlayers(data)
              break
            default:
              errors.push('Unknown CSV format detected')
              break
          }
          
          if (players.length === 0) {
            errors.push('No valid players found in CSV data')
          }
          
        } catch (error) {
          errors.push(`Error parsing CSV data: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
        
        resolve({
          players,
          errors,
          type: csvType,
        })
      },
      error: (error) => {
        resolve({
          players: [],
          errors: [error.message],
          type: 'offensive-vorp',
        })
      }
    })
  })
}

// Parse multiple CSV files
export const parseMultipleCSVFiles = async (files: FileList | File[]): Promise<{
  allPlayers: Player[]
  errors: string[]
  fileResults: Array<{ fileName: string; type: CSVDataType; playerCount: number; errors: string[] }>
}> => {
  console.log('🔍 parseMultipleCSVFiles called with files:', files)
  const fileArray = Array.from(files)
  console.log('🔍 File array:', fileArray.map(f => ({ name: f.name, size: f.size, type: f.type })))
  
  const results = await Promise.all(
    fileArray.map(async (file) => {
      console.log('🔍 About to parse file:', file.name)
      const result = await parseCSVData(file)
      console.log('🔍 parseCSVData result for', file.name, ':', result)
      return {
        fileName: file.name,
        ...result,
      }
    })
  )
  
  console.log('🔍 All parsing results:', results)
  
  const allPlayers: Player[] = []
  const allErrors: string[] = []
  const fileResults: Array<{ fileName: string; type: CSVDataType; playerCount: number; errors: string[] }> = []
  
  results.forEach((result) => {
    allPlayers.push(...result.players)
    
    if (result.errors.length > 0) {
      allErrors.push(`${result.fileName}: ${result.errors.join(', ')}`)
    }
    
    fileResults.push({
      fileName: result.fileName,
      type: result.type,
      playerCount: result.players.length,
      errors: result.errors,
    })
  })
  
  return {
    allPlayers,
    errors: allErrors,
    fileResults,
  }
}

// Utility function to download sample CSV template
export const generateSampleCSV = (type: CSVDataType): string => {
  const samples = {
    'offensive-vorp': 'RK,OVERALL PLAYER,POS RK,BYE,FPS,VORP\n1,Christian McCaffrey,RB1,14,311.128294,162.6150511',
    'offensive': 'RK,Player,TM,BYE,PASS ATT,COMP,PASS YARDS,PASS TD,INT,RUSH ATT,RUSH YARDS,RUSH TD,FPS,AUC$\n1,Lamar Jackson,BAL,7,474,313,3641,33,5,153,891,4,382.6,$24',
    'idp': 'RK,TIERS,PLAYER NAME,TEAM,POS,BYE WEEK\n1,1,Zaire Franklin,IND,LB1,11',
    'team-defense': 'RK,TEAM,BYE,SACKS,INT,FR,TD,SAFETY,PA\n1,PIT,14,45,18,12,2,1,18.5',
    'kicker': 'rank,kicker,team\n1,Justin Tucker,BAL\n2,Cameron Dicker,LAC'
  }
  
  return samples[type] || samples['offensive-vorp']
}

export default { parseCSVData, parseMultipleCSVFiles, generateSampleCSV }