import express from "express";
import cors from "cors";
import morgan from "morgan";
import "dotenv/config";

import authRoutes from "./routes/auth.routes.js";
import desksRoutes from "./routes/desks.routes.js";
import usersRoutes from "./routes/users.routes.js";
import pushRoutes from "./routes/push.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import settingsRoutes from "./routes/settings.routes.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/desks", desksRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api", settingsRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler (in case anything throws outside try/catch)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`JoinDesk backend running on http://localhost:${PORT}`);
});
