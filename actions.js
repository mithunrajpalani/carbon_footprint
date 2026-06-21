/**
 * Database of carbon reduction actions and gamification logic.
 */

export const PREDEFINED_ACTIONS = [
  // --- HOME ENERGY ---
  {
    id: 'led-bulbs',
    title: 'Switch to LED Bulbs',
    category: 'home',
    difficulty: 'easy',
    carbonSaving: 150, // kg CO2e/year
    points: 50,
    description: 'Replace standard incandescent bulbs with Energy Star LEDs. They use 75% less energy.'
  },
  {
    id: 'cold-wash',
    title: 'Wash Laundry in Cold Water',
    category: 'home',
    difficulty: 'easy',
    carbonSaving: 75,
    points: 30,
    description: 'About 75% to 90% of all energy your washing machine uses goes to heating the water.'
  },
  {
    id: 'smart-thermostat',
    title: 'Install a Smart Thermostat',
    category: 'home',
    difficulty: 'medium',
    carbonSaving: 340,
    points: 120,
    description: 'Optimize heating and cooling cycles. Set thermostats lower in winter and higher in summer.'
  },
  {
    id: 'air-dry',
    title: 'Air-Dry Clothes',
    category: 'home',
    difficulty: 'easy',
    carbonSaving: 200,
    points: 60,
    description: 'Hang dry clothes instead of using a tumble dryer. Tumble dryers are major electricity consumers.'
  },
  {
    id: 'solar-panels',
    title: 'Install Solar Panels',
    category: 'home',
    difficulty: 'hard',
    carbonSaving: 3000,
    points: 800,
    description: 'Generate clean energy locally and feed excess electricity back into the grid.'
  },

  // --- TRANSPORTATION ---
  {
    id: 'transit-weekly',
    title: 'Take Public Transit Weekly',
    category: 'transport',
    difficulty: 'easy',
    carbonSaving: 400,
    points: 100,
    description: 'Replace one or two solo driving commutes a week with bus, train, or subway rides.'
  },
  {
    id: 'bike-short-trips',
    title: 'Walk or Bike Short Trips',
    category: 'transport',
    difficulty: 'medium',
    carbonSaving: 250,
    points: 150,
    description: 'Avoid short drives (under 2 miles) where internal combustion engines are least efficient.'
  },
  {
    id: 'eco-driving',
    title: 'Practice Eco-Driving',
    category: 'transport',
    difficulty: 'easy',
    carbonSaving: 180,
    points: 50,
    description: 'Maintain smooth acceleration, respect speed limits, and avoid idling to reduce fuel use.'
  },
  {
    id: 'avoid-flight',
    title: 'Avoid One Short-Haul Flight',
    category: 'transport',
    difficulty: 'medium',
    carbonSaving: 500,
    points: 250,
    description: 'Take a train or conduct virtual meetings instead of flying for domestic trips.'
  },

  // --- DIET & FOOD ---
  {
    id: 'meatless-mondays',
    title: 'Observe Meatless Mondays',
    category: 'diet',
    difficulty: 'easy',
    carbonSaving: 360,
    points: 80,
    description: 'Go vegetarian or vegan one day a week. Animal agriculture is a major driver of global emissions.'
  },
  {
    id: 'half-plant-based',
    title: 'Go 50% Plant-Based',
    category: 'diet',
    difficulty: 'medium',
    carbonSaving: 800,
    points: 200,
    description: 'Substitute dairy and red meat with plant-based alternatives for half of your weekly meals.'
  },
  {
    id: 'compost-food',
    title: 'Compost Organic Waste',
    category: 'diet',
    difficulty: 'easy',
    carbonSaving: 120,
    points: 50,
    description: 'Diverting organic waste from landfills prevents the formation of methane, a potent greenhouse gas.'
  },
  {
    id: 'meal-prep-zero-waste',
    title: 'Reduce Food Waste',
    category: 'diet',
    difficulty: 'easy',
    carbonSaving: 150,
    points: 60,
    description: 'Plan your meals, store food properly, and eat leftovers to avoid throwing away food.'
  },

  // --- SHOPPING & WASTE ---
  {
    id: 'second-hand-clothes',
    title: 'Buy Second-Hand Clothes',
    category: 'shopping',
    difficulty: 'easy',
    carbonSaving: 120,
    points: 70,
    description: 'Extend the lifespan of existing garments. The fashion industry accounts for ~8-10% of global emissions.'
  },
  {
    id: 'zero-single-use',
    title: 'Eliminate Single-Use Plastics',
    category: 'shopping',
    difficulty: 'easy',
    carbonSaving: 50,
    points: 40,
    description: 'Carry reusable shopping bags, water bottles, and coffee cups everywhere.'
  },
  {
    id: 'repair-first',
    title: 'Repair Before Replacing',
    category: 'shopping',
    difficulty: 'medium',
    carbonSaving: 300,
    points: 180,
    description: 'Mend clothes, repair electronics, and fix furniture instead of buying brand new replacements.'
  }
];

/**
 * Calculates user level and experience requirements.
 * Levels are linear at every 300 XP.
 * @param {number} totalPoints 
 * @returns {{level: number, currentXp: number, nextLevelXp: number, progressPct: number}}
 */
export function calculateLevelMetrics(totalPoints) {
  const pointsPerLevel = 300;
  const level = Math.floor(totalPoints / pointsPerLevel) + 1;
  const currentXp = totalPoints % pointsPerLevel;
  const progressPct = Math.round((currentXp / pointsPerLevel) * 100);

  return {
    level,
    currentXp,
    nextLevelXp: pointsPerLevel,
    progressPct
  };
}

/**
 * Returns all active actions, combining predefined and custom ones.
 * @param {Array} customActions 
 * @returns {Array}
 */
export function getAllActions(customActions = []) {
  return [...PREDEFINED_ACTIONS, ...customActions];
}

/**
 * Calculates completed action stats.
 * @param {Array<string>} completedIds 
 * @param {Array} customActions 
 * @returns {{totalCarbonSaved: number, totalPoints: number}}
 */
export function calculateCompletedStats(completedIds, customActions = []) {
  const allActions = getAllActions(customActions);
  let totalCarbonSaved = 0;
  let totalPoints = 0;

  completedIds.forEach(id => {
    const action = allActions.find(a => a.id === id);
    if (action) {
      totalCarbonSaved += action.carbonSaving;
      totalPoints += action.points;
    }
  });

  return {
    totalCarbonSaved,
    totalPoints
  };
}
