import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  app.delete("/api/vault/:id", requireAuth, async (req: any, res) => {
    try {
      await prisma.vault.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Global Error Handler for API
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // --- VITE MIDDLEWARE / STATIC ---
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
}

startServer();
