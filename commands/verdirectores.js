'use strict';

/**
 * /verdirectores — Muestra todos los DT y Sub-DT de cada equipo.
 * Disponible para todos los miembros.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { EQUIPOS } = require('./fichar');
const { COLORS }  = require('../config');

const DT_ROLE_ID     = '1497693671141671034';
const SUB_DT_ROLE_ID = '1497693705539424467';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verdirectores')
    .setDescription('Muestra todos los Directores Técnicos y Sub-DT de cada equipo'),

  async execute(interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;

    // Asegurar que los miembros estén en caché
    await guild.members.fetch().catch(() => {});

    const equipoIds = Object.keys(EQUIPOS);
    const lineas = [];

    for (const equipoId of equipoIds) {
      const info = EQUIPOS[equipoId];

      // Miembros del equipo que tienen DT o Sub-DT
      const dt = guild.members.cache.find(
        m => m.roles.cache.has(equipoId) && m.roles.cache.has(DT_ROLE_ID) && !m.user.bot
      );
      const subDt = guild.members.cache.find(
        m => m.roles.cache.has(equipoId) && m.roles.cache.has(SUB_DT_ROLE_ID) && !m.user.bot
      );

      const dtStr    = dt    ? `🏅 **DT:** ${dt} (\`${dt.user.tag}\`)`          : '🏅 **DT:** *Vacante*';
      const subDtStr = subDt ? `🎖️ **Sub-DT:** ${subDt} (\`${subDt.user.tag}\`)` : '🎖️ **Sub-DT:** *Vacante*';

      lineas.push({ name: `🏟️ ${info.nombre}`, value: `${dtStr}\n${subDtStr}`, logo: info.logo });
    }

    // Discord permite hasta 25 fields por embed → dividir si hay más de 12 equipos
    const CHUNK = 8; // Equipos por embed
    const chunks = [];
    for (let i = 0; i < lineas.length; i += CHUNK) {
      chunks.push(lineas.slice(i, i + CHUNK));
    }

    const embeds = chunks.map((chunk, idx) => {
      const e = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(idx === 0 ? '⚽ Cuerpo Técnico — LigaPro Ecuabet' : '⚽ Cuerpo Técnico (continuación)')
        .setTimestamp()
        .setFooter({ text: `LigaPro Ecuabet • Directores Técnicos`, iconURL: guild.iconURL() ?? undefined });

      for (const campo of chunk) {
        e.addFields({ name: campo.name, value: campo.value, inline: false });
      }
      return e;
    });

    await interaction.editReply({ embeds });
  },
};
