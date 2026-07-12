import nodemailer from "nodemailer";
import { config } from "../config/config.js";

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = config.get("SMTP_HOST");
  const from = config.get("SMTP_FROM");
  const resetUrl = config.get("PASSWORD_RESET_URL");

  if (!host || !from || !resetUrl) {
    return null;
  }

  const user = config.get("SMTP_USER");
  const password = config.get("SMTP_PASSWORD");

  transporter = nodemailer.createTransport({
    host,
    port: config.get("SMTP_PORT"),
    secure: config.get("SMTP_SECURE"),
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
    from: config.get("SMTP_FROM"),
    to: email,
    subject: "Reset your AssetFlow password",
    text: `Hello ${name},\n\nReset your AssetFlow password using this link:\n${resetUrl.toString()}\n\nThis link expires soon. If you did not request it, you can ignore this email.`,
  });

  return true;
}

export { sendPasswordResetEmail };
