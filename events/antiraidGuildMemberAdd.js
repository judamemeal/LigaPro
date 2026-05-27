/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  🔍 ANTIRAID — Detector de Joins | LigaPro Ecuabet x4      ║
 * ║  Control de Acceso al Estadio | Anti-Raid de Cuentas Nuevas ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const {
  isWhitelisted, track, raidLog, autoban,
  joinBurst, THRESHOLDS, AR_COLORS, activateLockdown, raidState,
} = require('../utils/antiraid');

// Antigüedad mínima de cuenta para entrar sin sospecha (7 días)
const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = {
  name: 'guildMemberAdd',

  async execute(member, client) {
    const guild = member.guild;

    // Si el lockdown está activo, kick inmediato a nuevos miembros sospechosos
    if (raidState.lockdownActive) {
      const accountAge = Date.now() - member.user.createdTimestamp;
      if (accountAge < MIN_ACCOUNT_AGE_MS) {
        try {
          await member.send({
            embeds: [{
              color: AR_COLORS.LOCKDOWN,
              title: '🛑 ACCESO DENEGADO — LigaPro Ecuabet x4',
              description:
                `El estadio virtual se encuentra en **Modo de Seguridad Máxima**.\n\n` +
                `Tu cuenta es demasiado nueva para ingresar durante este período de alerta.\n` +
                `Por favor, inténtalo más tarde cuando el sistema regrese a estado normal.`,
              footer: { text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4' },
              timestamp: new Date().toISOString(),
            }]
          }).catch(() => {});
          await member.kick('🛡️ AntiRaid: Cuenta nueva durante lockdown activo');
        } catch (_) {}

        await raidLog(guild, {
          title: 'ACCESO BLOQUEADO — LOCKDOWN ACTIVO',
          description:
            `🛑 **Usuario bloqueado por alterar el orden del campeonato.**\n\n` +
            `Intento de entrada con cuenta nueva durante **Modo Estadio Seguro**.\n` +
            `**${member.user.tag}** fue expulsado automáticamente.`,
          color: AR_COLORS.LOCKDOWN,
          userId: member.id,
          fields: [
            { name: '📅 Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: '⚠️ Motivo', value: 'Cuenta nueva + Lockdown activo', inline: true },
          ]
        });
        return;
      }
    }

    // ══════════════════════════════════════════════════
    //  DETECCIÓN DE RAID POR JOINS MASIVOS
    // ══════════════════════════════════════════════════
    const burstCount = track(joinBurst, guild.id, THRESHOLDS.JOIN_BURST_WINDOW, 10);

    if (burstCount >= THRESHOLDS.JOIN_BURST_COUNT) {
      // Activar lockdown por raid de joins
      await activateLockdown(
        guild,
        `${burstCount} usuarios ingresaron en ${THRESHOLDS.JOIN_BURST_WINDOW / 1000} segundos`
      );

      await raidLog(guild, {
        title: 'RAID POR JOINS MASIVOS DETECTADO',
        description:
          `🚫 **RAID DETECTADO EN LigaPro Ecuabet x4.**\n\n` +
          `**${burstCount}** usuarios ingresaron en un período de tiempo anormalmente corto.\n` +
          `🛡️ **MODO ESTADIO SEGURO ACTIVADO** automáticamente.`,
        color: AR_COLORS.RAID_ALERT,
        fields: [
          { name: '👥 Joins detectados', value: `${burstCount} en ${THRESHOLDS.JOIN_BURST_WINDOW / 1000}s`, inline: true },
          { name: '🔒 Acción', value: 'Lockdown automático activado', inline: true },
        ]
      });
    }

    // ══════════════════════════════════════════════════
    //  ALERTA POR CUENTA MUY NUEVA
    // ══════════════════════════════════════════════════
    const accountAge = Date.now() - member.user.createdTimestamp;
    if (accountAge < MIN_ACCOUNT_AGE_MS) {
      await raidLog(guild, {
        title: 'CUENTA NUEVA DETECTADA',
        description:
          `🚨 **VAR DE SEGURIDAD:** Se detectó actividad sospechosa en el acceso al estadio.\n\n` +
          `**${member.user.tag}** tiene una cuenta creada hace menos de 7 días.\n` +
          `Se recomienda vigilancia sobre este usuario.`,
        color: AR_COLORS.SUSPICIOUS,
        userId: member.id,
        fields: [
          { name: '📅 Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '⚠️ Riesgo', value: 'Cuenta nueva (< 7 días)', inline: true },
        ]
      });
    }
  },
};
