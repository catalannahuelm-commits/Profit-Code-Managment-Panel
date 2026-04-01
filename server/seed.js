const bcrypt = require('bcrypt');
const db = require('./database');

async function seed() {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();

  if (existingUsers.count > 0) {
    console.log('La base de datos ya tiene usuarios. Seed cancelado.');
    return;
  }

  const nahuelHash = await bcrypt.hash('nahuel123', 10);
  const tomasHash = await bcrypt.hash('tomas123', 10);

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );

  insertUser.run('Nahuel', 'nahuel@profitcode.com', nahuelHash, 'owner');
  insertUser.run('Tomas', 'tomas@profitcode.com', tomasHash, 'owner');

  console.log('Usuarios creados:');
  console.log('  - Nahuel (owner) | email: nahuel@profitcode.com | pass: nahuel123');
  console.log('  - Tomas (owner)  | email: tomas@profitcode.com  | pass: tomas123');
  console.log('\nCambia las contraseñas en produccion!');
}

seed().catch(console.error);
