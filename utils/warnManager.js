/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   📋 WARN MANAGER — Sistema de Advertencias Progresivas     ║
 * ║   Comisión Disciplinaria Digital | LigaPro Ecuabet x4       ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * NOTA: Antes de llegar aquí, el usuario ya recibió advertencias
 * verbales (3 para links, 2 para spam/menciones). Esta escala
 * se aplica solo cuando el usuario insiste tras las advertencias.
 *
 * Escala de sanciones formales:
 *  Adv. 1 → Aislamiento 1h   (timeout)
 *  Adv. 2 → Aislamiento 4h   (timeout)
 *  Adv. 3 → Ban temporal 12h
 *  Adv. 4 → Expulsión (kick)
 *  Adv. 5+ → Ban permanente
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

let cachedWarns = null;

/** @returns {{ [userId: string]: { count: number, history: Array<{ts:number,reason:string}> } }} */
function loadWarns() {
  if (cachedWarns) return cachedWarns;
  try {
    if (!fs.existsSync(WARNS_PATH)) cachedWarns = {};
    else cachedWarns = JSON.parse(fs.readFileSync(WARNS_PATH, 'utf8'));
  } catch (_) { cachedWarns = {}; }
  return cachedWarns;
}

function saveWarns(data) {
  cachedWarns = data;
  fs.promises.writeFile(WARNS_PATH, JSON.stringify(data, null, 2)).catch(e => console.error('[WarnManager] Error saving warns:', e));
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

let cachedTempBans = null;

/** @returns {{ [userId: string]: { guildId: string, unbanAt: number } }} */
function loadTempBans() {
  if (cachedTempBans) return cachedTempBans;
  try {
    if (!fs.existsSync(TEMPBANS_PATH)) cachedTempBans = {};
    else cachedTempBans = JSON.parse(fs.readFileSync(TEMPBANS_PATH, 'utf8'));
  } catch (_) { cachedTempBans = {}; }
  return cachedTempBans;
}

function saveTempBans(data) {
  cachedTempBans = data;
  fs.promises.writeFile(TEMPBANS_PATH, JSON.stringify(data, null, 2)).catch(e => console.error('[WarnManager] Error saving tempbans:', e));
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
    case 1: return { type: 'TIMEOUT',   durationMs: 1 * 60 * 60 * 1000,  label: '⏸️ Aislamiento 1 hora' };
    case 2: return { type: 'TIMEOUT',   durationMs: 4 * 60 * 60 * 1000,  label: '⏸️ Aislamiento 4 horas' };
    case 3: return { type: 'TEMPBAN',   durationMs: 12 * 60 * 60 * 1000, label: '🟧 Ban temporal 12 horas' };
    case 4: return { type: 'KICK',      durationMs: 0,                    label: '🟥 Expulsión del servidor' };
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
