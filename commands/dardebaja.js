const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

// Importamos helpers desde fichar.js para no duplicar config
const { EQUIPOS, leerDB, guardarDB, tiempoRelativo } = require('./fichar');
const { sendLog } = require('../utils/logger');
const { COLORS } = require('../config');


const DT_ROLE_ID     = '1497693671141671034';
const SUB_DT_ROLE_ID = '1497693705539424467';
const CANAL_BAJAS    = '1497684725815316601';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dardeabaja')
    .setDescription('Da de baja a un jugador de tu equipo')
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('El jugador a dar de baja').setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('equipo').setDescription('El equipo del que se da de baja').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const reclutador = interaction.member;
    const objetivo   = interaction.options.getMember('usuario');
    const equipoRol  = interaction.options.getRole('equipo');
    const guild      = interaction.guild;

    // ── 1. Equipo válido?
    const equipoInfo = EQUIPOS[equipoRol.id];
    if (!equipoInfo) {
      return interaction.editReply({ content: '❌ Ese rol no es un equipo válido de la liga.' });
    }

    // ── 2. Reclutador es DT o SUB-DT?
    const esDT    = reclutador.roles.cache.has(DT_ROLE_ID);
    const esSubDT = reclutador.roles.cache.has(SUB_DT_ROLE_ID);
    if (!esDT && !esSubDT) {
      return interaction.editReply({ content: '❌ Solo el **Director Técnico** o el **Sub-Director Técnico** pueden dar de baja a jugadores.' });
    }

    // ── 3. El reclutador pertenece al equipo?
    if (!reclutador.roles.cache.has(equipoRol.id)) {
      return interaction.editReply({
        content: `❌ No puedes dar de baja en **${equipoInfo.nombre}** porque no formas parte de ese equipo.`,
      });
    }

    // ── 4. No puedes darte de baja a ti mismo
    if (objetivo.id === reclutador.id) {
      return interaction.editReply({ content: '❌ No puedes darte de baja a ti mismo.' });
    }

    // ── 5. El jugador está en ese equipo?
    if (!objetivo.roles.cache.has(equipoRol.id)) {
      return interaction.editReply({
        content: `❌ **${objetivo.displayName}** no pertenece al equipo **${equipoInfo.nombre}**.`,
      });
    }

    // ── 6. Quitar el rol
    try {
      await objetivo.roles.remove(equipoRol.id);
    } catch (e) {
      return interaction.editReply({ content: '❌ No pude quitar el rol. Verifica mis permisos.' });
    }

    // ── 7. Eliminar de la DB y calcular tiempo que estuvo
    const db = leerDB();
    const datosJugador = db.jugadores[objetivo.id];
    let tiempoEnEquipo = 'Desconocido';
    if (datosJugador && datosJugador.equipoRolId === equipoRol.id) {
      tiempoEnEquipo = tiempoRelativo(datosJugador.fechaFichaje).replace('hace ', '');
      delete db.jugadores[objetivo.id];
      guardarDB(db);
    }

    // ── 8. Anunciar en canal de bajas
    const canalBajas = guild.channels.cache.get(CANAL_BAJAS);
    if (canalBajas) {
      const embed = new EmbedBuilder()
        .setTitle('🔴 Baja de Jugador')
        .setDescription(
          `**${objetivo.displayName}** ha sido dado de baja del equipo **${equipoInfo.nombre}**.`
        )
        .addFields(
          { name: '🧑‍💼 Autorizado por',      value: `${reclutador}`, inline: true },
          { name: '🏟️ Equipo',               value: `**${equipoInfo.nombre}**`, inline: true },
          { name: '⏱️ Tiempo en el equipo',  value: tiempoEnEquipo, inline: true },
        )
        .setThumbnail(equipoInfo.logo)
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: `Baja registrada el ${new Date().toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}` });

      await canalBajas.send({ embeds: [embed] });
    }

    await interaction.editReply({
      content: `✅ **${objetivo.displayName}** ha sido dado de baja de **${equipoInfo.nombre}** correctamente.`,
    });

    // Enviar log
    await sendLog(guild, {
      title: 'Baja de Jugador / Rol Removido',
      description: `Se removió el rol **${equipoInfo.nombre}** del usuario ${objetivo}.`,
      color: COLORS.ERROR,
      fields: [
        { name: '👤 Jugador', value: `${objetivo}`, inline: true },
        { name: '🏟️ Equipo', value: `**${equipoInfo.nombre}**`, inline: true },
        { name: '🧑‍💼 Autorizado por', value: `${reclutador}`, inline: true },
      ],
      thumbnail: equipoInfo.logo
    });
  },
};