'use strict';

/**
 * /plantilla — Muestra la plantilla completa de un equipo concreto.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EQUIPOS, leerDB, tiempoRelativo } = require('./fichar');

const DT_ROLE_ID     = '1497693671141671034';
const SUB_DT_ROLE_ID = '1497693705539424467';

// Colores por equipo
const COLORES_EQUIPO = {
  '1497694196205879326': { primario: '#FFD700', secundario: '#e92828', texto: '#18160a' }, // Aucas
  '1497694246189273279': { primario: '#FFD700', secundario: '#1a1a1a', texto: '#FFD700' }, // Barcelona SC
  '1497694298270073013': { primario: '#C8102E', secundario: '#141313', texto: '#FFFFFF' }, // Deportivo Cuenca
  '1497694271740838058': { primario: '#00529B', secundario: '#d5d810', texto: '#FFFFFF' }, // Delfín
  '1497694379304026152': { primario: '#003087', secundario: '#5c5b55', texto: '#f8f7f1' }, // Emelec
  '1497694414586511440': { primario: '#0d0c0e', secundario: '#2d1d69', texto: '#FFFFFF' }, // IDV
  '1497797471483723817': { primario: '#d83417', secundario: '#0a0a09', texto: '#f0f0f0' }, // Leones del Norte
  '1497694479992492243': { primario: '#e6800c', secundario: '#0c0b0b', texto: '#FFFFFF' }, // Libertad
  '1497694498590031872': { primario: '#fdfdff', secundario: '#FFFFFF', texto: '#2a1e97' }, // Liga de Quito
  '1497694538523742430': { primario: '#0c6aa0', secundario: '#0c6aa0', texto: '#FFFFFF' }, // Macará
  '1497694562683060255': { primario: '#00529B', secundario: '#FFFFFF', texto: '#FFFFFF' }, // Manta
  '1497694576738304061': { primario: '#04692e', secundario: '#867f1d', texto: '#FFFFFF' }, // Mushuc Runa
  '1497694629758505060': { primario: '#0b6303', secundario: '#92902b', texto: '#ffffff' }, // Orense
  '1497694651589722203': { primario: '#e00d31', secundario: '#ffffff', texto: '#000000' }, // Técnico Universitario
  '1497694729792393216': { primario: '#437ab9', secundario: '#FFFFFF', texto: '#FFFFFF' }, // U. Católica
  '1497695403158671571': { primario: '#65afd1', secundario: '#ffffff', texto: '#ffffff' }, // Guayaquil City
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: obtiene display name y username de forma segura
// ─────────────────────────────────────────────────────────────────────────────
function nombreMiembro(m) {
  const display = m.displayName ?? m.user?.globalName ?? m.user?.username ?? 'Usuario desconocido';
  const user    = m.user?.username ?? m.user?.id ?? 'desconocido';
  return { display, user };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comando
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('plantilla')
    .setDescription('Muestra la plantilla completa de un equipo')
    .addRoleOption(opt =>
      opt.setName('equipo').setDescription('El equipo a consultar').setRequired(true)
    ),

  async execute(interaction) {
    try {
      // SITUACIÓN 1: El comando se ejecutó en mensajes directos (DMs)
      if (!interaction.inGuild()) {
        return interaction.reply({ content: '❌ **Error:** Este comando solo se puede usar dentro de un servidor.', ephemeral: true });
      }

      await interaction.deferReply();

      const equipoRol = interaction.options.getRole('equipo');
      const guild     = interaction.guild;

      // SITUACIÓN 2: El rol no existe o fue eliminado justo antes de ejecutar
      if (!equipoRol) {
        return interaction.editReply({ content: '❌ **Error:** No se pudo obtener el rol. ¿Fue eliminado del servidor?' });
      }

      const equipoInfo = EQUIPOS[equipoRol.id];

      // SITUACIÓN 3: El rol ingresado no está registrado en la liga
      if (!equipoInfo) {
        return interaction.editReply({ content: '❌ **Error:** Ese rol no pertenece a un equipo oficial registrado en la liga.' });
      }

      // SITUACIÓN 4: Problemas de permisos o Discord API al hacer fetch
      try {
        await guild.members.fetch();
      } catch (fetchError) {
        console.error('[PLANTILLA] Error al obtener miembros:', fetchError);
        return interaction.editReply({
          content: '⚠️ **Error de Discord:** No pude cargar la lista de miembros. Comprueba que el bot tenga permisos o inténtalo más tarde.',
        });
      }

      const miembros = guild.members.cache.filter(
        m => m.roles.cache.has(equipoRol.id) && !m.user.bot
      );

      // SITUACIÓN 5: El equipo está vacío
      if (miembros.size === 0) {
        return interaction.editReply({
          content: `📋 El equipo **${equipoInfo.nombre}** no tiene jugadores ni cuerpo técnico registrados actualmente.`,
        });
      }

      let db;
      let dbErrorAlert = '';
      try {
        db = leerDB();
      } catch (dbError) {
        console.error('[PLANTILLA] Error al leer DB:', dbError);
        db = { jugadores: {}, cooldowns: {}, ofertas_pendientes: {} };
        dbErrorAlert = '\n⚠️ *Atención: Hubo un problema al leer la base de datos de fichajes en este momento.*';
      }

      // SITUACIÓN 6: Posibles múltiples DTs o Sub-DTs (asignación de roles duplicada por error)
      const dts = [];
      const subDts = [];
      const jugadores = [];

      for (const [, miembro] of miembros) {
        const esDT    = miembro.roles.cache.has(DT_ROLE_ID);
        const esSubDT = miembro.roles.cache.has(SUB_DT_ROLE_ID);

        // Si tiene rol de DT, va a la lista de DTs. Si también tiene Sub-DT, se ignora ese rol menor.
        if (esDT) {
          dts.push(miembro);
        } else if (esSubDT) {
          subDts.push(miembro);
        } else {
          // Es jugador normal
          const datos  = db.jugadores?.[miembro.id] ?? null;
          const tiempo = (datos && datos.fechaFichaje) ? tiempoRelativo(datos.fechaFichaje) : 'Sin ficha / No registrado';
          jugadores.push({ miembro, tiempo });
        }
      }

      // Ordenar jugadores por fecha de fichaje
      jugadores.sort((a, b) => {
        const fa = db.jugadores?.[a.miembro.id]?.fechaFichaje ?? 0;
        const fb = db.jugadores?.[b.miembro.id]?.fechaFichaje ?? 0;
        return fa - fb;
      });

      const colorEmbed     = COLORES_EQUIPO[equipoRol.id]?.primario ?? '#FFD700';
      const totalJugadores = jugadores.length + dts.length + subDts.length;

      // SITUACIÓN 7: Alerta de exceso de cupo
      let cupoAlerta = '';
      if (totalJugadores > 15) {
        cupoAlerta = '\n🚨 **ALERTA: El equipo supera el límite permitido de 15 integrantes.**';
      }

      const embed = new EmbedBuilder()
        .setColor(colorEmbed)
        .setAuthor({
          name: 'Liga Ecuador · Plantilla Oficial',
          iconURL: 'https://flagcdn.com/w40/ec.png',
        })
        .setTitle(`🏟️ ${equipoInfo.nombre}`)
        .setThumbnail(equipoInfo.logo ?? null)
        .setDescription(`**${totalJugadores}/15** jugadores en plantilla${cupoAlerta}${dbErrorAlert}`)
        .setTimestamp()
        .setFooter({ text: 'Los tiempos se actualizan en cada consulta' });

      let camposAgregados = 0;

      // ── Sección cuerpo técnico ──
      if (dts.length > 0 || subDts.length > 0) {
        embed.addFields({ name: '━━━━━━  CUERPO TÉCNICO  ━━━━━━', value: '\u200B', inline: false });
        camposAgregados++;

        for (const dt of dts) {
          if (camposAgregados >= 25) break;
          const { display, user } = nombreMiembro(dt);
          const datosDT = db.jugadores?.[dt.id] ?? null;
          const tiempoDT = (datosDT && datosDT.fechaFichaje) ? tiempoRelativo(datosDT.fechaFichaje) : 'Sin ficha / No registrado';
          embed.addFields({
            name: '🏅 Director Técnico',
            value: `<@${dt.id}>\n**${display}**\n\`@${user}\`\n*${tiempoDT}*`,
            inline: true,
          });
          camposAgregados++;
        }

        for (const sdt of subDts) {
          if (camposAgregados >= 25) break;
          const { display, user } = nombreMiembro(sdt);
          const datosSDT = db.jugadores?.[sdt.id] ?? null;
          const tiempoSDT = (datosSDT && datosSDT.fechaFichaje) ? tiempoRelativo(datosSDT.fechaFichaje) : 'Sin ficha / No registrado';
          embed.addFields({
            name: '🎖️ Sub-Director Técnico',
            value: `<@${sdt.id}>\n**${display}**\n\`@${user}\`\n*${tiempoSDT}*`,
            inline: true,
          });
          camposAgregados++;
        }
      } else {
        embed.addFields({ name: '━━━━━━  CUERPO TÉCNICO  ━━━━━━', value: '*Sin cuerpo técnico asignado*', inline: false });
        camposAgregados++;
      }

      // ── Sección jugadores ──
      if (jugadores.length > 0 && camposAgregados < 25) {
        embed.addFields({ name: '━━━━━━━  JUGADORES  ━━━━━━━', value: '\u200B', inline: false });
        camposAgregados++;

        for (const j of jugadores) {
          // SITUACIÓN 8: Límite extremo de la API de Discord
          if (camposAgregados >= 24) {
            embed.addFields({
              name: '⚠️ Límite de visualización',
              value: 'Plantilla muy grande. Muestra limitada para evitar errores de Discord.',
              inline: false,
            });
            break;
          }
          const { display, user } = nombreMiembro(j.miembro);
          embed.addFields({
            name: display,
            value: `<@${j.miembro.id}>\n\`@${user}\`\n*${j.tiempo}*`,
            inline: true,
          });
          camposAgregados++;
        }

        const resto = jugadores.length % 3;
        if (resto === 1 && camposAgregados < 24) {
          embed.addFields(
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
          );
        } else if (resto === 2 && camposAgregados < 25) {
          embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
        }
      } else if (jugadores.length === 0 && camposAgregados < 25) {
        embed.addFields({ name: '━━━━━━━  JUGADORES  ━━━━━━━', value: '*Sin jugadores fichados*', inline: false });
      }

      await interaction.editReply({
        content: `<@&${equipoRol.id}>`,
        embeds: [embed],
        allowedMentions: { roles: [equipoRol.id] },
      });

    } catch (error) {
      console.error('[PLANTILLA] Error general atrapado en catch superior:', error);
      
      // SITUACIÓN 9: Falla crítica de red o de Discord al editar o enviar
      try {
        const errorMsg = '❌ **Ocurrió un error inesperado al cargar la plantilla.** Por favor verifica los permisos del bot o intenta más tarde.';
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMsg, embeds: [], components: [] });
        } else {
          await interaction.reply({ content: errorMsg, ephemeral: true });
        }
      } catch (e) {
        console.error('[PLANTILLA] Imposible enviar mensaje de error al usuario:', e);
      }
    }
  },
};