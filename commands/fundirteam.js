'use strict';

/**
 * /fundirteam — Disuelve un equipo completo:
 *   • Quita el rol de equipo a TODOS sus miembros
 *   • Quita el rol DT al Director Técnico del equipo
 *   • Quita el rol Sub-DT al Sub-Director Técnico del equipo
 *   • Limpia ofertas pendientes y cooldowns del equipo en la DB
 *   • Elimina a todos los jugadores del equipo de la DB
 *   • Envía log al canal de logs
 *
 * Solo puede usarlo un ADMIN (roles definidos en ADMIN_ROLES).
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require('discord.js');

const { EQUIPOS, leerDB, guardarDB } = require('./fichar');
const { sendLog } = require('../utils/logger');
const { COLORS, ADMIN_ROLES } = require('../config');

const DT_ROLE_ID = '1497693671141671034';
const SUB_DT_ROLE_ID = '1497693705539424467';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — respuesta de error segura (nunca crashea aunque la interacción ya expiró)
// ─────────────────────────────────────────────────────────────────────────────
async function replyError(interaction, msg) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg, embeds: [], components: [] });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  } catch (e) {
    console.error('[FUNDIRTEAM] No se pudo enviar mensaje de error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — quitar un array de roles a un miembro con reintento único
// ─────────────────────────────────────────────────────────────────────────────
async function quitarRolesSeguro(miembro, roleIds) {
  // Filtrar roles que el miembro realmente tiene (evita error 404 innecesario)
  const rolesPresentes = roleIds.filter(id => miembro.roles.cache.has(id));
  if (rolesPresentes.length === 0) return { ok: true, noTenia: true };

  try {
    await miembro.roles.remove(rolesPresentes);
    return { ok: true };
  } catch (err) {
    // Reintento único tras 1 segundo (por rate-limit momentáneo)
    await new Promise(r => setTimeout(r, 1000));
    try {
      await miembro.roles.remove(rolesPresentes);
      return { ok: true };
    } catch (err2) {
      return { ok: false, error: err2.message };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comando
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fundirteam')
    .setDescription('⚠️ Disuelve un equipo: quita todos los roles a sus jugadores, DT y Sub-DT')
    .addRoleOption(opt =>
      opt.setName('equipo')
        .setDescription('El equipo a disolver')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo de la disolución')
        .setRequired(true)
        .addChoices(
          { name: 'Falta de jugadores', value: 'Disolución por falta de jugadores' },
          { name: 'Inactividad prolongada', value: 'Disolución por inactividad prolongada' },
          { name: 'Decisión administrativa', value: 'Disolución por decisión administrativa' },
          { name: 'Irregularidades deportivas', value: 'Disolución por irregularidades deportivas' },
          { name: 'Otro motivo', value: 'Otro motivo' },
        )
    )
    .addStringOption(opt =>
      opt.setName('detalle')
        .setDescription('Detalle adicional del motivo (opcional, máx. 200 caracteres)')
        .setRequired(false)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    // ── Defer lo antes posible para evitar "Interaction failed" ──────────────
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (deferErr) {
      console.error('[FUNDIRTEAM] Error al hacer deferReply:', deferErr);
      return; // Si ni siquiera podemos diferir, no hay nada que hacer
    }

    try {
      const guild = interaction.guild;
      const ejecutor = interaction.member;
      const equipoRol = interaction.options.getRole('equipo');
      const motivo = interaction.options.getString('motivo');
      const detalle = interaction.options.getString('detalle') ?? null;

      // ── Sanity checks de contexto ─────────────────────────────────────────
      if (!guild) {
        return replyError(interaction, '❌ Este comando solo puede usarse dentro de un servidor.');
      }
      if (!ejecutor) {
        return replyError(interaction, '❌ No se pudo obtener tu información de miembro. Inténtalo de nuevo.');
      }
      if (!equipoRol) {
        return replyError(interaction, '❌ No se pudo obtener el rol del equipo. Inténtalo de nuevo.');
      }

      // ── 1. Verificar permisos de ADMIN ────────────────────────────────────
      if (!Array.isArray(ADMIN_ROLES) || ADMIN_ROLES.length === 0) {
        console.error('[FUNDIRTEAM] ADMIN_ROLES no está configurado en config.js');
        return replyError(interaction, '⚙️ **Error de configuración:** No hay roles de admin definidos. Contacta al desarrollador.');
      }
      const esAdmin = ADMIN_ROLES.some(rid => ejecutor.roles.cache.has(rid));
      if (!esAdmin) {
        return replyError(interaction, '❌ **Sin permisos.** Solo los **Administradores** pueden disolver equipos.');
      }

      // ── 2. Verificar que el rol pertenece a la liga ───────────────────────
      const equipoInfo = EQUIPOS[equipoRol.id];
      if (!equipoInfo) {
        return replyError(interaction, `❌ **Rol inválido.** <@&${equipoRol.id}> no es un equipo oficial de la liga.`);
      }

      // ── 3. Verificar que el bot puede gestionar ese rol ───────────────────
      const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
      if (!botMember) {
        return replyError(interaction, '⚠️ No se pudo obtener la información del bot. Inténtalo de nuevo.');
      }

      const botHighest = botMember.roles.highest.position;
      const rolPos = guild.roles.cache.get(equipoRol.id)?.position ?? 0;
      const dtRolPos = guild.roles.cache.get(DT_ROLE_ID)?.position ?? 0;
      const sdtRolPos = guild.roles.cache.get(SUB_DT_ROLE_ID)?.position ?? 0;

      const problemasRoles = [];
      if (botHighest <= rolPos) problemasRoles.push(`el rol del equipo **${equipoInfo.nombre}**`);
      if (botHighest <= dtRolPos) problemasRoles.push('el rol **Director Técnico**');
      if (botHighest <= sdtRolPos) problemasRoles.push('el rol **Sub-DT**');

      if (problemasRoles.length > 0) {
        return replyError(interaction,
          `⚠️ **El bot no tiene jerarquía suficiente** para quitar:\n${problemasRoles.map(r => `• ${r}`).join('\n')}\n\n` +
          `Sube el rol del bot por encima de los roles de equipo en la configuración del servidor.`
        );
      }

      // ── 4. Fetch de miembros actualizado ─────────────────────────────────
      try {
        await guild.members.fetch();
      } catch (fetchErr) {
        console.error('[FUNDIRTEAM] Error al obtener miembros:', fetchErr);
        return replyError(interaction, '⚠️ No se pudieron cargar los miembros del servidor. Inténtalo de nuevo en unos segundos.');
      }

      // ── 5. Obtener miembros del equipo ────────────────────────────────────
      const miembros = guild.members.cache.filter(
        m => m.roles.cache.has(equipoRol.id) && !m.user.bot
      );

      // Advertir si el equipo ya está vacío pero continuar (puede que haya datos en DB)
      const equipoVacio = miembros.size === 0;

      // ── 6. Validar motivo y detalle ───────────────────────────────────────
      if (!motivo || motivo.trim().length === 0) {
        return replyError(interaction, '❌ El motivo de disolución no puede estar vacío.');
      }
      const detalleSeguro = detalle ? detalle.replace(/[<>@&]/g, '') : null; // Sanitizar menciones
      const motivoCompleto = detalleSeguro ? `${motivo} — ${detalleSeguro}` : motivo;

      // ── 7. Embed de confirmación ──────────────────────────────────────────
      const confirmEmbed = new EmbedBuilder()
        .setColor(COLORS.WARNING ?? 0xf39c12)
        .setTitle('⚠️ Confirmar Disolución de Equipo')
        .setThumbnail(equipoInfo.logo ?? null)
        .setDescription(
          `Estás a punto de **disolver permanentemente** el equipo **${equipoInfo.nombre}**.\n\n` +
          `Esta acción **no se puede deshacer** y realizará lo siguiente:\n` +
          `> 🔴 Quitará el rol del equipo a **${miembros.size}** miembro(s)\n` +
          `> 🔴 Quitará el rol **Director Técnico** al DT del equipo\n` +
          `> 🔴 Quitará el rol **Sub-DT** al Sub-DT del equipo\n` +
          `> 🗑️ Limpiará todos los registros de fichajes del equipo\n` +
          `> 🗑️ Cancelará ofertas de fichaje pendientes del equipo\n\n` +
          (equipoVacio ? '⚠️ **El equipo no tiene miembros actualmente.** Se limpiarán solo los datos de la DB.\n\n' : '') +
          `**Motivo:** ${motivoCompleto}`
        )
        .setTimestamp()
        .setFooter({ text: 'Tienes 30 segundos para confirmar. Esta acción es irreversible.' });

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('fundir_confirmar')
          .setLabel('💥 Sí, disolver equipo')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('fundir_cancelar')
          .setLabel('✖ Cancelar')
          .setStyle(ButtonStyle.Secondary),
      );

      let confirmMsg;
      try {
        confirmMsg = await interaction.editReply({ embeds: [confirmEmbed], components: [confirmRow] });
      } catch (replyErr) {
        console.error('[FUNDIRTEAM] Error al enviar confirmación:', replyErr);
        return replyError(interaction, '❌ Error al enviar el embed de confirmación.');
      }

      // ── 8. Esperar respuesta del botón ────────────────────────────────────
      let confirmado = false;
      try {
        const btn = await confirmMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          filter: i => {
            if (i.user.id !== interaction.user.id) {
              i.reply({ content: '❌ Solo quien ejecutó el comando puede confirmar esto.', ephemeral: true }).catch(() => { });
              return false;
            }
            return true;
          },
          time: 30_000,
        });
        await btn.deferUpdate().catch(() => { });
        confirmado = btn.customId === 'fundir_confirmar';
      } catch {
        // Timeout
        confirmado = false;
      }

      // Siempre desactivar botones tras respuesta o timeout
      const rowDesactivada = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('fundir_confirmar_d').setLabel('💥 Sí, disolver equipo').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('fundir_cancelar_d').setLabel('✖ Cancelar').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );

      if (!confirmado) {
        const cancelEmbed = new EmbedBuilder()
          .setColor(COLORS.INFO ?? 0x3498db)
          .setTitle('🚫 Disolución cancelada')
          .setDescription(
            `La disolución del equipo **${equipoInfo.nombre}** fue **cancelada**${confirmado === false ? ' o el tiempo expiró' : ''
            }.`
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [cancelEmbed], components: [rowDesactivada] }).catch(() => { });
      }

      // ── 9. Mostrar estado "procesando" ────────────────────────────────────
      const procesandoEmbed = new EmbedBuilder()
        .setColor(COLORS.WARNING ?? 0xf39c12)
        .setTitle('⏳ Disolviendo equipo...')
        .setDescription(`Procesando **${miembros.size}** miembro(s). Por favor espera, esto puede tardar unos segundos.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [procesandoEmbed], components: [rowDesactivada] }).catch(() => { });

      // ── 10. Quitar roles a cada miembro ───────────────────────────────────
      const resultados = {
        exitosos: [],  // { nombre, eraDT, eraSubDT }
        fallidos: [],  // { nombre, error }
        dtQuitado: null,
        subDtQuitado: null,
        dbEliminados: 0,
        ofertasCancel: 0,
        cooldownsLimp: 0,
      };

      for (const [, miembro] of miembros) {
        const eraDT = miembro.roles.cache.has(DT_ROLE_ID);
        const eraSubDT = miembro.roles.cache.has(SUB_DT_ROLE_ID);

        const rolIds = [equipoRol.id];
        if (eraDT) rolIds.push(DT_ROLE_ID);
        if (eraSubDT) rolIds.push(SUB_DT_ROLE_ID);

        const res = await quitarRolesSeguro(miembro, rolIds);

        if (res.ok) {
          resultados.exitosos.push({ nombre: miembro.displayName, eraDT, eraSubDT });
          if (eraDT) resultados.dtQuitado = miembro.displayName;
          if (eraSubDT) resultados.subDtQuitado = miembro.displayName;
        } else {
          console.error(`[FUNDIRTEAM] Fallo al quitar roles a ${miembro.displayName}: ${res.error}`);
          resultados.fallidos.push({ nombre: miembro.displayName, error: res.error });
        }

        // Pequeña pausa entre miembros para evitar rate-limit de Discord
        await new Promise(r => setTimeout(r, 300));
      }

      // ── 11. Limpiar base de datos ─────────────────────────────────────────
      try {
        const db = leerDB();

        // Limpiar jugadores del equipo
        for (const [jugadorId, datos] of Object.entries(db.jugadores ?? {})) {
          if (datos?.equipoRolId === equipoRol.id) {
            delete db.jugadores[jugadorId];
            resultados.dbEliminados++;
          }
        }

        // Cancelar ofertas pendientes relacionadas al equipo
        for (const [jugadorId, oferta] of Object.entries(db.ofertas_pendientes ?? {})) {
          if (oferta?.equipoRolId === equipoRol.id) {
            delete db.ofertas_pendientes[jugadorId];
            resultados.ofertasCancel++;
          }
        }

        // Limpiar cooldowns del equipo (formato: "jugadorId-equipoRolId")
        for (const key of Object.keys(db.cooldowns ?? {})) {
          if (key.endsWith(`-${equipoRol.id}`)) {
            delete db.cooldowns[key];
            resultados.cooldownsLimp++;
          }
        }

        guardarDB(db);
      } catch (dbErr) {
        console.error('[FUNDIRTEAM] Error al limpiar DB:', dbErr);
        // No es fatal — continuamos y lo reportamos en el resumen
        resultados.dbError = true;
      }

      // ── 12. Embed de resultado ────────────────────────────────────────────
      const exitosos = resultados.exitosos.length;
      const fallidos = resultados.fallidos.length;
      const hayErrores = fallidos > 0 || resultados.dbError;

      const resultEmbed = new EmbedBuilder()
        .setColor(hayErrores ? (COLORS.WARNING ?? 0xf39c12) : (COLORS.ERROR ?? 0xe74c3c))
        .setTitle(`💥 Equipo Disuelto — ${equipoInfo.nombre}`)
        .setThumbnail(equipoInfo.logo ?? null)
        .setDescription(
          `El equipo **${equipoInfo.nombre}** ha sido disuelto oficialmente.\n\n` +
          `**Motivo:** ${motivoCompleto}`
        )
        .addFields(
          {
            name: '📊 Resumen de roles',
            value:
              `✅ Removidos correctamente: **${exitosos}**\n` +
              `${fallidos > 0 ? `⚠️ Con errores: **${fallidos}**\n` : ''}` +
              `🏅 DT quitado: **${resultados.dtQuitado ?? 'Ninguno'}**\n` +
              `🎖️ Sub-DT quitado: **${resultados.subDtQuitado ?? 'Ninguno'}**`,
            inline: false,
          },
          {
            name: '🗑️ Limpieza de datos',
            value:
              `Registros de fichajes eliminados: **${resultados.dbEliminados}**\n` +
              `Ofertas pendientes canceladas: **${resultados.ofertasCancel}**\n` +
              `Cooldowns limpiados: **${resultados.cooldownsLimp}**\n` +
              (resultados.dbError ? '⚠️ Hubo un error parcial al limpiar la DB.' : ''),
            inline: false,
          },
        )
        .setTimestamp()
        .setFooter({ text: `Disuelto por ${ejecutor.displayName}` });

      // Listar miembros con error (máx 15 para no reventar el embed)
      if (fallidos > 0) {
        const listaFallidos = resultados.fallidos
          .slice(0, 15)
          .map(f => `• ${f.nombre}`)
          .join('\n');
        resultEmbed.addFields({
          name: `⚠️ Miembros a los que NO se pudo quitar el rol (${fallidos})`,
          value: listaFallidos + (fallidos > 15 ? `\n*…y ${fallidos - 15} más*` : '') +
            '\n\n*Verifica que el rol del bot esté por encima de los roles de equipo.*',
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [resultEmbed], components: [] }).catch(() => { });

      // ── 13. Log privado ───────────────────────────────────────────────────
      await sendLog(guild, {
        title: `💥 Equipo Disuelto — ${equipoInfo.nombre}`,
        description:
          `El equipo **${equipoInfo.nombre}** fue disuelto por <@${ejecutor.id}>.\n` +
          `**Motivo:** ${motivoCompleto}`,
        color: COLORS.ERROR ?? 0xe74c3c,
        fields: [
          { name: '🏟️ Equipo', value: `**${equipoInfo.nombre}**`, inline: true },
          { name: '👮 Admin', value: `<@${ejecutor.id}>`, inline: true },
          { name: '👥 Miembros afectados', value: `${exitosos} ok / ${fallidos} fallidos`, inline: true },
          { name: '🗑️ Fichajes eliminados', value: `${resultados.dbEliminados}`, inline: true },
          { name: '📄 Ofertas canceladas', value: `${resultados.ofertasCancel}`, inline: true },
          { name: '⏳ Cooldowns limpiados', value: `${resultados.cooldownsLimp}`, inline: true },
          { name: '🏅 DT quitado', value: resultados.dtQuitado ?? 'Ninguno', inline: true },
          { name: '🎖️ Sub-DT quitado', value: resultados.subDtQuitado ?? 'Ninguno', inline: true },
        ],
        thumbnail: equipoInfo.logo ?? undefined,
      }).catch(logErr => console.error('[FUNDIRTEAM] Error al enviar log:', logErr));

    } catch (error) {
      console.error('[FUNDIRTEAM] Error general no controlado:', error);
      await replyError(interaction, '❌ Ocurrió un error inesperado al disolver el equipo. Revisa los logs del bot.');
    }
  },
};
