import convict from "convict";
import dotenv from "dotenv";
dotenv.config();

const config = convict({
  BACKEND_EXPRESS_SERVER_PORT: {
    doc: "The port to bind.",
    format: "port",
    default: 8080,
    env: "BACKEND_EXPRESS_SERVER_PORT",
    arg: "port",
  },
});

config.validate({ allowed: "strict" });

export { config };
