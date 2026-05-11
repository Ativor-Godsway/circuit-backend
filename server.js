import dotenv from "dotenv";
dotenv.config();

import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import connectDB from "./config/db.js";
import { initSocket } from "./socket/socket.js";
import { startCronJobs } from "./utils/cronJobs.js";

// Route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import communityRoutes from "./routes/communities.js";
import messageRoutes from "./routes/messages.js";
import companyRoutes from "./routes/companies.js";
import opportunityRoutes from "./routes/opportunities.js";
import recruiterRoutes from "./routes/recruiters.js";
import onboardingRoutes from "./routes/onboarding.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

const app = express();
const httpServer = createServer(app);

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io accessible in route handlers via req.app.get('io')
app.set("io", io);

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "7d",
  etag: true,
  lastModified: true,
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/communities", communityRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/recruiters", recruiterRoutes);
app.use("/api/onboarding", onboardingRoutes);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Initialize Socket.io handlers
initSocket(io);

// Start cron jobs
startCronJobs();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
