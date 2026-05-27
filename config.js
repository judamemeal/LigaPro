module.exports = {
  // Roles de administrador
  ADMIN_ROLES: [
    '1497690995964383393',
    '1497690952662388897',
    '1503094058267050225',
    '1503094066500468816',
  ],

  // Promoción de administrador
  TARGET_ADMIN_USER_ID: '1506006863290957937',   // Usuario que recibirá el admin
  PROMOTABLE_ADMIN_ROLE_ID: '1497690995964383393', // Rol Administrador a otorgar

  // Canales
  WELCOME_CHANNEL_ID: '1497682737363157002',
  GOODBYE_CHANNEL_ID: '1497682867260756079',
  AUTOROLES_CHANNEL_ID: '1497741419899781200',
  LOGS_CHANNEL_ID: '1501712725129035817',
  SANCTIONS_CHANNEL_ID: '1506100143131328542',


  // Colores embed
  COLORS: {
    SUCCESS: 0x2ecc71,
    ERROR: 0xe74c3c,
    INFO: 0x3498db,
    WARNING: 0xf39c12,
    WELCOME: 0x9b59b6,
    GOODBYE: 0x95a5a6,
    LOG_BAN: 0xff0000,
    LOG_MUTE: 0xffa500,
    LOG_CLEAR: 0x3498db,
    LOG_TICKET: 0x00ffff,
    LOG_FICHAJE: 0x1db954,
    LOG_UNBAN: 0x2ecc71,
    LOG_UNSANCTION: 0x1abc9c,
    // ── AntiRaid ──────────────────────────────
    RAID_ALERT:  0xFF0000,   // 🚨 Peligro máximo - VAR activo
    LOCKDOWN:    0x8B0000,   // 🛑 Modo Estadio Seguro
    AR_WARN:     0xFF6B00,   // 🟨 Tarjeta amarilla
    AR_SAFE:     0x00C851,   // ✅ Sistema normal
    AR_INFO:     0x1565C0,   // ℹ️ Info LigaPro
    AR_SUSPICIOUS: 0xFFAB00, // ⚠️ Sospechoso
  },

  // ── Canales protegidos (AntiRaid no toca estos canales) ─────
  // Agrega aquí los IDs de canales de anuncios y resultados
  PROTECTED_CHANNEL_IDS: [],
};
