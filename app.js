/**
 * CODEX DU LOUP — Assistant RPG de Suivi Sportif & Summer Body
 * Inspiré de l'interface de personnage et d'alchimie de The Witcher 3
 */

const STORAGE_KEY = 'codex_du_loup_state_v1';

const WITCHER_RANKS = [
  { minLevel: 1, title: 'Novice de Kaer Morhen' },
  { minLevel: 3, title: 'Apprenti Sorceleur' },
  { minLevel: 5, title: 'Sorceleur de l’École du Loup' },
  { minLevel: 8, title: 'Vétéran de la Voie' },
  { minLevel: 12, title: 'Maître Sorceleur' },
  { minLevel: 16, title: 'Loup Blanc — Légende Summer Body' }
];

const METRIC_CONFIG = {
  weight: { label: 'Poids Corporel', unit: 'kg', color: '#f0d58c', goalKey: 'targetWeight' },
  bodyFat: { label: 'Masse Grasse', unit: '%', color: '#ef4444', goalKey: 'targetFat' },
  muscle: { label: 'Masse Musculaire', unit: 'kg', color: '#48bb78', goalKey: null },
  bone: { label: 'Masse Osseuse', unit: 'kg', color: '#cbd5e0', goalKey: null },
  waterPct: { label: 'Hydratation Corporelle', unit: '%', color: '#63b3ed', goalKey: null },
  calories: { label: 'Calories Journalières', unit: 'kcal', color: '#ecc94b', goalKey: 'targetCalories' },
  steps: { label: 'Pas Quotidiens', unit: 'pas', color: '#9f7aea', goalKey: 'targetSteps' },
  workoutVolume: { label: 'Volume Soulevé (Tonnage)', unit: 'kg', color: '#f6ad55', goalKey: null }
};

function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function addDaysISO(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const offset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - offset).toISOString().slice(0, 10);
}

function createDefaultDayRecord(dateStr) {
  return {
    date: dateStr,
    weight: null,
    bodyFat: null,
    muscle: null,
    bone: null,
    waterPct: null,
    waterLiters: 0,
    calories: null,
    steps: 0,
    notes: '',
    proteinChecked: false,
    proteinGrams: 140,
    creatineChecked: false,
    creatineGrams: 5,
    workouts: []
  };
}

function createInitialState() {
  const today = getTodayISO();
  const state = {
    profile: {
      name: 'Loup Blanc',
      targetWeight: 76.0,
      targetFat: 12.0,
      targetCalories: 2200,
      targetWaterLiters: 3.0,
      targetSteps: 10000
    },
    xp: 320,
    days: {}
  };

  // Seed 10 days of realistic initial data so graphs & silhouette are immediately alive
  const sampleWorkouts = [
    { id: 'w1', name: 'Développé Couché', zone: 'Pectoraux', mode: 'weighted', sets: 4, reps: 10, weight: 65, done: true },
    { id: 'w2', name: 'Tractions Pronation', zone: 'Dos', mode: 'bodyweight', sets: 4, reps: 10, weight: 0, done: true },
    { id: 'w3', name: 'Pompes Explosives', zone: 'Pectoraux', mode: 'bodyweight', sets: 4, reps: 20, weight: 0, done: true },
    { id: 'w4', name: 'Squat Barre', zone: 'Jambes', mode: 'weighted', sets: 4, reps: 10, weight: 85, done: false },
    { id: 'w5', name: 'Gainage Planche (sec)', zone: 'Abdos / Core', mode: 'bodyweight', sets: 3, reps: 60, weight: 0, done: true }
  ];

  for (let i = 9; i >= 0; i--) {
    const d = addDaysISO(today, -i);
    const progress = (9 - i) / 9;
    state.days[d] = {
      date: d,
      weight: Number((79.4 - progress * 1.3).toFixed(1)),
      bodyFat: Number((16.2 - progress * 0.9).toFixed(1)),
      muscle: Number((61.8 + progress * 0.6).toFixed(1)),
      bone: 3.2,
      waterPct: Number((58.5 + progress * 1.4).toFixed(1)),
      waterLiters: i === 0 ? 2.0 : 2.75,
      calories: Math.round(2250 - (i % 3) * 60),
      steps: Math.round(8200 + progress * 2400 + (i % 2 === 0 ? 400 : -300)),
      notes: i === 0 ? 'Séance prête dans la Salle d’Armes.' : 'Entraînement validé.',
      proteinChecked: i !== 0 ? true : true,
      proteinGrams: 150,
      creatineChecked: i !== 2,
      creatineGrams: 5,
      workouts: i === 0
        ? JSON.parse(JSON.stringify(sampleWorkouts))
        : [
            { id: 'h1_' + i, name: 'Développé Couché', zone: 'Pectoraux', mode: 'weighted', sets: 4, reps: 10, weight: 60 + (9 - i), done: true },
            { id: 'h2_' + i, name: 'Tractions Pronation', zone: 'Dos', mode: 'bodyweight', sets: 4, reps: 10, weight: 0, done: true }
          ]
    };
  }

  return state;
}

let appState = loadState();
let activeDate = getTodayISO();
let activeChartMetric = 'weight';
let activeChartRange = 30;
let deferredPwaPrompt = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.days) parsed.days = {};
    if (!parsed.profile) parsed.profile = createInitialState().profile;
    return parsed;
  } catch (e) {
    console.error('Erreur chargement mémoire :', e);
    return createInitialState();
  }
}

function saveState(toastMsg = null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    const statusEl = document.getElementById('saveStatusText');
    if (statusEl) {
      const now = new Date();
      statusEl.textContent = `Sauvegardé à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (toastMsg) showToast(toastMsg);
  } catch (e) {
    console.error('Erreur sauvegarde :', e);
  }
}

function getDayRecord(dateStr) {
  if (!appState.days[dateStr]) {
    appState.days[dateStr] = createDefaultDayRecord(dateStr);
  }
  return appState.days[dateStr];
}

function addXp(amount, reason) {
  appState.xp = Math.max(0, (appState.xp || 0) + amount);
  saveState(`${amount >= 0 ? '+' : ''}${amount} XP — ${reason}`);
  renderHud();
}

function showToast(message) {
  const toast = document.getElementById('rpgToast');
  if (!toast) return;
  toast.textContent = `🐺 ${message}`;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

/* ==========================================
   COMPUTE LEVEL, RANK, STREAK & VOLUME
   ========================================== */
function computeTotalXp() {
  let calculated = 100;
  Object.values(appState.days).forEach((d) => {
    if (d.weight !== null || d.bodyFat !== null) calculated += 50;
    if (d.proteinChecked) calculated += 40;
    if (d.creatineChecked) calculated += 40;
    if (d.waterLiters >= (appState.profile.targetWaterLiters || 3)) calculated += 30;
    if ((Number(d.steps) || 0) >= (appState.profile.targetSteps || 10000)) calculated += 30;
    if (Array.isArray(d.workouts)) {
      d.workouts.forEach((w) => {
        if (w.done) calculated += 35;
      });
    }
  });
  return Math.max(appState.xp || 0, calculated);
}

function getRankForLevel(level) {
  let current = WITCHER_RANKS[0].title;
  for (const r of WITCHER_RANKS) {
    if (level >= r.minLevel) current = r.title;
  }
  return current;
}

function computeStreak() {
  let streak = 0;
  let cursor = getTodayISO();
  for (let i = 0; i < 365; i++) {
    const d = appState.days[cursor];
    const active = d && (d.proteinChecked || d.creatineChecked || (d.workouts && d.workouts.some((w) => w.done)) || d.weight !== null);
    if (active) {
      streak++;
      cursor = addDaysISO(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

function computeDayWorkoutVolume(day) {
  if (!day || !Array.isArray(day.workouts)) return 0;
  return day.workouts.reduce((sum, w) => {
    if (!w.done) return sum;
    if (w.mode === 'weighted') {
      return sum + (Number(w.sets) || 0) * (Number(w.reps) || 0) * (Number(w.weight) || 0);
    }
    return sum;
  }, 0);
}

/* ==========================================
   RENDER HUD & ALL PANELS
   ========================================== */
function renderAll() {
  document.getElementById('activeDateInput').value = activeDate;
  renderHud();
  renderCharacterTab();
  renderAlchemyTab();
  renderTrainingTab();
  renderChroniclesTab();
  renderGrimoireTab();
}

function renderHud() {
  const totalXp = computeTotalXp();
  const xpPerLevel = 500;
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const currentLevelXp = totalXp % xpPerLevel;
  const xpPct = Math.min(100, Math.round((currentLevelXp / xpPerLevel) * 100));

  document.getElementById('hudLevel').textContent = level;
  document.getElementById('hudName').textContent = appState.profile.name || 'Loup Blanc';
  document.getElementById('hudRank').textContent = getRankForLevel(level);
  document.getElementById('hudStreak').textContent = `🔥 ${computeStreak()} j`;

  document.getElementById('hudXpText').textContent = `${currentLevelXp} / ${xpPerLevel} XP`;
  document.getElementById('hudXpBar').style.width = `${xpPct}%`;

  const day = getDayRecord(activeDate);
  const elixirsCount = (day.proteinChecked ? 1 : 0) + (day.creatineChecked ? 1 : 0);
  document.getElementById('hudToxicityText').textContent = `${elixirsCount} / 2`;
  document.getElementById('hudToxicityBar').style.width = `${elixirsCount * 50}%`;

  const waterTarget = Number(appState.profile.targetWaterLiters) || 3.0;
  const waterScore = Math.min(1, (Number(day.waterLiters) || 0) / waterTarget);
  const calScore = day.calories ? 1 : 0;
  const vitalityPct = Math.round(((waterScore + calScore) / 2) * 100);
  document.getElementById('hudVitalityText').textContent = `${vitalityPct}%`;
  document.getElementById('hudVitalityBar').style.width = `${vitalityPct}%`;
}

function findPreviousMetricValue(dateStr, key) {
  const sortedDates = Object.keys(appState.days).sort();
  const idx = sortedDates.indexOf(dateStr);
  for (let i = idx - 1; i >= 0; i--) {
    const prev = appState.days[sortedDates[i]];
    if (prev && prev[key] !== null && prev[key] !== undefined && prev[key] !== '') {
      return Number(prev[key]);
    }
  }
  return null;
}

function formatDeltaBadge(elId, currentVal, prevVal, unit, lowerIsBetter = false) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (currentVal === null || currentVal === undefined || prevVal === null) {
    el.textContent = 'Stable';
    el.className = 'delta-tag delta-neutral';
    return;
  }
  const diff = Number((currentVal - prevVal).toFixed(1));
  if (diff === 0) {
    el.textContent = `= 0 ${unit}`;
    el.className = 'delta-tag delta-neutral';
    return;
  }
  const sign = diff > 0 ? '+' : '';
  el.textContent = `${sign}${diff} ${unit}`;
  const isGood = lowerIsBetter ? diff < 0 : diff > 0;
  el.className = `delta-tag ${isGood ? 'delta-good' : 'delta-neutral'}`;
}

function renderCharacterTab() {
  const day = getDayRecord(activeDate);
  const isToday = activeDate === getTodayISO();
  document.getElementById('statsDateBadge').textContent = isToday ? "Aujourd'hui" : activeDate;

  // Stat tiles
  document.getElementById('valWeight').textContent = day.weight !== null ? `${day.weight} kg` : '-- kg';
  document.getElementById('valBodyFat').textContent = day.bodyFat !== null ? `${day.bodyFat} %` : '-- %';
  document.getElementById('valMuscle').textContent = day.muscle !== null ? `${day.muscle} kg` : '-- kg';
  document.getElementById('valBone').textContent = day.bone !== null ? `${day.bone} kg` : '-- kg';
  document.getElementById('valWater').textContent = day.waterPct !== null ? `${day.waterPct} %` : '-- %';
  document.getElementById('valWaterLiters').textContent = `${(Number(day.waterLiters) || 0).toFixed(2)} L`;
  document.getElementById('valCalories').textContent = day.calories !== null ? `${day.calories} kcal` : '-- kcal';
  const currentSteps = Number(day.steps) || 0;
  document.getElementById('valSteps').textContent = `${currentSteps.toLocaleString('fr-FR')} pas`;

  // Targets
  document.getElementById('targetWeightLabel').textContent = `${appState.profile.targetWeight} kg`;
  document.getElementById('targetFatLabel').textContent = `${appState.profile.targetFat} %`;
  document.getElementById('targetCaloriesLabel').textContent = `${appState.profile.targetCalories} kcal`;
  const targetSteps = Number(appState.profile.targetSteps) || 10000;
  document.getElementById('targetStepsLabel').textContent = `${targetSteps.toLocaleString('fr-FR')} pas`;

  // Deltas
  formatDeltaBadge('deltaWeight', day.weight, findPreviousMetricValue(activeDate, 'weight'), 'kg', true);
  formatDeltaBadge('deltaBodyFat', day.bodyFat, findPreviousMetricValue(activeDate, 'bodyFat'), '%', true);
  formatDeltaBadge('deltaMuscle', day.muscle, findPreviousMetricValue(activeDate, 'muscle'), 'kg', false);
  formatDeltaBadge('deltaBone', day.bone, findPreviousMetricValue(activeDate, 'bone'), 'kg', false);
  formatDeltaBadge('deltaWater', day.waterPct, findPreviousMetricValue(activeDate, 'waterPct'), '%', false);
  formatDeltaBadge('deltaCalories', day.calories, findPreviousMetricValue(activeDate, 'calories'), 'kcal', false);
  formatDeltaBadge('deltaSteps', day.steps, findPreviousMetricValue(activeDate, 'steps'), 'pas', false);

  // Populate biometrics form
  document.getElementById('inputWeight').value = day.weight !== null ? day.weight : '';
  document.getElementById('inputBodyFat').value = day.bodyFat !== null ? day.bodyFat : '';
  document.getElementById('inputMuscle').value = day.muscle !== null ? day.muscle : '';
  document.getElementById('inputBone').value = day.bone !== null ? day.bone : '';
  document.getElementById('inputWaterPct').value = day.waterPct !== null ? day.waterPct : '';
  document.getElementById('inputCalories').value = day.calories !== null ? day.calories : '';
  document.getElementById('inputSteps').value = day.steps !== null && day.steps !== undefined ? day.steps : '';
  document.getElementById('inputNotes').value = day.notes || '';

  // Quick quest summary
  const doneWorkouts = (day.workouts || []).filter((w) => w.done);
  document.getElementById('quickQuestProtein').textContent = day.proteinChecked ? `✅ ${day.proteinGrams}g` : '⏳ À prendre';
  document.getElementById('quickQuestCreatine').textContent = day.creatineChecked ? `✅ ${day.creatineGrams}g` : '⏳ À prendre';
  document.getElementById('quickQuestWorkouts').textContent = `${doneWorkouts.length} / ${(day.workouts || []).length} validés`;

  // Highlight trained anatomical zones
  const trainedZones = new Set(doneWorkouts.map((w) => w.zone));
  if (currentSteps >= targetSteps) {
    trainedZones.add('Jambes');
    trainedZones.add('Mental / Cardio');
  }
  document.querySelectorAll('.muscle-zone').forEach((zoneEl) => {
    const zName = zoneEl.getAttribute('data-zone');
    if (trainedZones.has(zName)) {
      zoneEl.classList.add('trained');
    } else {
      zoneEl.classList.remove('trained');
    }
  });
  document.getElementById('trainedZonesCount').textContent = `${trainedZones.size} zone${trainedZones.size > 1 ? 's' : ''} active${trainedZones.size > 1 ? 's' : ''}`;

  // Mutagen slots status
  const redSlot = document.getElementById('mutagenRed');
  redSlot.classList.toggle('active-red', doneWorkouts.length > 0);
  document.getElementById('mutagenRedVal').textContent = doneWorkouts.length > 0 ? `${doneWorkouts.length} Ex.` : 'Repos';

  const greenSlot = document.getElementById('mutagenGreen');
  const elixirScore = (day.proteinChecked ? 1 : 0) + (day.creatineChecked ? 1 : 0);
  greenSlot.classList.toggle('active-green', elixirScore === 2);
  document.getElementById('mutagenGreenVal').textContent = `${elixirScore}/2`;

  const blueSlot = document.getElementById('mutagenBlue');
  const waterPctGoal = Math.min(100, Math.round(((day.waterLiters || 0) / (appState.profile.targetWaterLiters || 3)) * 100));
  blueSlot.classList.toggle('active-blue', waterPctGoal >= 80);
  document.getElementById('mutagenBlueVal').textContent = `${waterPctGoal}%`;

  const goldSlot = document.getElementById('mutagenGold');
  let summerScore = '--%';
  if (day.bodyFat !== null && appState.profile.targetFat) {
    const ratio = Math.min(100, Math.max(10, Math.round((appState.profile.targetFat / day.bodyFat) * 100)));
    summerScore = `${ratio}%`;
    goldSlot.classList.toggle('active-gold', ratio >= 80);
  }
  document.getElementById('mutagenGoldVal').textContent = summerScore;
}

/* ==========================================
   RENDER ALCHEMY TAB (PROTEIN, CREATINE, WATER)
   ========================================== */
function renderAlchemyTab() {
  const day = getDayRecord(activeDate);

  const checkProt = document.getElementById('checkProtein');
  const checkCrea = document.getElementById('checkCreatine');
  checkProt.checked = !!day.proteinChecked;
  checkCrea.checked = !!day.creatineChecked;

  document.getElementById('proteinGramsInput').value = day.proteinGrams ?? 140;
  document.getElementById('creatineGramsInput').value = day.creatineGrams ?? 5;

  document.getElementById('elixirCardProtein').classList.toggle('completed', !!day.proteinChecked);
  document.getElementById('elixirCardCreatine').classList.toggle('completed', !!day.creatineChecked);

  const liters = Number(day.waterLiters) || 0;
  const targetL = Number(appState.profile.targetWaterLiters) || 3.0;
  const pct = Math.min(100, Math.round((liters / targetL) * 100));

  document.getElementById('waterLitersBadge').textContent = `${liters.toFixed(2)} / ${targetL.toFixed(1)} L`;
  document.getElementById('waterProgressPct').textContent = `${pct}%`;
  document.getElementById('waterBarFill').style.width = `${pct}%`;

  document.getElementById('alchemyCaloriesInput').value = day.calories !== null ? day.calories : '';
  document.getElementById('alchemyWaterPctInput').value = day.waterPct !== null ? day.waterPct : '';
}

/* ==========================================
   RENDER TRAINING TAB (EXERCISE CHECKLIST)
   ========================================== */
function renderTrainingTab() {
  const day = getDayRecord(activeDate);
  const container = document.getElementById('workoutChecklistContainer');
  const volume = computeDayWorkoutVolume(day);
  document.getElementById('workoutVolumeBadge').textContent = `Volume soulevé : ${volume} kg`;

  if (!day.workouts || day.workouts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
        <p class="lore-quote" style="margin-bottom: 0.75rem;">Aucun exercice inscrit pour cette journée.</p>
        <p style="font-size: 0.8rem;">Ajoutez un exercice à gauche ou cliquez sur <strong>« + Routine Summer Body »</strong>.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = day.workouts
    .map((w, idx) => {
      const isWeighted = w.mode === 'weighted';
      const totalReps = (Number(w.sets) || 0) * (Number(w.reps) || 0);
      const subText = isWeighted
        ? `${totalReps} rép. totales • Tonnage : ${totalReps * (Number(w.weight) || 0)} kg`
        : `${totalReps} rép. au poids du corps`;

      return `
        <div class="workout-item ${w.done ? 'done' : ''}" data-index="${idx}">
          <div class="workout-main">
            <input type="checkbox" class="rpg-checkbox workout-toggle" data-index="${idx}" ${w.done ? 'checked' : ''} />
            <div>
              <div class="workout-title">${escapeHtml(w.name)}</div>
              <div class="workout-meta">
                <span class="rpg-badge">${escapeHtml(w.zone)}</span>
                <span class="mode-pill ${isWeighted ? 'weighted' : 'bodyweight'}">
                  ${isWeighted ? '🏋️ Poids soulevé' : '🤸 Poids du corps'}
                </span>
                <span>${subText}</span>
              </div>
            </div>
          </div>

          <div class="workout-inputs">
            <div class="mini-field">
              <label>Séries</label>
              <input type="number" min="1" class="workout-edit-sets" data-index="${idx}" value="${w.sets}" />
            </div>
            <div class="mini-field">
              <label>Rép.</label>
              <input type="number" min="1" class="workout-edit-reps" data-index="${idx}" value="${w.reps}" />
            </div>
            ${
              isWeighted
                ? `<div class="mini-field">
                    <label>Poids (kg)</label>
                    <input type="number" step="0.5" min="0" class="workout-edit-weight" data-index="${idx}" value="${w.weight}" />
                  </div>`
                : ''
            }
            <button type="button" class="btn-icon-rpg workout-delete" data-index="${idx}" title="Supprimer">✕</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================
   RENDER CHRONICLES TAB (CANVAS CHART & TABLE)
   ========================================== */
function renderChroniclesTab() {
  drawEvolutionChart();
  renderHistoryTable();
}

function drawEvolutionChart() {
  const canvas = document.getElementById('evolutionChartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(300, rect.width - 16);
  const height = Math.max(240, rect.height - 16);

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);

  const cfg = METRIC_CONFIG[activeChartMetric] || METRIC_CONFIG.weight;

  // Gather data points sorted by date
  const sortedDates = Object.keys(appState.days).sort();
  const cutoffDate = addDaysISO(getTodayISO(), -activeChartRange);

  const points = [];
  sortedDates.forEach((dStr) => {
    if (dStr < cutoffDate) return;
    const dObj = appState.days[dStr];
    let val = null;
    if (activeChartMetric === 'workoutVolume') {
      val = computeDayWorkoutVolume(dObj);
      if (val === 0 && (!dObj.workouts || dObj.workouts.length === 0)) val = null;
    } else {
      val = dObj[activeChartMetric];
    }
    if (val !== null && val !== undefined && val !== '') {
      points.push({ date: dStr, value: Number(val) });
    }
  });

  document.getElementById('chartPointsBadge').textContent = `${points.length} mesure${points.length > 1 ? 's' : ''}`;

  const padLeft = 52;
  const padRight = 24;
  const padTop = 28;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Draw background grid
  ctx.strokeStyle = 'rgba(200, 164, 93, 0.14)';
  ctx.lineWidth = 1;
  const gridRows = 4;
  for (let r = 0; r <= gridRows; r++) {
    const y = padTop + (plotH / gridRows) * r;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(width - padRight, y);
    ctx.stroke();
  }

  if (points.length === 0) {
    ctx.fillStyle = '#b7a990';
    ctx.font = 'italic 15px "Cormorant Garamond", serif';
    ctx.textAlign = 'center';
    ctx.fillText('Aucune mesure enregistrée sur cette période pour cet attribut.', width / 2, height / 2);
    return;
  }

  const values = points.map((p) => p.value);
  const goalVal = cfg.goalKey && appState.profile[cfg.goalKey] ? Number(appState.profile[cfg.goalKey]) : null;
  if (goalVal !== null) values.push(goalVal);

  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  if (minVal === maxVal) {
    minVal -= 2;
    maxVal += 2;
  } else {
    const margin = (maxVal - minVal) * 0.15;
    minVal -= margin;
    maxVal += margin;
  }

  const getX = (idx) =>
    points.length === 1 ? padLeft + plotW / 2 : padLeft + (idx / (points.length - 1)) * plotW;
  const getY = (v) => padTop + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;

  // Y-axis labels
  ctx.fillStyle = '#b7a990';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let r = 0; r <= gridRows; r++) {
    const v = maxVal - ((maxVal - minVal) / gridRows) * r;
    const y = padTop + (plotH / gridRows) * r;
    ctx.fillText(v.toFixed(1), padLeft - 8, y + 4);
  }

  // Optional Goal Line
  if (goalVal !== null) {
    const gy = getY(goalVal);
    ctx.save();
    ctx.strokeStyle = 'rgba(72, 187, 120, 0.7)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, gy);
    ctx.lineTo(width - padRight, gy);
    ctx.stroke();
    ctx.fillStyle = '#68d391';
    ctx.textAlign = 'left';
    ctx.font = '10px Cinzel, serif';
    ctx.fillText(`CIBLE : ${goalVal} ${cfg.unit}`, padLeft + 6, gy - 5);
    ctx.restore();
  }

  // Area gradient under curve
  if (points.length > 1) {
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, cfg.color + '55');
    grad.addColorStop(1, cfg.color + '05');
    ctx.beginPath();
    ctx.moveTo(getX(0), padTop + plotH);
    points.forEach((p, i) => ctx.lineTo(getX(i), getY(p.value)));
    ctx.lineTo(getX(points.length - 1), padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Main line
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.value);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points & labels
  const stepLabel = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.value);

    // Diamond point
    ctx.fillStyle = '#090807';
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (i % stepLabel === 0 || i === points.length - 1) {
      // Value above point
      ctx.fillStyle = '#ece2d0';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.value}`, x, y - 9);

      // Date on X-axis
      const shortDate = p.date.slice(5).split('-').reverse().join('/');
      ctx.fillStyle = '#846a3a';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(shortDate, x, height - 12);
    }
  });
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  const dates = Object.keys(appState.days).sort().reverse();

  const nonEmptyDates = dates.filter((d) => {
    const r = appState.days[d];
    return (
      r.weight !== null ||
      r.bodyFat !== null ||
      r.muscle !== null ||
      r.calories !== null ||
      (r.steps && r.steps > 0) ||
      r.proteinChecked ||
      r.creatineChecked ||
      (r.workouts && r.workouts.length > 0)
    );
  });

  tbody.innerHTML = nonEmptyDates
    .slice(0, 30)
    .map((d) => {
      const r = appState.days[d];
      const doneEx = (r.workouts || []).filter((w) => w.done).length;
      const totalEx = (r.workouts || []).length;
      return `
        <tr>
          <td><strong>${d}</strong></td>
          <td>${r.weight !== null ? r.weight + ' kg' : '-'}</td>
          <td>${r.bodyFat !== null ? r.bodyFat + ' %' : '-'}</td>
          <td>${r.muscle !== null ? r.muscle + ' kg' : '-'}</td>
          <td>${r.bone !== null ? r.bone + ' kg' : '-'}</td>
          <td>${r.waterPct !== null ? r.waterPct + ' %' : '-'}</td>
          <td>${r.calories !== null ? r.calories : '-'}</td>
          <td>${r.steps ? Number(r.steps).toLocaleString('fr-FR') : '-'}</td>
          <td>${r.proteinChecked ? '🧪Prot' : ''} ${r.creatineChecked ? '⚡Créa' : ''}</td>
          <td>${doneEx}/${totalEx}</td>
          <td>
            <button type="button" class="btn-icon-rpg history-jump-btn" data-date="${d}">Voir</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderGrimoireTab() {
  document.getElementById('profName').value = appState.profile.name || 'Loup Blanc';
  document.getElementById('profTargetWeight').value = appState.profile.targetWeight ?? 76;
  document.getElementById('profTargetFat').value = appState.profile.targetFat ?? 12;
  document.getElementById('profTargetCalories').value = appState.profile.targetCalories ?? 2200;
  document.getElementById('profTargetWaterLiters').value = appState.profile.targetWaterLiters ?? 3.0;
  document.getElementById('profTargetSteps').value = appState.profile.targetSteps ?? 10000;
}

/* ==========================================
   EVENT LISTENERS & INTERACTIONS
   ========================================== */
function setupEventListeners() {
  // Navigation tabs
  document.querySelectorAll('.rpg-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rpg-tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
      if (targetId === 'tab-chronicles') {
        setTimeout(drawEvolutionChart, 30);
      }
    });
  });

  // Date selector controls
  document.getElementById('btnPrevDay').addEventListener('click', () => {
    activeDate = addDaysISO(activeDate, -1);
    renderAll();
  });
  document.getElementById('btnNextDay').addEventListener('click', () => {
    activeDate = addDaysISO(activeDate, 1);
    renderAll();
  });
  document.getElementById('btnToday').addEventListener('click', () => {
    activeDate = getTodayISO();
    renderAll();
  });
  document.getElementById('activeDateInput').addEventListener('change', (e) => {
    if (e.target.value) {
      activeDate = e.target.value;
      renderAll();
    }
  });

  // Interactive Anatomical Zones
  document.querySelectorAll('.muscle-zone').forEach((zoneEl) => {
    zoneEl.addEventListener('click', () => {
      document.querySelectorAll('.muscle-zone').forEach((z) => z.classList.remove('selected'));
      zoneEl.classList.add('selected');
      const zoneName = zoneEl.getAttribute('data-zone');
      const day = getDayRecord(activeDate);
      const matching = (day.workouts || []).filter((w) => w.zone === zoneName && w.done);
      document.getElementById('selectedZoneLabel').textContent = `Zone : ${zoneName}`;
      document.getElementById('selectedZoneStatus').textContent =
        matching.length > 0 ? `${matching.length} ex. validé(s)` : 'Non travaillée ce jour';
    });
  });

  // Biometrics Form Submit
  document.getElementById('biometricsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const day = getDayRecord(activeDate);
    const parseOrNull = (id) => {
      const v = document.getElementById(id).value;
      return v !== '' ? Number(v) : null;
    };
    day.weight = parseOrNull('inputWeight');
    day.bodyFat = parseOrNull('inputBodyFat');
    day.muscle = parseOrNull('inputMuscle');
    day.bone = parseOrNull('inputBone');
    day.waterPct = parseOrNull('inputWaterPct');
    day.calories = parseOrNull('inputCalories');
    const parsedSteps = parseOrNull('inputSteps');
    if (parsedSteps !== null) day.steps = Math.max(0, Math.round(parsedSteps));
    day.notes = document.getElementById('inputNotes').value.trim();

    addXp(50, 'Mesures corporelles gravées');
    renderAll();
  });

  // Steps quick add buttons
  document.querySelectorAll('[data-steps-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.getAttribute('data-steps-add'));
      const day = getDayRecord(activeDate);
      day.steps = Math.max(0, (Number(day.steps) || 0) + delta);
      saveState(`Pas quotidiens : ${day.steps.toLocaleString('fr-FR')} pas`);
      renderAll();
    });
  });

  // Alchemy Checkboxes (Protein & Creatine)
  document.getElementById('checkProtein').addEventListener('change', (e) => {
    const day = getDayRecord(activeDate);
    day.proteinChecked = e.target.checked;
    day.proteinGrams = Number(document.getElementById('proteinGramsInput').value) || 140;
    addXp(day.proteinChecked ? 40 : -40, 'Élixir Protéine');
    renderAll();
  });

  document.getElementById('proteinGramsInput').addEventListener('change', (e) => {
    const day = getDayRecord(activeDate);
    day.proteinGrams = Number(e.target.value) || 0;
    saveState('Grammage protéine mis à jour');
    renderAll();
  });

  document.getElementById('checkCreatine').addEventListener('change', (e) => {
    const day = getDayRecord(activeDate);
    day.creatineChecked = e.target.checked;
    day.creatineGrams = Number(document.getElementById('creatineGramsInput').value) || 5;
    addXp(day.creatineChecked ? 40 : -40, 'Élixir Créatine');
    renderAll();
  });

  document.getElementById('creatineGramsInput').addEventListener('change', (e) => {
    const day = getDayRecord(activeDate);
    day.creatineGrams = Number(e.target.value) || 0;
    saveState('Dose créatine mise à jour');
    renderAll();
  });

  // Water quick add buttons
  document.querySelectorAll('[data-water-add]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.getAttribute('data-water-add'));
      const day = getDayRecord(activeDate);
      day.waterLiters = Math.max(0, Number(((Number(day.waterLiters) || 0) + delta).toFixed(2)));
      saveState(`Hydratation : ${day.waterLiters} L`);
      renderAll();
    });
  });

  // Save Alchemy Metrics button
  document.getElementById('btnSaveAlchemyMetrics').addEventListener('click', () => {
    const day = getDayRecord(activeDate);
    const cal = document.getElementById('alchemyCaloriesInput').value;
    const wp = document.getElementById('alchemyWaterPctInput').value;
    if (cal !== '') day.calories = Number(cal);
    if (wp !== '') day.waterPct = Number(wp);
    saveState('Rations & Hydratation enregistrées');
    renderAll();
  });

  // Exercise Preset Selector
  document.getElementById('exPresetSelect').addEventListener('change', (e) => {
    if (!e.target.value) return;
    const [name, zone, mode, sets, reps, weight] = e.target.value.split('|');
    document.getElementById('exNameInput').value = name;
    document.getElementById('exZoneSelect').value = zone;
    document.getElementById('exModeSelect').value = mode;
    document.getElementById('exSetsInput').value = sets;
    document.getElementById('exRepsInput').value = reps;
    document.getElementById('exWeightInput').value = weight;
    document.getElementById('exWeightGroup').style.opacity = mode === 'bodyweight' ? '0.4' : '1';
  });

  document.getElementById('exModeSelect').addEventListener('change', (e) => {
    const isBw = e.target.value === 'bodyweight';
    document.getElementById('exWeightGroup').style.opacity = isBw ? '0.4' : '1';
    if (isBw) document.getElementById('exWeightInput').value = 0;
  });

  // Add Exercise Form
  document.getElementById('addExerciseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const day = getDayRecord(activeDate);
    const mode = document.getElementById('exModeSelect').value;
    const newWorkout = {
      id: 'ex_' + Date.now(),
      name: document.getElementById('exNameInput').value.trim(),
      zone: document.getElementById('exZoneSelect').value,
      mode,
      sets: Number(document.getElementById('exSetsInput').value) || 4,
      reps: Number(document.getElementById('exRepsInput').value) || 10,
      weight: mode === 'weighted' ? Number(document.getElementById('exWeightInput').value) || 0 : 0,
      done: false
    };
    day.workouts.push(newWorkout);
    document.getElementById('exNameInput').value = '';
    document.getElementById('exPresetSelect').value = '';
    saveState('Exercice ajouté à la checklist');
    renderAll();
  });

  // Load Full Body Summer Body Routine
  document.getElementById('btnLoadFullBodyPreset').addEventListener('click', () => {
    const day = getDayRecord(activeDate);
    const routine = [
      { id: 'r1_' + Date.now(), name: 'Développé Couché', zone: 'Pectoraux', mode: 'weighted', sets: 4, reps: 10, weight: 65, done: false },
      { id: 'r2_' + Date.now(), name: 'Tractions Pronation', zone: 'Dos', mode: 'bodyweight', sets: 4, reps: 10, weight: 0, done: false },
      { id: 'r3_' + Date.now(), name: 'Développé Militaire', zone: 'Épaules', mode: 'weighted', sets: 4, reps: 12, weight: 40, done: false },
      { id: 'r4_' + Date.now(), name: 'Dips au Poids du Corps', zone: 'Bras', mode: 'bodyweight', sets: 4, reps: 12, weight: 0, done: false },
      { id: 'r5_' + Date.now(), name: 'Squat Barre', zone: 'Jambes', mode: 'weighted', sets: 4, reps: 10, weight: 80, done: false },
      { id: 'r6_' + Date.now(), name: 'Crunch & Gainage', zone: 'Abdos / Core', mode: 'bodyweight', sets: 4, reps: 25, weight: 0, done: false }
    ];
    day.workouts.push(...routine);
    saveState('Routine Summer Body chargée !');
    renderAll();
  });

  // Delegated events on Workout Checklist
  document.getElementById('workoutChecklistContainer').addEventListener('change', (e) => {
    const idx = Number(e.target.getAttribute('data-index'));
    const day = getDayRecord(activeDate);
    if (Number.isNaN(idx) || !day.workouts[idx]) return;

    if (e.target.classList.contains('workout-toggle')) {
      day.workouts[idx].done = e.target.checked;
      addXp(e.target.checked ? 35 : -35, day.workouts[idx].name);
      renderAll();
    } else if (e.target.classList.contains('workout-edit-sets')) {
      day.workouts[idx].sets = Number(e.target.value) || 1;
      saveState();
      renderAll();
    } else if (e.target.classList.contains('workout-edit-reps')) {
      day.workouts[idx].reps = Number(e.target.value) || 1;
      saveState();
      renderAll();
    } else if (e.target.classList.contains('workout-edit-weight')) {
      day.workouts[idx].weight = Number(e.target.value) || 0;
      saveState();
      renderAll();
    }
  });

  document.getElementById('workoutChecklistContainer').addEventListener('click', (e) => {
    if (e.target.classList.contains('workout-delete')) {
      const idx = Number(e.target.getAttribute('data-index'));
      const day = getDayRecord(activeDate);
      if (!Number.isNaN(idx) && day.workouts[idx]) {
        day.workouts.splice(idx, 1);
        saveState('Exercice retiré');
        renderAll();
      }
    }
  });

  // Chart Metric & Range selectors
  document.getElementById('metricButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-metric]');
    if (!btn) return;
    document.querySelectorAll('#metricButtons .chip-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeChartMetric = btn.getAttribute('data-metric');
    drawEvolutionChart();
  });

  document.getElementById('rangeButtons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-range]');
    if (!btn) return;
    document.querySelectorAll('#rangeButtons .chip-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeChartRange = Number(btn.getAttribute('data-range'));
    drawEvolutionChart();
  });

  window.addEventListener('resize', () => {
    if (document.getElementById('tab-chronicles').classList.contains('active')) {
      drawEvolutionChart();
    }
  });

  // History table jump to date
  document.getElementById('historyTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.history-jump-btn');
    if (!btn) return;
    activeDate = btn.getAttribute('data-date');
    document.querySelector('[data-tab="tab-character"]').click();
    renderAll();
  });

  // Profile & Summer Body Goals form
  document.getElementById('profileGoalsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    appState.profile.name = document.getElementById('profName').value.trim() || 'Loup Blanc';
    appState.profile.targetWeight = Number(document.getElementById('profTargetWeight').value) || 75;
    appState.profile.targetFat = Number(document.getElementById('profTargetFat').value) || 12;
    appState.profile.targetCalories = Number(document.getElementById('profTargetCalories').value) || 2200;
    appState.profile.targetWaterLiters = Number(document.getElementById('profTargetWaterLiters').value) || 3.0;
    appState.profile.targetSteps = Number(document.getElementById('profTargetSteps').value) || 10000;
    saveState('Contrat Summer Body scellé !');
    renderAll();
  });

  // Export JSON Backup
  document.getElementById('btnExportJson').addEventListener('click', () => {
    const dataStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-codex-loup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Sauvegarde JSON exportée');
  });

  // Import JSON Backup
  document.getElementById('inputImportJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (imported && imported.days && imported.profile) {
          appState = imported;
          saveState('Sauvegarde restaurée avec succès !');
          renderAll();
        } else {
          alert('Fichier JSON non reconnu.');
        }
      } catch (err) {
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
  });

  // Seed 21 days of demo progression
  document.getElementById('btnSeedDemoData').addEventListener('click', () => {
    const today = getTodayISO();
    for (let i = 20; i >= 0; i--) {
      const d = addDaysISO(today, -i);
      const t = (20 - i) / 20;
      appState.days[d] = {
        date: d,
        weight: Number((80.5 - t * 2.6 + Math.sin(i) * 0.2).toFixed(1)),
        bodyFat: Number((17.0 - t * 2.2).toFixed(1)),
        muscle: Number((61.2 + t * 1.4).toFixed(1)),
        bone: Number((3.2 + (i % 2 === 0 ? 0.0 : 0.1)).toFixed(1)),
        waterPct: Number((58.0 + t * 2.5).toFixed(1)),
        waterLiters: Number((2.5 + (i % 3) * 0.25).toFixed(2)),
        calories: 2150 + (i % 4) * 50,
        steps: Math.round(7800 + t * 3200 + (i % 3 === 0 ? 800 : -400)),
        notes: 'Progression constante vers le Summer Body.',
        proteinChecked: true,
        proteinGrams: 155,
        creatineChecked: i % 6 !== 0,
        creatineGrams: 5,
        workouts: [
          { id: 'sim1_' + i, name: 'Développé Couché', zone: 'Pectoraux', mode: 'weighted', sets: 4, reps: 10, weight: Math.round(60 + t * 12), done: true },
          { id: 'sim2_' + i, name: 'Tractions Pronation', zone: 'Dos', mode: 'bodyweight', sets: 4, reps: 12, weight: 0, done: true },
          { id: 'sim3_' + i, name: 'Squat Barre', zone: 'Jambes', mode: 'weighted', sets: 4, reps: 10, weight: Math.round(75 + t * 15), done: i % 2 === 0 }
        ]
      };
    }
    saveState('21 jours de chroniques générés !');
    renderAll();
  });

  // Reset all data
  document.getElementById('btnResetAllData').addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment effacer toutes les mesures et repartir de zéro ?')) {
      appState = {
        profile: {
          name: 'Loup Blanc',
          targetWeight: 76.0,
          targetFat: 12.0,
          targetCalories: 2200,
          targetWaterLiters: 3.0,
          targetSteps: 10000
        },
        xp: 0,
        days: {}
      };
      saveState('Mémoire réinitialisée');
      renderAll();
    }
  });

  // PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const btn = document.getElementById('btnInstallPwa');
    if (btn) btn.style.display = 'block';
  });

  document.getElementById('btnInstallPwa').addEventListener('click', async () => {
    if (!deferredPwaPrompt) return;
    deferredPwaPrompt.prompt();
    await deferredPwaPrompt.userChoice;
    deferredPwaPrompt = null;
    document.getElementById('btnInstallPwa').style.display = 'none';
  });
}

// Register Service Worker for Android PWA offline mode
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  renderAll();
});
