import express from 'express';
import cors from 'cors';
import jobRoutes from "./routes/job.route.js";
import rateLimit from 'express-rate-limit';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;


app.use(express.static(path.join(__dirname, "../frontend/build")));

app.use(cors());
app.use(express.json());


const limiter = rateLimit({
  windowMs: 60 * 1000, // דקה אחת
  max: 5, // עד 5 בקשות לדקה
});
app.use("/api/jobs", limiter);

app.use("/api/jobs", jobRoutes);


app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
