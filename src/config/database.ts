import { Pool } from "pg";
import { logger } from "../utils/logger";

// Create a new pool instance with connection parameters from environment variables
const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || "postgres",
  database: process.env.POSTGRES_DB || "workflow_automation",
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the database connection
export async function initializeDatabase() {
  try {
    const client = await pool.connect();
    logger.info("Connected to PostgreSQL database");
    client.release();
    return true;
  } catch (error) {
    logger.error("Failed to connect to PostgreSQL database:", error);
    throw error;
  }
}

// Execute a query
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug("Executed query", { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error("Query error", { text, error });
    throw error;
  }
}

// Transaction support
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default { query, withTransaction, initializeDatabase };
