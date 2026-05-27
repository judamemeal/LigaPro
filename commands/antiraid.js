/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   ⚙️  /antiraid — Comando Admin | LigaPro Ecuabet x4       ║
 * ║   Panel de Control VAR · Comisión Disciplinaria Digital     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
} = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { sendLog } = require('../utils/logger');
const {
  raidState, AR_COLORS,
  activateLockdown, deactivateLockdown,
  THRESHOLDS,
} = require('../utils/antiraid');
const {
  getWarnCount, getAllWarns, resetWarns, getSanctionInfo,
} = require('../utils/warnManager');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('🛡️ Panel de control del sistema VAR de seguridad de LigaPro Ecuabet x4')
    .addSubcommand(sub =>
      sub.setName('estado')
         .setDescription('📊 Ver el estado actual del sistema AntiRaid')
    )
    .addSubcommand(sub =>
      sub.setName('lockdown')
         .setDescription('🔒 Activar el Modo Estadio Seguro manualmente')
         .addStringOption(opt =>
           opt.setName('razon')
              .setDescription('Razón del lockdown')
              .setRequired(false)
         )
    )
    .addSubcommand(sub =>
      sub.setName('desbloquear')
         .setDescription('🔓 Desactivar el Modo Estadio Seguro manualmente')
    )
    .addSubcommand(sub =>
      sub.setName('sensibilidad')
         .setDescription('🎚️ Ajustar la sensibilidad del AntiRaid')
         .addStringOption(opt =>
           opt.setName('nivel')
              .setDescription('Nivel de sensibilidad')
              .setRequired(true)
              .addChoices(
                { name: '🟢 Baja (servidores con bots)', value: 'baja' },
                { name: '🟡 Normal (configuración por defecto)', value: 'normal' },
                { name: '🔴 Alta (máxima protección)', value: 'alta' },
              )
         )
    )
    .addSubcommand(sub =>
      sub.setName('warns')
         .setDescription('📋 Ver advertencias de un usuario')
         .addUserOption(opt =>
           opt.setName('usuario').setDescription('Usuario a consultar').setRequired(true)
         )
    )
    .addSubcommand(sub =>
      sub.setName('resetwarns')
         .setDescription('🗑️ Resetear advertencias de un usuario')
         .addUserOption(opt =>
           opt.setName('usuario').setDescription('Usuario a limpiar').setRequired(true)
         )
    ),

  async execute(interaction) {
    // Solo admins pueden usar este comando
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const sub   = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // ══════════════════════════════════════════════════
    //  SUBCOMANDO: ESTADO
    // ══════════════════════════════════════════════════
    if (sub === 'estado') {
      const lockdownStr = raidState.lockdownActive
        ? `🔴 **ACTIVO** desde <t:${Math.floor(raidState.lockdownSince / 1000)}:R>`
        : '🟢 **INACTIVO** — Operaciones normales';

      const nivelStr = {
        NORMAL:  '🟢 NORMAL',
        ELEVADO: '🟡 ELEVADO',
        CRITICO: '🔴 CRÍTICO',
      }[raidState.alertLevel] || '🟢 NORMAL';

      const embed = new EmbedBuilder()
        .setColor(raidState.lockdownActive ? AR_COLORS.RAID_ALERT : AR_COLORS.SAFE)
        .setTitle('🛡️ VAR DE SEGURIDAD — Estado del Sistema')
        .setDescription(
          `**Sistema AntiRaid de LigaPro Ecuabet x4**\n` +
          `Árbitro Digital Automático | Comisión Disciplinaria Virtual`
        )
        .addFields(
          { name: '🔒 Modo Estadio Seguro', value: lockdownStr, inline: false },
          { name: '🚨 Nivel de Alerta',     value: nivelStr,    inline: true },
          { name: '🚫 Cmds Bloqueados',     value: raidState.disabledCommands.size > 0 ? [...raidState.disabledCommands].join(', ') : 'Ninguno', inline: true },
          { name: '📩 Invitaciones',        value: raidState.invitesBanned ? '🔴 Bloqueadas' : '🟢 Activas', inline: true },
          // Umbrales actuales
          { name: '═══ Umbrales Actuales ═══', value: '\u200B', inline: false },
          { name: '📨 Spam Msg',    value: `${THRESHOLDS.SPAM_MSG_COUNT} msgs/${THRESHOLDS.SPAM_MSG_WINDOW/1000}s`,     inline: true },
          { name: '👥 Join Burst',  value: `${THRESHOLDS.JOIN_BURST_COUNT} joins/${THRESHOLDS.JOIN_BURST_WINDOW/1000}s`, inline: true },
          { name: '⌨️ Cmd Spam',   value: `${THRESHOLDS.CMD_SPAM_COUNT} cmds/${THRESHOLDS.CMD_SPAM_WINDOW/1000}s`,     inline: true },
          { name: '🖱️ Btn Spam',   value: `${THRESHOLDS.BTN_SPAM_COUNT} btns/${THRESHOLDS.BTN_SPAM_WINDOW/1000}s`,    inline: true },
          { name: '🔗 Links',       value: `${THRESHOLDS.LINK_COUNT} links/${THRESHOLDS.LINK_WINDOW/1000}s`,           inline: true },
          { name: '📢 Menciones',   value: `${THRESHOLDS.MENTION_COUNT} pings/msg`,                                    inline: true },
        )
        .setFooter({ text: '🛡️ Sistema VAR de Seguridad | LigaPro Ecuabet x4', iconURL: guild.iconURL() || undefined })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ══════════════════════════════════════════════════
    //  SUBCOMANDO: LOCKDOWN MANUAL
    // ══════════════════════════════════════════════════
    if (sub === 'lockdown') {
      if (raidState.lockdownActive) {
        return interaction.reply({
          embeds: [{
            color: AR_COLORS.WARNING,
            title: '⚠️ El Modo Estadio Seguro ya está activo',
            description: 'Usa `/antiraid desbloquear` para levantarlo.',
          }],
          ephemeral: true,
        });
      }

      const razon = interaction.options.getString('razon') || `Activado manualmente por ${interaction.user.tag}`;
      await activateLockdown(guild, razon);

      await sendLog(guild, {
        title: '🔒 Lockdown Activado Manualmente',
        description:
          `El administrador **${interaction.user.tag}** activó el Modo Estadio Seguro manualmente.`,
        color: AR_COLORS.LOCKDOWN,
        fields: [
          { name: '👤 Admin', value: `${interaction.user}`, inline: true },
          { name: '📝 Razón', value: razon, inline: false },
        ]
      });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(AR_COLORS.LOCKDOWN)
          .setTitle('🛡️ MODO ESTADIO SEGURO ACTIVADO')
          .setDescription(
            `El lockdown ha sido activado.\n\n` +
            `**Razón:** ${razon}\n\n` +
            `Se levantará automáticamente en **15 minutos** o usa \`/antiraid desbloquear\`.`
          )
          .setTimestamp()
        ],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════
    //  SUBCOMANDO: DESBLOQUEAR
    // ══════════════════════════════════════════════════
    if (sub === 'desbloquear') {
      if (!raidState.lockdownActive) {
        return interaction.reply({
          embeds: [{
            color: AR_COLORS.SAFE,
            title: '✅ El sistema ya está en modo normal',
            description: 'No hay ningún lockdown activo.',
          }],
          ephemeral: true,
        });
      }

      await deactivateLockdown(guild);

      await sendLog(guild, {
        title: '🔓 Lockdown Desactivado Manualmente',
        description:
          `El administrador **${interaction.user.tag}** desactivó el Modo Estadio Seguro.`,
        color: AR_COLORS.SAFE,
        fields: [
          { name: '👤 Admin', value: `${interaction.user}`, inline: true },
        ]
      });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(AR_COLORS.SAFE)
          .setTitle('✅ MODO NORMAL RESTAURADO')
          .setDescription(
            `El Modo Estadio Seguro ha sido **desactivado**.\n\n` +
            `🏟️ LigaPro Ecuabet x4 vuelve a operar con normalidad.`
          )
          .setTimestamp()
        ],
        ephemeral: true,
      });
    }

    // ══════════════════════════════════════════════════
    //  SUBCOMANDO: SENSIBILIDAD
    // ══════════════════════════════════════════════════
    if (sub === 'sensibilidad') {
      const nivel = interaction.options.getString('nivel');

      if (nivel === 'baja') {
        THRESHOLDS.SPAM_MSG_COUNT    = 12;
        THRESHOLDS.JOIN_BURST_COUNT  = 15;
        THRESHOLDS.CMD_SPAM_COUNT    = 15;
        THRESHOLDS.BTN_SPAM_COUNT    = 20;
        THRESHOLDS.LINK_COUNT        = 5;
        THRESHOLDS.MENTION_COUNT     = 10;
      } else if (nivel === 'normal') {
        THRESHOLDS.SPAM_MSG_COUNT    = 6;
        THRESHOLDS.JOIN_BURST_COUNT  = 8;
        THRESHOLDS.CMD_SPAM_COUNT    = 8;
        THRESHOLDS.BTN_SPAM_COUNT    = 10;
        THRESHOLDS.LINK_COUNT        = 3;
        THRESHOLDS.MENTION_COUNT     = 5;
      } else if (nivel === 'alta') {
        THRESHOLDS.SPAM_MSG_COUNT    = 4;
        THRESHOLDS.JOIN_BURST_COUNT  = 5;
        THRESHOLDS.CMD_SPAM_COUNT    = 5;
        THRESHOLDS.BTN_SPAM_COUNT    = 7;
        THRESHOLDS.LINK_COUNT        = 2;
        THRESHOLDS.MENTION_COUNT     = 3;
      }

      const nivelLabel = { baja: '🟢 Baja', normal: '🟡 Normal', alta: '🔴 Alta' }[nivel];

      await sendLog(guild, {
        title: '🎚️ Sensibilidad AntiRaid Actualizada',
        description: `Administrador **${interaction.user.tag}** cambió la sensibilidad a **${nivelLabel}**.`,
        color: AR_COLORS.INFO,
        fields: [
          { name: '👤 Admin', value: `${interaction.user}`, inline: true },
          { name: '🎚️ Nuevo nivel', value: nivelLabel, inline: true },
        ]
      });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(AR_COLORS.INFO)
          .setTitle(`🎚️ Sensibilidad ajustada a ${nivelLabel}`)
          .setDescription(`El VAR de Seguridad ahora opera en modo **${nivelLabel}**.\nTodos los umbrales de detección han sido actualizados.`)
          .setTimestamp()
        ],
        ephemeral: true,
      });
    }
    // ══════════════════════════════════════════════════
    //  SUBCOMANDO: WARNS
    // ══════════════════════════════════════════════════
    if (sub === 'warns') {
      const target = interaction.options.getUser('usuario');
      const count  = getWarnCount(target.id);
      const next   = getSanctionInfo(count + 1);

      const embed = new EmbedBuilder()
        .setColor(count === 0 ? AR_COLORS.SAFE : count >= 6 ? AR_COLORS.RAID_ALERT : AR_COLORS.WARNING)
        .setTitle(`📋 Advertencias de ${target.tag}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '⚠️ Total advertencias',    value: `**${count}**`, inline: true },
          { name: '⏭️ Próxima sanción',        value: count === 0 ? '🟢 Sin infracciones' : next.label, inline: true },
        )
        .setFooter({ text: '🛡️ Comisión Disciplinaria | LigaPro Ecuabet x4' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ══════════════════════════════════════════════════
    //  SUBCOMANDO: RESETWARNS
    // ══════════════════════════════════════════════════
    if (sub === 'resetwarns') {
      const target = interaction.options.getUser('usuario');
      const oldCount = getWarnCount(target.id);
      resetWarns(target.id);

      await sendLog(guild, {
        title: '🗑️ Advertencias Reseteadas',
        description:
          `Admin **${interaction.user.tag}** limpió las advertencias de **${target.tag}**.`,
        color: AR_COLORS.SAFE,
        fields: [
          { name: '👤 Usuario',           value: `${target}`, inline: true },
          { name: '🆔 ID',                value: target.id, inline: true },
          { name: '⚠️ Adv. eliminadas',   value: `${oldCount}`, inline: true },
          { name: '👮 Admin',             value: `${interaction.user}`, inline: true },
        ]
      });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(AR_COLORS.SAFE)
          .setTitle('🗑️ Advertencias eliminadas')
          .setDescription(`Las **${oldCount}** advertencias de **${target.tag}** han sido eliminadas.`)
          .setTimestamp()
        ],
        ephemeral: true,
      });
    }
  },
};
