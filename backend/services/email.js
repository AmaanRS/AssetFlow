import nodemailer from "nodemailer";
import { config } from "../config/config.js";

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = config.get("SMTP_HOST");
  const resetUrl = config.get("PASSWORD_RESET_URL");
  const user = config.get("SMTP_USER");
  const password = config.get("SMTP_PASSWORD");
  const from = config.get("SMTP_FROM") || user;
  const secure = config.get("SMTP_SECURE");

  if (!host || !from || !resetUrl || !user || !password) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: config.get("SMTP_PORT"),
    secure,
    ...(!secure ? { requireTLS: true } : {}),
    ...(user && password
      ? {
          auth: {
            user,
            pass: password,
          },
        }
      : {}),
  });

  return transporter;
}

async function sendPasswordResetEmail({ email, name, token }) {
  const mailer = getTransporter();

  if (!mailer) {
    return false;
  }

  const resetUrl = new URL(config.get("PASSWORD_RESET_URL"));
  resetUrl.searchParams.set("token", token);

  await mailer.sendMail({
    from: config.get("SMTP_FROM") || config.get("SMTP_USER"),
    to: email,
    subject: "Reset your AssetFlow password",
    text: `Hello ${name},\n\nReset your AssetFlow password using this link:\n${resetUrl.toString()}\n\nThis link expires soon. If you did not request it, you can ignore this email.`,
  });

  return true;
}

export { sendPasswordResetEmail };
