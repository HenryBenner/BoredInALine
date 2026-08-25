import bcrypt from 'bcryptjs';
import pool from '../config/database';

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Bored in Line Admin';

  if (!email || !password) {
    console.error('Error: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars are required.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO super_admins (email, password, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, name`,
    [email, hash, name]
  );

  if (result.rows.length > 0) {
    console.log('Super admin seeded:', result.rows[0].email);
  } else {
    console.log('Super admin already exists:', email);
  }

  await pool.end();
}

seedSuperAdmin().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
