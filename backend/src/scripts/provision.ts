import 'dotenv/config';
import { randomBytes, createHash } from 'node:crypto';
import prisma from '../integrations/client.js';

const name = process.argv[2];
const timezone = process.argv[3] ?? 'UTC';
if (!name?.trim()) throw new Error('Usage: npm run provision -- "Business name" "Europe/Berlin"');
new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
const token = randomBytes(32).toString('hex');
try {
  const business = await prisma.integrationBusiness.create({ data: { name, timezone, apiKeyHash: createHash('sha256').update(token).digest('hex') } });
  console.log(`Provisioned ${business.name}. Keep this admin token private; it is shown once:\n${token}`);
} finally { await prisma.$disconnect(); }
