/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        🛡️  ANTIRAID ENGINE - LigaPro Ecuabet x4            ║
 * ║   Sistema VAR de Seguridad | Árbitro Digital Automático     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendLog } = require('./logger');
const config = require('../config');

// ── COLORES TEMÁTICOS ANTIRAID ──────────────────────────────────
const AR_COLORS = {
  RAID_ALERT:    0xFF0000,   // Rojo VAR - peligro máximo
  WARNING:       0xFF6B00,   // Naranja tarjeta amarilla
  BAN:           0xCC0000,   // Rojo tarjeta roja
  LOCKDOWN:      0x8B0000,   // Rojo oscuro - Modo Estadio Seguro
  SAFE:          0x00C851,   // Verde - vuelta a la normalidad
  INFO:          0x1565C0,   // Azul LigaPro
  SUSPICIOUS:    0xFFAB00,   // Ámbar - sospechoso
};

// ── ESTADO GLOBAL DEL ANTIRAID ──────────────────────────────────
const raidState = {
  /** true si el modo lockdown está activo */
  lockdownActive: false,
  /** timestamp de cuándo inició el lockdown */
  lockdownSince: null,
  /** nivel de alerta: 'NORMAL' | 'ELEVADO' | 'CRITICO' */
  alertLevel: 'NORMAL',
  /** comandos deshabilitados en modo defensa */
  disabledCommands: new Set(),
  /** invitaciones bloqueadas en lockdown */
  invitesBanned: false,
};

// ── REGISTROS EN MEMORIA ────────────────────────────────────────
/** Map<userId, { count, firstSeen, messages: string[] }> */
const spamTracker    = new Map();
/** Map<userId, { count, firstSeen }> */
const joinTracker    = new Map();
/** Map<userId, { count, firstSeen }> */
const cmdTracker     = new Map();
/** Map<userId, { count, firstSeen }> */
const btnTracker     = new Map();
/** Map<userId, { count, firstSeen }> */
const linkTracker    = new Map();
/** Map<userId, { count, firstSeen }> */
const ticketTracker  = new Map();
/** Map<userId, { count, firstSeen }> */
const mentionTracker = new Map();
/** Map<guildId, { count, firstSeen }> */
const joinBurst      = new Map();
/** Map<userId, { count, firstSeen }> */
const adminLinkTracker = new Map();
/** Map<userId, number> */
const adminStrikes   = new Map();
/** Map<userId, { spam: number, mentions: number, lastInfraction: number }> */
const warningTracker = new Map();

// ── UMBRALES DE DETECCIÓN ───────────────────────────────────────
const THRESHOLDS = {
  // Mensajes por usuario en X ms
  SPAM_MSG_COUNT:    8,
  SPAM_MSG_WINDOW:   5_000,
  // Joins rápidos al servidor
  JOIN_BURST_COUNT:  8,
  JOIN_BURST_WINDOW: 10_000,
  // Comandos slash por usuario
  CMD_SPAM_COUNT:    8,
  CMD_SPAM_WINDOW:   6_000,
  // Botones / interacciones
  BTN_SPAM_COUNT:    10,
  BTN_SPAM_WINDOW:   5_000,
  // Links externos — se necesitan MÁS DE 3 (4ª vez = infracción)
  LINK_COUNT:        4,           // se activa en la 4ª detección (>3)
  LINK_WINDOW:       2 * 60_000,  // ventana de 2 minutos
  // Admin Link Spam (hacked admins enviando > 20 links en 10s)
  ADMIN_LINK_SPAM_COUNT:  20,
  ADMIN_LINK_SPAM_WINDOW: 10_000,
  // Menciones masivas
  MENTION_COUNT:     6,
  MENTION_WINDOW:    5_000,
  // Tickets / embeds masivos
  TICKET_COUNT:      3,
  TICKET_WINDOW:     30_000,
  // Duración lockdown automático (ms)
  LOCKDOWN_DURATION: 15 * 60 * 1000,
  // ── ADVERTENCIAS (sistema flexible) ────────────────
  SPAM_WARN_MAX:     2,            // advertencias verbales antes de sancionar por spam
  MENTION_WARN_MAX:  2,            // advertencias verbales antes de sancionar por menciones
  LINK_WARN_MAX:     3,            // advertencias visibles antes de escalar a sanción formal por links
  WARNING_DECAY:     5 * 60_000,   // 5 minutos sin infracciones → se resetean advertencias
};

// ── COMANDOS PELIGROSOS QUE SE DESHABILITAN EN LOCKDOWN ─────────
const DANGEROUS_COMMANDS = ['ticket', 'fichar', 'autorol'];

// ── REGEX DE LINKS ──────────────────────────────────────────────
const LINK_REGEX = /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i;

// ═══════════════════════════════════════════════════════════════
//  WHITELIST
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica si un miembro está en la whitelist (dueño, admins de config, bots)
 * @param {import('discord.js').GuildMember|null} member
 * @param {import('discord.js').Guild} guild
 */
function isWhitelisted(member, guild) {
  if (!member) return false;
  if (member.user.bot) return true;
  if (member.id === guild.ownerId) return true;
  // Roles de admin configurados
  if (member.roles.cache.some(r => config.ADMIN_ROLES.includes(r.id))) return true;
  // Permiso admin de Discord
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS DE TRACKER EN MEMORIA
// ═══════════════════════════════════════════════════════════════

/**
 * Registra un evento en el tracker y devuelve cuántas veces ocurrió en la ventana
 * @param {Map} tracker
 * @param {string} key
 * @param {number} window  ms
 * @param {number} [maxStore] máx entradas a recordar (para limpieza)
 */
function track(tracker, key, window, maxStore = 50) {
  const now = Date.now();
  let entry = tracker.get(key);
  if (!entry || now - entry.firstSeen > window) {
    entry = { count: 1, firstSeen: now };
  } else {
    entry.count++;
  }
  tracker.set(key, entry);
  // Limpieza periódica (evitar fugas de memoria)
  if (tracker.size > maxStore) {
    const oldest = [...tracker.entries()]
      .sort((a, b) => a[1].firstSeen - b[1].firstSeen)[0];
    if (oldest) tracker.delete(oldest[0]);
  }
  return entry.count;
}

/**
 * Resetea el contador de un tracker para un usuario (tras emitir sanción)
 * @param {Map} tracker
 * @param {string} key
 */
function resetTracker(tracker, key) {
  tracker.delete(key);
}

// ═══════════════════════════════════════════════════════════════
//  LOCKDOWN
// ═══════════════════════════════════════════════════════════════

/**
 * Activa el Modo Estadio Seguro para el servidor
 * @param {import('discord.js').Guild} guild
 * @param {string} reason  razón legible
 */
async function activateLockdown(guild, reason = 'Actividad de raid detectada') {
  if (raidState.lockdownActive) return; // ya activo
  raidState.lockdownActive = true;
  raidState.lockdownSince  = Date.now();
  raidState.alertLevel     = 'CRITICO';

  // Deshabilitar comandos peligrosos
  DANGEROUS_COMMANDS.forEach(cmd => raidState.disabledCommands.add(cmd));

  // Bloquear invitaciones del servidor
  try {
    const invites = await guild.invites.fetch();
    for (const inv of invites.values()) {
      await inv.delete('🛡️ AntiRaid - Modo Estadio Seguro activado').catch(() => {});
    }
    raidState.invitesBanned = true;
  } catch (_) {}

  // Slowmode en canales públicos (2 min)
  try {
    const channels = guild.channels.cache.filter(
      c => c.isTextBased() && c.permissionsFor(guild.roles.everyone)?.has('SendMessages')
    );
    for (const ch of channels.values()) {
      await ch.setRateLimitPerUser(120, '🛡️ AntiRaid lockdown').catch(() => {});
    }
  } catch (_) {}

  // Log inmediato
  await sendLog(guild, {
    title: '🛡️ MODO ESTADIO SEGURO ACTIVADO',
    description:
      `**🚫 RAID DETECTADO EN LigaPro Ecuabet x4**\n\n` +
      `El sistema VAR de Seguridad ha detectado actividad maliciosa.\n` +
      `Se han activado protocolos de emergencia automáticos.\n\n` +
      `**Razón:** ${reason}`,
    color: AR_COLORS.LOCKDOWN,
    fields: [
      { name: '⏱️ Duración', value: '15 minutos (automático)', inline: true },
      { name: '🔒 Invitaciones', value: 'Bloqueadas', inline: true },
      { name: '🐢 Slowmode', value: '2 minutos en canales públicos', inline: true },
      { name: '🚫 Comandos bloqueados', value: DANGEROUS_COMMANDS.join(', '), inline: false },
    ]
  });

  // Levantar lockdown automáticamente tras 15 minutos
  setTimeout(() => deactivateLockdown(guild), THRESHOLDS.LOCKDOWN_DURATION);
}

/**
 * Desactiva el Modo Estadio Seguro
 * @param {import('discord.js').Guild} guild
 */
async function deactivateLockdown(guild) {
  if (!raidState.lockdownActive) return;
  raidState.lockdownActive = false;
  raidState.lockdownSince  = null;
  raidState.alertLevel     = 'NORMAL';
  raidState.disabledCommands.clear();
  raidState.invitesBanned  = false;

  // Quitar slowmode
  try {
    const channels = guild.channels.cache.filter(c => c.isTextBased());
    for (const ch of channels.values()) {
      await ch.setRateLimitPerUser(0, '✅ AntiRaid - Modo normal restaurado').catch(() => {});
    }
  } catch (_) {}

  await sendLog(guild, {
    title: '✅ MODO ESTADIO SEGURO DESACTIVADO',
    description:
      `El sistema de seguridad ha regresado a estado **NORMAL**.\n` +
      `Todos los canales y comandos han sido restaurados.\n\n` +
      `🏟️ **LigaPro Ecuabet x4** vuelve a operar con normalidad.`,
    color: AR_COLORS.SAFE,
    fields: [
      { name: '🕐 Duración del lockdown', value: `${Math.floor((Date.now() - (raidState.lockdownSince || Date.now())) / 60000)} min`, inline: true },
      { name: '🔓 Estado', value: 'Operaciones restauradas', inline: true },
    ]
  });
}

// ═══════════════════════════════════════════════════════════════
//  ACCIONES PUNITIVAS
// ═══════════════════════════════════════════════════════════════

/**
 * Bannea un usuario automáticamente (tarjeta roja)
 * @param {import('discord.js').GuildMember} member
 * @param {string} reason
 */
async function autoban(member, reason) {
  try {
    await member.send({
      embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.BAN)
        .setTitle('🟥 TARJETA ROJA — LigaPro Security')
        .setDescription(
          `Has sido expulsado automáticamente del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** ${reason}\n\n` +
          `Si crees que esto es un error, contacta a la Comisión Disciplinaria.`
        )
        .setTimestamp()
      ]
    }).catch(() => {});
    await member.ban({ reason: `🟥 AntiRaid: ${reason}`, deleteMessageSeconds: 86400 });
  } catch (_) {}
}

/**
 * Kickea un usuario automáticamente (tarjeta amarilla grave)
 * @param {import('discord.js').GuildMember} member
 * @param {string} reason
 */
async function autokick(member, reason) {
  try {
    await member.send({
      embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.WARNING)
        .setTitle('🟨 ADVERTENCIA OFICIAL — LigaPro Security')
        .setDescription(
          `Has sido expulsado temporalmente del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** ${reason}`
        )
        .setTimestamp()
      ]
    }).catch(() => {});
    await member.kick(`🟨 AntiRaid: ${reason}`);
  } catch (_) {}
}

/**
 * Aplica timeout/mute a un usuario (advertencia formal)
 * @param {import('discord.js').GuildMember} member
 * @param {string} reason
 * @param {number} durationMs  duración en ms
 */
async function autotimeout(member, reason, durationMs = 10 * 60 * 1000) {
  try {
    await member.timeout(durationMs, `⚠️ AntiRaid: ${reason}`);
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════
//  FUNCIÓN DE LOG ANTIRAID
// ═══════════════════════════════════════════════════════════════

/**
 * Envía un log temático del AntiRaid al canal de logs
 */
async function raidLog(guild, { title, description, color = AR_COLORS.WARNING, fields = [], userId = null }) {
  const allFields = [...fields];
  if (userId) allFields.unshift({ name: '🆔 ID Usuario', value: userId, inline: true });

  await sendLog(guild, {
    title: `🛡️ VAR DE SEGURIDAD: ${title}`,
    description,
    color,
    fields: allFields
  });
}

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  raidState,
  AR_COLORS,
  THRESHOLDS,
  LINK_REGEX,
  isWhitelisted,
  track,
  resetTracker,
  activateLockdown,
  deactivateLockdown,
  autoban,
  autokick,
  autotimeout,
  raidLog,
  // Trackers compartidos
  spamTracker,
  joinTracker,
  cmdTracker,
  btnTracker,
  linkTracker,
  ticketTracker,
  mentionTracker,
  joinBurst,
  adminLinkTracker,
  adminStrikes,
  warningTracker,
};
