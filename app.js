import { calculateTotalFootprint } from './calculations.js';
import { getAllActions, calculateCompletedStats, calculateLevelMetrics } from './actions.js';
import { getAdvisorResponse } from './assistant.js';

// ==========================================
// STATE MANAGEMENT & LOCAL STORAGE KEYS
// ==========================================
const STORAGE_KEYS = {
  FOOTPRINT_DATA: 'ecosphere_footprint_data',
  COMPLETED_ACTIONS: 'ecosphere_completed_actions',
  CUSTOM_ACTIONS: 'ecosphere_custom_actions',
  THEME: 'ecosphere_theme'
};

const DEFAULT_FOOTPRINT = {
  electricity: 200,
  naturalGas: 15,
  heatingOil: 1,
  waste: 5,
  recycle: true,
  vehicleKm: 10000,
  vehicleType: 'ice',
  vehicleKml: 15,
  transitKm: 50,
  flightHours: 0,
  dietType: 'vegetarian',
  shoppingHabit: 'average'
};

class App {
  constructor() {
    this.loadState();
    this.initDOMRefs();
    this.initTheme();
    this.bindEvents();
    
    // Initial renders
    this.updateCalculation();
    this.renderActionList();
    this.initAssistant();
  }

  loadState() {
    // 1. Footprint Input Data
    const rawFootprint = localStorage.getItem(STORAGE_KEYS.FOOTPRINT_DATA);
    this.footprintInput = rawFootprint ? JSON.parse(rawFootprint) : { ...DEFAULT_FOOTPRINT };

    // 2. Completed Action IDs
    const rawCompleted = localStorage.getItem(STORAGE_KEYS.COMPLETED_ACTIONS);
    this.completedActionIds = rawCompleted ? JSON.parse(rawCompleted) : [];

    // 3. Custom Actions List
    const rawCustom = localStorage.getItem(STORAGE_KEYS.CUSTOM_ACTIONS);
    this.customActions = rawCustom ? JSON.parse(rawCustom) : [];

    // 4. Gemini API Key (stored in session storage for privacy)
    this.geminiApiKey = sessionStorage.getItem('ecosphere_gemini_key') || '';

    // 5. App UI state
    this.activeTab = 'dashboard';
    this.calcWizardStep = 1;
    this.activeActionFilter = 'all';
    this.chatHistory = [];
  }

  saveState() {
    localStorage.setItem(STORAGE_KEYS.FOOTPRINT_DATA, JSON.stringify(this.footprintInput));
    localStorage.setItem(STORAGE_KEYS.COMPLETED_ACTIONS, JSON.stringify(this.completedActionIds));
    localStorage.setItem(STORAGE_KEYS.CUSTOM_ACTIONS, JSON.stringify(this.customActions));
  }

  initDOMRefs() {
    // Announcer
    this.announcer = document.getElementById('a11y-announcer');

    // Navigation triggers and panels
    this.tabTriggers = document.querySelectorAll('.tab-trigger');
    this.tabPanels = document.querySelectorAll('.page-section');

    // Theme & Settings
    this.themeToggleBtn = document.getElementById('theme-toggle');
    this.themeIcon = document.getElementById('theme-icon');
    this.settingsBtn = document.getElementById('settings-btn');
    this.settingsDialog = document.getElementById('settings-dialog');
    this.settingsForm = document.getElementById('settings-form');
    this.settingsApiKeyInput = document.getElementById('settings-api-key');
    this.cancelSettingsBtn = document.getElementById('cancel-settings-btn');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');

    // Dashboard values
    this.displayTotalCarbon = document.getElementById('display-total-carbon');
    this.displayComparison = document.getElementById('display-comparison');
    this.displayLevel = document.getElementById('display-level');
    this.displayXpText = document.getElementById('display-xp-text');
    this.displayXpBar = document.getElementById('display-xp-bar');
    
    // Donut chart elements
    this.donutSegmentsGroup = document.getElementById('donut-segments-group');
    this.donutCenterPct = document.getElementById('donut-center-pct');
    this.donutCenterLbl = document.getElementById('donut-center-lbl');
    this.chartLegendContainer = document.getElementById('chart-legend-container');

    // Calculator inputs
    this.calcForm = document.getElementById('footprint-form');
    this.inputElectricity = document.getElementById('input-electricity');
    this.inputGas = document.getElementById('input-gas');
    this.inputOil = document.getElementById('input-oil');
    this.inputWaste = document.getElementById('input-waste');
    this.inputRecycle = document.getElementById('input-recycle');
    
    this.inputVehicleType = document.getElementById('input-vehicle-type');
    this.vehicleFields = document.getElementById('vehicle-fields');
    this.mpgGroup = document.getElementById('mpg-group');
    this.inputVehicleMiles = document.getElementById('input-vehicle-miles');
    this.inputVehicleMpg = document.getElementById('input-vehicle-mpg');
    this.inputTransitMiles = document.getElementById('input-transit-miles');
    this.inputFlights = document.getElementById('input-flights');

    // Sync input defaults
    this.syncInputsFromState();

    // Range bubbles
    this.rangeInputs = this.calcForm.querySelectorAll('input[type="range"]');

    // Calculator step controls
    this.wizardStepNodes = document.querySelectorAll('.wizard-step-node');
    this.wizardStepContents = document.querySelectorAll('.wizard-step-content');
    this.wizardProgressBar = document.getElementById('wizard-progress-bar');
    this.wizardPrevBtn = document.getElementById('wizard-prev-btn');
    this.wizardNextBtn = document.getElementById('wizard-next-btn');
    this.wizardRealtimeBadge = document.getElementById('wizard-realtime-badge');

    // Action center elements
    this.actionCatTriggers = document.querySelectorAll('.action-cat-trigger');
    this.actionItemsListContainer = document.getElementById('action-items-list-container');
    this.actionsXpValue = document.getElementById('actions-xp-value');
    this.actionsXpBar = document.getElementById('actions-xp-bar');
    this.actionsLevelText = document.getElementById('actions-level-text');
    this.actionsSavingValue = document.getElementById('actions-saving-value');
    
    this.customActionForm = document.getElementById('custom-action-form');
    this.customTitle = document.getElementById('custom-title');
    this.customCat = document.getElementById('custom-cat');
    this.customSaving = document.getElementById('custom-saving');

    // Assistant elements
    this.chatMessagesContainer = document.getElementById('chat-messages-container');
    this.chatInputField = document.getElementById('chat-input-field');
    this.sendChatBtn = document.getElementById('send-chat-btn');
    this.clearChatBtn = document.getElementById('clear-chat-btn');
    this.chatQuickTags = document.querySelectorAll('.chat-tag');
    this.displayAssistantStatus = document.getElementById('display-assistant-status');
  }

  syncInputsFromState() {
    this.inputElectricity.value = this.footprintInput.electricity;
    this.inputGas.value = this.footprintInput.naturalGas;
    this.inputOil.value = this.footprintInput.heatingOil;
    this.inputWaste.value = this.footprintInput.waste;
    this.inputRecycle.checked = this.footprintInput.recycle;
    
    this.inputVehicleType.value = this.footprintInput.vehicleType;
    this.inputVehicleMiles.value = this.footprintInput.vehicleKm;
    this.inputVehicleMpg.value = this.footprintInput.vehicleKml;
    this.inputTransitMiles.value = this.footprintInput.transitKm;
    this.inputFlights.value = this.footprintInput.flightHours;

    // Diet radio sync
    const dietRadio = document.getElementById(`diet-${this.footprintInput.dietType}`);
    if (dietRadio) dietRadio.checked = true;

    // Shopping radio sync
    const shopRadio = document.getElementById(`shop-${this.footprintInput.shoppingHabit}`);
    if (shopRadio) shopRadio.checked = true;

    this.toggleVehicleVisibility();
  }

  toggleVehicleVisibility() {
    const type = this.inputVehicleType.value;
    if (type === 'none') {
      this.vehicleFields.style.display = 'none';
    } else {
      this.vehicleFields.style.display = 'block';
      if (type === 'ev') {
        this.mpgGroup.style.display = 'none';
      } else {
        this.mpgGroup.style.display = 'block';
      }
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDarkTheme = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    document.documentElement.classList.toggle('dark', useDarkTheme);
    document.documentElement.classList.toggle('light', !useDarkTheme);

    if (useDarkTheme) {
      this.themeToggleBtn.setAttribute('aria-label', 'Toggle light mode');
      this.themeToggleBtn.setAttribute('title', 'Toggle light mode');
      // Sun SVG inside Moon button
      this.themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`;
    } else {
      this.themeToggleBtn.setAttribute('aria-label', 'Toggle dark mode');
      this.themeToggleBtn.setAttribute('title', 'Toggle dark mode');
      this.themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light', !isDark);
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    // Update icon only — do NOT call initTheme() here or it double-toggles the class
    if (isDark) {
      this.themeToggleBtn.setAttribute('aria-label', 'Toggle light mode');
      this.themeToggleBtn.setAttribute('title', 'Toggle light mode');
      this.themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>`;
    } else {
      this.themeToggleBtn.setAttribute('aria-label', 'Toggle dark mode');
      this.themeToggleBtn.setAttribute('title', 'Toggle dark mode');
      this.themeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;
    }
    this.announceA11y(`Theme switched to ${isDark ? 'dark' : 'light'} mode.`);
  }

  announceA11y(message) {
    this.announcer.textContent = '';
    // Small timeout ensures screen readers catch the change
    setTimeout(() => {
      this.announcer.textContent = message;
    }, 100);
  }

  bindEvents() {
    // Theme toggle
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());

    // Settings Native Dialog controls
    this.settingsBtn.addEventListener('click', () => {
      this.settingsApiKeyInput.value = this.geminiApiKey;
      this.settingsDialog.showModal();
    });

    const closeDialog = () => this.settingsDialog.close();
    this.closeSettingsBtn.addEventListener('click', closeDialog);
    this.cancelSettingsBtn.addEventListener('click', closeDialog);

    this.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.geminiApiKey = this.settingsApiKeyInput.value.trim();
      if (this.geminiApiKey) {
        sessionStorage.setItem('ecosphere_gemini_key', this.geminiApiKey);
      } else {
        sessionStorage.removeItem('ecosphere_gemini_key');
      }
      this.updateAssistantStatus();
      this.settingsDialog.close();
      this.announceA11y('API Key settings saved.');
    });

    // SPA Tab Navigation
    this.tabTriggers.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.id.replace('tab-', '');
        this.switchTab(targetTab);
      });
      btn.addEventListener('keydown', (e) => this.handleTabKeyboard(e));
    });

    // Calculator inputs & real-time updates
    this.rangeInputs.forEach(input => {
      const bubble = document.getElementById(input.id.replace('input-', 'val-'));
      
      const handleInput = () => {
        if (bubble) bubble.textContent = input.value;
        this.updateCalculation(true); // Fast silent calc
      };

      input.addEventListener('input', handleInput);
      input.addEventListener('change', () => {
        this.syncInputsToState();
        this.saveState();
        this.updateCalculation(); // Heavy render calc
      });
    });

    this.inputVehicleType.addEventListener('change', () => {
      this.toggleVehicleVisibility();
      this.syncInputsToState();
      this.saveState();
      this.updateCalculation();
    });

    this.calcForm.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        this.syncInputsToState();
        this.saveState();
        this.updateCalculation();
      });
    });

    // Wizard navigation
    this.wizardPrevBtn.addEventListener('click', () => this.navigateWizard(-1));
    this.wizardNextBtn.addEventListener('click', () => this.navigateWizard(1));

    // Action Category filter triggers
    this.actionCatTriggers.forEach(btn => {
      btn.addEventListener('click', () => {
        this.actionCatTriggers.forEach(t => {
          t.setAttribute('data-active', 'false');
          t.setAttribute('aria-selected', 'false');
        });
        btn.setAttribute('data-active', 'true');
        btn.setAttribute('aria-selected', 'true');
        this.activeActionFilter = btn.getAttribute('data-cat');
        this.renderActionList();
      });
    });

    // Custom Action submission
    this.customActionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addCustomAction();
    });

    // AI Assistant text input
    this.chatInputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendChatMessage();
      }
    });
    this.sendChatBtn.addEventListener('click', () => this.sendChatMessage());
    this.clearChatBtn.addEventListener('click', () => this.clearChatHistory());

    // Assistant Conversational Tags
    this.chatQuickTags.forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-query');
        this.chatInputField.value = query;
        this.sendChatMessage();
      });
    });
  }

  syncInputsToState() {
    this.footprintInput.electricity = Number(this.inputElectricity.value);
    this.footprintInput.naturalGas = Number(this.inputGas.value);
    this.footprintInput.heatingOil = Number(this.inputOil.value);
    this.footprintInput.waste = Number(this.inputWaste.value);
    this.footprintInput.recycle = this.inputRecycle.checked;
    
    this.footprintInput.vehicleType = this.inputVehicleType.value;
    this.footprintInput.vehicleKm = Number(this.inputVehicleMiles.value);
    this.footprintInput.vehicleKml = Number(this.inputVehicleMpg.value);
    this.footprintInput.transitKm = Number(this.inputTransitMiles.value);
    this.footprintInput.flightHours = Number(this.inputFlights.value);

    // Diet
    const checkedDiet = this.calcForm.querySelector('input[name="dietType"]:checked');
    if (checkedDiet) this.footprintInput.dietType = checkedDiet.value;

    // Shopping
    const checkedShop = this.calcForm.querySelector('input[name="shoppingHabit"]:checked');
    if (checkedShop) this.footprintInput.shoppingHabit = checkedShop.value;
  }

  // ==========================================
  // SPA ROUTER & NAVIGATION
  // ==========================================
  switchTab(tabName) {
    this.activeTab = tabName;
    
    // Update tab bar triggers
    this.tabTriggers.forEach(btn => {
      const active = btn.id === `tab-${tabName}`;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.setAttribute('tabindex', active ? '0' : '-1');
    });

    // Update display page sections
    this.tabPanels.forEach(panel => {
      const active = panel.id === `panel-${tabName}`;
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    this.announceA11y(`Navigated to ${tabName} tab.`);
  }

  handleTabKeyboard(e) {
    const triggers = Array.from(this.tabTriggers);
    const index = triggers.indexOf(e.target);
    let nextIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % triggers.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + triggers.length) % triggers.length;
    } else {
      return;
    }

    triggers[nextIndex].focus();
    this.switchTab(triggers[nextIndex].id.replace('tab-', ''));
  }

  // ==========================================
  // CARBON FOOTPRINT CALCULATIONS & CHARTS
  // ==========================================
  updateCalculation(silent = false) {
    // 1. Calculate Footprint from logic formulas
    this.footprintResults = calculateTotalFootprint(this.footprintInput);

    // 2. Fetch Gamification Stats
    const stats = calculateCompletedStats(this.completedActionIds, this.customActions);
    this.stats = stats;
    
    // Net Footprint = Total Annual emissions - Annual completed actions offset savings
    this.netFootprint = Math.max(0, this.footprintResults.total - stats.totalCarbonSaved);

    if (silent) {
      this.wizardRealtimeBadge.textContent = `Live: ${this.footprintResults.total.toLocaleString()} kg CO2e/yr`;
      return;
    }

    this.wizardRealtimeBadge.textContent = `Calculated: ${this.footprintResults.total.toLocaleString()} kg CO2e/yr`;
    
    // Update displays
    this.displayTotalCarbon.textContent = this.netFootprint.toLocaleString();
    this.actionsSavingValue.textContent = `${stats.totalCarbonSaved.toLocaleString()} kg`;
    this.actionsXpValue.textContent = stats.totalPoints.toLocaleString();

    // Update level info
    const levelMetrics = calculateLevelMetrics(stats.totalPoints);
    this.displayLevel.textContent = levelMetrics.level;
    this.displayLevel.setAttribute('aria-label', `Level ${levelMetrics.level}`);
    this.displayXpText.textContent = `${levelMetrics.currentXp} / ${levelMetrics.nextLevelXp} XP`;
    this.displayXpBar.style.width = `${levelMetrics.progressPct}%`;
    this.displayXpBar.setAttribute('aria-valuenow', levelMetrics.progressPct);

    // Update Action sidebar level indicators
    this.actionsXpBar.style.width = `${levelMetrics.progressPct}%`;
    this.actionsXpBar.setAttribute('aria-valuenow', levelMetrics.progressPct);
    
    let rankName = 'Eco-Novice';
    if (levelMetrics.level >= 8) rankName = 'Carbon Neutralizer';
    else if (levelMetrics.level >= 5) rankName = 'Green Champion';
    else if (levelMetrics.level >= 3) rankName = 'Eco-Specialist';
    this.actionsLevelText.textContent = `Level ${levelMetrics.level} ${rankName}`;

    // Comparison copy
    let compHtml = '';
    if (this.netFootprint < 2000) {
      this.displayComparison.className = 'metric-comparison good';
      compHtml = `🍃 Outstanding! You are below the sustainable target (2,000 kg).`;
    } else if (this.netFootprint <= 4000) {
      this.displayComparison.className = 'metric-comparison';
      compHtml = `👍 Good! You are below the urban Indian average (4,000 kg).`;
    } else {
      this.displayComparison.className = 'metric-comparison bad';
      compHtml = `⚠️ Alert: Your footprint exceeds the urban Indian average (4,000 kg).`;
    }
    this.displayComparison.textContent = compHtml;

    // Render donut chart
    this.renderDonutChart();
  }

  renderDonutChart() {
    this.donutSegmentsGroup.innerHTML = '';
    this.chartLegendContainer.innerHTML = '';

    const categories = [
      { name: 'Home Energy', key: 'home', value: this.footprintResults.home, color: 'hsl(140, 60%, 45%)' },
      { name: 'Transportation', key: 'transport', value: this.footprintResults.transport, color: 'hsl(190, 65%, 45%)' },
      { name: 'Diet & Food', key: 'diet', value: this.footprintResults.diet, color: 'hsl(35, 80%, 50%)' },
      { name: 'Shopping', key: 'shopping', value: this.footprintResults.shopping, color: 'hsl(280, 60%, 55%)' }
    ];

    const total = this.footprintResults.total;

    if (total === 0) {
      this.donutCenterPct.textContent = '0%';
      this.donutCenterLbl.textContent = 'No emissions';
      return;
    }

    // Sort categories to find largest contributor
    const sorted = [...categories].sort((a, b) => b.value - a.value);
    const largestCat = sorted[0];
    const largestPct = Math.round((largestCat.value / total) * 100);
    this.donutCenterPct.textContent = `${largestPct}%`;
    this.donutCenterLbl.textContent = largestCat.name.split(' ')[0]; // Just category short name

    // Draw circular segments
    // Circumference = 2 * PI * R. R=80 -> Circumference = ~502.65
    const radius = 80;
    const circ = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    categories.forEach(cat => {
      const pct = cat.value / total;
      const strokeDash = pct * circ;
      const strokeGap = circ - strokeDash;
      const strokeOffset = circ - accumulatedAngle;

      if (strokeDash > 0) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '100');
        circle.setAttribute('cy', '100');
        circle.setAttribute('r', radius.toString());
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', cat.color);
        circle.setAttribute('stroke-width', '20');
        circle.setAttribute('stroke-dasharray', `${strokeDash} ${strokeGap}`);
        circle.setAttribute('stroke-dashoffset', strokeOffset.toString());
        circle.setAttribute('class', 'donut-segment');
        
        // Tooltip description
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${cat.name}: ${cat.value.toLocaleString()} kg (${Math.round(pct * 100)}%)`;
        circle.appendChild(title);

        this.donutSegmentsGroup.appendChild(circle);
      }

      accumulatedAngle += strokeDash;

      // Populate Legend items in details side
      const legendItem = document.createElement('div');
      legendItem.className = 'legend-item';
      legendItem.innerHTML = `
        <span class="legend-color" style="background-color: ${cat.color}"></span>
        <div class="legend-details">
          <span style="font-size:0.75rem; color:var(--text-secondary);">${cat.name}</span>
          <span class="legend-val">${cat.value.toLocaleString()} kg <span style="font-weight:normal; font-size:0.75rem; color:var(--text-secondary);">(${Math.round(pct * 100)}%)</span></span>
        </div>
      `;
      this.chartLegendContainer.appendChild(legendItem);
    });
  }

  // ==========================================
  // STEP WIZARD FLOW
  // ==========================================
  navigateWizard(direction) {
    const nextStep = this.calcWizardStep + direction;
    if (nextStep < 1 || nextStep > 4) return;

    // Update active fieldsets
    this.wizardStepContents.forEach(fieldset => {
      const isTarget = fieldset.id === `calc-step-${nextStep}`;
      fieldset.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
    });

    // Update wizard nodes visual status
    this.wizardStepNodes.forEach((node, idx) => {
      const stepNum = idx + 1;
      if (stepNum === nextStep) {
        node.setAttribute('data-active', 'true');
        node.removeAttribute('data-complete');
      } else if (stepNum < nextStep) {
        node.removeAttribute('data-active');
        node.setAttribute('data-complete', 'true');
      } else {
        node.removeAttribute('data-active');
        node.removeAttribute('data-complete');
      }
    });

    // Update Wizard Progress Bar line width
    const progressPct = ((nextStep - 1) / 3) * 100;
    this.wizardProgressBar.style.width = `${progressPct}%`;

    // Update step tracker state
    this.calcWizardStep = nextStep;

    // Toggle button texts / states
    this.wizardPrevBtn.disabled = nextStep === 1;
    
    if (nextStep === 4) {
      this.wizardNextBtn.innerHTML = `Save & View Dashboard <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.15rem; height:1.15rem;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    } else {
      this.wizardNextBtn.innerHTML = `Next <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:1.15rem; height:1.15rem;" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
    }

    this.announceA11y(`Wizard shifted to step ${nextStep}.`);

    // Handle end node behavior
    if (direction === 1 && nextStep === 4 && this.wizardNextBtn.dataset.saved === 'true') {
      // Re-click of Next button on step 4 triggers redirect
      this.wizardNextBtn.removeAttribute('data-saved');
      this.switchTab('dashboard');
      return;
    }
    
    if (nextStep === 4) {
      this.wizardNextBtn.dataset.saved = 'true';
    } else {
      this.wizardNextBtn.removeAttribute('data-saved');
    }
  }

  // ==========================================
  // ACTION CENTER AND POINTS
  // ==========================================
  renderActionList() {
    this.actionItemsListContainer.innerHTML = '';
    const allActions = getAllActions(this.customActions);
    
    const filtered = allActions.filter(action => {
      if (this.activeActionFilter === 'all') return true;
      return action.category === this.activeActionFilter;
    });

    if (filtered.length === 0) {
      this.actionItemsListContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-secondary);">No actions found in this category. Use the form to add a custom action!</div>`;
      return;
    }

    filtered.forEach(action => {
      const isChecked = this.completedActionIds.includes(action.id);
      
      const card = document.createElement('div');
      card.className = 'action-item-card';
      card.id = `action-card-${action.id}`;
      
      card.innerHTML = `
        <input type="checkbox" id="check-${action.id}" class="action-item-checkbox" ${isChecked ? 'checked' : ''} aria-describedby="desc-${action.id}">
        <div class="action-item-details">
          <div class="action-item-header">
            <label for="check-${action.id}" class="action-item-title">${action.title}</label>
            <div class="action-badge-container">
              <span class="action-badge badge-difficulty-${action.difficulty}">${action.difficulty}</span>
              <span class="action-badge badge-saving">-${action.carbonSaving} kg CO2e</span>
              <span class="action-badge badge-points">+${action.points} XP</span>
            </div>
          </div>
          <p id="desc-${action.id}" class="action-item-desc">${action.description}</p>
        </div>
      `;

      // Checkbox listener
      const checkbox = card.querySelector('input');
      checkbox.addEventListener('change', () => {
        this.toggleActionCompleted(action.id, checkbox.checked, action.title, action.points);
      });

      this.actionItemsListContainer.appendChild(card);
    });
  }

  toggleActionCompleted(actionId, isComplete, title, points) {
    if (isComplete) {
      if (!this.completedActionIds.includes(actionId)) {
        this.completedActionIds.push(actionId);
      }
      this.announceA11y(`Completed action: "${title}". Earned ${points} points!`);
    } else {
      this.completedActionIds = this.completedActionIds.filter(id => id !== actionId);
      this.announceA11y(`Removed action: "${title}". Points adjusted.`);
    }

    this.saveState();
    this.updateCalculation();
    this.renderActionList();
  }

  addCustomAction() {
    const title = this.customTitle.value.trim();
    const category = this.customCat.value;
    const saving = Number(this.customSaving.value);

    if (!title || saving <= 0) return;

    const id = `custom-${Date.now()}`;
    const difficulty = saving > 1000 ? 'hard' : (saving > 300 ? 'medium' : 'easy');
    
    // XP point proportional to emissions saving (approx 1 XP point per 4kg carbon saved, capped)
    const points = Math.min(500, Math.max(10, Math.round(saving / 4)));

    const newAction = {
      id,
      title,
      category,
      difficulty,
      carbonSaving: saving,
      points,
      description: 'Custom eco-action added to your catalog.'
    };

    this.customActions.push(newAction);
    this.saveState();
    this.renderActionList();
    this.updateCalculation();

    // Reset Form
    this.customTitle.value = '';
    this.customSaving.value = 100;
    
    this.announceA11y(`Added custom green action: "${title}".`);
  }

  // ==========================================
  // SMART AI ASSISTANT (ECO-ADVISOR)
  // ==========================================
  initAssistant() {
    this.updateAssistantStatus();
    
    // Initial greetings
    this.chatMessagesContainer.innerHTML = '';
    this.addAssistantMessage({
      message: `Hello! I am Eco-Advisor, your personal carbon coach. I have analyzed your carbon footprint profile (estimated at ${this.netFootprint.toLocaleString()} kg CO2e/year). 

Your highest emitting category is ${this.compileCategoryContext().toUpperCase()}.

How can I help you reduce your carbon footprint today? Select one of the tags below or type your questions directly!`,
      suggestedActions: [],
      category: 'general'
    });
  }

  updateAssistantStatus() {
    if (this.geminiApiKey) {
      this.displayAssistantStatus.textContent = 'Advisor Mode: Remote Gemini AI Agent (Connected)';
    } else if ('LanguageModel' in globalThis) {
      this.displayAssistantStatus.textContent = 'Advisor Mode: On-Device Gemini Nano AI (Offline Enabled)';
    } else {
      this.displayAssistantStatus.textContent = 'Advisor Mode: Local Heuristics & Rules Engine (Privacy Compliant)';
    }
  }

  compileCategoryContext() {
    const breakdown = [
      { name: 'home', value: this.footprintResults.home || 0 },
      { name: 'transport', value: this.footprintResults.transport || 0 },
      { name: 'diet', value: this.footprintResults.diet || 0 },
      { name: 'shopping', value: this.footprintResults.shopping || 0 }
    ];
    breakdown.sort((a, b) => b.value - a.value);
    return breakdown[0].name;
  }

  addAssistantMessage(advisorObj) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';
    
    // Strip markdown tokens (** bold **, * italic *, ` code `) that Gemini may include
    // Since we use textContent for XSS safety, these would appear as literal characters
    const cleanMessage = (advisorObj.message || '')
      .replace(/\*\*([\s\S]*?)\*\*/g, '$1') // **bold** -> bold
      .replace(/\*([\s\S]*?)\*/g, '$1')     // *italic* -> italic
      .replace(/`([\s\S]*?)`/g, '$1')       // `code` -> code
      .replace(/^#{1,6}\s+/gm, '')          // ## headings -> plain
      .replace(/\*\*/g, '')                 // remove leftover bold markers
      .replace(/^\s*[*-]\s+/gm, '');        // remove markdown bullet markers

    // Markdown/text parser safely to avoid innerHTML injection
    const textNode = document.createElement('div');
    textNode.style.whiteSpace = 'pre-wrap';
    textNode.textContent = cleanMessage;
    bubble.appendChild(textNode);

    // Render interactive suggested action tags if they exist
    if (advisorObj.suggestedActions && advisorObj.suggestedActions.length > 0) {
      const sugContainer = document.createElement('div');
      sugContainer.className = 'chat-assistant-suggestions';
      
      const allActions = getAllActions(this.customActions);

      advisorObj.suggestedActions.forEach(id => {
        const action = allActions.find(a => a.id === id);
        if (action) {
          const actionBtn = document.createElement('button');
          actionBtn.className = 'suggested-action-link';
          actionBtn.textContent = `🎯 Focus: ${action.title}`;
          actionBtn.addEventListener('click', () => {
            this.switchTab('actions');
            
            // Highlight action element with simple visual border animation
            setTimeout(() => {
              const cardEl = document.getElementById(`action-card-${id}`);
              if (cardEl) {
                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                cardEl.style.outline = '4px solid var(--primary-color)';
                setTimeout(() => {
                  cardEl.style.outline = 'none';
                }, 2000);
              }
            }, 300);
          });
          sugContainer.appendChild(actionBtn);
        }
      });
      bubble.appendChild(sugContainer);
    }

    this.chatMessagesContainer.appendChild(bubble);
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
  }

  addUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;
    this.chatMessagesContainer.appendChild(bubble);
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
  }

  async sendChatMessage() {
    const query = this.chatInputField.value.trim();
    if (!query) return;

    this.chatInputField.value = '';
    this.addUserMessage(query);

    // Create typing bubble placeholder
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble assistant';
    typingBubble.innerHTML = `<span style="opacity: 0.6; font-style: italic;">Coach is typing...</span>`;
    this.chatMessagesContainer.appendChild(typingBubble);
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;

    try {
      const response = await getAdvisorResponse({
        query,
        footprint: this.footprintResults,
        completedActionIds: this.completedActionIds,
        geminiApiKey: this.geminiApiKey
      });

      // Remove typing indicator and append real response
      typingBubble.remove();
      this.addAssistantMessage(response);
      
      // Save query/response to local state history
      this.chatHistory.push({ role: 'user', content: query });
      this.chatHistory.push({ role: 'assistant', content: response.message });

      // Screen reader announcements
      this.announceA11y(`Assistant says: ${response.message.slice(0, 100)}...`);
    } catch (e) {
      typingBubble.remove();
      const errorResponse = {
        message: "I encountered an error trying to process that. Please check your Gemini API key or proceed offline in Local Reasoning Mode.",
        suggestedActions: [],
        category: 'general'
      };
      this.addAssistantMessage(errorResponse);
      console.error(e);
    }
  }

  clearChatHistory() {
    this.chatHistory = [];
    this.initAssistant();
    this.announceA11y('Chat history cleared.');
  }
}

// Instantiate on document load
document.addEventListener('DOMContentLoaded', () => {
  window.ecoSphereApp = new App();
});
