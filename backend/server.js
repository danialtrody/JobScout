import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import jobRoutes from "./routes/job.route.js";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("trust proxy", 1); // trust first proxy


const app = express();
const PORT = process.env.PORT || 3000;



app.use(cors());
app.use(express.json());



const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
});
app.use("/api/jobs", limiter);
app.use("/api/jobs", jobRoutes);

app.use(express.static(path.join(__dirname, "../frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
