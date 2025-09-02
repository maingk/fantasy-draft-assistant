# Fantasy Draft Assistant

A comprehensive React-based fantasy football draft tool that helps you dominate your draft with AI-powered recommendations, custom player rankings, and real-time draft tracking.

## Features

### 🏈 Live Draft Interface
- **Real-time draft room** with timer and pick tracking
- **Manual pick recording** for other teams during live drafts
- **Snake and linear draft support** with proper turn calculation
- **Smart recommendations** based on available players and positional needs
- **Search functionality** to quickly find any player during the draft

### 📊 Player Management
- **CSV import** support for player rankings from multiple sources
- **Custom player rankings** with ability to override expert rankings
- **Player notes system** for tracking your research and insights
- **Target/Avoid lists** with automatic value adjustments
- **Team preferences** to boost or avoid players from specific NFL teams

### ⚡ Quick Setup Options
- **Full draft setup** with detailed roster configuration and team management
- **Quick draft setup** for last-minute draft position assignments
- **Position-specific strategy tips** based on your draft position (early/middle/late)
- **Flexible roster configurations** supporting various league formats

### 🧠 AI-Powered Recommendations
- **Positional need analysis** that considers your current roster gaps
- **Value-based recommendations** using VORP (Value Over Replacement Player)
- **Custom ranking integration** that factors in your personal research
- **Smart filtering** that won't suggest filled positions unless they're targets

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/maingk/fantasy-draft-assistant.git
cd fantasy-draft-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## Usage

### Setting Up Your Draft

1. **Import Player Data**: Upload CSV files with player rankings from your preferred sources
2. **Add Player Notes**: Research rookies and key players, add custom rankings and notes
3. **Configure Draft Settings**: Set up teams, roster positions, and draft type
4. **Choose Setup Method**:
   - **Full Setup**: When you know all draft details in advance
   - **Quick Setup**: When draft position is determined last-minute

### During the Draft

1. **Make Your Picks**: Click recommended players or search for specific targets
2. **Record Other Teams' Picks**: Use the search feature to quickly find and record picks
3. **Follow Recommendations**: AI suggests best available players based on your needs
4. **Track Progress**: Monitor roster construction and remaining needs

### Player Notes & Rankings

- **Custom Rankings**: Rate players 1-999 (1 = highest priority)
- **Target Players**: 20% value boost for must-have players
- **Avoid Players**: 40% value penalty for players to avoid
- **Personal Notes**: Track injury concerns, sleepers, and research insights

## CSV Import Format

The app supports various CSV formats. Common headers include:
- `Player`, `Name`, or `player_name`
- `Position`, `Pos`, or `position`
- `Team` or `team`
- `Rank`, `Ranking`, or `overall_rank`

## Draft Strategies by Position

### Early Picks (1-3)
- Elite talent available but long wait until next pick
- Consider best player available
- RB1 or elite WR typically best value

### Middle Picks (4-9)
- Balanced approach with moderate wait times
- Best player available usually optimal
- Watch for positional runs

### Late Picks (10-12+)
- Back-to-back picks provide flexibility
- Great spot for RB-RB or WR-WR start
- Consider reaching for positional need

## Technical Details

- **Framework**: React 18 with TypeScript
- **State Management**: Zustand with persistence
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Data Processing**: Papa Parse for CSV handling

## Contributing

This is a personal draft tool, but suggestions and improvements are welcome! Feel free to open issues or submit pull requests.

## License

MIT License - feel free to use and modify for your own drafts!

---

**Good luck dominating your draft! 🏆**