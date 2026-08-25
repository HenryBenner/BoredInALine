import pool from '../config/database';
import fs from 'fs';
import path from 'path';

export async function runMigrations(): Promise<void> {
  // In production (dist/), SQL files are copied alongside JS by the build script.
  // In development (tsx), __dirname points to src/db/ directly.
  const candidatePaths = [
    path.join(__dirname, 'migrations'),
    path.join(process.cwd(), 'src', 'db', 'migrations'),
  ];

  const migrationsDir = candidatePaths.find((p) => fs.existsSync(p));
  if (!migrationsDir) {
    console.warn('Migrations directory not found, skipping migrations. Checked:', candidatePaths);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await pool.query(sql);
      console.log(`Migration applied: ${file}`);
    } catch (err) {
      console.error(`Migration failed: ${file}`, err);
      throw err;
    }
  }
}
