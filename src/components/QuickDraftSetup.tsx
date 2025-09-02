import React, { useState } from 'react'
import { useDraftStore } from '../stores/draftStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DraftSettings, DraftTeam } from '../types'
import { playerDatabase } from '../lib/playerDatabase'

interface QuickDraftSetupProps {
  onStartDraft: () => void
  onBackToFull: () => void
}

export const QuickDraftSetup: React.FC<QuickDraftSetupProps> = ({ onStartDraft, onBackToFull }) => {
  const { initializeDraft } = useDraftStore()
  const { draftSettings, updateDraftSettings } = useSettingsStore()
  
  const [draftPosition, setDraftPosition] = useState(1)
  const [numberOfTeams, setNumberOfTeams] = useState(12)
  const [draftType, setDraftType] = useState<'snake' | 'linear'>('snake')
  const [pickTimeLimit, setPickTimeLimit] = useState(120)
  const [isLoading, setIsLoading] = useState(false)

  // Draft position strategy insights
  const getPositionStrategy = (position: number, teams: number, type: 'snake' | 'linear') => {
    const isEarly = position <= 3
    const isMiddle = position > 3 && position <= teams - 3
    const isLate = position > teams - 3

    if (type === 'snake') {
      if (isEarly) {
        return {
          title: "Early Pick Strategy",
          description: "Elite talent available, but long wait until next pick",
          tips: [
            "Consider the best player available",
            "RB1 or elite WR typically best value",
            "Plan for positional runs before your next pick"
          ],
          nextPick: `Your next pick: Round 2, Pick ${teams - position + 1}`
        }
      } else if (isLate) {
        return {
          title: "Late Pick Strategy", 
          description: "Back-to-back picks give flexibility",
          tips: [
            "Target complementary positions",
            "Consider reaching slightly for positional need",
            "Great spot for RB-RB or WR-WR start"
          ],
          nextPick: `Your next pick: Round 2, Pick ${position}`
        }
      } else {
        return {
          title: "Middle Pick Strategy",
          description: "Balanced approach with moderate wait times",
          tips: [
            "Best player available usually optimal",
            "Watch for positional runs",
            "Flexibility is your strength"
          ],
          nextPick: `Your next pick: Round 2, Pick ${teams - position + 1}`
        }
      }
    } else {
      return {
        title: "Linear Draft Strategy",
        description: "Same position every round",
        tips: [
          "Consistent timing makes planning easier",
          "Watch for positional runs more carefully",
          "BPA (Best Player Available) typically optimal"
        ],
        nextPick: `Your pick every round: Position ${position}`
      }
    }
  }

  const strategy = getPositionStrategy(draftPosition, numberOfTeams, draftType)

  const handleQuickStart = async () => {
    setIsLoading(true)
    
    try {
      const allPlayers = playerDatabase.getAllPlayers()
      
      if (allPlayers.length === 0) {
        alert('No player data found! Please import player rankings first.')
        setIsLoading(false)
        return
      }

      // Use existing roster settings or defaults
      const defaultRoster = {
        QB: 1, RB: 2, WR: 3, TE: 1, 'W-R-T': 2,
        K: 1, DEF: 1, DB: 1, DL: 1, LB: 1, BN: 6, IR: 1,
      }

      const quickSettings: DraftSettings = {
        numberOfTeams,
        userTeamIndex: draftPosition - 1,
        draftType,
        pickTimeLimit,
        rosterPositions: draftSettings?.rosterPositions || defaultRoster,
      }

      // Generate team names
      const teams: DraftTeam[] = Array.from({ length: numberOfTeams }, (_, index) => ({
        id: `team-${index}`,
        name: index === draftPosition - 1 ? 'Your Team' : `Team ${index + 1}`,
        roster: [],
        isUser: index === draftPosition - 1,
      }))
      
      updateDraftSettings(quickSettings)
      initializeDraft(quickSettings, teams, allPlayers)
      onStartDraft()
      
    } catch (error) {
      console.error('Failed to start draft:', error)
      alert('Failed to start draft. Please check your settings and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">⚡ Quick Draft Setup</h1>
            <p className="text-gray-300">Got your draft position? Let's get you ready in 60 seconds!</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">Essential Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Your Draft Position</label>
                <div className="relative">
                  <select
                    value={draftPosition}
                    onChange={(e) => setDraftPosition(parseInt(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-lg font-medium"
                  >
                    {Array.from({ length: 16 }, (_, i) => i + 1).map(pos => (
                      <option key={pos} value={pos}>Position {pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Number of Teams</label>
                <select
                  value={numberOfTeams}
                  onChange={(e) => setNumberOfTeams(parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  {[8, 10, 12, 14, 16].map(num => (
                    <option key={num} value={num}>{num} Teams</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Draft Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDraftType('snake')}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                      draftType === 'snake'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Snake
                  </button>
                  <button
                    onClick={() => setDraftType('linear')}
                    className={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                      draftType === 'linear'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Linear
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Pick Timer</label>
                <select
                  value={pickTimeLimit}
                  onChange={(e) => setPickTimeLimit(parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value={90}>90 seconds</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Strategy Card */}
          <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-blue-300">{strategy.title}</h3>
                <p className="text-gray-300">{strategy.description}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">#{draftPosition}</div>
                <div className="text-sm text-blue-300">of {numberOfTeams}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm font-medium text-blue-300 mb-2">Draft Strategy Tips:</div>
              <ul className="space-y-1">
                {strategy.tips.map((tip, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="text-blue-400">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-sm text-blue-300 bg-blue-800/30 rounded p-2">
              <strong>Pick Pattern:</strong> {strategy.nextPick}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={onBackToFull}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Full Setup Instead
            </button>
            
            <button
              onClick={handleQuickStart}
              disabled={isLoading}
              className={`px-8 py-3 text-lg font-bold rounded-lg transition-colors ${
                isLoading
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isLoading ? 'Starting Draft...' : `🚀 Start Draft (Position ${draftPosition})`}
            </button>
          </div>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-400">
              Using your custom player rankings and notes • Roster settings from previous setup or defaults
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}