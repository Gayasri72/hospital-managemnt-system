const { execSync } = require('child_process');

// Dynamically generate DIRECT_URL from DATABASE_URL if missing
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL.replace('-pooler', '');
  console.log('Successfully injected DIRECT_URL for Prisma migrations.');
}

try {
  console.log('Running: npx prisma generate');
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log('Running: npx prisma migrate deploy');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  console.log('Running: npx prisma db seed');
  execSync('npx prisma db seed', { stdio: 'inherit' });

  console.log('Running: tsc -p tsconfig.json');
  execSync('npx tsc -p tsconfig.json', { stdio: 'inherit' });
} catch (error) {
  console.error('Vercel build failed.');
  process.exit(1);
}
