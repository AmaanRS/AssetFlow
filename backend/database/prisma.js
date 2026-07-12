import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/config.js";

const adapter = new PrismaMariaDb(config.get("DATABASE_URL"));
const prisma = new PrismaClient({ adapter });

export { prisma };
