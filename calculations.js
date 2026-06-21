/**
 * Carbon footprint calculation formulas and constants tailored for India.
 * Values are based on standard Indian grid intensity (Central Electricity Authority - CEA),
 * and standard IPCC/DEFRA conversion factors converted to metric.
 */

export const EMISSION_FACTORS = {
  // Home Energy (kg CO2e per unit)
  electricityKWh: 0.82,        // Indian Grid average grid intensity (kg/kWh) - primarily coal-powered
  pipedGasSCM: 2.0,            // Piped Natural Gas (PNG) per Standard Cubic Meter (kg/SCM)
  lpgCylinder: 42.5,           // LPG emissions per standard domestic cylinder (14.2 kg)
  wasteKg: 0.5,                // Solid waste landfilling (kg/kg)
  wasteRecycledDiscount: 0.4,  // Discount multiplier if recycling/composting is active

  // Transport (kg CO2e per km/hour)
  petrolLitre: 2.35,           // Carbon dioxide emissions from gasoline/petrol (kg/litre)
  evKWhPerKm: 0.15,            // Average EV consumption: 0.15 kWh/km
  transitKm: 0.05,             // Average public transit emissions in India (metro, bus) (kg/passenger-km)
  flightHour: 250.0,           // Average commercial aviation factor (kg/passenger-hour)

  // Diet (kg CO2e per year)
  diet: {
    highMeat: 3300,            // Meat-heavy diet (daily non-veg)
    lowMeat: 2500,             // Low meat diet (poultry/fish/occasional meat)
    vegetarian: 1700,          // Vegetarian (standard Indian veg with dairy)
    vegan: 1500,               // Vegan (pure plant-based, no dairy/ghee)
  },

  // Shopping & Consumption (kg CO2e per year)
  shopping: {
    minimalist: 1000,          // Eco-conscious, low consumerism, repairing
    average: 2500,             // Standard consumer habits
    heavy: 5000,               // Frequent purchases of new electronics, fast fashion
  }
};

/**
 * Validates that an input is a non-negative number.
 * Falls back to 0 if invalid.
 * @param {any} val 
 * @returns {number}
 */
function sanitizeInput(val) {
  const num = Number(val);
  return isNaN(num) || num < 0 ? 0 : num;
}

/**
 * Calculates home emissions in kg CO2e per year.
 */
export function calculateHomeEmissions({ electricity, naturalGas, heatingOil, waste, recycle }) {
  const elec = sanitizeInput(electricity) * 12 * EMISSION_FACTORS.electricityKWh;
  const gas = sanitizeInput(naturalGas) * 12 * EMISSION_FACTORS.pipedGasSCM;
  const lpg = sanitizeInput(heatingOil) * 12 * EMISSION_FACTORS.lpgCylinder; // LPG cylinders/month
  
  const wasteMultiplier = recycle ? (1 - EMISSION_FACTORS.wasteRecycledDiscount) : 1;
  const solidWaste = sanitizeInput(waste) * 52 * EMISSION_FACTORS.wasteKg * wasteMultiplier; // weekly to annual

  return elec + gas + lpg + solidWaste;
}

/**
 * Calculates transport emissions in kg CO2e per year.
 */
export function calculateTransportEmissions({ vehicleKm, vehicleType, vehicleKml, transitKm, flightHours }) {
  let vehicleEmissions = 0;
  const km = sanitizeInput(vehicleKm);
  const kml = sanitizeInput(vehicleKml);

  if (km > 0) {
    if (vehicleType === 'ev') {
      // EV emissions = km * kWh/km * grid intensity
      vehicleEmissions = km * EMISSION_FACTORS.evKWhPerKm * EMISSION_FACTORS.electricityKWh;
    } else {
      // ICE emissions = (km / km/l) * petrol emissions factor
      const litresUsed = kml > 0 ? (km / kml) : (km / 15); // Fallback to 15 km/l average
      vehicleEmissions = litresUsed * EMISSION_FACTORS.petrolLitre;
    }
  }

  const transit = sanitizeInput(transitKm) * 52 * EMISSION_FACTORS.transitKm; // weekly to annual
  const aviation = sanitizeInput(flightHours) * EMISSION_FACTORS.flightHour;

  return vehicleEmissions + transit + aviation;
}

/**
 * Calculates diet emissions in kg CO2e per year.
 */
export function calculateDietEmissions(dietType) {
  switch (dietType) {
    case 'vegan':
      return EMISSION_FACTORS.diet.vegan;
    case 'vegetarian':
      return EMISSION_FACTORS.diet.vegetarian;
    case 'low-meat':
      return EMISSION_FACTORS.diet.lowMeat;
    case 'high-meat':
    default:
      return EMISSION_FACTORS.diet.highMeat;
  }
}

/**
 * Calculates shopping and consumption emissions in kg CO2e per year.
 */
export function calculateShoppingEmissions(shoppingHabit) {
  switch (shoppingHabit) {
    case 'minimalist':
      return EMISSION_FACTORS.shopping.minimalist;
    case 'heavy':
      return EMISSION_FACTORS.shopping.heavy;
    case 'average':
    default:
      return EMISSION_FACTORS.shopping.average;
  }
}

/**
 * Calculates total footprint and returns detailed breakdown.
 */
export function calculateTotalFootprint(data) {
  const home = calculateHomeEmissions({
    electricity: data.electricity || 0,
    naturalGas: data.naturalGas || 0,
    heatingOil: data.heatingOil || 0,
    waste: data.waste || 0,
    recycle: !!data.recycle,
  });

  const transport = calculateTransportEmissions({
    vehicleKm: data.vehicleKm || 0,
    vehicleType: data.vehicleType || 'ice',
    vehicleKml: data.vehicleKml || 15,
    transitKm: data.transitKm || 0,
    flightHours: data.flightHours || 0,
  });

  const diet = calculateDietEmissions(data.dietType || 'high-meat');
  const shopping = calculateShoppingEmissions(data.shoppingHabit || 'average');

  const total = home + transport + diet + shopping;

  return {
    home: Math.round(home),
    transport: Math.round(transport),
    diet: Math.round(diet),
    shopping: Math.round(shopping),
    total: Math.round(total)
  };
}
