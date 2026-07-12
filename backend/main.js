import express from "express";
import { config } from "./config/config.js";

const app = express();

const BACKEND_EXPRESS_SERVER_PORT = config.get("BACKEND_EXPRESS_SERVER_PORT");

app.use()

app.listen(BACKEND_EXPRESS_SERVER_PORT, () => {
  console.log(
    `Server is running at http://localhost:${BACKEND_EXPRESS_SERVER_PORT}`,
  );
});
