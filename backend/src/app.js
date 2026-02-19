const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const db = require("./config/db");
const app = express();
const authRoutes = require("./routes/auth.routes");

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
module.exports = app;










// app.get("/", (req, res) => {

//   const sql = `SELECT * FROM users`;
//   db.query(sql, (err, results) => {
//     if (err) {
//       console.error("Error fetching users:", err);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }
//     res.json(results);
//   });
// });
