import React, { useState } from 'react'
import { useDraftStore } from '../stores/draftStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DraftSettings, DraftTeam } from '../types'
import { playerDatabase } from '../lib/playerDatabase'

interface DraftSetupProps {
  onStartDraft: () => void
  onQuickSetup?: () => void
}

export const DraftSetup: React.FC<DraftSetupProps> = ({ onStartDraft, onQuickSetup }) => {
  const { initializeDraft } = useDraftStore()
  const { draftSettings, updateDraftSettings } = useSettingsStore()
  
  const [teams, setTeams] = useState<DraftTeam[]>([])
  const [userTeamIndex, setUserTeamIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const defaultSettings: DraftSettings = {
    numberOfTeams: 12,
    userTeamIndex: 0,
    draftType: 'snake',
    pickTimeLimit: 120,
    rosterPositions: {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 1,
      'W-R-T': 2,
      K: 1,
      DEF: 1,
      DB: 1,
      DL: 1,
      LB: 1,
      BN: 6,
      IR: 1,
    },
  }

  const currentSettings = draftSettings || defaultSettings

  React.useEffect(() => {
    // Initialize teams when number changes
    const newTeams = Array.from({ length: currentSettings.numberOfTeams }, (_, index) => ({
      id: `team-${index}`,
      name: index === userTeamIndex ? 'Your Team' : `Team ${index + 1}`,
      roster: [],
      isUser: index === userTeamIndex,
    }))
    setTeams(newTeams)
  }, [currentSettings.numberOfTeams, userTeamIndex])

  const handleSettingsChange = (key: keyof DraftSettings, value: any) => {
    const newSettings = { ...currentSettings, [key]: value }
    updateDraftSettings(newSettings)
  }

  const handleRosterPositionChange = (position: string, value: number) => {
    const newRosterPositions = { ...currentSettings.rosterPositions, [position]: value }
    handleSettingsChange('rosterPositions', newRosterPositions)
  }

  const handleTeamNameChange = (index: number, name: string) => {
    const newTeams = teams.map((team, i) => 
      i === index ? { ...team, name } : team
    )
    setTeams(newTeams)
  }

  const handleStartDraft = async () => {
    setIsLoading(true)
    
    try {
      // Get all players from database
      const allPlayers = playerDatabase.getAllPlayers()
      
      if (allPlayers.length === 0) {
        alert('No player data found! Please import player rankings first.')
        setIsLoading(false)
        return
      }

      // Update settings with current user team
      const finalSettings = {
        ...currentSettings,
        userTeamIndex,
      }
      
      updateDraftSettings(finalSettings)
      
      // Initialize the draft
      initializeDraft(finalSettings, teams, allPlayers)
      
      // Start the draft
      onStartDraft()
      
    } catch (error) {
      console.error('Failed to start draft:', error)
      alert('Failed to start draft. Please check your settings and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const totalRosterSpots = Object.values(currentSettings.rosterPositions).reduce((a, b) => a + b, 0)
  const totalDraftPicks = currentSettings.numberOfTeams * totalRosterSpots

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Draft Setup</h1>
            <p className="text-gray-300">Configure your draft settings and teams before starting</p>
            
            {onQuickSetup && (
              <div className="mt-4">
                <button
                  onClick={onQuickSetup}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  ⚡ Quick Setup (Got your draft position?)
                </button>
                <p className="text-sm text-gray-400 mt-2">Perfect for last-minute draft position assignments</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Basic Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Number of Teams</label>
                  <select
                    value={currentSettings.numberOfTeams}
                    onChange={(e) => handleSettingsChange('numberOfTeams', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    {[8, 10, 12, 14, 16].map(num => (
                      <option key={num} value={num}>{num} Teams</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Draft Type</label>
                  <select
                    value={currentSettings.draftType}
                    onChange={(e) => handleSettingsChange('draftType', e.target.value as 'snake' | 'linear')}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="snake">Snake Draft</option>
                    <option value="linear">Linear Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Pick Time Limit</label>
                  <select
                    value={currentSettings.pickTimeLimit}
                    onChange={(e) => handleSettingsChange('pickTimeLimit', parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value={60}>1 minute</option>
                    <option value={90}>1.5 minutes</option>
                    <option value={120}>2 minutes</option>
                    <option value={180}>3 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-700 rounded">
                <div className="text-sm text-gray-300">
                  <strong>Draft Summary:</strong> {totalDraftPicks} total picks • 
                  {Math.ceil(totalDraftPicks / currentSettings.numberOfTeams)} rounds • 
                  Estimated time: {Math.ceil((totalDraftPicks * currentSettings.pickTimeLimit) / 60)} minutes
                </div>
              </div>
            </div>

            {/* Roster Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Roster Positions</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(currentSettings.rosterPositions).map(([position, count]) => (
                  <div key={position}>
                    <label className="block text-sm font-medium mb-2">
                      {position === 'W-R-T' ? 'Flex (W/R/T)' : position}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={count}
                      onChange={(e) => handleRosterPositionChange(position, parseInt(e.target.value) || 0)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-gray-700 rounded">
                <div className="text-sm text-gray-300">
                  <strong>Total roster spots:</strong> {totalRosterSpots}
                </div>
              </div>
            </div>

            {/* Teams */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Teams</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Your Team Position</label>
                <select
                  value={userTeamIndex}
                  onChange={(e) => setUserTeamIndex(parseInt(e.target.value))}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  {teams.map((_, index) => (
                    <option key={index} value={index}>
                      Position {index + 1} {currentSettings.draftType === 'snake' && index === 0 && '(1st pick, last pick in round 2)'}
                      {currentSettings.draftType === 'snake' && index === teams.length - 1 && '(Last pick, first pick in round 2)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team, index) => (
                  <div key={team.id} className={`p-3 rounded ${team.isUser ? 'bg-blue-900/50 border border-blue-500' : 'bg-gray-700'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {team.isUser && <span className="text-blue-400">👤</span>}
                      <span className="text-sm font-medium">Team {index + 1}</span>
                      {team.isUser && <span className="text-xs bg-blue-600 px-2 py-1 rounded">YOU</span>}
                    </div>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleTeamNameChange(index, e.target.value)}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                      placeholder={`Team ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <button
                onClick={handleStartDraft}
                disabled={isLoading}
                className={`px-8 py-4 text-lg font-bold rounded-lg transition-colors ${
                  isLoading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isLoading ? 'Starting Draft...' : 'Start Draft 🚀'}
              </button>
              
              <div className="mt-4 text-sm text-gray-400">
                Make sure you've imported your player rankings before starting!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}