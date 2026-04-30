const path = require("path");
const express = require("express");
const { Resend } = require("resend");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

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

function requireEnvTrimmed(name) {
  return String(requireEnv(name)).trim();
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

let resendClient;
function getResendClient() {
  if (resendClient) return resendClient;
  const apiKey = requireEnvTrimmed("RESEND_API_KEY");
  resendClient = new Resend(apiKey);
  return resendClient;
}

app.post("/api/contact", async (req, res) => {
  try {
    const toEmail = requireEnvTrimmed("CONTACT_TO_EMAIL");
    const fromRaw = sanitize(process.env.CONTACT_FROM_EMAIL);
    const fromEmail = fromRaw || "onboarding@resend.dev";
    const result = validatePayload(req.body);

    if (!result.valid) {
      return res.status(400).json({ ok: false, message: result.error });
    }

    const { name, email, company, projectType, budget, message } = result.data;
    const resend = getResendClient();

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

    const sendResult = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject,
      text,
      html
    });

    if (sendResult.error) {
      throw new Error(sendResult.error.message || "Resend API request failed.");
    }

    return res.json({ ok: true, message: "Message sent successfully." });
  } catch (error) {
    // Log enough detail for production debugging without exposing secrets.
    // eslint-disable-next-line no-console
    console.error("Contact API error:", {
      message: error?.message || "Unknown error",
      code: error?.code || null,
      responseCode: error?.responseCode || null,
      command: error?.command || null
    });
    const errorMessage = error?.message || "Unknown error";
    return res.status(500).json({
      ok: false,
      message: errorMessage,
      error: errorMessage
    });
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
