/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   📋 WARN MANAGER — Sistema de Advertencias Progresivas     ║
 * ║   Comisión Disciplinaria Digital | LigaPro Ecuabet x4       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Escala de sanciones por links:
 *  Adv. 1 → Aislamiento 2h   (timeout completo)
 *  Adv. 2 → Ban temporal 4h
 *  Adv. 3 → Ban temporal 12h
 *  Adv. 4 → Expulsión (kick)
 *  Adv. 5 → Expulsión (kick)
 *  Adv. 6 → Expulsión (kick)
 *  Adv. 7+ → Ban permanente
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR       = path.join(__dirname, '../data');
const WARNS_PATH     = path.join(DATA_DIR, 'antiraid_warns.json');
const TEMPBANS_PATH  = path.join(DATA_DIR, 'antiraid_tempbans.json');

// ── Asegurar directorio ──────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════════
//  ADVERTENCIAS PERSISTENTES
// ═══════════════════════════════════════════════════════════════

/** @returns {{ [userId: string]: { count: number, history: Array<{ts:number,reason:string}> } }} */
function loadWarns() {
  try {
    if (!fs.existsSync(WARNS_PATH)) return {};
    return JSON.parse(fs.readFileSync(WARNS_PATH, 'utf8'));
  } catch (_) { return {}; }
}

function saveWarns(data) {
  try { fs.writeFileSync(WARNS_PATH, JSON.stringify(data, null, 2)); } catch (_) {}
}

/**
 * Obtiene el número de advertencias actuales de un usuario
 * @param {string} userId
 */
function getWarnCount(userId) {
  const warns = loadWarns();
  return warns[userId]?.count || 0;
}

/**
 * Añade una advertencia y devuelve el nuevo total
 * @param {string} userId
 * @param {string} reason
 * @returns {number} nuevo conteo de advertencias
 */
function addWarn(userId, reason = 'Links no autorizados') {
  const warns = loadWarns();
  if (!warns[userId]) warns[userId] = { count: 0, history: [] };
  warns[userId].count++;
  warns[userId].history.push({ ts: Date.now(), reason });
  saveWarns(warns);
  return warns[userId].count;
}

/**
 * Resetea las advertencias de un usuario (uso admin)
 * @param {string} userId
 */
function resetWarns(userId) {
  const warns = loadWarns();
  delete warns[userId];
  saveWarns(warns);
}

/**
 * Devuelve todas las advertencias (para panel admin)
 */
function getAllWarns() {
  return loadWarns();
}

// ═══════════════════════════════════════════════════════════════
//  TEMP BANS PERSISTENTES
// ═══════════════════════════════════════════════════════════════

/** @returns {{ [userId: string]: { guildId: string, unbanAt: number } }} */
function loadTempBans() {
  try {
    if (!fs.existsSync(TEMPBANS_PATH)) return {};
    return JSON.parse(fs.readFileSync(TEMPBANS_PATH, 'utf8'));
  } catch (_) { return {}; }
}

function saveTempBans(data) {
  try { fs.writeFileSync(TEMPBANS_PATH, JSON.stringify(data, null, 2)); } catch (_) {}
}

/**
 * Registra un temp ban
 * @param {string} userId
 * @param {string} guildId
 * @param {number} durationMs
 */
function addTempBan(userId, guildId, durationMs) {
  const tempBans = loadTempBans();
  tempBans[userId] = { guildId, unbanAt: Date.now() + durationMs };
  saveTempBans(tempBans);
}

/**
 * Elimina un temp ban del registro
 * @param {string} userId
 */
function removeTempBan(userId) {
  const tempBans = loadTempBans();
  delete tempBans[userId];
  saveTempBans(tempBans);
}

/**
 * Devuelve todos los temp bans pendientes
 */
function getPendingTempBans() {
  return loadTempBans();
}

// ═══════════════════════════════════════════════════════════════
//  LÓGICA DE SANCIÓN PROGRESIVA
// ═══════════════════════════════════════════════════════════════

/**
 * Descripción de la sanción según el número de advertencia
 * @param {number} warnCount
 */
function getSanctionInfo(warnCount) {
  switch (warnCount) {
    case 1: return { type: 'TIMEOUT',   durationMs: 2 * 60 * 60 * 1000,  label: '⏸️ Aislamiento 2 horas' };
    case 2: return { type: 'TEMPBAN',   durationMs: 4 * 60 * 60 * 1000,  label: '🟨 Ban temporal 4 horas' };
    case 3: return { type: 'TEMPBAN',   durationMs: 12 * 60 * 60 * 1000, label: '🟧 Ban temporal 12 horas' };
    case 4: return { type: 'KICK',      durationMs: 0,                    label: '🟥 Expulsión del servidor' };
    case 5: return { type: 'KICK',      durationMs: 0,                    label: '🟥 Expulsión del servidor' };
    case 6: return { type: 'KICK',      durationMs: 0,                    label: '🟥 Expulsión del servidor' };
    default: return { type: 'PERMBAN',  durationMs: 0,                    label: '🚫 Ban permanente' };
  }
}

module.exports = {
  getWarnCount,
  addWarn,
  resetWarns,
  getAllWarns,
  addTempBan,
  removeTempBan,
  getPendingTempBans,
  getSanctionInfo,
};
