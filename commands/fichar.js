const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendLog } = require('../utils/logger');
const { COLORS } = require('../config');


// ─────────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────────
const DT_ROLE_ID      = '1497693671141671034';
const SUB_DT_ROLE_ID  = '1497693705539424467';
const CANAL_FICHAJES  = '1497684673625587934';
const LIMITE_JUGADORES = 15;

const DB_DIR  = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'fichajes.json');

// Mapa equipo → { nombre, logo }
const EQUIPOS = {
  '1497694196205879326': { nombre: 'Aucas',                   logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiyyJrbKvxU7LVyrzB1dmv_-dCSiQu_l6TtTMWUxXUEPYxW3L0QyyyLizmMchUQYkhBGuJUO8MwdaXwrayHenUz5a_bWbpsTf39FJDNBeIgJGOGpzbaEvvjN98ZjPBoKkOQexd1EJUbS0E/s1600/Sociedad+Deportiva+Aucas.png' },
  '1497694246189273279': { nombre: 'Barcelona SC',            logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhiI1aCB5eRZPvsuNSunyhyphenhyphentO_oRzsUpbm1QE8xTN-S5si2jhQFzZ0OAvDtyNj56Hr2ZvT95Cg8b-memcKwrlv__H-LhCS0290SlY5oOs_ELyIRf8aoZn1PGUi4L5EvoO0Yq0HEycIFb-X1IhWwIu4ue3ZVxx3WxhB-avENOxgtm4K5DBTG8lHMfeRzJZw/s16000/Barcelona%20Sporting%20Club.png' },
  '1497694298270073013': { nombre: 'Deportivo Cuenca',        logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiExAeZbQ0Had0hMzFB0iCUe1_r0KAH45fIdW0iDwCr50q3EnJ4aXq2ayIAj0tEfS9lN8jcYuzQsDIpK7mxYviUoIquWnNsuij99ESV-4YDjKobJGu_ZDTf9BjCGlhyzkdrEPCCJEclmi-SO0QFEjxgVo0T_R0PF3WGrbmSHE-RPWnnMzaGGn6yZqvG/s16000/Club%20Deportivo%20Cuenca.png' },
  '1497694271740838058': { nombre: 'Delfín SC',               logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhyN_3LDEkfPxA_y-_lacbYQtLrfHqQJLMuDnFP7GTvKq9wCdVHV17-ykbGUlpSltFif1DAKKjKGsDHYdH7TuCiD_sjFOAQjIwnF5wafxNJZxEKx-_Th4N4hi87g9zXNMnMKV4wXX7LR4PymZvuKVUSNtLjVulBo0Q5-50raY3giUdjOOgHKZgVNHWX/s16000/Delf%C3%ADn%20Sporting%20Club.png' },
  '1497694379304026152': { nombre: 'Emelec',                  logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg0BWkRrK-3fyuzUWiCJokzBb252gRD0U29rLEHePsgiD7Gm84aFPg5OOfcmazGyLU1gGRt7mZf4EA1W13_tFaZDgL3QXCqp1YoDMaEROkKWZev4N_ZB_NKuSP15JgnLra-vZdD_kvOzfPRVtr-2YAlv_kqY_uZGKKp6i_8bMUMnAYPb3Lajis6AfAuJXo/s16000/Club%20Sport%20Emelec.png' },
  '1497694414586511440': { nombre: 'Independiente del Valle', logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj_FCPMW4rP0jMpSjXzZ14hQ6RGf5xzxwBqxRtw6zYHXVDr7Njb9181QEL-BGppfyX_lVMkH0RVMw6oz5H2C7EhEZ2oPPTmrnH15C6u2xuqaBmHrYKvd6_F3h1iIK1PKxK92Pq0fGF_s6c/s16000/Independiente+del+Valle.png' },
  '1497797471483723817': { nombre: 'Leones del Norte',        logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiCxwrk2ATzIGzBU9EVd-H0ou8lwrCCzj8JmA_4fO_i3khdPCa-nvHerhsjnfTS0zE7C455nsMvKjDzA6pvCt7T3zhhJ9pnnAm2sYrBXBc5CNiij4wjYR-weEFE79-LiRswL82vNR0Rvuwc-SLXhXSyWqfZt7v0w5XlT7z1aLRCcmBAUwCfkH9CyM-BF3U/s16000/Leones%20FC.png' },
  '1497694479992492243': { nombre: 'Libertad FC',             logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEihXVitUxPmF-LAiTTkeKBjcaOtFjmtLqWN7H7DRklkLKizH0o-Ti6V-AqTOXIWshr6Od4d8EgTzyNetbWvxDAIvLT_wPE-PvTpP3yMcSLGqaL7bxYLIwDGVY_IzuDG4RvSDg-zKQxm61w/s16000/Libertad+Futbol+Club.png' },
  '1497694498590031872': { nombre: 'Liga de Quito',           logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh-hf0FxHrej9sDqW_PMaI6tYji01CNG4WOoloENJJNRGPX-4ubXeS9Hr4agxbNCyzX9fDdUaer8n0Yho2yfKs0PRGt9Kepi6zYPjhgyuQ2YqZzdfO6ba2QojrJf-z6wq8AxUEfWAVj_qu-sV_dKoUmVplV6zGcorcJKUUWPtkkfwvbzYfkPeN427urigE/s16000/LDU%20de%20Quito.png' },
  '1497694538523742430': { nombre: 'Macará',                  logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgmgEkL0CU2cwJispHgV8mgrReRudxH9BdXAW4rPj1dQbbTzLYz2DcwLnUDg_uEKJ-ry9r0Vnn8wifx8tNkQ9letFRYaW_GssgQyC6kXKUlVJplBp2bjP3dy0c0yL42NrYaAXugE11PlNQ/s1600/Club+Social+y+Deportivo+Macara.png' },
  '1497694562683060255': { nombre: 'Manta FC',                logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgzzj5xWYN4fWbGKUuYN_GEAe0j2XhI2lkC4ah8Y7Fc2q3CnzzVaibBC0fqfrqREz0cMvFUrcPdYMQwX7OMahyJgwRU4qxDvM8VeQTdw-woq0pVWbVZ2BxWH2mV7M-aUoSce80-jqDobuLdZOJAgz0esvP4QyPyYvhRMB6eBoJyA2OEQEU__Lb1M2oBLQc/s16000/Manta%20FC.png' },
  '1497694576738304061': { nombre: 'Mushuc Runa',             logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiQLOQv7hirVa4J_zpCPyol0E__x_jrMqhljZNW_38hd9HsKbjhJbV432hF8npV4SSXRl1QrkzmTJByorhkZkmjiN5Fa-Bd2EiR-Y82IOxK9M8WHyXGS0W89b8GWZv7iDyp7bEukqkgO54/s1600/Mushuc.png' },
  '1497694629758505060': { nombre: 'Orense SC',               logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEha5mQfekZxcy2kNTy5WYAliiEdZLsVsBLDUIzYcuTT7x3tvm0JV2_q9vG7l5N4_U_nF8KpwWSiXcakmt1tVIjNL31Z3kDSmAST-owbRudr8uSVPV6xsmXBp9XG1KHuu2K6Dkrkx3dc-36U_-J03iaI_Vua_3S-YUz8m2MCmO4g9K1qRercbFClTrY30sA/s16000/Orense%20Sporting%20Club.png' },
  '1497694651589722203': { nombre: 'Técnico Universitario',   logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjwGpk81mi7qxgaAthGT22wFv7_P5_wdjbXJ9lbkij-THOsgMyHa0UNgsuW7T4CO4pY5qwvCaiT4QSHDmxg_3gXEN5K0T6v6NiOxTx0hOxrqpP5exTfzQTIIdJ-HpNnkPo7elPkWoCnj6tFSEY7qtWOtbA6lALU3U2nV_TnbWMJ3WVkPqjkD4UfMw9uqh0/s16000/Universitario.png' },
  '1497694729792393216': { nombre: 'Universidad Católica',    logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj4WSSMWZ4XGQ5EGDIxVGb-auUuwi92JHKQAwnZXS-FqeQN0Mvntib_i46xXDLNp2M-TRV7d72WvxziZH1S1ObNxYf_FbpqlrhNrPvnbhkzw0Ei-_cU-VfmYKA_xIvfyZ_cGQ7VXj35lqFvOFT5WVhOdtaVJhBhQO1_SyvWnVcy382v1hQHVTeqOx-bZQU/s16000/Universidad%20Catolica.png' },
  '1497695403158671571': { nombre: 'Guayaquil City FC',       logo: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjdakJtrobu0OsiYH5p1-tLnE5R1gZQBW1v0MiSfY1giuLJ5JRS4RRGXLKUG1p4aouOEPPjfft9FCpgpykwV5I8a2d8gKOCViJrksw9Ob9c2LOpNyx5iSHKLP0vf6wCUdzM9yYncV0aBmw/s1600/Guayaquil+City+FC.png' },
};

// ─────────────────────────────────────────────
//  HELPERS DB
// ─────────────────────────────────────────────
let dbCache = null;

function leerDB() {
  if (dbCache) return dbCache;
  const EMPTY = { jugadores: {}, cooldowns: {}, ofertas_pendientes: {} };
  try {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY, null, 2));
      dbCache = EMPTY;
      return dbCache;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8').trim();
    if (!raw) {
      fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY, null, 2));
      dbCache = EMPTY;
      return dbCache;
    }
    const parsed = JSON.parse(raw);
    dbCache = {
      jugadores:          parsed.jugadores          ?? {},
      cooldowns:          parsed.cooldowns          ?? {},
      ofertas_pendientes: parsed.ofertas_pendientes ?? {},
    };
    return dbCache;
  } catch (err) {
    console.error('[DB] Error al leer fichajes.json:', err.message);
    dbCache = EMPTY;
    return dbCache;
  }
}

function guardarDB(data) {
  dbCache = data;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  fs.promises.writeFile(DB_PATH, JSON.stringify(data, null, 2))
    .catch(e => console.error('[DB] Error al guardar fichajes.json:', e.message));
}

function tiempoRelativo(timestamp) {
  const diff = Date.now() - timestamp;
  const segundos = Math.floor(diff / 1000);
  const minutos  = Math.floor(segundos / 60);
  const horas    = Math.floor(minutos / 60);
  const dias     = Math.floor(horas / 24);
  const meses    = Math.floor(dias / 30);
  const anios    = Math.floor(meses / 12);

  if (anios > 0)   return `hace ${anios} año${anios > 1 ? 's' : ''}`;
  if (meses > 0)   return `hace ${meses} mes${meses > 1 ? 'es' : ''}`;
  if (dias > 0)    return `hace ${dias} día${dias > 1 ? 's' : ''}`;
  if (horas > 0)   return `hace ${horas} hora${horas > 1 ? 's' : ''}`;
  if (minutos > 0) return `hace ${minutos} minuto${minutos > 1 ? 's' : ''}`;
  return 'hace unos segundos';
}

// ─────────────────────────────────────────────
//  COMANDO
// ─────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fichar')
    .setDescription('Ficha a un jugador para tu equipo')
    .addUserOption(opt =>
      opt.setName('jugador').setDescription('El jugador a fichar').setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName('equipo').setDescription('El equipo al que lo fichas').setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Diferir la respuesta inmediatamente para evitar el "This interaction failed"
      await interaction.deferReply({ ephemeral: true });

      const reclutador = interaction.member;
      const jugador    = interaction.options.getMember('jugador');
      const equipoRol  = interaction.options.getRole('equipo');
      const guild      = interaction.guild;

      // Validar si el jugador existe en el caché o está en el servidor
      if (!jugador) {
        return interaction.editReply({ content: '❌ El jugador seleccionado no se encuentra en el servidor.' });
      }

      // ── 1. El equipo pasado es válido?
      const equipoInfo = EQUIPOS[equipoRol.id];
      if (!equipoInfo) {
        return interaction.editReply({ content: '❌ Ese rol no corresponde a un equipo oficial de la liga.' });
      }

      // ── 2. Reclutador tiene DT o SUB-DT?
      const esDT    = reclutador.roles.cache.has(DT_ROLE_ID);
      const esSubDT = reclutador.roles.cache.has(SUB_DT_ROLE_ID);
      if (!esDT && !esSubDT) {
        return interaction.editReply({ content: '❌ Solo el **Director Técnico** o el **Sub-Director Técnico** pueden fichar jugadores.' });
      }

      // ── 3. El reclutador pertenece al equipo que quiere fichar?
      if (!reclutador.roles.cache.has(equipoRol.id)) {
        return interaction.editReply({ content: `❌ No puedes fichar para **${equipoInfo.nombre}** porque no formas parte de ese equipo.` });
      }

      // ── 4. No puedes ficharte a ti mismo
      if (jugador.id === reclutador.id) {
        return interaction.editReply({ content: '❌ No puedes ficharte a ti mismo.' });
      }

      // ── 5. El jugador es un bot?
      if (jugador.user.bot) {
        return interaction.editReply({ content: '❌ No puedes fichar a un bot.' });
      }

      // ── 6. El jugador ya tiene equipo?
      const tieneEquipo = Object.keys(EQUIPOS).some(id => jugador.roles.cache.has(id));
      if (tieneEquipo) {
        const equipoActualId = Object.keys(EQUIPOS).find(id => jugador.roles.cache.has(id));
        const equipoActual = EQUIPOS[equipoActualId];
        return interaction.editReply({
          content: `❌ **${jugador.displayName}** ya pertenece a **${equipoActual ? equipoActual.nombre : 'un equipo'}**. Debe ser dado de baja primero.`,
        });
      }

      // ── 7. Límite de 15 jugadores (optimizamos el conteo)
      // Actualizamos los miembros del rol
      const roleActualizado = await guild.roles.fetch(equipoRol.id).catch(() => null);
      let totalJugadores = 0;
      if (roleActualizado) {
         totalJugadores = roleActualizado.members.size;
      }
      if (totalJugadores >= LIMITE_JUGADORES) {
        return interaction.editReply({
          content: `❌ **${equipoInfo.nombre}** ya alcanzó el límite de **${LIMITE_JUGADORES} jugadores** (Actualmente tienen ${totalJugadores}). No se permiten más fichajes.`,
        });
      }

      // ── 8. Cooldown: ¿hay oferta rechazada reciente?
      const db = leerDB();
      const cooldownKey = `${jugador.id}-${equipoRol.id}`;
      const cooldown = db.cooldowns[cooldownKey];
      if (cooldown && Date.now() - cooldown < 24 * 60 * 60 * 1000) {
        const restante = Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - cooldown)) / 3600000);
        return interaction.editReply({
          content: `⏳ **${jugador.displayName}** rechazó una oferta de **${equipoInfo.nombre}** recientemente. Debes esperar **${restante}h** antes de volver a intentarlo.`,
        });
      }

      // ── 9. ¿Ya hay oferta pendiente?
      if (db.ofertas_pendientes[jugador.id]) {
        return interaction.editReply({
          content: `⏳ **${jugador.displayName}** ya tiene una oferta pendiente. Espera a que la responda o a que caduque.`,
        });
      }

      // ── 10. Mandar oferta al canal de fichajes
      const canalFichajes = guild.channels.cache.get(CANAL_FICHAJES);
      if (!canalFichajes) {
        return interaction.editReply({ content: '❌ No se encontró el canal de fichajes. Contacta a un administrador.' });
      }

      const embed = new EmbedBuilder()
        .setTitle('⚽ Oferta de Fichaje')
        .setDescription(
          `${jugador} has recibido una oferta del equipo **${equipoInfo.nombre}**.\n\n` +
          `🕐 Tienes **1 hora** para responder. Si no respondes, la oferta caduca.`
        )
        .addFields(
          { name: '🧑‍💼 Director Técnico', value: `${reclutador}`, inline: true },
          { name: '🏟️ Equipo',            value: `**${equipoInfo.nombre}**`, inline: true },
          { name: '👥 Plantilla actual',  value: `${totalJugadores}/${LIMITE_JUGADORES} jugadores`, inline: true },
        )
        .setThumbnail(equipoInfo.logo)
        .setColor(0x1DB954)
        .setTimestamp()
        .setFooter({ text: 'Reacciona con los botones para aceptar o rechazar' });

      const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`fichar_aceptar_${jugador.id}_${equipoRol.id}_${reclutador.id}`)
          .setLabel('✅ Aceptar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`fichar_rechazar_${jugador.id}_${equipoRol.id}_${reclutador.id}`)
          .setLabel('❌ Rechazar')
          .setStyle(ButtonStyle.Danger),
      );

      const mensaje = await canalFichajes.send({
        content: `${jugador}`,
        embeds: [embed],
        components: [botones],
      }).catch(err => {
        console.error('[FICHAR] Error al enviar mensaje de fichaje:', err);
        return null;
      });

      if (!mensaje) {
         return interaction.editReply({ content: '❌ Hubo un error al enviar la oferta al canal de fichajes. Revisa mis permisos.' });
      }

      // Guardar oferta pendiente
      db.ofertas_pendientes[jugador.id] = {
        mensajeId:    mensaje.id,
        equipoRolId:  equipoRol.id,
        reclutadorId: reclutador.id,
        timestamp:    Date.now(),
      };
      guardarDB(db);

      // Auto-expirar en 1 hora (3600000 ms)
      setTimeout(async () => {
        const dbActual = leerDB();
        if (dbActual.ofertas_pendientes[jugador.id]?.mensajeId === mensaje.id) {
          delete dbActual.ofertas_pendientes[jugador.id];
          guardarDB(dbActual);
          try {
            const botonesDesactivados = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('expirado_aceptar').setLabel('✅ Aceptar').setStyle(ButtonStyle.Success).setDisabled(true),
              new ButtonBuilder()
                .setCustomId('expirado_rechazar').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger).setDisabled(true),
            );
            
            const msgCache = await canalFichajes.messages.fetch(mensaje.id).catch(() => null);
            if (msgCache) {
               const expiredEmbed = EmbedBuilder.from(embed)
                 .setColor(0x808080)
                 .setDescription(`${jugador} la oferta del equipo **${equipoInfo.nombre}** ha expirado.\n\n⏰ Este fichaje ha expirado por inactividad.`)
                 .setFooter({ text: '⌛ Oferta expirada — no se respondió a tiempo' });
               
               await msgCache.edit({
                 embeds: [expiredEmbed],
                 components: [botonesDesactivados],
               });
            }
          } catch (err) {
            console.error('[FICHAR] Error al expirar mensaje:', err);
          }
        }
      }, 60 * 60 * 1000);

      await interaction.editReply({
        content: `✅ Oferta enviada a **${jugador.displayName}** en ${canalFichajes}. Tiene 1 hora para responder.`,
      });

    } catch (error) {
      console.error('[FICHAR] Error en comando fichar:', error);
      // Intentar avisar del error si no pudimos
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '❌ Ocurrió un error inesperado al procesar el fichaje.' });
        } else {
          await interaction.reply({ content: '❌ Ocurrió un error inesperado al procesar el fichaje.', ephemeral: true });
        }
      } catch (e) {
        console.error('No se pudo enviar mensaje de error en fichar:', e);
      }
    }
  },

  // ─────────────────────────────────────────────
  //  MANEJADORES DE BOTONES
  // ─────────────────────────────────────────────
  async handleAceptar(interaction) {
    try {
      // 1. Diferir la interacción SIEMPRE primero
      await interaction.deferUpdate().catch(() => {});

      const [, , jugadorId, equipoRolId, reclutadorId] = interaction.customId.split('_');

      // 2. Validar que el usuario que presiona es el jugador
      if (interaction.user.id !== jugadorId) {
        return interaction.followUp({ content: '❌ Esta oferta no es para ti.', ephemeral: true }).catch(() => {});
      }

      const guild      = interaction.guild;
      const jugador    = await guild.members.fetch(jugadorId).catch(() => null);
      const equipoInfo = EQUIPOS[equipoRolId];

      if (!jugador || !equipoInfo) {
        return interaction.followUp({ content: '❌ Ocurrió un error: No se encontró al jugador o el equipo en el sistema.', ephemeral: true }).catch(() => {});
      }

      // 3. Verificar límite de nuevo de forma rápida
      const roleActualizado = await guild.roles.fetch(equipoRolId).catch(() => null);
      let totalJugadores = roleActualizado ? roleActualizado.members.size : 0;
      
      const db = leerDB();
      
      // Verificar si la oferta sigue pendiente
      if (!db.ofertas_pendientes[jugadorId] || db.ofertas_pendientes[jugadorId].mensajeId !== interaction.message.id) {
        return interaction.followUp({ content: '❌ Esta oferta ya ha expirado o ya fue respondida.', ephemeral: true }).catch(() => {});
      }

      if (totalJugadores >= LIMITE_JUGADORES) {
        delete db.ofertas_pendientes[jugadorId];
        guardarDB(db);
        return interaction.followUp({
          content: `❌ El equipo **${equipoInfo.nombre}** ya llegó al límite de ${LIMITE_JUGADORES} jugadores. No se puede completar el fichaje.`,
          ephemeral: true
        }).catch(() => {});
      }

      // 4. Asignar el rol
      try {
        await jugador.roles.add(equipoRolId);
      } catch (e) {
        console.error('[FICHAR] Error al asignar rol:', e);
        return interaction.followUp({ content: '❌ No pude asignar el rol al jugador. Verifica que el bot tenga permisos suficientes (rol del bot por encima de los equipos).', ephemeral: true }).catch(() => {});
      }

      // 5. Guardar en DB
      db.jugadores[jugadorId] = {
        equipoRolId,
        equipoNombre: equipoInfo.nombre,
        reclutadorId,
        fechaFichaje: Date.now(),
      };
      delete db.ofertas_pendientes[jugadorId];
      guardarDB(db);

      // 6. Actualizar embed de forma segura
      const oldEmbed = interaction.message.embeds[0];
      const embedAceptado = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder();
      
      embedAceptado
        .setTitle('✅ Fichaje Completado')
        .setColor(0x1DB954)
        .setDescription(
          `**${jugador.displayName}** ha **aceptado** la oferta de **${equipoInfo.nombre}** y ya es parte del plantel.\n\n` +
          `⏱️ Fichado: ${tiempoRelativo(Date.now())}`
        )
        .setFooter({ text: `Fichado el ${new Date().toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}` });

      const botonesDesactivados = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('done_aceptar').setLabel('✅ Aceptado').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('done_rechazar').setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger).setDisabled(true),
      );

      await interaction.message.edit({ embeds: [embedAceptado], components: [botonesDesactivados] }).catch(err => {
         console.error('[FICHAR] Error al editar mensaje original al aceptar:', err);
      });

      // Log accepted transfer
      await sendLog(guild, {
        title: 'Fichaje Aceptado',
        description: `Mediante el sistema de fichajes se otorgó el rol **${equipoInfo.nombre}** al usuario ${jugador}.`,
        color: COLORS.LOG_FICHAJE,
        fields: [
          { name: '👤 Jugador', value: `${jugador}`, inline: true },
          { name: '🏟️ Equipo', value: `**${equipoInfo.nombre}**`, inline: true },
          { name: '🧑‍💼 Fichado por', value: `<@${reclutadorId}>`, inline: true },
        ],
        thumbnail: equipoInfo.logo
      });

    } catch (err) {
      console.error("[FICHAR] Error fatal en handleAceptar:", err);
      interaction.followUp({ content: '❌ Ocurrió un error inesperado al aceptar la oferta.', ephemeral: true }).catch(() => {});
    }
  },

  async handleRechazar(interaction) {
    try {
      // 1. Diferir la interacción SIEMPRE primero
      await interaction.deferUpdate().catch(() => {});

      const [, , jugadorId, equipoRolId, reclutadorId] = interaction.customId.split('_');

      if (interaction.user.id !== jugadorId) {
        return interaction.followUp({ content: '❌ Esta oferta no es para ti.', ephemeral: true }).catch(() => {});
      }

      const equipoInfo = EQUIPOS[equipoRolId];
      const db = leerDB();

      // Verificar si la oferta sigue pendiente
      if (!db.ofertas_pendientes[jugadorId] || db.ofertas_pendientes[jugadorId].mensajeId !== interaction.message.id) {
        return interaction.followUp({ content: '❌ Esta oferta ya ha expirado o ya fue respondida.', ephemeral: true }).catch(() => {});
      }

      // 2. Poner cooldown de 24h
      const cooldownKey = `${jugadorId}-${equipoRolId}`;
      db.cooldowns[cooldownKey] = Date.now();
      delete db.ofertas_pendientes[jugadorId];
      guardarDB(db);

      // 3. Actualizar el mensaje de forma segura
      const oldEmbed = interaction.message.embeds[0];
      const embedRechazado = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder();
      
      embedRechazado
        .setTitle('❌ Oferta Rechazada')
        .setColor(0xED4245)
        .setDescription(
          `**${interaction.user.displayName}** ha **rechazado** la oferta de **${equipoInfo?.nombre ?? 'equipo'}**.\n\n` +
          `⏳ No se podrá enviar otra oferta a este jugador durante **24 horas**.`
        )
        .setFooter({ text: 'Cooldown activo por 24 horas' });

      const botonesDesactivados = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('done_aceptar').setLabel('✅ Aceptar').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('done_rechazar').setLabel('❌ Rechazado').setStyle(ButtonStyle.Danger).setDisabled(true),
      );

      await interaction.message.edit({ embeds: [embedRechazado], components: [botonesDesactivados] }).catch(err => {
         console.error('[FICHAR] Error al editar mensaje original al rechazar:', err);
      });

      // Log rejected transfer
      await sendLog(interaction.guild, {
        title: 'Fichaje Rechazado',
        description: `El usuario <@${jugadorId}> ha rechazado el fichaje del equipo **${equipoInfo?.nombre ?? 'Desconocido'}**.`,
        color: COLORS.ERROR,
        fields: [
          { name: '👤 Jugador', value: `<@${jugadorId}>`, inline: true },
          { name: '🏟️ Equipo', value: `**${equipoInfo?.nombre ?? 'Desconocido'}**`, inline: true },
          { name: '🧑‍💼 Ofertado por', value: `<@${reclutadorId}>`, inline: true },
        ]
      });

    } catch (err) {
      console.error("[FICHAR] Error fatal en handleRechazar:", err);
      interaction.followUp({ content: '❌ Ocurrió un error inesperado al rechazar la oferta.', ephemeral: true }).catch(() => {});
    }
  },

  // Helper exportado para otros archivos
  tiempoRelativo,
  EQUIPOS,
  leerDB,
  guardarDB,
};