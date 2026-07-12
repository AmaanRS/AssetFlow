import convict from "convict";
import dotenv from "dotenv";
dotenv.config();

const config = convict({
  BACKEND_EXPRESS_SERVER_PORT: {
    doc: "The port to bind.",
    format: "port",
    default: 8080,
    env: "BACKEND_EXPRESS_SERVER_PORT",
  },
  DATABASE_URL: {
    doc: "The MySQL database URL.",
    format: String,
    default: null,
    env: "DATABASE_URL",
  },
  JWT_SECRET: {
    doc: "The secret used to sign JWT access tokens.",
    format: String,
    default: "",
    env: "JWT_SECRET",
    sensitive: true,
  },
  JWT_EXPIRES_IN: {
    doc: "The lifetime of a JWT access token.",
    format: String,
    default: "1h",
    env: "JWT_EXPIRES_IN",
  },
  PASSWORD_RESET_TOKEN_TTL_MINUTES: {
    doc: "The lifetime of a password-reset token in minutes.",
    format: "nat",
    default: 15,
    env: "PASSWORD_RESET_TOKEN_TTL_MINUTES",
  },
  PASSWORD_RESET_URL: {
    doc: "The frontend URL used in password-reset emails.",
    format: String,
    default: "",
    env: "PASSWORD_RESET_URL",
  },
  SMTP_HOST: {
    doc: "The Gmail SMTP server host.",
    format: String,
    default: "smtp.gmail.com",
    env: "SMTP_HOST",
  },
  SMTP_PORT: {
    doc: "The SMTP server port.",
    format: "port",
    default: 587,
    env: "SMTP_PORT",
  },
  SMTP_SECURE: {
    doc: "Whether the SMTP connection uses TLS immediately.",
    format: Boolean,
    default: false,
    env: "SMTP_SECURE",
  },
  SMTP_USER: {
    doc: "The Google account email address.",
    format: String,
    default: "",
    env: "SMTP_USER",
  },
  SMTP_PASSWORD: {
    doc: "The Google App Password used for Gmail SMTP.",
    format: String,
    default: "",
    env: "SMTP_PASSWORD",
    sensitive: true,
  },
  SMTP_FROM: {
    doc: "The sender address used for application emails.",
    format: String,
    default: "",
    env: "SMTP_FROM",
  },
});

config.validate({ allowed: "strict" });

export { config };
