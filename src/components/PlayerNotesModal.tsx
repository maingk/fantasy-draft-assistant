import React, { useState } from 'react'
import { Player } from '../types'
import { useUserPreferencesStore } from '../stores/userPreferencesStore'

interface PlayerNotesModalProps {
  player: Player
  isOpen: boolean
  onClose: () => void
}

export const PlayerNotesModal: React.FC<PlayerNotesModalProps> = ({
  player,
  isOpen,
  onClose,
}) => {
  const {
    getPlayerNote,
    addPlayerNote,
    setPlayerTarget,
    setPlayerAvoid,
    setCustomRanking,
    clearCustomRanking,
  } = useUserPreferencesStore()

  const playerNote = getPlayerNote(player.id)
  const [note, setNote] = useState(playerNote?.note || '')
  const [customRanking, setCustomRankingLocal] = useState(
    playerNote?.customRanking?.toString() || ''
  )

  if (!isOpen) return null

  const handleSave = () => {
    if (note.trim()) {
      addPlayerNote(player.id, note.trim())
    }
    
    if (customRanking.trim()) {
      const ranking = parseInt(customRanking.trim())
      if (!isNaN(ranking) && ranking > 0) {
        setCustomRanking(player.id, ranking)
      }
    } else if (playerNote?.customRanking) {
      clearCustomRanking(player.id)
    }
    
    onClose()
  }

  const handleTargetToggle = () => {
    const newTargetStatus = !playerNote?.isTarget
    setPlayerTarget(player.id, newTargetStatus)
  }

  const handleAvoidToggle = () => {
    const newAvoidStatus = !playerNote?.isAvoid
    setPlayerAvoid(player.id, newAvoidStatus)
  }

  const getProjectedPoints = () => {
    if ('fps' in player) return (player as any).fps
    if ('vorp' in player) return (player as any).vorp * 0.15
    if ('estimatedWeeklyPoints' in player) return (player as any).estimatedWeeklyPoints
    return 0
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{player.name}</h2>
            <div className="flex items-center gap-2 mt-1">
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
              <span className="text-gray-400">{player.team}</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400">Bye: {player.byeWeek || 'N/A'}</span>
            </div>
            <div className="text-sm text-gray-300 mt-1">
              Projected: {getProjectedPoints().toFixed(1)} pts/week
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Target/Avoid Toggles */}
          <div className="flex gap-3">
            <button
              onClick={handleTargetToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                playerNote?.isTarget
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="text-lg">🎯</span>
              {playerNote?.isTarget ? 'Remove Target' : 'Mark as Target'}
            </button>
            
            <button
              onClick={handleAvoidToggle}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                playerNote?.isAvoid
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="text-lg">🚫</span>
              {playerNote?.isAvoid ? 'Remove Avoid' : 'Mark as Avoid'}
            </button>
          </div>

          {/* Custom Ranking */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Custom Ranking (1 = highest priority)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={customRanking}
              onChange={(e) => setCustomRankingLocal(e.target.value)}
              placeholder="Leave empty for default ranking"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400"
            />
            <div className="text-xs text-gray-400 mt-1">
              Lower numbers = higher priority in your draft board
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Personal Notes
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes about this player (rookie potential, injury concerns, etc.)"
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 resize-none"
            />
          </div>

          {/* Player Stats Summary */}
          <div className="bg-gray-700 rounded p-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Current Rankings</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {('vorp' in player) && (
                <div>
                  <span className="text-gray-400">VORP:</span>
                  <span className="text-white ml-1">{(player as any).vorp?.toFixed(1) || 'N/A'}</span>
                </div>
              )}
              {('fps' in player) && (
                <div>
                  <span className="text-gray-400">FPS:</span>
                  <span className="text-white ml-1">{(player as any).fps?.toFixed(1) || 'N/A'}</span>
                </div>
              )}
              {('tier' in player) && (
                <div>
                  <span className="text-gray-400">Tier:</span>
                  <span className="text-white ml-1">{(player as any).tier || 'N/A'}</span>
                </div>
              )}
              {('estimatedWeeklyPoints' in player) && (
                <div>
                  <span className="text-gray-400">Est. Pts:</span>
                  <span className="text-white ml-1">{(player as any).estimatedWeeklyPoints?.toFixed(1) || 'N/A'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  )
}