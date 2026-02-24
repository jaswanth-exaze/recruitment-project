require("./config/env");
require("./config/db");
const app = require("./app");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
});
