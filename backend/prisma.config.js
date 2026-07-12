import { defineConfig } from "prisma/config";
import { config as appConfig } from "./config/config.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: appConfig.get("DATABASE_URL"),
  },
});
