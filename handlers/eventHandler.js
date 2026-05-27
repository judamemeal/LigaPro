const fs = require('fs');
const path = require('path');

async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    const executeEvent = async (...args) => {
      try {
        await event.execute(...args, client);
      } catch (error) {
        console.error(`💥 [Event Error] Fallo al ejecutar el evento ${event.name}:`, error);
      }
    };

    if (event.once) {
      client.once(event.name, executeEvent);
    } else {
      client.on(event.name, executeEvent);
    }
    console.log(`✅ Evento cargado: ${event.name}`);
  }
}

module.exports = { loadEvents };
