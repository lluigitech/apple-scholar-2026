const nodemailer = require('nodemailer');
const { URL } = require('url');
const http = require('http');
const https = require('https');
const db = require('../config/db');

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465, // true for 465, false for other ports
    auth: { user, pass },
  });
};

exports.getStatus = async (req, res) => {
  try {
    const transporter = getTransporter();
    let gmailStatus = 'Not configured';
    if (transporter) {
      try {
        await transporter.verify();
        gmailStatus = 'Connected';
      } catch (err) {
        gmailStatus = 'Disconnected';
      }
    }

    const webhookUrl = process.env.MESSENGER_WEBHOOK_URL;
    let messengerStatus = webhookUrl ? 'Configured' : 'Not configured';
    if (webhookUrl) {
      try {
        const parsed = new URL(webhookUrl);
        const lib = parsed.protocol === 'https:' ? https : http;
        const opts = {
          method: 'HEAD',
          hostname: parsed.hostname,
          path: parsed.pathname + (parsed.search || ''),
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          timeout: 3000,
        };
        await new Promise((resolve, reject) => {
          const req = lib.request(opts, (resp) => {
            // treat any 2xx/3xx/4xx as reachable; only network errors mean unreachable
            messengerStatus = 'Connected';
            resp.resume();
            resolve();
          });
          req.on('error', () => {
            messengerStatus = 'Disconnected';
            resolve();
          });
          req.on('timeout', () => {
            req.destroy();
            messengerStatus = 'Disconnected';
            resolve();
          });
          req.end();
        });
      } catch (e) {
        messengerStatus = 'Disconnected';
      }
    }

    res.json({ gmail: gmailStatus, messenger: messengerStatus });
  } catch (err) {
    console.error('notification status error', err);
    res.status(500).json({ error: 'Failed to determine notification status' });
  }
};

exports.testGmail = async (req, res) => {
  try {
    const transporter = getTransporter();
    const to = req.body?.email || process.env.TEST_EMAIL;
    if (!transporter) return res.status(400).json({ error: 'SMTP not configured' });
    if (!to) return res.status(400).json({ error: 'No recipient configured for test email' });

    const cfg = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      secure: Number(process.env.SMTP_PORT) === 465,
    };

    let verifyOk = false;
    let verifyError = null;
    try {
      await transporter.verify();
      verifyOk = true;
    } catch (vErr) {
      verifyError = String(vErr);
    }

    let sendInfo = null;
    let sendError = null;
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'Kalinga Scholar — Test Email',
        text: 'This is a test message from Kalinga Scholar notification system.',
      });
      sendInfo = info.messageId || info.response || info;
    } catch (sErr) {
      sendError = String(sErr);
    }

    const ok = verifyOk && !sendError;
    const result = { ok, transporter: cfg, verify: { ok: verifyOk, error: verifyError }, send: { info: sendInfo, error: sendError } };
    if (!ok) console.error('testGmail diagnostics', result);
    return res.json(result);
  } catch (err) {
    console.error('testGmail unexpected error', err);
    return res.status(500).json({ error: 'Unexpected error', detail: String(err) });
  }
};

exports.testMessenger = async (req, res) => {
  try {
    const webhookUrl = process.env.MESSENGER_WEBHOOK_URL || req.body?.url;
    if (!webhookUrl) return res.status(400).json({ ok: false, error: 'No webhook URL configured' });

    let parsed;
    try {
      parsed = new URL(webhookUrl);
    } catch (urlErr) {
      return res.status(400).json({ ok: false, error: 'Invalid webhook URL', detail: String(urlErr) });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ ok: false, error: 'Webhook URL must use http or https' });
    }

    const isPlaceholder = /hooks\.example\.com|your-webhook|example\.com/i.test(webhookUrl);
    if (isPlaceholder) {
      return res.status(400).json({ ok: false, error: 'Webhook URL is still a placeholder. Configure a real endpoint before testing.' });
    }

    const lib = parsed.protocol === 'https:' ? https : http;

    const payload = JSON.stringify({ text: 'Kalinga Scholar — test message' });
    const opts = {
      method: 'POST',
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 5000,
    };

    await new Promise((resolve, reject) => {
      const r = lib.request(opts, (resp) => {
        let body = '';
        resp.on('data', (c) => (body += c));
        resp.on('end', () => resolve({ status: resp.statusCode, body }));
      });
      r.on('error', (e) => reject(e));
      r.on('timeout', () => {
        r.destroy();
        reject(new Error('timeout'));
      });
      r.write(payload);
      r.end();
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('testMessenger error', err);
    res.status(502).json({ ok: false, error: 'Failed to call messenger webhook', detail: String(err) });
  }
};

// GET recent notification logs (admin)
exports.getLogs = (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const sql = `SELECT id, scholar_id, recipient, channel, type, status, detail, created_at FROM notification_logs ORDER BY created_at DESC LIMIT ?`;
    db.query(sql, [limit], (err, rows) => {
      if (err) {
        console.error('Failed to fetch administrator notification logs:', err);
        return res.status(500).json({ error: 'Failed to fetch logs' });
      }
      res.json(rows);
    });
  } catch (e) {
    console.error('getLogs error', e);
    res.status(500).json({ error: 'Unexpected error' });
  }
};
