import express from 'express';
import cors from 'cors';
import jobRoutes from "./routes/job.route.js";
import rateLimit from 'express-rate-limit';


const app = express();
const PORT = 3000;


// Middleware
app.use(cors());
app.use(express.json());


const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 דקה
  max: 5, // עד 5 בקשות לדקה
});
app.use("/api/jobs", limiter);


app.use("/api/jobs",jobRoutes)



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
