const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin, noPermReply } = require('./utils');
const { COLORS } = require('../config');

// Configuración de roles y emojis (emoji -> roleID)
const ROLES_CONFIG = {
  '📢': '1497691429445832815',
  '⚽': '1497691648535171162',
  '📅': '1497691693221285999',
  '📊': '1497691694756266086',
  '📱': '1497691774808883291',
  '🆚': '1500626740551352340',
  '🤝': '1497691990328873071'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorol')
    .setDescription('Despliega el menú de roles por reacción de LigaPro (solo admins)'),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) return noPermReply(interaction);

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO || 0x3498db)
      .setTitle('🌟 Panel de Roles - LigaPro Ecuabet')
      .setDescription('¡Personaliza tu experiencia en el servidor! Reacciona con el emoji correspondiente para obtener o quitar el rol que prefieras.\n\n' +
        '📢 **Anuncios**\nRecibe avisos importantes y novedades oficiales de la liga.\n\n' +
        '⚽ **Resultados**\nEntérate de los resultados de todos los partidos.\n\n' +
        '📅 **Fechas**\nMantente al día con horarios y fechas de los encuentros.\n\n' +
        '📊 **Tabla**\nSigue las actualizaciones de la tabla de posiciones.\n\n' +
        '📱 **Social Media**\nNoticias, entrevistas y contenido exclusivo de la liga.\n\n' +
        '🆚 **Amistosos**\nCuadrar amistosos con otros equipos del servidor.\n\n' +
        '🤝 **Partners**\nInformación sobre alianzas y oportunidades con otras ligas.')
      .setImage('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSRcS2AHxGC_7ya2vbgsDyQMQ7gm_VhJLuwHQ&s') // Puedes cambiar la imagen si quieres
      .setFooter({ text: 'Selecciona las reacciones abajo para gestionar tus roles.' })
      .setTimestamp();

    await interaction.reply({ content: '✅ Desplegando menú de autoroles...', flags: MessageFlags.Ephemeral });

    const msg = await interaction.channel.send({ embeds: [embed] });

    // Añadir las reacciones automáticamente
    for (const emoji of Object.keys(ROLES_CONFIG)) {
      try {
        await msg.react(emoji);
      } catch (error) {
        console.error(`Error al reaccionar con ${emoji}:`, error);
      }
    }
  },
};
