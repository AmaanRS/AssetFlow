import express from "express";
import { readFileSync } from "node:fs";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/config.js";
import { prisma } from "./database/prisma.js";
import { routes } from "./routes/routes.js";

const app = express();
const openApiDocument = JSON.parse(
  readFileSync(new URL("./api-contracts/openapi.json", import.meta.url), "utf8"),
);

const BACKEND_EXPRESS_SERVER_PORT = config.get("BACKEND_EXPRESS_SERVER_PORT");

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.get("/api-contracts/openapi.json", (_request, response) => {
  response.json(openApiDocument);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use("/api", routes);

app.use((_request, response) => {
  response.status(404).json({ message: "Route not found." });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ message: "Internal server error." });
});

const server = app.listen(BACKEND_EXPRESS_SERVER_PORT, (error) => {
  if (error) {
    console.error("Unable to start the server:", error);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Server is running at http://localhost:${BACKEND_EXPRESS_SERVER_PORT}`,
  );
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export { app };
