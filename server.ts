import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";

import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import crypto from 'crypto';

const rpName = 'Quantum Credentials Vault';
const rpID = process.env.NODE_ENV === 'production' ? new URL(process.env.APP_URL || 'https://example.com').hostname : 'localhost';
const origin = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

// Ensure a valid connection string structure is passed to Prisma to prevent initialization crashes
const dbUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres")
  ? process.env.DATABASE_URL
  : "postgresql://dummy:dummy@localhost:5432/qcv";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
const JWT_SECRET = process.env.JWT_SECRET || "quantum_vault_super_secret_key_change_in_production";

async function seedCreatorAccount() {
  try {
    const email = 'shaoncmd@gmail.com';
    const password = 'BadSoul@1989';
    await prisma.$queryRaw`SELECT 1`; // Test conn
    const existing = await prisma.user.findUnique({ where: { email } });
    const hashedPassword = await bcrypt.hash(password, 10);
    
    if (!existing) {
      await prisma.user.create({ data: { email, password: hashedPassword, role: 'admin' } });
      console.log('✅ Default Creator Account seeded successfully (shaoncmd@gmail.com)');
    } else {
      await prisma.user.update({ where: { email }, data: { password: hashedPassword, role: 'admin' } });
      console.log('✅ Default Creator Account synced.');
    }
  } catch (err: any) {
     if (err.message.includes('Can\'t reach database server')) {
       console.log('⚠️ Creator Account Seed Skipped: Database not connected.');
     }
  }
}

const app = express();

export default app;

const PORT = 3000;

seedCreatorAccount();

app.use(express.json());
app.use(cookieParser());

  // --- API ROUTES ---

  // Database check middleware
  app.use("/api", async (req, res, next) => {
    try {
      await prisma.$connect();
      next();
    } catch (e: any) {
      if (e.message.includes("does not exist") || e.message.includes("connect")) {
        console.error("Database connection error:", e);
        return res.status(500).json({ error: "Database setup required. Please configure DATABASE_URL in .env." });
      }
      next(e);
    }
  });

  // Auth Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    const token = req.cookies.qcv_session;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) return res.status(400).json({ error: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, password: hashedPassword }
      });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie("qcv_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
      res.json({ success: true, user: { id: user.id, email: user.email } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie("qcv_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
      res.json({ success: true, user: { id: user.id, email: user.email } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.clearCookie("qcv_session");
    res.json({ success: true });
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, role: true } });
    res.json({ user });
  });

  // --- MAGIC LINK & BIOMETRICS ---
  
  app.post("/api/auth/magic-link", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const token = require("crypto").randomBytes(32).toString("hex");
      await prisma.magicLink.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
        }
      });
      
      // In production, send via SendGrid/AWS SES. Here we print for DEV MODE.
      const magicLinkUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login?magic_token=${token}`;
      console.log(`\n\n=== [DEV MODE] MAGIC LINK FOR ${email} ===\n${magicLinkUrl}\n==========================================\n`);

      res.json({ success: true, message: "Check DEV console for magic link" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/magic-login", async (req, res) => {
    try {
      const { token } = req.body;
      const link = await prisma.magicLink.findUnique({ where: { token }, include: { user: true } });
      
      if (!link || link.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired magic link" });
      }

      await prisma.magicLink.delete({ where: { id: link.id } }); // One-time use

      const sessionToken = jwt.sign({ id: link.user.id, email: link.user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie("qcv_session", sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
      res.json({ success: true, user: { id: link.user.id, email: link.user.email } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
       const { email, newPassword } = req.body;
       const user = await prisma.user.findUnique({ where: { email } });
       if (!user) return res.status(404).json({ error: "User not found" });

       const hashedPassword = await bcrypt.hash(newPassword, 10);
       await prisma.user.update({ where: { email }, data: { password: hashedPassword } });

       res.json({ success: true, message: "Master password reset successfully. Vault items locked with old key will be inaccessible." });
    } catch (e: any) {
       res.status(500).json({ error: e.message });
    }
  });

  // --- WEBAUTHN ---
  
  app.post('/api/auth/webauthn/register-options', requireAuth, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { authenticators: true } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new Uint8Array(Buffer.from(user.id)),
        userName: user.email,
        attestationType: 'none',
        excludeCredentials: user.authenticators.map((auth: any) => ({
          id: auth.credentialID,
          type: 'public-key',
        })),
      });

      // Save challenge in session (using DB or memory, simple cache for prototype)
      app.locals[`challenge_${req.user.id}`] = options.challenge;
      res.json(options);
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/auth/webauthn/register-verify', requireAuth, async (req: any, res) => {
    try {
      const body = req.body;
      const expectedChallenge = app.locals[`challenge_${req.user.id}`];

      const verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        
        await prisma.authenticator.create({
          data: {
            credentialID: credential.id,
            credentialPublicKey: Buffer.from(credential.publicKey),
            counter: 0,
            credentialDeviceType,
            credentialBackedUp,
            userId: req.user.id,
            transports: body.response.transports ? body.response.transports.join(',') : '',
          }
        });
        
        delete app.locals[`challenge_${req.user.id}`];
        res.json({ verified: true });
      } else {
        res.status(400).json({ error: 'Verification failed' });
      }
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/auth/webauthn/auth-options', async (req: any, res) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email }, include: { authenticators: true } });
      if (!user || user.authenticators.length === 0) return res.status(404).json({ error: "No authenticators registered" });

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: user.authenticators.map((auth: any) => ({
          id: auth.credentialID,
          type: 'public-key',
        })),
        userVerification: 'preferred',
      });

      app.locals[`challenge_${email}`] = options.challenge;
      res.json(options);
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/auth/webauthn/auth-verify', async (req: any, res) => {
    try {
      const { email, body } = req.body;
      const user = await prisma.user.findUnique({ where: { email }, include: { authenticators: true } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const expectedChallenge = app.locals[`challenge_${email}`];
      
      const authenticator = user.authenticators.find(
        (a: any) => a.credentialID === body.id
      );

      if (!authenticator) return res.status(400).json({ error: "Authenticator not found" });

      const verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: authenticator.credentialID,
          publicKey: new Uint8Array(authenticator.credentialPublicKey),
          counter: authenticator.counter,
        },
      });

      if (verification.verified) {
        await prisma.authenticator.update({
          where: { credentialID: authenticator.credentialID },
          data: { counter: verification.authenticationInfo.newCounter }
        });
        
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie("qcv_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
        delete app.locals[`challenge_${email}`];
        res.json({ verified: true, user: { id: user.id, email: user.email } });
      } else {
        res.status(400).json({ error: "Verification failed" });
      }
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  // Vault API
  app.get("/api/vault", requireAuth, async (req: any, res) => {
    const vaults = await prisma.vault.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json({ vaults });
  });

  app.post("/api/vault", requireAuth, async (req: any, res) => {
    try {
      const { title, category, tags, encryptedData } = req.body;
      const vault = await prisma.vault.create({
        data: { userId: req.user.id, title, category, tags, encryptedData }
      });
      res.json({ vault });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/vault/:id", requireAuth, async (req: any, res) => {
    try {
      const { title, category, tags, encryptedData } = req.body;
      
      // Ensure user owns item before updating
      const existing = await prisma.vault.findFirst({ where: { id: req.params.id, userId: req.user.id }});
      if (!existing) return res.status(404).json({ error: "Item not found" });

      const vault = await prisma.vault.update({
        where: { id: req.params.id },
        data: { title, category, tags, encryptedData }
      });
      res.json({ vault });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/vault/:id", requireAuth, async (req: any, res) => {
    try {
      await prisma.vault.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- ADMIN / CREATOR PANEL API ---
  app.get("/api/admin/users", requireAuth, async (req: any, res) => {
    try {
      const u = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (u?.role !== 'admin') return res.status(403).json({ error: "Access denied" });
      const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true, subscriptionPlan: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ users });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/admin/users/:id", requireAuth, async (req: any, res) => {
    try {
      const u = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (u?.role !== 'admin') return res.status(403).json({ error: "Access denied" });
      const { role, subscriptionPlan } = req.body;
      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { role, subscriptionPlan }
      });
      res.json({ success: true, user: updated });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/admin/users/:id", requireAuth, async (req: any, res) => {
    try {
      const u = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (u?.role !== 'admin') return res.status(403).json({ error: "Access denied" });
      if (req.user.id === req.params.id) return res.status(400).json({ error: "Cannot delete self" });
      await prisma.user.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/metrics", requireAuth, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.role !== 'admin') return res.status(403).json({ error: "Access denied" });
      
      const totalUsers = await prisma.user.count();
      const totalVaults = await prisma.vault.count();
      
      const userPlans = await prisma.user.groupBy({
        by: ['subscriptionPlan'],
        _count: { id: true }
      });
      
      const recentLogs = await prisma.auditLog.findMany({
        take: 20,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { email: true } } }
      });

      res.json({ totalUsers, totalVaults, userPlans, recentLogs });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/admin/plans", requireAuth, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user?.role !== 'admin') return res.status(403).json({ error: "Access denied" });
      // Stub to allow updating plans on specific users, or configuring feature flags.
      res.json({ success: true, message: "Plans updated" });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- SUBSCRIPTIONS ---
  app.post("/api/billing/upgrade", requireAuth, async (req: any, res) => {
    try {
      const { plan } = req.body;
      const validPlans = ['free', 'pro', 'team', 'enterprise'];
      if (!validPlans.includes(plan)) return res.status(400).json({ error: "Invalid plan" });

      await prisma.user.update({
        where: { id: req.user.id },
        data: { subscriptionPlan: plan }
      });
      await prisma.auditLog.create({
        data: { userId: req.user.id, action: `Upgraded to ${plan} plan`, ip: req.ip }
      });

      res.json({ success: true, plan });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
  });

  // Global Error Handler for API
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // --- VITE MIDDLEWARE / STATIC ---
  if (!process.env.VERCEL) {
    (async () => {
      if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }

      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })();
  }
