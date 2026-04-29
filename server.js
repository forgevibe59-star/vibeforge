const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sanitize(value) {
  return String(value || "").trim();
}

function validatePayload(payload) {
  const name = sanitize(payload.name);
  const email = sanitize(payload.email);
  const projectType = sanitize(payload.projectType);
  const company = sanitize(payload.company) || "Not provided";
  const budget = sanitize(payload.budget) || "Not provided";
  const message = sanitize(payload.message);

  if (!name || !email || !projectType || !message) {
    return { valid: false, error: "Missing required fields." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email address." };
  }

  return {
    valid: true,
    data: { name, email, company, projectType, budget, message }
  };
}

let mailer;
function getMailer() {
  if (mailer) return mailer;

  const host = requireEnv("SMTP_HOST");
  const port = Number(requireEnv("SMTP_PORT"));
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");

  mailer = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return mailer;
}

app.post("/api/contact", async (req, res) => {
  try {
    const toEmail = requireEnv("CONTACT_TO_EMAIL");
    const fromEmail = requireEnv("CONTACT_FROM_EMAIL");
    const result = validatePayload(req.body);

    if (!result.valid) {
      return res.status(400).json({ ok: false, message: result.error });
    }

    const { name, email, company, projectType, budget, message } = result.data;
    const transporter = getMailer();

    const subject = `New VibeForge enquiry from ${name}`;
    const text = [
      "New contact form submission:",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company}`,
      `Project Type: ${projectType}`,
      `Estimated Budget: ${budget}`,
      "",
      "Project Brief:",
      message
    ].join("\n");

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Project Type:</strong> ${projectType}</p>
      <p><strong>Estimated Budget:</strong> ${budget}</p>
      <p><strong>Project Brief:</strong></p>
      <p>${message.replace(/\n/g, "<br />")}</p>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject,
      text,
      html
    });

    return res.json({ ok: true, message: "Message sent successfully." });
  } catch (error) {
    // Avoid leaking secrets in responses.
    return res.status(500).json({ ok: false, message: "Failed to send message." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "vibeforge.html"));
});

app.get("/logo.png", (_req, res) => {
  res.sendFile(path.join(__dirname, "logo.png"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`VibeForge server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
