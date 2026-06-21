/**
 * Smart Advisor Engine.
 * Integrates with Chrome's native Prompt API, remote Gemini API,
 * and a robust local rules-based engine.
 */

import { PREDEFINED_ACTIONS } from './actions.js';

// JSON schema for the assistant response
export const ASSISTANT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' }
    },
    category: { type: 'string', enum: ['home', 'transport', 'diet', 'shopping', 'general'] }
  },
  required: ['message', 'suggestedActions', 'category']
};

/**
 * Main function to generate advice based on user footprint context and user query.
 * @param {Object} params
 * @param {string} params.query - User prompt text
 * @param {Object} params.footprint - Calculated footprint breakdown {home, transport, diet, shopping, total}
 * @param {Array<string>} params.completedActionIds - IDs of actions already checked
 * @param {string} [params.geminiApiKey] - Optional Google Gemini API Key
 * @returns {Promise<{message: string, suggestedActions: Array<string>, category: string}>}
 */
export async function getAdvisorResponse({ query, footprint, completedActionIds, geminiApiKey }) {
  const normalizedQuery = (query || '').toLowerCase().trim();
  const context = compileUserContext(footprint, completedActionIds);
  
  // 1. Try Remote Gemini API if key is present
  if (geminiApiKey) {
    try {
      return await getGeminiApiResponse(normalizedQuery, context, geminiApiKey);
    } catch (e) {
      console.warn("Gemini API call failed, falling back to local/Prompt API:", e);
    }
  }

  // 2. Try Chrome Built-in LanguageModel (Prompt API)
  if ('LanguageModel' in globalThis) {
    try {
      const availability = await globalThis.LanguageModel.availability();
      if (availability !== 'unavailable') {
        return await getPromptApiResponse(normalizedQuery, context);
      }
    } catch (e) {
      console.warn("Chrome Prompt API failed, falling back to rules engine:", e);
    }
  }

  // 3. Resilient Fallback: Local Rules-Based Reasoner
  return getLocalRulesResponse(normalizedQuery, context);
}

/**
 * Compiles structural state context to feed to AI or local reasoning.
 */
function compileUserContext(footprint, completedActionIds) {
  const allPredefined = PREDEFINED_ACTIONS;
  const remainingActions = allPredefined.filter(a => !completedActionIds.includes(a.id));
  
  // Find highest emitter
  const breakdown = [
    { name: 'home', value: footprint.home || 0 },
    { name: 'transport', value: footprint.transport || 0 },
    { name: 'diet', value: footprint.diet || 0 },
    { name: 'shopping', value: footprint.shopping || 0 }
  ];
  breakdown.sort((a, b) => b.value - a.value);
  const highestCategory = breakdown[0].name;

  return {
    footprint,
    completedActionIds,
    remainingActions,
    highestCategory,
    totalSavedEstimated: allPredefined
      .filter(a => completedActionIds.includes(a.id))
      .reduce((sum, a) => sum + a.carbonSaving, 0)
  };
}

/**
 * Remote Gemini API Call
 */
async function getGeminiApiResponse(query, context, apiKey) {
  const systemPrompt = `You are Eco-Advisor, a smart carbon footprint coach.
You must help the user reduce their carbon footprint using their profile context.
User Carbon Profile Context:
- Annual Footprint: ${context.footprint.total} kg CO2e (Home: ${context.footprint.home}, Transport: ${context.footprint.transport}, Diet: ${context.footprint.diet}, Shopping: ${context.footprint.shopping})
- Highest Emitting Category: ${context.highestCategory}
- Completed Actions: [${context.completedActionIds.join(', ')}]
- Available Actions to Recommend: [${context.remainingActions.map(a => `${a.id} (${a.title}, saves ${a.carbonSaving}kg/yr)`).join(', ')}]

IMPORTANT: Write the "message" field as plain text only. Do NOT use any markdown formatting such as **bold**, *italic*, # headers, or backticks. Plain sentences only.

Respond strictly in valid JSON matching this schema:
${JSON.stringify(ASSISTANT_RESPONSE_SCHEMA, null, 2)}
Ensure the "suggestedActions" array contains action IDs from the Available Actions list that directly address the user's query.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Query: ${query}` }] }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: ASSISTANT_RESPONSE_SCHEMA
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API HTTP Error: ${response.status}`);
  }

  const responseData = await response.json();
  const text = responseData.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

/**
 * Chrome Prompt API (Gemini Nano on-device) Call
 */
async function getPromptApiResponse(query, context) {
  const systemPrompt = `You are Eco-Advisor. Return JSON strictly.
Profile: Total ${context.footprint.total} kg CO2e. Highest: ${context.highestCategory}.
Available Recommendations: ${context.remainingActions.map(a => a.id).join(', ')}.
Respond strictly matching this JSON schema:
${JSON.stringify(ASSISTANT_RESPONSE_SCHEMA)}`;

  const session = await globalThis.LanguageModel.create({
    initialPrompts: [
      { role: 'system', content: systemPrompt }
    ]
  });

  try {
    const result = await session.prompt(query, {
      responseConstraint: ASSISTANT_RESPONSE_SCHEMA
    });
    return JSON.parse(result);
  } finally {
    session.destroy();
  }
}

/**
 * Sophisticated rules-based local response generator.
 * Provides custom tailored carbon tips when AI is offline or unavailable.
 */
export function getLocalRulesResponse(query, context) {
  const remaining = context.remainingActions;
  const footprint = context.footprint;

  // Simple intent classification
  let category = 'general';
  let message = '';
  let suggestedIds = [];

  const matchesHome = ['home', 'energy', 'electric', 'gas', 'heat', 'bulb', 'light', 'thermostat', 'appliance', 'utility', 'solar'];
  const matchesTransport = ['transport', 'car', 'drive', 'flight', 'plane', 'bike', 'walk', 'transit', 'bus', 'train', 'miles'];
  const matchesDiet = ['diet', 'food', 'meat', 'vegan', 'vegetarian', 'eat', 'waste', 'compost', 'meal'];
  const matchesShopping = ['shop', 'clothes', 'purchase', 'buy', 'plastic', 'waste', 'repair', 'second-hand', 'electronics'];
  const matchesHelp = ['help', 'hello', 'hi', 'hey', 'start', 'advisor', 'who are you', 'how to use'];

  const queryContains = (keywords) => keywords.some(kw => query.includes(kw));

  if (queryContains(matchesHome)) {
    category = 'home';
    const highestNotice = footprint.home > 4000 ? 'Your home energy emissions are quite high (~' + footprint.home + ' kg CO2e/year).' : 'Your home emissions look moderate (~' + footprint.home + ' kg CO2e/year).';
    
    message = `${highestNotice} To reduce home energy footprint, prioritize upgrading your lighting to LED, washing laundry in cold water, and adjusting thermostat settings. Heating/cooling and water heating are the largest energy consumers. If you own your home, solar panels are a high-impact investment that can cut emissions by up to 3,000 kg CO2e/year.`;
    
    // Select relevant home actions
    suggestedIds = remaining.filter(a => a.category === 'home').slice(0, 3).map(a => a.id);
  } 
  else if (queryContains(matchesTransport)) {
    category = 'transport';
    const highestNotice = footprint.transport > 5000 ? 'Your transport emissions are a major component (~' + footprint.transport + ' kg CO2e/year).' : 'Your transport emissions are ~' + footprint.transport + ' kg CO2e/year.';
    
    message = `${highestNotice} Transportation emissions are heavily driven by single-occupancy gas vehicle travel and aviation. You can reduce this by walking or biking for short trips (under 2 miles), using public transit for weekly commutes, and practicing eco-driving (smooth acceleration saves up to 15% fuel). Eliminating just one short-haul flight saves 500 kg CO2e.`;
    
    suggestedIds = remaining.filter(a => a.category === 'transport').slice(0, 3).map(a => a.id);
  } 
  else if (queryContains(matchesDiet)) {
    category = 'diet';
    message = `Your diet footprint is currently estimated at ~${footprint.diet} kg CO2e/year. Plant-based diets (vegan and vegetarian) have a carbon footprint that is 50-60% lower than meat-heavy diets. Observing 'Meatless Mondays' or shifting to a 50% plant-based diet will make a dramatic difference. Additionally, minimizing food waste through meal prep prevents landfill methane emissions.`;
    
    suggestedIds = remaining.filter(a => a.category === 'diet').slice(0, 3).map(a => a.id);
  } 
  else if (queryContains(matchesShopping)) {
    category = 'shopping';
    message = `Your shopping and consumption footprint contributes ~${footprint.shopping} kg CO2e/year. Consumer goods carry high "embodied carbon" from manufacturing and global shipping. Try a minimalist approach: buy second-hand clothing, avoid single-use plastics, and opt to repair electronics and furniture instead of buying replacements.`;
    
    suggestedIds = remaining.filter(a => a.category === 'shopping').slice(0, 3).map(a => a.id);
  } 
  else if (queryContains(matchesHelp) || query === '') {
    category = 'general';
    message = `Hello! I am Eco-Advisor, your personal carbon coach. I analyze your current carbon footprint (~${footprint.total} kg CO2e/year) and offer tailored, actionable tips. 

Your highest emitting category is ${context.highestCategory.toUpperCase()} (${footprint[context.highestCategory]} kg CO2e/year). 

You have completed ${context.completedActionIds.length} actions, saving approximately ${context.totalSavedEstimated} kg CO2e/year!

Try asking me about specific categories:
- "How do I cut down transport emissions?"
- "Give me tips to save energy at home"
- "What can I change in my diet?"
- "How does my shopping affect my footprint?"`;

    // Suggest highest impact actions from the remaining actions list
    suggestedIds = remaining.sort((a, b) => b.carbonSaving - a.carbonSaving).slice(0, 2).map(a => a.id);
  } 
  else {
    category = 'general';
    message = `I analyzed your question. To reduce your carbon footprint (currently ${footprint.total} kg CO2e/year, with ${context.highestCategory} being your largest category), I recommend looking at your Action Center checklist. Taking simple actions like switching to LED bulbs or biking for short trips are practical ways to make a real difference. Let me know if you'd like details on home energy, transit, diet, or shopping.`;
    
    // Suggest highest impact remaining actions
    suggestedIds = remaining.sort((a, b) => b.carbonSaving - a.carbonSaving).slice(0, 2).map(a => a.id);
  }

  // Ensure suggestedIds is populated if empty
  if (suggestedIds.length === 0 && remaining.length > 0) {
    suggestedIds = [remaining[0].id];
  }

  return {
    message,
    suggestedActions: suggestedIds,
    category
  };
}
