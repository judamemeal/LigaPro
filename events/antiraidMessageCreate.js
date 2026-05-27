/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   🔍 ANTIRAID — Detector de Mensajes | LigaPro Ecuabet x4  ║
 * ║   VAR Digital: Anti-Spam · Anti-Links · Anti-Menciones      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * SISTEMA FLEXIBLE — ADVERTENCIAS ANTES DE SANCIONES
 *
 * REGLAS DE LINKS:
 *  - GIFs (tenor, giphy, .gif) → PERMITIDOS, no se cuentan ni eliminan
 *  - Links 1ª–3ª vez → Se BORRAN + mensaje educativo visible al usuario
 *  - Links 4ª+ vez (>3) → SE CONSIDERA INFRACCIÓN → sanción progresiva
 *
 * REGLAS DE SPAM/FLOOD:
 *  - 1ª–2ª detección → Advertencia verbal (sin sanción)
 *  - 3ª+ detección   → Timeout 10 minutos
 *
 * REGLAS DE MENCIONES MASIVAS:
 *  - 1ª–2ª detección → Advertencia verbal (sin sanción)
 *  - 3ª+ detección   → Timeout 15 minutos
 *
 * ESCALA DE SANCIONES FORMALES (tras advertencias):
 *  Adv. 1 → Aislamiento 1h
 *  Adv. 2 → Aislamiento 4h
 *  Adv. 3 → Ban temporal 12h
 *  Adv. 4 → Expulsión (kick)
 *  Adv. 5+→ Ban permanente
 */

const { EmbedBuilder } = require('discord.js');
const {
  isWhitelisted, track, resetTracker, raidLog, autotimeout, autokick, autoban,
  spamTracker, linkTracker, mentionTracker, adminLinkTracker, adminStrikes,
  warningTracker,
  THRESHOLDS, AR_COLORS, LINK_REGEX, activateLockdown,
} = require('../utils/antiraid');
const {
  addWarn, getSanctionInfo, addTempBan,
} = require('../utils/warnManager');

// ── GIFs PERMITIDOS (nunca se eliminan ni cuentan) ──────────────
// Cubre: tenor, giphy, URLs terminadas en .gif y .gifv
const GIF_REGEX = /^https?:\/\/(www\.)?(tenor\.com|giphy\.com|media\.tenor\.com|c\.tenor\.com|i\.giphy\.com|media\d?\.giphy\.com|media\.discordapp\.net\/[^\s]+\.gif)/i;
const ENDS_GIF   = /\.(gif|gifv)(\?[^\s]*)?$/i;

/**
 * Devuelve true si el contenido del mensaje SOLO contiene links de GIFs
 * (o texto sin links prohibidos)
 */
function isGifOnly(content) {
  // Extraemos todos los URLs del mensaje
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = content.match(urlRegex);
  if (!urls) return false; // no hay URLs → no aplica
  // Si TODOS los URLs son GIFs → permitido
  return urls.every(url => GIF_REGEX.test(url) || ENDS_GIF.test(url));
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS DE ADVERTENCIAS VERBALES
// ═══════════════════════════════════════════════════════════════

/**
 * Obtiene o crea el registro de advertencias verbales de un usuario.
 * Si pasó más tiempo que WARNING_DECAY desde la última infracción, se resetea.
 */
function getWarnings(userId) {
  const now = Date.now();
  let entry = warningTracker.get(userId);

  if (!entry || (now - entry.lastInfraction) > THRESHOLDS.WARNING_DECAY) {
    entry = { spam: 0, mentions: 0, lastInfraction: now };
    warningTracker.set(userId, entry);
  }

  return entry;
}

/**
 * Incrementa el contador de advertencia verbal para un tipo y actualiza el timestamp.
 * @param {string} userId
 * @param {'spam'|'mentions'} type
 * @returns {number} nuevo conteo
 */
function addVerbalWarning(userId, type) {
  const entry = getWarnings(userId);
  entry[type]++;
  entry.lastInfraction = Date.now();
  warningTracker.set(userId, entry);
  return entry[type];
}

/**
 * Envía un mensaje de advertencia temporal al canal (se autoborra en X segundos)
 * @param {import('discord.js').Message} message
 * @param {string} text
 * @param {number} [deleteAfterMs=10000]
 */
async function sendTempWarning(message, text, deleteAfterMs = 10_000) {
  try {
    const reply = await message.channel.send(text);
    setTimeout(() => reply.delete().catch(() => {}), deleteAfterMs);
  } catch (_) {}
}

/**
 * Aplica la sanción progresiva por links al miembro
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').Guild} guild
 * @param {number} warnCount  número de advertencia actual (ya sumado)
 */
async function applySanction(member, guild, warnCount) {
  const info = getSanctionInfo(warnCount);

  switch (info.type) {

    // ── Adv 1-2: Aislamiento (Discord timeout) ─────────────────
    case 'TIMEOUT': {
      const horas = info.durationMs / (60 * 60 * 1000);
      await autotimeout(member,
        `Infracción reiterada (advertencia ${warnCount}) — Aislamiento ${horas}h`,
        info.durationMs
      );

      // Notificar al usuario por DM
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.WARNING)
        .setTitle('⏸️ AISLAMIENTO TEMPORAL — LigaPro Security')
        .setDescription(
          `Has sido **aislado** del estadio virtual de **LigaPro Ecuabet x4** durante **${horas} hora${horas > 1 ? 's' : ''}**.\n\n` +
          `Durante este tiempo **no podrás**:\n` +
          `> ❌ Enviar mensajes\n` +
          `> ❌ Reaccionar\n` +
          `> ❌ Crear o unirte a hilos\n\n` +
          `**Razón:** Comportamiento reiterado tras múltiples advertencias.\n` +
          `Esta es tu **sanción formal #${warnCount}**. Nuevas infracciones tendrán consecuencias mayores.`
        )
        .setFooter({ text: '🛡️ Comisión Disciplinaria | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});
      break;
    }

    // ── Adv 3: Ban temporal 12h ─────────────────────────────────
    case 'TEMPBAN': {
      const horas = info.durationMs / (60 * 60 * 1000);
      const unbanAt = Date.now() + info.durationMs;

      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.BAN)
        .setTitle(`🟨 BAN TEMPORAL ${horas}H — LigaPro Security`)
        .setDescription(
          `Has sido **baneado temporalmente** por **${horas} horas** del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** Comportamiento reiterado tras múltiples advertencias.\n` +
          `Esta es tu **sanción formal #${warnCount}**. Nuevas infracciones conllevarán expulsión o ban permanente.`
        )
        .addFields(
          { name: '⏰ Regreso', value: `<t:${Math.floor(unbanAt / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: '🛡️ Comisión Disciplinaria | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});

      // Guardar temp ban ANTES de banear (para que el scheduler lo recupere)
      addTempBan(member.id, guild.id, info.durationMs);
      await member.ban({
        reason: `🟨 AntiRaid [Sanción ${warnCount}]: Comportamiento reiterado — Ban temporal ${horas}h`,
        deleteMessageSeconds: 0,
      });
      break;
    }

    // ── Adv 4: Expulsión (kick) ─────────────────────────────────
    case 'KICK': {
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.BAN)
        .setTitle('🟥 EXPULSIÓN DEL ESTADIO — LigaPro Security')
        .setDescription(
          `Has sido **expulsado** del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** Comportamiento reiterativo tras múltiples advertencias.\n` +
          `Esta es tu **sanción formal #${warnCount}**. La próxima resultará en ban permanente.`
        )
        .setFooter({ text: '🛡️ Comisión Disciplinaria | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});

      await autokick(member, `Infracción reiterada (sanción formal ${warnCount})`);
      break;
    }

    // ── Adv 5+: Ban permanente ──────────────────────────────────
    case 'PERMBAN': {
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.RAID_ALERT)
        .setTitle('🚫 BAN PERMANENTE — LigaPro Security')
        .setDescription(
          `Has sido **baneado permanentemente** del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** Comportamiento malicioso reiterativo tras múltiples advertencias.\n` +
          `Sanción formal #${warnCount} alcanzada. No hay vuelta atrás.`
        )
        .setFooter({ text: '🚫 Comisión Disciplinaria Permanente | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});

      await autoban(member, `Infracción reiterada (sanción formal ${warnCount})`);
      break;
    }
  }

  return info;
}

// ═══════════════════════════════════════════════════════════════
//  EVENTO
// ═══════════════════════════════════════════════════════════════

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    // ── Ignorar bots / DMs / sistema ──────────────────────────
    if (message.author.bot || !message.guild || message.system) return;

    const member = message.member;
    const guild  = message.guild;

    const isAdmin = isWhitelisted(member, guild);

    // ── PROTECCIÓN EXTREMA CONTRA ADMINS HACKEADOS ─────────────
    if (isAdmin) {
      if (LINK_REGEX.test(message.content) && !isGifOnly(message.content)) {
        const adminLinkCount = track(adminLinkTracker, message.author.id, THRESHOLDS.ADMIN_LINK_SPAM_WINDOW);

        if (adminLinkCount >= THRESHOLDS.ADMIN_LINK_SPAM_COUNT) {
          // Administrador comprometido (mandando ~20 links en 10s)
          resetTracker(adminLinkTracker, message.author.id);
          
          let strikes = (adminStrikes.get(message.author.id) || 0) + 1;
          adminStrikes.set(message.author.id, strikes);
          
          await message.delete().catch(() => {});

          if (strikes === 1 || strikes === 2) {
            // Aislamiento por 12 horas
            await autotimeout(member, `[ADMIN COMPROMETIDO] Spam masivo de links (Strike ${strikes})`, 12 * 60 * 60 * 1000);
            
            await raidLog(guild, {
              title: `🚨 ADMINISTRADOR COMPROMETIDO — Aislamiento (Strike ${strikes})`,
              description: `**${message.author.tag}** (Admin/Whitelisted) ha enviado demasiados links muy rápido (${THRESHOLDS.ADMIN_LINK_SPAM_COUNT} en ${THRESHOLDS.ADMIN_LINK_SPAM_WINDOW/1000}s).\nSe ha aplicado un aislamiento (timeout) de 12 horas por seguridad extrema.`,
              color: AR_COLORS.LOCKDOWN,
              userId: message.author.id,
              fields: [
                { name: '⚖️ Sanción', value: 'Timeout 12 horas', inline: true },
                { name: '📍 Canal', value: `${message.channel}`, inline: true }
              ]
            });
            return;
          } else {
            // Tercer Strike -> Expulsión (kick)
            await autokick(member, `[ADMIN COMPROMETIDO] Spam masivo de links reiterado (Strike ${strikes})`);
            
            await raidLog(guild, {
              title: `🚨 ADMINISTRADOR COMPROMETIDO — EXPULSADO (Strike ${strikes})`,
              description: `**${message.author.tag}** (Admin/Whitelisted) continuó enviando spam masivo de links.\nSe ha expulsado al administrador del servidor por seguridad extrema.`,
              color: AR_COLORS.BAN,
              userId: message.author.id,
              fields: [
                { name: '⚖️ Sanción', value: 'Expulsión (Kick)', inline: true },
                { name: '📍 Canal', value: `${message.channel}`, inline: true }
              ]
            });
            return;
          }
        }
      }
      return; // Los admins regulares pasan sin ser evaluados por el resto del antiraid
    }

    // ══════════════════════════════════════════════════
    //  1. SPAM DE MENSAJES — CON ADVERTENCIAS PREVIAS
    // ══════════════════════════════════════════════════
    const spamCount = track(spamTracker, message.author.id, THRESHOLDS.SPAM_MSG_WINDOW);

    if (spamCount >= THRESHOLDS.SPAM_MSG_COUNT) {
      const warnings = getWarnings(message.author.id);

      // ── ¿Aún tiene advertencias disponibles? ──
      if (warnings.spam < THRESHOLDS.SPAM_WARN_MAX) {
        const warnNum = addVerbalWarning(message.author.id, 'spam');

        // Enviar advertencia verbal temporal (se borra sola en 10s)
        await sendTempWarning(message,
          `⚠️ **${message.author}**, por favor deja de escribir tan rápido. ` +
          `Si continúas, puedes recibir una sanción. ` +
          `*(Advertencia ${warnNum}/${THRESHOLDS.SPAM_WARN_MAX})*`
        );

        await raidLog(guild, {
          title: `ADVERTENCIA POR FLOOD — ${warnNum}/${THRESHOLDS.SPAM_WARN_MAX}`,
          description:
            `⚠️ **${message.author.tag}** está escribiendo demasiado rápido.\n` +
            `Se le envió una advertencia verbal (${warnNum}/${THRESHOLDS.SPAM_WARN_MAX}). ` +
            `Aún no se aplica sanción.`,
          color: AR_COLORS.SUSPICIOUS,
          userId: message.author.id,
          fields: [
            { name: '📨 Mensajes', value: `${spamCount} en ${THRESHOLDS.SPAM_MSG_WINDOW / 1000}s`, inline: true },
            { name: '📍 Canal',    value: `${message.channel}`, inline: true },
          ]
        });

        // Resetear el tracker de spam para darle un respiro
        resetTracker(spamTracker, message.author.id);
        return;
      }

      // ── Ya agotó las advertencias → SANCIONAR ──
      await message.delete().catch(() => {});
      await autotimeout(member, 'Spam masivo de mensajes tras advertencias', 10 * 60 * 1000);

      // Resetear advertencias verbales (ya fue sancionado)
      warnings.spam = 0;
      warningTracker.set(message.author.id, warnings);

      await raidLog(guild, {
        title: 'SPAM DE MENSAJES — SANCIÓN APLICADA',
        description:
          `🚨 **VAR DE SEGURIDAD:** Se detectó spam reiterado en el estadio.\n\n` +
          `**${message.author.tag}** continuó escribiendo rápido tras ${THRESHOLDS.SPAM_WARN_MAX} advertencias.\n` +
          `⚠️ **COMISIÓN DISCIPLINARIA:** Silencio temporal de 10 minutos aplicado.`,
        color: AR_COLORS.WARNING,
        userId: message.author.id,
        fields: [
          { name: '📨 Mensajes', value: `${spamCount} en ${THRESHOLDS.SPAM_MSG_WINDOW / 1000}s`, inline: true },
          { name: '👤 Usuario',  value: message.author.tag, inline: true },
          { name: '📍 Canal',    value: `${message.channel}`, inline: true },
          { name: '🕐 Sanción',  value: 'Timeout 10 minutos', inline: true },
        ]
      });

      if (spamCount >= THRESHOLDS.SPAM_MSG_COUNT * 3) {
        await activateLockdown(guild, `Spam extremo por ${message.author.tag}`);
      }
      return;
    }

    // ══════════════════════════════════════════════════
    //  2. LINKS EXTERNOS — CON ADVERTENCIAS EDUCATIVAS
    // ══════════════════════════════════════════════════
    if (LINK_REGEX.test(message.content)) {

      // ── GIFs PERMITIDOS: no se tocan, se ignoran completamente ──
      if (isGifOnly(message.content)) return;

      // ── EXCEPCIÓN: TICKETS DE PARTNER ──
      if (global.ticketData && global.ticketData.tickets) {
        const isPartnerTicket = Object.values(global.ticketData.tickets).some(
          t => t.channelId === message.channel.id && t.type === '🤝 Partner' && t.status === 'open'
        );
        if (isPartnerTicket) return; // Permitir enviar links libremente aquí
      }

      // Eliminar el mensaje con link (siempre)
      await message.delete().catch(() => {});

      // Contar links en ventana de 2 minutos
      const linkCount = track(linkTracker, message.author.id, THRESHOLDS.LINK_WINDOW);

      // ── Aún dentro de las advertencias educativas (1-3) ──
      if (linkCount < THRESHOLDS.LINK_COUNT) {

        // Enviar mensaje educativo visible (se borra en 15s)
        await sendTempWarning(message,
          `🔗 **${message.author}**, no puedes enviar links en este servidor. ` +
          `Si deseas algún partner, abre un ticket y el staff te responderá. ` +
          `*(Advertencia ${linkCount}/${THRESHOLDS.LINK_COUNT - 1})*`,
          15_000
        );

        await raidLog(guild, {
          title: `LINK ELIMINADO — Advertencia ${linkCount}/${THRESHOLDS.LINK_COUNT - 1}`,
          description:
            `🔇 Link eliminado + advertencia educativa enviada.\n` +
            `**${message.author.tag}** intentó publicar un enlace no autorizado.\n` +
            `Se le informó que puede abrir un ticket para solicitudes de partner.`,
          color: AR_COLORS.SUSPICIOUS,
          userId: message.author.id,
          fields: [
            { name: '📍 Canal',    value: `${message.channel}`, inline: true },
            { name: '🔢 Conteo',   value: `${linkCount}/${THRESHOLDS.LINK_COUNT - 1}`, inline: true },
          ]
        });
        return;
      }

      // ── UMBRAL SUPERADO: emitir sanción formal ──────────
      // Resetear el contador para que la próxima ráfaga también cuente desde 0
      linkTracker.delete(message.author.id);

      const warnCount = addWarn(message.author.id, `Links reiterados (${linkCount} en ventana)`);
      const info = await applySanction(member, guild, warnCount);

      await raidLog(guild, {
        title: `🟥 INFRACCIÓN POR LINKS — Sanción Formal #${warnCount}`,
        description:
          `🚨 **VAR DE SEGURIDAD:** **${message.author.tag}** superó el límite de links tras advertencias.\n\n` +
          `📋 **Comisión Disciplinaria** ha aplicado sanción automática.\n` +
          `**Sanción aplicada:** ${info.label}`,
        color: warnCount >= 5 ? AR_COLORS.RAID_ALERT : warnCount >= 4 ? AR_COLORS.BAN : AR_COLORS.WARNING,
        userId: message.author.id,
        fields: [
          { name: '🔢 Sanción Formal',  value: `#${warnCount}`, inline: true },
          { name: '⚖️ Sanción',      value: info.label, inline: true },
          { name: '🔗 Links en ráfaga', value: `${linkCount}`, inline: true },
          { name: '📍 Canal',        value: `${message.channel}`, inline: true },
        ]
      });
      return;
    }

    // ══════════════════════════════════════════════════
    //  3. MENCIONES MASIVAS — CON ADVERTENCIAS PREVIAS
    // ══════════════════════════════════════════════════
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    if (totalMentions >= THRESHOLDS.MENTION_COUNT) {
      const warnings = getWarnings(message.author.id);

      // ── ¿Aún tiene advertencias disponibles? ──
      if (warnings.mentions < THRESHOLDS.MENTION_WARN_MAX) {
        const warnNum = addVerbalWarning(message.author.id, 'mentions');

        await sendTempWarning(message,
          `⚠️ **${message.author}**, evita hacer menciones masivas. ` +
          `Si continúas, recibirás una sanción. ` +
          `*(Advertencia ${warnNum}/${THRESHOLDS.MENTION_WARN_MAX})*`
        );

        await raidLog(guild, {
          title: `ADVERTENCIA POR MENCIONES — ${warnNum}/${THRESHOLDS.MENTION_WARN_MAX}`,
          description:
            `⚠️ **${message.author.tag}** realizó un ping con ${totalMentions} menciones.\n` +
            `Se le envió una advertencia verbal (${warnNum}/${THRESHOLDS.MENTION_WARN_MAX}). ` +
            `Aún no se aplica sanción.`,
          color: AR_COLORS.SUSPICIOUS,
          userId: message.author.id,
          fields: [
            { name: '📢 Menciones', value: `${totalMentions}`, inline: true },
            { name: '📍 Canal',     value: `${message.channel}`, inline: true },
          ]
        });
        return;
      }

      // ── Ya agotó las advertencias → SANCIONAR ──
      await message.delete().catch(() => {});
      await autotimeout(member, 'Ping masivo reiterado tras advertencias', 15 * 60 * 1000);

      // Resetear advertencias verbales (ya fue sancionado)
      warnings.mentions = 0;
      warningTracker.set(message.author.id, warnings);

      await raidLog(guild, {
        title: 'PING MASIVO — SANCIÓN APLICADA',
        description:
          `🚨 **VAR DE SEGURIDAD:** Actividad reiterada en el estadio.\n\n` +
          `**${message.author.tag}** continuó con menciones masivas tras ${THRESHOLDS.MENTION_WARN_MAX} advertencias.\n` +
          `🟥 **TARJETA ROJA:** Silencio temporal de 15 minutos aplicado.`,
        color: AR_COLORS.BAN,
        userId: message.author.id,
        fields: [
          { name: '📢 Menciones', value: `${totalMentions}`, inline: true },
          { name: '👤 Usuario',   value: message.author.tag, inline: true },
          { name: '📍 Canal',     value: `${message.channel}`, inline: true },
          { name: '🕐 Sanción',   value: 'Timeout 15 minutos', inline: true },
        ]
      });
    }
  },
};
