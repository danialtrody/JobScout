import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import jobRoutes from "./routes/job.route.js";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiter על /api/jobs
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 דקה
  max: 5,              // עד 5 בקשות בדקה
});
app.use("/api/jobs", limiter);

// Routes
app.use("/api/jobs", jobRoutes);

// Serve React build
app.use(express.static(path.join(__dirname, "frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/build", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
