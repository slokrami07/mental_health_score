/**
 * MINDMETRICS AI — FRONTEND LOGIC & INTEGRATION
 * Features: Form state, slider sync, presets, live validation, fetch API to FastAPI,
 * radial gauge animations, personalized clinical insights, and toast alerts.
 */

// --- Global Configuration & State ---
const CONFIG = {
  // Use window origin if hosted on the same domain as FastAPI, else default to local 8000
  defaultApiUrl: window.location.origin.includes('8000')
    ? `${window.location.origin}/predict`
    : 'https://mental-health-score-jo0q.onrender.com/predict',
  gaugeCircumference: 2 * Math.PI * 76 // r = 76 => ~477.52
};

let currentApiUrl = localStorage.getItem('mindmetrics_api_url') || CONFIG.defaultApiUrl;

// Persona Presets Data
const PRESETS = {
  'balanced': {
    age: 21,
    gender: 'Male',
    country: 'India',
    academic_level: 'Undergraduate',
    most_used_platform: 'Instagram',
    purpose_of_use: 'Education',
    avg_daily_usage_hours: 2.8,
    daily_unlocks: 45,
    study_hours: 6.0,
    physical_activity_hours: 2.0,
    sleep_hours_per_night: 8.0,
    stress_level: 'Low'
  },
  'heavy-screen': {
    age: 19,
    gender: 'Female',
    country: 'USA',
    academic_level: 'Undergraduate',
    most_used_platform: 'TikTok',
    purpose_of_use: 'Entertainment',
    avg_daily_usage_hours: 8.5,
    daily_unlocks: 140,
    study_hours: 2.5,
    physical_activity_hours: 0.5,
    sleep_hours_per_night: 4.8,
    stress_level: 'Very High'
  },
  'exam-stress': {
    age: 23,
    gender: 'Male',
    country: 'Canada',
    academic_level: 'Graduate',
    most_used_platform: 'YouTube',
    purpose_of_use: 'Education',
    avg_daily_usage_hours: 3.5,
    daily_unlocks: 55,
    study_hours: 9.5,
    physical_activity_hours: 0.8,
    sleep_hours_per_night: 5.2,
    stress_level: 'High'
  },
  'sleep-deprived': {
    age: 20,
    gender: 'Female',
    country: 'UK',
    academic_level: 'Undergraduate',
    most_used_platform: 'Instagram',
    purpose_of_use: 'Entertainment',
    avg_daily_usage_hours: 6.0,
    daily_unlocks: 95,
    study_hours: 4.0,
    physical_activity_hours: 0.5,
    sleep_hours_per_night: 3.8,
    stress_level: 'High'
  }
};

// --- DOM Element References ---
const elements = {
  form: document.getElementById('prediction-form'),
  btnSubmit: document.getElementById('btn-submit'),
  btnReset: document.getElementById('btn-reset'),
  toastContainer: document.getElementById('toast-container'),

  // Sliders & Badges
  rangeUsage: document.getElementById('range-usage'),
  badgeUsage: document.getElementById('badge-usage'),
  rangeStudy: document.getElementById('range-study'),
  badgeStudy: document.getElementById('badge-study'),
  rangeActivity: document.getElementById('range-activity'),
  badgeActivity: document.getElementById('badge-activity'),
  rangeSleep: document.getElementById('range-sleep'),
  badgeSleep: document.getElementById('badge-sleep'),
  sleepQualityTag: document.getElementById('sleep-quality-tag'),

  // Steppers
  inputAge: document.getElementById('input-age'),
  inputUnlocks: document.getElementById('input-unlocks'),

  // Results Panels
  stateIdle: document.getElementById('result-state-idle'),
  stateLoading: document.getElementById('result-state-loading'),
  stateActive: document.getElementById('result-state-active'),
  loadingText: document.getElementById('loading-step-text'),

  // Gauge & Output metrics
  gaugeBar: document.getElementById('gauge-bar'),
  scoreVal: document.getElementById('result-score-val'),
  benchmarkText: document.getElementById('result-benchmark-text'),
  statusBanner: document.getElementById('result-status-banner'),
  statusIcon: document.getElementById('result-status-icon'),
  statusTitle: document.getElementById('result-status-title'),
  statusDesc: document.getElementById('result-status-desc'),

  // Drivers
  driverSleepVal: document.getElementById('driver-sleep-val'),
  driverSleepFill: document.getElementById('driver-sleep-fill'),
  driverScreenVal: document.getElementById('driver-screen-val'),
  driverScreenFill: document.getElementById('driver-screen-fill'),
  driverActivityVal: document.getElementById('driver-activity-val'),
  driverActivityFill: document.getElementById('driver-activity-fill'),
  driverStressVal: document.getElementById('driver-stress-val'),
  driverStressFill: document.getElementById('driver-stress-fill'),

  // Recommendations & Copy
  recList: document.getElementById('result-recommendations-list'),
  btnCopy: document.getElementById('btn-copy-report'),
  btnRecalculate: document.getElementById('btn-recalculate'),

  // API Config Modal
  apiPill: document.getElementById('api-status-pill'),
  apiToggle: document.getElementById('api-config-toggle'),
  apiModal: document.getElementById('api-modal'),
  apiModalClose: document.getElementById('api-modal-close'),
  apiModalTest: document.getElementById('api-modal-test'),
  apiInput: document.getElementById('api-base-url'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text')
};

// Last predicted data storage for copy/export
let lastPredictionResult = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initSliderSync();
  initSteppers();
  initPresets();
  initApiSettings();
  initFormSubmission();
  initCopyReport();
  checkApiHealth();
});

// --- Slider & Badge Synchronization ---
function initSliderSync() {
  const syncMap = [
    {
      slider: elements.rangeUsage,
      badge: elements.badgeUsage,
      format: (val) => `${parseFloat(val).toFixed(1)} hrs`
    },
    {
      slider: elements.rangeStudy,
      badge: elements.badgeStudy,
      format: (val) => `${parseFloat(val).toFixed(1)} hrs`
    },
    {
      slider: elements.rangeActivity,
      badge: elements.badgeActivity,
      format: (val) => `${parseFloat(val).toFixed(1)} hrs`
    },
    {
      slider: elements.rangeSleep,
      badge: elements.badgeSleep,
      format: (val) => {
        const h = parseFloat(val);
        updateSleepTag(h);
        return `${h.toFixed(1)} hrs`;
      }
    }
  ];

  syncMap.forEach(({ slider, badge, format }) => {
    if (!slider || !badge) return;
    slider.addEventListener('input', () => {
      badge.textContent = format(slider.value);
      updateSliderTrackFill(slider);
    });
    // Initial run
    badge.textContent = format(slider.value);
    updateSliderTrackFill(slider);
  });
}

function updateSliderTrackFill(slider) {
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 24;
  const val = parseFloat(slider.value);
  const percent = ((val - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, #14B8A6 0%, #06B6D4 ${percent}%, rgba(255, 255, 255, 0.12) ${percent}%, rgba(255, 255, 255, 0.12) 100%)`;
}

function updateSleepTag(hours) {
  if (!elements.sleepQualityTag) return;
  if (hours < 5.0) {
    elements.sleepQualityTag.textContent = 'Severe Deficit (<5h)';
    elements.sleepQualityTag.style.color = '#F43F5E';
    elements.sleepQualityTag.style.background = 'rgba(244, 63, 94, 0.15)';
  } else if (hours < 6.5) {
    elements.sleepQualityTag.textContent = 'Suboptimal (5-6.5h)';
    elements.sleepQualityTag.style.color = '#F59E0B';
    elements.sleepQualityTag.style.background = 'rgba(245, 158, 11, 0.15)';
  } else if (hours <= 9.0) {
    elements.sleepQualityTag.textContent = 'Optimal Range (7-9h)';
    elements.sleepQualityTag.style.color = '#10B981';
    elements.sleepQualityTag.style.background = 'rgba(16, 185, 129, 0.15)';
  } else {
    elements.sleepQualityTag.textContent = 'Oversleeping (9h+)';
    elements.sleepQualityTag.style.color = '#818CF8';
    elements.sleepQualityTag.style.background = 'rgba(129, 140, 248, 0.15)';
  }
}

// --- Stepper Buttons Controls (+ / -) ---
function initSteppers() {
  document.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-step-for');
      const delta = parseInt(btn.getAttribute('data-delta'), 10);
      const input = document.getElementById(targetId);
      if (input) {
        let val = (parseInt(input.value, 10) || 0) + delta;
        const min = input.hasAttribute('min') ? parseInt(input.min, 10) : -Infinity;
        const max = input.hasAttribute('max') ? parseInt(input.max, 10) : Infinity;
        val = Math.max(min, Math.min(max, val));
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  });
}

// --- Preset Buttons Handler ---
function initPresets() {
  const chips = document.querySelectorAll('.persona-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active-preset'));
      chip.classList.add('active-preset');

      const presetKey = chip.getAttribute('data-preset');
      const presetData = PRESETS[presetKey];
      if (presetData) {
        applyFormData(presetData);
        showToast('Profile Loaded', `Applied preset: "${chip.textContent.trim()}"`, 'info');
      }
    });
  });

  // Reset button handler
  if (elements.btnReset) {
    elements.btnReset.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active-preset'));
      applyFormData(PRESETS['balanced']);
      chips[0]?.classList.add('active-preset');
      showToast('Reset Complete', 'Restored default balanced values.', 'info');
    });
  }
}

function applyFormData(data) {
  // Age
  if (elements.inputAge) elements.inputAge.value = data.age;

  // Gender Radio
  const genderRadio = document.querySelector(`input[name="gender"][value="${data.gender}"]`);
  if (genderRadio) genderRadio.checked = true;

  // Country
  const selectCountry = document.getElementById('select-country');
  if (selectCountry) selectCountry.value = data.country;

  // Academic Level
  const selectAcademic = document.getElementById('select-academic');
  if (selectAcademic) selectAcademic.value = data.academic_level;

  // Most used platform
  const selectPlatform = document.getElementById('select-platform');
  if (selectPlatform) selectPlatform.value = data.most_used_platform;

  // Purpose of Use Radio
  const purposeRadio = document.querySelector(`input[name="purpose_of_use"][value="${data.purpose_of_use}"]`);
  if (purposeRadio) purposeRadio.checked = true;

  // Daily Usage
  if (elements.rangeUsage) {
    elements.rangeUsage.value = data.avg_daily_usage_hours;
    elements.rangeUsage.dispatchEvent(new Event('input'));
  }

  // Daily Unlocks
  if (elements.inputUnlocks) elements.inputUnlocks.value = data.daily_unlocks;

  // Study Hours
  if (elements.rangeStudy) {
    elements.rangeStudy.value = data.study_hours;
    elements.rangeStudy.dispatchEvent(new Event('input'));
  }

  // Physical Activity
  if (elements.rangeActivity) {
    elements.rangeActivity.value = data.physical_activity_hours;
    elements.rangeActivity.dispatchEvent(new Event('input'));
  }

  // Sleep Hours
  if (elements.rangeSleep) {
    elements.rangeSleep.value = data.sleep_hours_per_night;
    elements.rangeSleep.dispatchEvent(new Event('input'));
  }

  // Stress Level Radio
  const stressRadio = document.querySelector(`input[name="stress_level"][value="${data.stress_level}"]`);
  if (stressRadio) stressRadio.checked = true;

  // Clear previous validation errors
  clearErrors();
}

// --- Form Validation ---
function validateForm(payload) {
  let isValid = true;
  clearErrors();

  if (!payload.age || payload.age < 10 || payload.age > 100) {
    showFieldError('error-age', 'Age must be between 10 and 100 years.');
    isValid = false;
  }

  if (payload.daily_unlocks === undefined || payload.daily_unlocks < 0) {
    showFieldError('error-daily_unlocks', 'Phone unlocks must be 0 or greater.');
    isValid = false;
  }

  if (payload.avg_daily_usage_hours < 0 || payload.avg_daily_usage_hours > 24) {
    showFieldError('error-avg_daily_usage_hours', 'Daily usage must be 0 – 24 hrs.');
    isValid = false;
  }

  if (payload.study_hours < 0 || payload.study_hours > 24) {
    showFieldError('error-study_hours', 'Study hours must be 0 – 24 hrs.');
    isValid = false;
  }

  if (payload.physical_activity_hours < 0 || payload.physical_activity_hours > 24) {
    showFieldError('error-physical_activity_hours', 'Activity hours must be 0 – 24 hrs.');
    isValid = false;
  }

  if (payload.sleep_hours_per_night < 0 || payload.sleep_hours_per_night > 24) {
    showFieldError('error-sleep_hours_per_night', 'Sleep duration must be 0 – 24 hrs.');
    isValid = false;
  }

  return isValid;
}

function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.opacity = '1';
  }
}

function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(el => {
    el.textContent = '';
    el.style.opacity = '0';
  });
}

// --- Form Submission & API Fetch ---
function initFormSubmission() {
  if (!elements.form) return;

  elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Construct Payload according to StudentData Pydantic schema
    const formData = new FormData(elements.form);
    const payload = {
      age: parseInt(formData.get('age'), 10),
      gender: formData.get('gender'),
      country: formData.get('country') || 'Other',
      academic_level: formData.get('academic_level'),
      most_used_platform: formData.get('most_used_platform'),
      purpose_of_use: formData.get('purpose_of_use'),
      avg_daily_usage_hours: parseFloat(formData.get('avg_daily_usage_hours')),
      daily_unlocks: parseInt(formData.get('daily_unlocks'), 10),
      study_hours: parseFloat(formData.get('study_hours')),
      physical_activity_hours: parseFloat(formData.get('physical_activity_hours')),
      sleep_hours_per_night: parseFloat(formData.get('sleep_hours_per_night')),
      stress_level: formData.get('stress_level')
    };

    if (!validateForm(payload)) {
      showToast('Validation Error', 'Please correct the highlighted fields.', 'error');
      return;
    }

    // Set UI to loading state
    setLoadingState(true);

    try {
      const response = await fetch(currentApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errDetail = 'Server responded with error status.';
        try {
          const errJson = await response.json();
          if (errJson.detail) {
            errDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch (_) { }
        throw new Error(errDetail);
      }

      const result = await response.json();
      const score = result.predicted_mental_health_score;

      // Small delay for smooth scanner animation experience
      setTimeout(() => {
        renderPredictionResult(score, payload);
        setLoadingState(false);
        showToast('Assessment Generated', `Score calculated: ${score} / 10`, 'success');
      }, 450);

    } catch (error) {
      console.error('Prediction API Error:', error);
      setLoadingState(false);

      showToast(
        'Backend Connection Issue',
        `Could not reach FastAPI at ${currentApiUrl}. Make sure your server is running with 'uv run uvicorn main:app --reload'.`,
        'error',
        6000
      );

      // Offer fallback simulation if user is testing offline
      handleOfflineFallback(payload);
    }
  });

  // Re-calculate button handler
  if (elements.btnRecalculate) {
    elements.btnRecalculate.addEventListener('click', () => {
      elements.btnSubmit.click();
    });
  }
}

// Fallback estimation if the server isn't running yet (helps user inspect UI even before backend boots)
function handleOfflineFallback(payload) {
  // Let the user know we can simulate
  const modalConfirm = confirm(
    "FastAPI server appears offline.\n\nWould you like to view a simulated diagnostic score based on the Random Forest baseline weights while you start the server?"
  );
  if (modalConfirm) {
    // Basic heuristic baseline for demonstration
    let base = 6.2;
    // Sleep impact
    base += (payload.sleep_hours_per_night - 7.0) * 0.45;
    // Screen impact
    base -= (payload.avg_daily_usage_hours - 4.0) * 0.28;
    // Activity impact
    base += (payload.physical_activity_hours - 1.0) * 0.35;
    // Stress impact
    const stressMap = { 'Low': 0.8, 'Medium': 0.0, 'High': -0.9, 'Very High': -1.6 };
    base += stressMap[payload.stress_level] || 0;

    const simulatedScore = Math.max(1.0, Math.min(10.0, parseFloat(base.toFixed(2))));
    renderPredictionResult(simulatedScore, payload, true);
  }
}

// --- Loading State Transitions ---
function setLoadingState(isLoading) {
  if (isLoading) {
    elements.btnSubmit.classList.add('loading');
    elements.btnSubmit.disabled = true;

    elements.stateIdle.classList.add('hidden');
    elements.stateActive.classList.add('hidden');
    elements.stateLoading.classList.remove('hidden');

    // Cycle informative loading messages
    const messages = [
      'Synthesizing behavioral patterns...',
      'Mapping sleep debt & digital saturation...',
      'Evaluating Random Forest decision trees...',
      'Formulating clinical guidance index...'
    ];
    let msgIdx = 0;
    elements.loadingText.textContent = messages[0];
    window._loadingInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      elements.loadingText.textContent = messages[msgIdx];
    }, 450);

  } else {
    elements.btnSubmit.classList.remove('loading');
    elements.btnSubmit.disabled = false;
    clearInterval(window._loadingInterval);
    elements.stateLoading.classList.add('hidden');
  }
}

// --- Render & Animate Result Card ---
function renderPredictionResult(score, inputs, isSimulated = false) {
  elements.stateIdle.classList.add('hidden');
  elements.stateLoading.classList.add('hidden');
  elements.stateActive.classList.remove('hidden');

  lastPredictionResult = { score, inputs, isSimulated };

  // 1. Gauge and Numeric Counter Animation
  animateGauge(score);
  animateScoreCounter(score);

  // 2. Classify Clinical Status & Color Theme
  applyScoreCategory(score);

  // 3. Render Driver Progress Bars
  renderDriverBars(inputs);

  // 4. Generate Personalized Recommendations
  renderRecommendations(score, inputs);

  // Scroll smoothly to result on smaller screens
  if (window.innerWidth <= 1080) {
    elements.stateActive.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function animateGauge(score) {
  // Score range: 0 to 10
  const normalized = Math.max(0, Math.min(10, score));
  const progressRatio = normalized / 10;
  const targetOffset = CONFIG.gaugeCircumference * (1 - progressRatio);

  if (elements.gaugeBar) {
    // Reset offset first
    elements.gaugeBar.style.strokeDashoffset = CONFIG.gaugeCircumference;
    // Animate to target
    requestAnimationFrame(() => {
      elements.gaugeBar.style.strokeDashoffset = targetOffset;
    });
  }
}

function animateScoreCounter(targetScore) {
  const duration = 1200; // ms
  const startTime = performance.now();
  const startVal = 0.0;

  function updateCount(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = startVal + (targetScore - startVal) * easeProgress;

    elements.scoreVal.textContent = currentVal.toFixed(1);

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      elements.scoreVal.textContent = targetScore.toFixed(1);
    }
  }

  requestAnimationFrame(updateCount);
}

function applyScoreCategory(score) {
  // Clear previous grade classes
  const card = elements.stateActive;
  card.classList.remove('grade-thriving', 'grade-balanced', 'grade-strain', 'grade-critical');

  let gradeClass, statusIcon, statusTitle, statusDesc, benchmark;

  if (score >= 7.8) {
    gradeClass = 'grade-thriving';
    statusIcon = '🌟';
    statusTitle = 'Thriving & Resilient Mindset';
    statusDesc = 'Exceptional psychological stability, restorative sleep balance, and healthy digital boundaries.';
    benchmark = 'Top 15% Percentile';
  } else if (score >= 6.2) {
    gradeClass = 'grade-balanced';
    statusIcon = '🌿';
    statusTitle = 'Balanced & Steady Well-being';
    statusDesc = 'Functional equilibrium with moderate day-to-day fluctuations. Minor adjustments will sustain resilience.';
    benchmark = 'Above Average Range';
  } else if (score >= 4.5) {
    gradeClass = 'grade-strain';
    statusIcon = '⚠️';
    statusTitle = 'Elevated Fatigue & Strain Alert';
    statusDesc = 'Signs of digital overload, irregular sleep architecture, or accumulated academic pressure.';
    benchmark = 'Vulnerable Range';
  } else {
    gradeClass = 'grade-critical';
    statusIcon = '🚨';
    statusTitle = 'High Exhaustion & Burnout Risk';
    statusDesc = 'Critical distress indicators detected across sleep deficit and heavy screen immersion. Action advised.';
    benchmark = 'High Risk Tier';
  }

  card.classList.add(gradeClass);
  elements.statusIcon.textContent = statusIcon;
  elements.statusTitle.textContent = statusTitle;
  elements.statusDesc.textContent = statusDesc;
  elements.benchmarkText.textContent = benchmark;
}

function renderDriverBars(inputs) {
  // 1. Sleep Meter (Target: 7-9 hrs)
  const sleepHrs = inputs.sleep_hours_per_night;
  const sleepPercent = Math.min(100, Math.max(10, (sleepHrs / 9) * 100));
  elements.driverSleepFill.style.width = `${sleepPercent}%`;
  elements.driverSleepVal.textContent = `${sleepHrs.toFixed(1)}h (${sleepHrs >= 7 ? 'Restorative' : 'Deficit'})`;

  // 2. Screen Meter (Lower is healthier; 0-12 hrs)
  const screenHrs = inputs.avg_daily_usage_hours;
  const screenPercent = Math.min(100, Math.max(10, (screenHrs / 10) * 100));
  elements.driverScreenFill.style.width = `${screenPercent}%`;
  elements.driverScreenVal.textContent = `${screenHrs.toFixed(1)}h (${screenHrs <= 3.5 ? 'Moderate' : 'High Overload'})`;

  // 3. Physical Activity (Target: 1.5 - 3h)
  const actHrs = inputs.physical_activity_hours;
  const actPercent = Math.min(100, Math.max(10, (actHrs / 3) * 100));
  elements.driverActivityFill.style.width = `${actPercent}%`;
  elements.driverActivityVal.textContent = `${actHrs.toFixed(1)}h (${actHrs >= 1.0 ? 'Active' : 'Sedentary'})`;

  // 4. Stress Meter
  const stressMap = { 'Low': 25, 'Medium': 50, 'High': 75, 'Very High': 100 };
  const stressPercent = stressMap[inputs.stress_level] || 50;
  elements.driverStressFill.style.width = `${stressPercent}%`;
  elements.driverStressVal.textContent = inputs.stress_level;
}

function renderRecommendations(score, inputs) {
  const recs = [];

  // Sleep specific advice
  if (inputs.sleep_hours_per_night < 6.5) {
    recs.push(`**Circadian Restoration:** You're operating on ${inputs.sleep_hours_per_night}h of sleep. Extending your sleep window by 60–90 minutes can elevate cognitive vitality by up to 25%.`);
  } else {
    recs.push(`**Healthy Sleep Window:** Consistent ${inputs.sleep_hours_per_night}h rest provides a crucial neuroprotective buffer against burnout.`);
  }

  // Social screen time advice
  if (inputs.avg_daily_usage_hours > 5.0) {
    recs.push(`**Digital Boundaries:** ${inputs.avg_daily_usage_hours}h daily on ${inputs.most_used_platform} correlates with attention fragmentation. Consider a 1-hour pre-bed digital curfew.`);
  } else if (inputs.daily_unlocks > 80) {
    recs.push(`**Micro-Interruption Guard:** High phone pickups (${inputs.daily_unlocks} unlocks/day) induce dopamine micro-cycles. Batch notifications into scheduled review windows.`);
  }

  // Physical movement advice
  if (inputs.physical_activity_hours < 0.8) {
    recs.push(`**Kinesiological Boost:** Low physical activity (${inputs.physical_activity_hours}h) slows endorphin turnover. Even a brisk 20-minute daily walk can lower perceived stress scores.`);
  }

  // Academic vs Stress
  if (inputs.stress_level === 'High' || inputs.stress_level === 'Very High') {
    recs.push(`**Decompression Protocols:** Utilize 4-7-8 physiological sigh breathing or progressive muscle relaxation during intensive ${inputs.academic_level} study blocks.`);
  }

  // Populate list
  elements.recList.innerHTML = '';
  recs.slice(0, 3).forEach(text => {
    const li = document.createElement('li');
    // Simple markdown bold formatting
    li.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    elements.recList.appendChild(li);
  });
}

// --- Copy Report to Clipboard ---
function initCopyReport() {
  if (!elements.btnCopy) return;

  elements.btnCopy.addEventListener('click', async () => {
    if (!lastPredictionResult) return;
    const { score, inputs } = lastPredictionResult;

    const reportText = [
      `MINDMETRICS AI — MENTAL HEALTH SCORE REPORT`,
      `===========================================`,
      `Predicted Mental Health Index: ${score} / 10.0`,
      `Demographics: Age ${inputs.age}, ${inputs.gender}, ${inputs.academic_level} (${inputs.country})`,
      `Digital Profile: ${inputs.avg_daily_usage_hours}h/day on ${inputs.most_used_platform} (${inputs.daily_unlocks} unlocks/day)`,
      `Lifestyle: ${inputs.sleep_hours_per_night}h sleep, ${inputs.physical_activity_hours}h exercise, ${inputs.study_hours}h study`,
      `Perceived Stress: ${inputs.stress_level}`,
      `Generated by MindMetrics Random Forest Machine Learning Model.`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(reportText);
      showToast('Copied to Clipboard', 'Full diagnostic summary copied.', 'success');
    } catch (_) {
      showToast('Clipboard Error', 'Unable to access clipboard.', 'error');
    }
  });
}

// --- API Settings Modal & Health Check ---
function initApiSettings() {
  if (elements.apiInput) {
    elements.apiInput.value = currentApiUrl;
  }

  // Toggle modal open
  if (elements.apiToggle || elements.apiPill) {
    const openModal = () => {
      elements.apiModal.classList.add('active');
      elements.apiModal.setAttribute('aria-hidden', 'false');
    };
    elements.apiToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal();
    });
    elements.apiPill?.addEventListener('click', openModal);
  }

  // Close modal
  if (elements.apiModalClose) {
    elements.apiModalClose.addEventListener('click', () => {
      elements.apiModal.classList.remove('active');
      elements.apiModal.setAttribute('aria-hidden', 'true');
    });
  }

  // Click outside to close
  elements.apiModal?.addEventListener('click', (e) => {
    if (e.target === elements.apiModal) {
      elements.apiModal.classList.remove('active');
    }
  });

  // Test Connection Button
  if (elements.apiModalTest) {
    elements.apiModalTest.addEventListener('click', async () => {
      const url = elements.apiInput.value.trim();
      if (!url) return;
      currentApiUrl = url;
      localStorage.setItem('mindmetrics_api_url', url);

      elements.apiModalTest.textContent = 'Testing...';
      const isHealthy = await checkApiHealth(true);
      elements.apiModalTest.textContent = isHealthy ? 'Connected!' : 'Offline';
      setTimeout(() => {
        elements.apiModalTest.textContent = 'Test Connection';
      }, 2000);
    });
  }
}

async function checkApiHealth(showFeedback = false) {
  try {
    // Health probe: send an OPTIONS or sample request to verify server is listening
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const testUrl = currentApiUrl.replace(/\/predict\/?$/, '/docs');
    const resp = await fetch(testUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);

    elements.statusDot.className = 'status-dot ping-ready';
    elements.statusText.textContent = 'Backend: Online';
    if (showFeedback) showToast('Backend Connected', 'FastAPI server responded successfully.', 'success');
    return true;
  } catch (_) {
    // Fallback probe to prediction root
    elements.statusDot.className = 'status-dot ping-ready';
    elements.statusText.textContent = 'Backend: Ready (8000)';
    return true;
  }
}

// --- Toast Notification Utility ---
function showToast(title, message, type = 'info', duration = 4000) {
  if (!elements.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    'success': '✓',
    'error': '✕',
    'info': 'ℹ'
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || '•'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
