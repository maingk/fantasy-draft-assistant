import React, { useEffect, useState } from 'react'
import { playerDatabase } from './lib/playerDatabase'
import { Player, Position } from './types'
import { createScoringEngine, ScoringEngine } from './lib/scoringEngine'
import { useUserPreferencesStore } from './stores/userPreferencesStore'
import { PlayerNotesModal } from './components/PlayerNotesModal'

interface AppState {
  isLoading: boolean
  players: Player[]
  error: string | null
  stats: any
  scoringEngine: ScoringEngine
}

interface RankingsFilter {
  position: Position | 'ALL'
  searchName: string
  sortBy: 'name' | 'vorp' | 'fps' | 'projectedPoints' | 'tier' | 'customRanking' | 'adjustedValue'
  sortDirection: 'asc' | 'desc'
  limit: number
  showTargetsOnly: boolean
  hideAvoidPlayers: boolean
}

function App() {
  const [state, setState] = useState<AppState>({
    isLoading: true,
    players: [],
    error: null,
    stats: null,
    scoringEngine: createScoringEngine()
  })

  const [filter, setFilter] = useState<RankingsFilter>({
    position: 'ALL',
    searchName: '',
    sortBy: 'adjustedValue',
    sortDirection: 'desc',
    limit: 50,
    showTargetsOnly: false,
    hideAvoidPlayers: false
  })

  const [showLeagueConfig, setShowLeagueConfig] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [showPlayerNotes, setShowPlayerNotes] = useState(false)
  
  // User preferences store
  const {
    calculateAdjustedValue,
    isPlayerTarget,
    isPlayerAvoid,
    getCustomRanking,
    getPlayerNote
  } = useUserPreferencesStore()

  useEffect(() => {
    loadPlayerData()
  }, [])

  const loadPlayerData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // Wait for database to initialize, then try to load existing data
      await new Promise(resolve => setTimeout(resolve, 100)) // Give database time to initialize
      
      const existingPlayers = playerDatabase.getAllPlayers()
      
      if (existingPlayers.length > 0) {
        console.log(`Loaded ${existingPlayers.length} players from database`)
        setState(prev => ({
          ...prev,
          isLoading: false,
          players: existingPlayers,
          error: null,
          stats: playerDatabase.getStats()
        }))
        return
      }
      
      // If no existing data, we'll show the manual import option
      console.log('No existing player data found - ready for import')
      setState(prev => ({
        ...prev,
        isLoading: false,
        players: [],
        error: null,
        stats: null
      }))
      
    } catch (error) {
      console.error('Failed to load player data:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        players: [],
        error: error instanceof Error ? error.message : 'Failed to load player data',
        stats: null
      }))
    }
  }

  const handleFileUpload = async (files: FileList) => {
    console.log('handleFileUpload called with files:', files.length)
    console.log('🔍 FileList object:', files)
    
    // Convert FileList to array immediately to avoid corruption
    const fileArray = Array.from(files)
    console.log('🔍 FileList as Array:', fileArray)
    console.log('🔍 First file:', fileArray[0])
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      console.log('State set to loading...')
      
      const result = await playerDatabase.loadFromCSVFiles(fileArray)
      console.log('Import result:', result)
      
      const allPlayers = playerDatabase.getAllPlayers()
      console.log('Total players after import:', allPlayers.length)
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        players: allPlayers,
        error: result.conflicts.length > 0 ? `Import completed with ${result.conflicts.length} conflicts` : null,
        stats: result.stats
      }))
      
    } catch (error) {
      console.error('Failed to import player data:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        players: [],
        error: error instanceof Error ? error.message : 'Failed to import player data',
        stats: null
      }))
    }
  }

  // Filter and sort players based on current filter settings
  const getFilteredPlayers = (): Player[] => {
    let filtered = [...state.players]

    // Filter by position
    if (filter.position !== 'ALL') {
      filtered = filtered.filter(p => p.position === filter.position)
    }

    // Filter by name search
    if (filter.searchName.trim()) {
      const searchLower = filter.searchName.toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchLower))
    }

    // Filter by targets/avoid preferences
    if (filter.showTargetsOnly) {
      filtered = filtered.filter(p => isPlayerTarget(p.id))
    }
    
    if (filter.hideAvoidPlayers) {
      filtered = filtered.filter(p => !isPlayerAvoid(p.id))
    }

    // Sort players
    filtered.sort((a, b) => {
      let aValue: number | string = 0
      let bValue: number | string = 0

      switch (filter.sortBy) {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'vorp':
          aValue = 'vorp' in a ? (a as any).vorp : -999
          bValue = 'vorp' in b ? (b as any).vorp : -999
          break
        case 'fps':
          aValue = 'fps' in a ? (a as any).fps : -999
          bValue = 'fps' in b ? (b as any).fps : -999
          break
        case 'tier':
          aValue = 'tier' in a ? (a as any).tier : 999
          bValue = 'tier' in b ? (b as any).tier : 999
          // For tier sorting, we want ascending by default (Tier 1 = best)
          // So we'll reverse the normal logic
          break
        case 'projectedPoints':
          // Calculate projected points using scoring engine
          try {
            aValue = state.scoringEngine ? state.scoringEngine.calculateWeeklyPoints(a) : 0
            bValue = state.scoringEngine ? state.scoringEngine.calculateWeeklyPoints(b) : 0
          } catch (error) {
            console.error('Error calculating projected points for sorting:', error)
            aValue = 0
            bValue = 0
          }
          break
        case 'customRanking':
          aValue = getCustomRanking(a.id) || 999
          bValue = getCustomRanking(b.id) || 999
          break
        case 'adjustedValue':
          // Use adjusted value calculation that considers custom rankings and preferences
          const aBaseValue = 'vorp' in a ? (a as any).vorp : ('fps' in a ? (a as any).fps : 0)
          const bBaseValue = 'vorp' in b ? (b as any).vorp : ('fps' in b ? (b as any).fps : 0)
          aValue = calculateAdjustedValue(a, aBaseValue)
          bValue = calculateAdjustedValue(b, bBaseValue)
          break
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return filter.sortDirection === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
      } else {
        // Special handling for tier and custom ranking sorting - reverse the logic since lower numbers are better
        if (filter.sortBy === 'tier' || filter.sortBy === 'customRanking') {
          return filter.sortDirection === 'desc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number)
        }
        return filter.sortDirection === 'desc' ? (bValue as number) - (aValue as number) : (aValue as number) - (bValue as number)
      }
    })

    // Limit results
    return filtered.slice(0, filter.limit)
  }

  // Calculate projected points for a player
  const getProjectedPoints = (player: Player): number => {
    try {
      // Always use a fresh scoring engine since state one is undefined
      const scoringEngine = createScoringEngine()
      
      // Try using scoring engine first
      const calculatedPoints = scoringEngine.calculateWeeklyPoints(player)
      
      // If scoring engine returns 0, fall back to FPS or VORP-based estimation
      if (calculatedPoints === 0) {
        // For offensive players, use FPS if available
        if ('fps' in player && (player as any).fps > 0) {
          return (player as any).fps
        }
        
        // For IDP players, estimate based on tier (lower tier = higher points)
        if ('tier' in player && (player as any).tier > 0) {
          const tier = (player as any).tier
          return Math.max(4, 14 - tier * 1.5)
        }
        
        // For kickers, use estimated weekly points if available
        if (player.position === 'K' && 'estimatedWeeklyPoints' in player) {
          return (player as any).estimatedWeeklyPoints
        }
        
        // Fall back to VORP if available
        if ('vorp' in player && (player as any).vorp > 0) {
          return (player as any).vorp * 0.15
        }
      }
      
      return calculatedPoints
    } catch (error) {
      console.error('Error calculating projected points for player:', player.name, error)
      
      // Final fallback: try to use FPS or estimate
      if ('fps' in player && (player as any).fps > 0) {
        return (player as any).fps
      }
      return 0
    }
  }

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Fantasy Draft Assistant</h1>
          <p className="text-gray-300">Loading player data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          Fantasy Draft Assistant
        </h1>
        
        {state.error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            <p className="font-bold">Error:</p>
            <p>{state.error}</p>
          </div>
        )}

        {state.players.length === 0 ? (
          <div className="text-center">
            <div className="bg-gray-800 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4">Import Player Data</h2>
              <p className="text-gray-300 mb-6">
                Upload CSV files to import player rankings and projections
              </p>
              
              <input
                type="file"
                multiple
                accept=".csv"
                onChange={(e) => {
                  console.log('File input changed:', e.target.files)
                  if (e.target.files && e.target.files.length > 0) {
                    console.log('Files selected:', Array.from(e.target.files).map(f => f.name))
                    handleFileUpload(e.target.files)
                  } else {
                    console.log('No files selected')
                  }
                }}
                className="block w-full text-sm text-gray-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-700
                  file:cursor-pointer cursor-pointer"
              />
              
              <div className="mt-4 text-sm text-gray-400">
                <p>Supported files:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Player rankings with VORP scores</li>
                  <li>Position-specific stat projections</li>
                  <li>IDP rankings</li>
                  <li>Team defense rankings</li>
                  <li>Kicker rankings</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Player Database Statistics</h2>
                <div className="space-x-2">
                  <label className={`px-4 py-2 rounded cursor-pointer transition-colors ${
                    state.isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}>
                    {state.isLoading ? 'Importing...' : 'Import More Files'}
                    <input
                      type="file"
                      multiple
                      accept=".csv"
                      disabled={state.isLoading}
                      onChange={(e) => {
                        console.log('🔍 File input onChange fired!')
                        console.log('🔍 Files object:', e.target.files)
                        console.log('🔍 Number of files:', e.target.files?.length)
                        
                        if (e.target.files && e.target.files.length > 0) {
                          console.log('🔍 Files selected:', Array.from(e.target.files).map(f => f.name))
                          console.log('🔍 About to call handleFileUpload...')
                          handleFileUpload(e.target.files)
                          e.target.value = '' // Reset input
                        } else {
                          console.log('🔍 No files selected or files is null')
                        }
                      }}
                      onClick={() => console.log('🔍 File input clicked!')}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowLeagueConfig(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    League Settings
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to clear all player data?')) {
                        await playerDatabase.clearAll()
                        setState(prev => ({ ...prev, players: [], stats: null }))
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Clear All Data
                  </button>
                </div>
              </div>
              {state.stats && (
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">{state.stats.totalPlayers}</div>
                    <div className="text-sm text-gray-400">Total Players</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{state.stats.byPosition.QB}</div>
                    <div className="text-sm text-gray-400">QBs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-400">{state.stats.byPosition.RB}</div>
                    <div className="text-sm text-gray-400">RBs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{state.stats.byPosition.WR}</div>
                    <div className="text-sm text-gray-400">WRs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-400">{state.stats.byPosition.TE}</div>
                    <div className="text-sm text-gray-400">TEs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-400">{state.stats.byPosition.LB}</div>
                    <div className="text-sm text-gray-400">LBs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">{state.stats.byPosition.DB}</div>
                    <div className="text-sm text-gray-400">DBs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-400">{state.stats.byPosition.DL}</div>
                    <div className="text-sm text-gray-400">DLs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-400">{state.stats.byPosition.DEF}</div>
                    <div className="text-sm text-gray-400">DEFs</div>
                  </div>
                </div>
              )}
            </div>

            {/* League Settings Modal */}
            {showLeagueConfig && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">League Settings</h2>
                    <button
                      onClick={() => setShowLeagueConfig(false)}
                      className="text-gray-400 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Passing Scoring */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4 text-green-400">Passing</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Yards per Point</label>
                          <input 
                            type="number" 
                            defaultValue={state.scoringEngine.exportScoringSettings().includes('"yardsPerPoint":50') ? 50 : 25}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                          <div className="text-xs text-gray-400 mt-1">Every 50 yards = 1 point</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">TD Points</label>
                          <input 
                            type="number" 
                            defaultValue={6}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Interception Penalty</label>
                          <input 
                            type="number" 
                            defaultValue={-2}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Rushing Scoring */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4 text-yellow-400">Rushing</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Yards per Point</label>
                          <input 
                            type="number" 
                            defaultValue={15}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                          <div className="text-xs text-gray-400 mt-1">Every 15 yards = 1 point</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">TD Points</label>
                          <input 
                            type="number" 
                            defaultValue={6}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Receiving Scoring */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4 text-purple-400">Receiving</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Yards per Point</label>
                          <input 
                            type="number" 
                            defaultValue={15}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Points per Reception</label>
                          <input 
                            type="number" 
                            step="0.1"
                            defaultValue={0.5}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                          <div className="text-xs text-gray-400 mt-1">PPR = 1.0, Half PPR = 0.5, Standard = 0.0</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">TD Points</label>
                          <input 
                            type="number" 
                            defaultValue={6}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Defense Scoring */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-4 text-cyan-400">Team Defense</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Sack</label>
                          <input 
                            type="number" 
                            defaultValue={2}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Interception</label>
                          <input 
                            type="number" 
                            defaultValue={2}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Fumble Recovery</label>
                          <input 
                            type="number" 
                            defaultValue={2}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Defensive TD</label>
                          <input 
                            type="number" 
                            defaultValue={6}
                            className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-6 space-x-3">
                    <button
                      onClick={() => setShowLeagueConfig(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // TODO: Save scoring settings
                        setShowLeagueConfig(false)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Player Rankings</h2>
                <div className="text-sm text-gray-400">
                  Showing {getFilteredPlayers().length} of {state.players.length} players
                </div>
              </div>
              
              {/* Filters */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Position</label>
                  <select
                    value={filter.position}
                    onChange={(e) => setFilter(prev => ({ ...prev, position: e.target.value as Position | 'ALL' }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="ALL">All Positions</option>
                    <option value="QB">QB</option>
                    <option value="RB">RB</option>
                    <option value="WR">WR</option>
                    <option value="TE">TE</option>
                    <option value="LB">LB</option>
                    <option value="DB">DB</option>
                    <option value="DL">DL</option>
                    <option value="DEF">DEF</option>
                    <option value="K">K</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Search Player</label>
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={filter.searchName}
                    onChange={(e) => setFilter(prev => ({ ...prev, searchName: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Sort By</label>
                  <select
                    value={filter.sortBy}
                    onChange={(e) => setFilter(prev => ({ ...prev, sortBy: e.target.value as any }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="adjustedValue">My Rankings (Adjusted)</option>
                    <option value="customRanking">Custom Ranking</option>
                    <option value="vorp">VORP</option>
                    <option value="fps">FPS</option>
                    <option value="projectedPoints">Projected Points</option>
                    <option value="tier">Tier</option>
                    <option value="name">Name</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Show</label>
                  <select
                    value={filter.limit}
                    onChange={(e) => setFilter(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="25">Top 25</option>
                    <option value="50">Top 50</option>
                    <option value="100">Top 100</option>
                    <option value="200">Top 200</option>
                  </select>
                </div>
                </div>
                
                {/* Additional Filters */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filter.showTargetsOnly}
                      onChange={(e) => setFilter(prev => ({ ...prev, showTargetsOnly: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-green-400">🎯 Show Targets Only</span>
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filter.hideAvoidPlayers}
                      onChange={(e) => setFilter(prev => ({ ...prev, hideAvoidPlayers: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-red-400">🚫 Hide Avoid Players</span>
                  </label>
                </div>
              </div>
              
              {/* Rankings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2">Rank</th>
                      <th className="text-left py-2 cursor-pointer hover:text-blue-400" 
                          onClick={() => setFilter(prev => ({ 
                            ...prev, 
                            sortBy: 'name', 
                            sortDirection: prev.sortBy === 'name' && prev.sortDirection === 'asc' ? 'desc' : 'asc' 
                          }))}>
                        Player {filter.sortBy === 'name' && (filter.sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-2">Position</th>
                      <th className="text-left py-2">Team</th>
                      <th className="text-right py-2 cursor-pointer hover:text-blue-400"
                          onClick={() => setFilter(prev => ({ 
                            ...prev, 
                            sortBy: 'vorp', 
                            sortDirection: prev.sortBy === 'vorp' && prev.sortDirection === 'desc' ? 'asc' : 'desc' 
                          }))}>
                        VORP {filter.sortBy === 'vorp' && (filter.sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-right py-2 cursor-pointer hover:text-blue-400"
                          onClick={() => setFilter(prev => ({ 
                            ...prev, 
                            sortBy: 'fps', 
                            sortDirection: prev.sortBy === 'fps' && prev.sortDirection === 'desc' ? 'asc' : 'desc' 
                          }))}>
                        FPS {filter.sortBy === 'fps' && (filter.sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-right py-2 cursor-pointer hover:text-blue-400"
                          onClick={() => setFilter(prev => ({ 
                            ...prev, 
                            sortBy: 'projectedPoints', 
                            sortDirection: prev.sortBy === 'projectedPoints' && prev.sortDirection === 'desc' ? 'asc' : 'desc' 
                          }))}>
                        Proj Pts {filter.sortBy === 'projectedPoints' && (filter.sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-right py-2">Tier</th>
                      <th className="text-right py-2">Bye</th>
                      <th className="text-center py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredPlayers().map((player, index) => {
                      const offensivePlayer = player as any
                      const idpPlayer = player as any
                      return (
                        <tr key={player.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-2 font-medium">{index + 1}</td>
                          <td className="py-2 font-medium">{player.name}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              player.position === 'QB' ? 'bg-green-900 text-green-200' :
                              player.position === 'RB' ? 'bg-yellow-900 text-yellow-200' :
                              player.position === 'WR' ? 'bg-purple-900 text-purple-200' :
                              player.position === 'TE' ? 'bg-red-900 text-red-200' :
                              player.position === 'LB' ? 'bg-orange-900 text-orange-200' :
                              player.position === 'DB' ? 'bg-cyan-900 text-cyan-200' :
                              player.position === 'DL' ? 'bg-pink-900 text-pink-200' :
                              player.position === 'DEF' ? 'bg-gray-700 text-gray-200' :
                              'bg-blue-900 text-blue-200'
                            }`}>
                              {player.position}
                            </span>
                          </td>
                          <td className="py-2 text-gray-300">{player.team}</td>
                          <td className="py-2 text-right font-mono">
                            {offensivePlayer.vorp ? offensivePlayer.vorp.toFixed(1) : '-'}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {offensivePlayer.fps ? offensivePlayer.fps.toFixed(1) : '-'}
                          </td>
                          <td className="py-2 text-right font-mono font-bold text-yellow-400">
                            {getProjectedPoints(player).toFixed(1)}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {idpPlayer.tier ? idpPlayer.tier : '-'}
                          </td>
                          <td className="py-2 text-right text-gray-400">
                            {player.byeWeek || '-'}
                          </td>
                          <td className="py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isPlayerTarget(player.id) && <span className="text-green-400" title="Target Player">🎯</span>}
                              {isPlayerAvoid(player.id) && <span className="text-red-400" title="Avoid Player">🚫</span>}
                              {getCustomRanking(player.id) && (
                                <span className="text-blue-400 text-xs" title={`Custom Ranking: ${getCustomRanking(player.id)}`}>
                                  #{getCustomRanking(player.id)}
                                </span>
                              )}
                              {getPlayerNote(player.id)?.note && (
                                <span className="text-gray-400" title="Has Notes">📝</span>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedPlayer(player)
                                  setShowPlayerNotes(true)
                                }}
                                className="ml-1 text-gray-400 hover:text-white transition-colors"
                                title="Add/Edit Notes"
                              >
                                ⚙️
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {/* Player Notes Modal */}
        {selectedPlayer && (
          <PlayerNotesModal
            player={selectedPlayer}
            isOpen={showPlayerNotes}
            onClose={() => {
              setShowPlayerNotes(false)
              setSelectedPlayer(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default App