import { describe, it, expect } from 'vitest';
import { getLocalRulesResponse } from '../assistant.js';

describe('Local Advisor Reasoning Engine', () => {
  const footprint = {
    home: 4500,
    transport: 6000,
    diet: 3300,
    shopping: 2500,
    total: 16300
  };
  
  const completedActionIds = ['led-bulbs'];
  
  // mock context
  const remainingActions = [
    { id: 'cold-wash', title: 'Wash Laundry in Cold Water', category: 'home', carbonSaving: 75, points: 30 },
    { id: 'smart-thermostat', title: 'Install a Smart Thermostat', category: 'home', carbonSaving: 340, points: 120 },
    { id: 'transit-weekly', title: 'Take Public Transit Weekly', category: 'transport', carbonSaving: 400, points: 100 },
    { id: 'meatless-mondays', title: 'Observe Meatless Mondays', category: 'diet', carbonSaving: 360, points: 80 }
  ];

  const context = {
    footprint,
    completedActionIds,
    remainingActions,
    highestCategory: 'transport',
    totalSavedEstimated: 150
  };

  it('should handle general inquiries and greetings', () => {
    const res = getLocalRulesResponse('hello there', context);
    expect(res.category).toBe('general');
    expect(res.message).toContain('Eco-Advisor');
    expect(res.message).toContain('16300'); // total footprint
    expect(res.message).toContain('TRANSPORT'); // highest category
    expect(res.suggestedActions.length).toBeGreaterThan(0);
  });

  it('should route home energy questions to home category tips', () => {
    const res = getLocalRulesResponse('how to reduce electricity bill?', context);
    expect(res.category).toBe('home');
    expect(res.message).toContain('home energy emissions');
    expect(res.suggestedActions).toContain('cold-wash');
    expect(res.suggestedActions).toContain('smart-thermostat');
  });

  it('should route travel inquiries to transit suggestions', () => {
    const res = getLocalRulesResponse('car miles emissions', context);
    expect(res.category).toBe('transport');
    expect(res.message).toContain('Transportation emissions');
    expect(res.suggestedActions).toContain('transit-weekly');
  });

  it('should route diet questions to diet suggestions', () => {
    const res = getLocalRulesResponse('what diet is best for the environment?', context);
    expect(res.category).toBe('diet');
    expect(res.message).toContain('diet footprint');
    expect(res.suggestedActions).toContain('meatless-mondays');
  });
});
