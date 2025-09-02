import React, { useEffect, useState } from 'react'
import { useDraftStore } from '../stores/draftStore'
import { useUserPreferencesStore } from '../stores/userPreferencesStore'
import { useSettingsStore } from '../stores/settingsStore'
import { Player } from '../types'
import { PlayerNotesModal } from './PlayerNotesModal'

interface DraftRoomProps {
  onBackToRankings?: () => void
}

export const DraftRoom: React.FC<DraftRoomProps> = ({ onBackToRankings }) => {
  const {
    isActive,
    currentPick,
    currentTeamIndex,
    teams,
    picks,
    timeRemaining,
    availablePlayers,
    recommendations,
    makePick,
    undoLastPick,
    pauseDraft,
    startDraft,
    updateTimer,
    generateRecommendations,
    markPlayerAsDrafted,
  } = useDraftStore()

  const {
    calculateAdjustedValue,
    isPlayerTarget,
    isPlayerAvoid,
    getCustomRanking,
    getPlayerNote,
  } = useUserPreferencesStore()

  const { draftSettings } = useSettingsStore()

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [showPlayerNotes, setShowPlayerNotes] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState<string>('ALL')

  // Timer effect
  useEffect(() => {
    if (!isActive || timeRemaining <= 0) return

    const timer = setInterval(() => {
      updateTimer(timeRemaining - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive, timeRemaining, updateTimer])

  // Auto-generate recommendations when it's user's turn
  useEffect(() => {
    if (draftSettings && teams[currentTeamIndex]?.isUser) {
      generateRecommendations()
    }
  }, [currentPick, currentTeamIndex, availablePlayers, draftSettings, generateRecommendations, teams])

  // Keyboard shortcut for search (Ctrl/Cmd + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentTeam = teams[currentTeamIndex]
  const isUserTurn = currentTeam?.isUser
  const totalPicks = draftSettings ? draftSettings.numberOfTeams * Object.values(draftSettings.rosterPositions).reduce((a, b) => a + b, 0) : 0

  const filteredPlayers = availablePlayers
    .filter(player => {
      if (positionFilter !== 'ALL' && player.position !== positionFilter) return false
      if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      // Use adjusted value that considers custom rankings and preferences
      const aBaseValue = 'vorp' in a ? (a as any).vorp : ('fps' in a ? (a as any).fps : 0)
      const bBaseValue = 'vorp' in b ? (b as any).vorp : ('fps' in b ? (b as any).fps : 0)
      const aAdjusted = calculateAdjustedValue(a, aBaseValue)
      const bAdjusted = calculateAdjustedValue(b, bBaseValue)
      return bAdjusted - aAdjusted
    })
    .slice(0, 100) // Show top 100 for performance

  const handlePlayerPick = (player: Player) => {
    if (!isActive) return
    
    if (isUserTurn) {
      // User's pick - go through full pick process
      makePick(player)
    } else {
      // Other team's pick - record and advance
      markPlayerAsDrafted(player, currentTeamIndex)
      
      // Clear search after recording a pick to reset view
      setSearchTerm('')
      setPositionFilter('ALL')
    }
  }

  const getPlayerDisplayValue = (player: Player): string => {
    const customRank = getCustomRanking(player.id)
    if (customRank) return `#${customRank}`
    
    if ('vorp' in player && (player as any).vorp > 0) {
      return (player as any).vorp.toFixed(1)
    }
    if ('fps' in player && (player as any).fps > 0) {
      return (player as any).fps.toFixed(1)
    }
    if ('estimatedWeeklyPoints' in player) {
      return (player as any).estimatedWeeklyPoints.toFixed(1)
    }
    return '-'
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              {onBackToRankings && (
                <button
                  onClick={onBackToRankings}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded transition-colors"
                  title="Back to Rankings"
                >
                  ← Back
                </button>
              )}
              <div>
                <h1 className="text-3xl font-bold">Draft Room</h1>
                <div className="text-gray-300">
                  Pick {currentPick} of {totalPicks} • Round {Math.ceil(currentPick / (draftSettings?.numberOfTeams || 1))}
                  {draftSettings?.draftType === 'snake' && (
                    <span className="ml-2 text-xs bg-blue-800 px-2 py-1 rounded">
                      🐍 Snake Draft
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${timeRemaining <= 30 ? 'text-red-400' : timeRemaining <= 60 ? 'text-yellow-400' : 'text-green-400'}`}>
                {formatTime(timeRemaining)}
              </div>
              <div className="text-sm text-gray-400">Time Remaining</div>
            </div>
          </div>

          {/* Current Pick Info */}
          <div className={`${isUserTurn ? 'bg-green-800 border-green-500' : 'bg-yellow-900 border-yellow-500'} border-2 rounded p-4 mb-4`}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xl font-bold">
                  {isUserTurn ? '🎯 YOUR PICK - Wyld Stallyns' : `📋 RECORD PICK: ${currentTeam?.name || 'Team'}`}
                </div>
                <div className="text-sm opacity-90">
                  {isUserTurn 
                    ? 'Choose your player from the list below' 
                    : 'Click on the player that this team just picked'
                  }
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={isActive ? pauseDraft : startDraft}
                  className={`px-4 py-2 rounded font-medium transition-colors ${
                    isActive 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isActive ? 'Pause Draft' : 'Resume Draft'}
                </button>
                <button
                  onClick={undoLastPick}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium transition-colors"
                  disabled={currentPick === 1}
                >
                  Undo Pick
                </button>
              </div>
            </div>
          </div>

          {/* Recent Picks */}
          {picks.length > 0 && (
            <div className="bg-gray-700 rounded p-3 mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Recent Picks</h4>
              <div className="flex gap-2 overflow-x-auto">
                {picks.slice(-6).reverse().map((pick) => (
                  <div key={pick.pickNumber} className="flex-shrink-0 bg-gray-600 rounded p-2 text-xs">
                    <div className="font-medium">#{pick.pickNumber}</div>
                    <div className="text-gray-300">{teams[pick.teamIndex]?.name}</div>
                    <div className="font-medium">{pick.player?.name}</div>
                    <div className="text-gray-400">{pick.player?.position}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations for User */}
          {isUserTurn && recommendations.length > 0 && (
            <div className="bg-blue-900/30 border border-blue-500/50 rounded p-4">
              <h3 className="text-lg font-semibold mb-3 text-blue-300">🤖 AI Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {recommendations.slice(0, 3).map((rec, index) => (
                  <button
                    key={rec.player.id}
                    onClick={() => handlePlayerPick(rec.player)}
                    className="bg-gray-700 hover:bg-gray-600 rounded p-3 text-left transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">{index + 1}. {rec.player.name}</div>
                        <div className="text-sm text-gray-300">{rec.player.position} - {rec.player.team}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-yellow-400">
                          {getPlayerDisplayValue(rec.player)}
                        </div>
                        {isPlayerTarget(rec.player.id) && <span className="text-green-400">🎯</span>}
                        {getCustomRanking(rec.player.id) && <span className="text-blue-400 text-xs">Custom</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{rec.reason}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Available Players */}
          <div className="col-span-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xl font-bold">Available Players</h2>
                  {!isUserTurn && (
                    <div className="text-sm bg-yellow-800 text-yellow-200 px-3 py-1 rounded">
                      💡 Tip: Use search to quickly find the player that {currentTeam?.name} just picked
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder={isUserTurn ? "Search for players to draft..." : "🔍 Search for the player that was just picked..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full bg-gray-700 border rounded px-4 py-2 text-sm ${
                        !isUserTurn 
                          ? 'border-yellow-500 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400' 
                          : 'border-gray-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
                      } focus:outline-none`}
                      autoFocus={!isUserTurn}
                    />
                    {searchTerm && (
                      <div className="text-xs text-gray-400 mt-1">
                        Showing {filteredPlayers.length} of {availablePlayers.length} players
                      </div>
                    )}
                  </div>
                  <select
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                  >
                    <option value="ALL">All Positions</option>
                    <option value="QB">QB</option>
                    <option value="RB">RB</option>
                    <option value="WR">WR</option>
                    <option value="TE">TE</option>
                    <option value="K">K</option>
                    <option value="DEF">DEF</option>
                    <option value="LB">LB</option>
                    <option value="DB">DB</option>
                    <option value="DL">DL</option>
                  </select>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm transition-colors"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2">#</th>
                      <th className="text-left py-2">Player</th>
                      <th className="text-left py-2">Pos</th>
                      <th className="text-left py-2">Team</th>
                      <th className="text-right py-2">Value</th>
                      <th className="text-center py-2">Tags</th>
                      <th className="text-center py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((player, index) => (
                      <tr key={player.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 font-medium text-gray-400">{index + 1}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{player.name}</span>
                            {getPlayerNote(player.id)?.note && (
                              <button
                                onClick={() => {
                                  setSelectedPlayer(player)
                                  setShowPlayerNotes(true)
                                }}
                                className="text-gray-400 hover:text-white"
                                title="View notes"
                              >
                                📝
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            player.position === 'QB' ? 'bg-green-900 text-green-200' :
                            player.position === 'RB' ? 'bg-yellow-900 text-yellow-200' :
                            player.position === 'WR' ? 'bg-purple-900 text-purple-200' :
                            player.position === 'TE' ? 'bg-red-900 text-red-200' :
                            player.position === 'K' ? 'bg-blue-900 text-blue-200' :
                            'bg-gray-700 text-gray-200'
                          }`}>
                            {player.position}
                          </span>
                        </td>
                        <td className="py-2 text-gray-300">{player.team}</td>
                        <td className="py-2 text-right font-mono">
                          <span className={getCustomRanking(player.id) ? 'text-blue-400 font-bold' : ''}>
                            {getPlayerDisplayValue(player)}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <div className="flex justify-center gap-1">
                            {isPlayerTarget(player.id) && <span title="Target Player">🎯</span>}
                            {isPlayerAvoid(player.id) && <span title="Avoid Player">🚫</span>}
                            {getCustomRanking(player.id) && <span title="Custom Ranking" className="text-blue-400 text-xs">#</span>}
                          </div>
                        </td>
                        <td className="py-2 text-center">
                          <button
                            onClick={() => handlePlayerPick(player)}
                            disabled={!isActive}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              !isActive 
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : isUserTurn
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            }`}
                          >
                            {isUserTurn ? 'DRAFT' : 'RECORD'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Team Rosters */}
          <div className="col-span-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-4">Team Rosters</h2>
              <div className="space-y-3">
                {teams.map((team, index) => (
                  <div 
                    key={team.id} 
                    className={`bg-gray-700 rounded p-3 ${index === currentTeamIndex ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium flex items-center gap-2">
                        {team.isUser && <span>👤</span>}
                        {team.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {team.roster.length} picks
                      </div>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {team.roster.map((player, playerIndex) => (
                        <div key={player.id} className="text-sm flex justify-between">
                          <span>{player.name}</span>
                          <span className="text-gray-400">{player.position}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

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