/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   🔍 ANTIRAID — Detector de Mensajes | LigaPro Ecuabet x4  ║
 * ║   VAR Digital: Anti-Spam · Anti-Links · Anti-Menciones      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * REGLAS DE LINKS:
 *  - GIFs (tenor, giphy, .gif) → PERMITIDOS, no se cuentan ni eliminan
 *  - Links normales 1–3 veces  → Eliminados en silencio, sin advertencia
 *  - Links 4ª vez (>3)         → SE CONSIDERA INFRACCIÓN → advertencia progresiva
 *
 * ESCALA DE SANCIONES:
 *  Adv. 1 → Aislamiento 2h (timeout: sin hablar, reaccionar ni usar hilos)
 *  Adv. 2 → Ban temporal 4h
 *  Adv. 3 → Ban temporal 12h
 *  Adv. 4 → Expulsión (kick)
 *  Adv. 5 → Expulsión (kick)
 *  Adv. 6 → Expulsión (kick)
 *  Adv. 7+→ Ban permanente
 */

const { EmbedBuilder } = require('discord.js');
const {
  isWhitelisted, track, resetTracker, raidLog, autotimeout, autokick, autoban,
  spamTracker, linkTracker, mentionTracker, adminLinkTracker, adminStrikes,
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

/**
 * Aplica la sanción progresiva por links al miembro
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').Guild} guild
 * @param {number} warnCount  número de advertencia actual (ya sumado)
 */
async function applySanction(member, guild, warnCount) {
  const info = getSanctionInfo(warnCount);

  switch (info.type) {

    // ── Adv 1: Aislamiento completo 2h (Discord timeout) ───────
    case 'TIMEOUT': {
      // El timeout de Discord bloquea: mensajes, reacciones, hilos, todo
      await autotimeout(member,
        `Infracción por links (advertencia ${warnCount}) — Aislamiento 2h`,
        info.durationMs
      );

      // Notificar al usuario por DM
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.WARNING)
        .setTitle('⏸️ AISLAMIENTO TEMPORAL — LigaPro Security')
        .setDescription(
          `Has sido **aislado** del estadio virtual de **LigaPro Ecuabet x4** durante **2 horas**.\n\n` +
          `Durante este tiempo **no podrás**:\n` +
          `> ❌ Enviar mensajes\n` +
          `> ❌ Reaccionar\n` +
          `> ❌ Crear o unirte a hilos\n\n` +
          `**Razón:** Publicación reiterada de links no autorizados.\n` +
          `Esta es tu **advertencia #${warnCount}**. Nuevas infracciones tendrán consecuencias mayores.`
        )
        .setFooter({ text: '🛡️ Comisión Disciplinaria | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});
      break;
    }

    // ── Adv 2-3: Ban temporal (4h / 12h) ───────────────────────
    case 'TEMPBAN': {
      const horas = info.durationMs / (60 * 60 * 1000);
      const unbanAt = Date.now() + info.durationMs;

      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.BAN)
        .setTitle(`🟨 BAN TEMPORAL ${horas}H — LigaPro Security`)
        .setDescription(
          `Has sido **baneado temporalmente** por **${horas} horas** del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** Publicación reiterada de links no autorizados.\n` +
          `Esta es tu **advertencia #${warnCount}**. Nuevas infracciones conllevarán expulsión o ban permanente.`
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
        reason: `🟨 AntiRaid [Adv. ${warnCount}]: Links reiterados — Ban temporal ${horas}h`,
        deleteMessageSeconds: 0,
      });
      break;
    }

    // ── Adv 4-6: Expulsión (kick) ───────────────────────────────
    case 'KICK': {
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.BAN)
        .setTitle('🟥 EXPULSIÓN DEL ESTADIO — LigaPro Security')
        .setDescription(
          `Has sido **expulsado** del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** Comportamiento reiterativo con links no autorizados.\n` +
          `Esta es tu **advertencia #${warnCount}**. La próxima resultará en ban permanente.`
        )
        .setFooter({ text: '🛡️ Comisión Disciplinaria | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});

      await autokick(member, `Infracción por links (advertencia ${warnCount})`);
      break;
    }

    // ── Adv 7+: Ban permanente ──────────────────────────────────
    case 'PERMBAN': {
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(AR_COLORS.RAID_ALERT)
        .setTitle('🚫 BAN PERMANENTE — LigaPro Security')
        .setDescription(
          `Has sido **baneado permanentemente** del estadio virtual de **LigaPro Ecuabet x4**.\n\n` +
          `**Razón:** Comportamiento malicioso reiterativo (links no autorizados).\n` +
          `Advertencia #${warnCount} alcanzada. No hay vuelta atrás.`
        )
        .setFooter({ text: '🚫 Comisión Disciplinaria Permanente | LigaPro Ecuabet x4' })
        .setTimestamp()
      ]}).catch(() => {});

      await autoban(member, `Infracción reiterada por links (advertencia ${warnCount})`);
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
    //  1. SPAM DE MENSAJES
    // ══════════════════════════════════════════════════
    const spamCount = track(spamTracker, message.author.id, THRESHOLDS.SPAM_MSG_WINDOW);

    if (spamCount >= THRESHOLDS.SPAM_MSG_COUNT) {
      await message.delete().catch(() => {});
      await autotimeout(member, 'Spam masivo de mensajes detectado', 10 * 60 * 1000);

      await raidLog(guild, {
        title: 'SPAM DE MENSAJES DETECTADO',
        description:
          `🚨 **VAR DE SEGURIDAD:** Se detectó spam sospechoso en el estadio.\n\n` +
          `**${message.author.tag}** ha superado el límite de mensajes en poco tiempo.\n` +
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
    //  2. LINKS EXTERNOS — SISTEMA PROGRESIVO
    // ══════════════════════════════════════════════════
    if (LINK_REGEX.test(message.content)) {

      // ── GIFs PERMITIDOS: no se tocan, se ignoran completamente ──
      if (isGifOnly(message.content)) return;

      // Eliminar el mensaje con link (siempre, sin importar el conteo)
      await message.delete().catch(() => {});

      // Contar links en ventana de 2 minutos
      // LINK_COUNT = 4 (>3 = infracción), LINK_WINDOW = 2 min
      const linkCount = track(linkTracker, message.author.id, THRESHOLDS.LINK_WINDOW);

      // Si aún no supera el umbral → silencio, solo log discreto
      if (linkCount < THRESHOLDS.LINK_COUNT) {
        await raidLog(guild, {
          title: 'LINK SILENCIADO',
          description:
            `🔇 Link eliminado sin sanción (${linkCount}/${THRESHOLDS.LINK_COUNT - 1} permitidos antes de advertencia).\n` +
            `**${message.author.tag}** intentó publicar un enlace no autorizado.`,
          color: AR_COLORS.SUSPICIOUS,
          userId: message.author.id,
          fields: [
            { name: '📍 Canal',    value: `${message.channel}`, inline: true },
            { name: '🔢 Conteo',   value: `${linkCount}/${THRESHOLDS.LINK_COUNT - 1}`, inline: true },
          ]
        });
        return;
      }

      // ── UMBRAL SUPERADO: emitir advertencia formal ──────────
      // Resetear el contador para que la próxima ráfaga también cuente desde 0
      linkTracker.delete(message.author.id);

      const warnCount = addWarn(message.author.id, `Links reiterados (${linkCount} en ventana)`);
      const info = await applySanction(member, guild, warnCount);

      await raidLog(guild, {
        title: `🟥 INFRACCIÓN POR LINKS — Advertencia #${warnCount}`,
        description:
          `🚨 **VAR DE SEGURIDAD:** **${message.author.tag}** superó el límite de links en el estadio.\n\n` +
          `📋 **Comisión Disciplinaria** ha aplicado sanción automática.\n` +
          `**Sanción aplicada:** ${info.label}`,
        color: warnCount >= 7 ? AR_COLORS.RAID_ALERT : warnCount >= 4 ? AR_COLORS.BAN : AR_COLORS.WARNING,
        userId: message.author.id,
        fields: [
          { name: '🔢 Advertencia',  value: `#${warnCount}`, inline: true },
          { name: '⚖️ Sanción',      value: info.label, inline: true },
          { name: '🔗 Links en ráfaga', value: `${linkCount}`, inline: true },
          { name: '📍 Canal',        value: `${message.channel}`, inline: true },
        ]
      });
      return;
    }

    // ══════════════════════════════════════════════════
    //  3. MENCIONES MASIVAS
    // ══════════════════════════════════════════════════
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    if (totalMentions >= THRESHOLDS.MENTION_COUNT) {
      await message.delete().catch(() => {});
      await autotimeout(member, 'Ping masivo a usuarios/roles', 15 * 60 * 1000);

      await raidLog(guild, {
        title: 'PING MASIVO DETECTADO',
        description:
          `🚨 **VAR DE SEGURIDAD:** Actividad sospechosa en el estadio.\n\n` +
          `**${message.author.tag}** realizó un ping masivo (${totalMentions} menciones).\n` +
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
