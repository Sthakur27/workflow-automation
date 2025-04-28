import express from "express";
import dotenv from "dotenv";
import { logger } from "./utils/logger";
import routes from "./api/routes";
import { initializeDatabase } from "./config/database";

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database connection
    await initializeDatabase();

    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

export default app;
