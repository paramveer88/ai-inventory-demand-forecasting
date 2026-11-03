import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';

// Experimental connection data can live separately from the existing ERP.
// The quickstart always provisions this separate database; it never migrates
// the user's original configured database.
const url = process.env.INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const options: Prisma.PrismaClientOptions = {};
if (url) options.datasources = { db: { url } };
const integrationPrisma = new PrismaClient(options);
export default integrationPrisma;
