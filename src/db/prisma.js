const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma");

// pg.Pool + PrismaPg adapter — lazy connection (no actual DB call until first query).
// Tests that mock the repository never trigger a real connection.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

module.exports = new PrismaClient({ adapter });
