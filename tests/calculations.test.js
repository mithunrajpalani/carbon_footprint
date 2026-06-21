import { describe, it, expect } from 'vitest';
import {
  calculateHomeEmissions,
  calculateTransportEmissions,
  calculateDietEmissions,
  calculateShoppingEmissions,
  calculateTotalFootprint
} from '../calculations.js';

describe('Carbon Calculations', () => {
  it('should calculate home energy emissions correctly', () => {
    const emissions = calculateHomeEmissions({
      electricity: 300, // kWh/month
      naturalGas: 30,   // SCM/month
      heatingOil: 0,    // Cylinders
      waste: 15,        // kg/week
      recycle: false
    });
    // Expected:
    // Elec = 300 * 12 * 0.82 = 2952
    // Gas = 30 * 12 * 2.0 = 720
    // Waste = 15 * 52 * 0.5 = 390
    // Total = 2952 + 720 + 390 = 4062
    expect(emissions).toBeCloseTo(4062, 1);
  });
  
  it('should apply discount if recycling is active', () => {
    const emissionsNoRecycle = calculateHomeEmissions({ electricity: 0, naturalGas: 0, heatingOil: 0, waste: 10, recycle: false });
    const emissionsRecycle = calculateHomeEmissions({ electricity: 0, naturalGas: 0, heatingOil: 0, waste: 10, recycle: true });
    
    // waste: 10 * 52 * 0.5 = 260
    // recycle: 260 * (1 - 0.4) = 156
    expect(emissionsNoRecycle).toBe(260);
    expect(emissionsRecycle).toBe(156);
  });

  it('should calculate vehicle transport emissions correctly', () => {
    const emissionsIce = calculateTransportEmissions({
      vehicleKm: 10000,
      vehicleType: 'ice',
      vehicleKml: 25,
      transitKm: 0,
      flightHours: 0
    });
    // Expected: (10000 / 25) * 2.35 = 940
    expect(emissionsIce).toBeCloseTo(940, 1);

    const emissionsEv = calculateTransportEmissions({
      vehicleKm: 10000,
      vehicleType: 'ev',
      vehicleKml: 25,
      transitKm: 0,
      flightHours: 0
    });
    // Expected: 10000 * 0.15 * 0.82 = 1230
    expect(emissionsEv).toBeCloseTo(1230, 1);
  });

  it('should calculate flight emissions correctly', () => {
    const emissions = calculateTransportEmissions({
      vehicleKm: 0,
      vehicleType: 'none',
      vehicleKml: 0,
      transitKm: 0,
      flightHours: 10
    });
    // Expected: 10 * 250 = 2500
    expect(emissions).toBe(2500);
  });

  it('should sanitize negative inputs to zero', () => {
    const emissions = calculateHomeEmissions({
      electricity: -300,
      naturalGas: -30,
      heatingOil: -1,
      waste: -15,
      recycle: false
    });
    expect(emissions).toBe(0);
  });

  it('should compute total footprint breakdown correctly', () => {
    const total = calculateTotalFootprint({
      electricity: 300,
      naturalGas: 30,
      heatingOil: 0,
      waste: 15,
      recycle: false,
      vehicleMiles: 10000, // mapped to vehicleKm internally
      vehicleType: 'ice',
      vehicleMpg: 25,      // mapped to vehicleKml internally
      transitMiles: 20,    // mapped to transitKm internally
      flightHours: 6,
      dietType: 'high-meat',
      shoppingHabit: 'average'
    });

    // Home: 4062
    // Transport: Ice = (10000 / 25) * 2.35 = 940, transit = 20 * 52 * 0.05 = 52, flight = 6 * 250 = 1500 -> 940 + 52 + 1500 = 2492
    // Diet: high-meat = 3300
    // Shopping: average = 2500
    expect(total.home).toBe(4062);
    expect(total.transport).toBe(2492);
    expect(total.diet).toBe(3300);
    expect(total.shopping).toBe(2500);
    expect(total.total).toBe(4062 + 2492 + 3300 + 2500);
  });
});
