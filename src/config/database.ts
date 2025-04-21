import { Pool } from "pg";
import { logger } from "../utils/logger";

// Initialize environment variables
import { config } from "./index";
// Create a new pool instance with connection parameters from environment variables
const pool = new Pool(config.db);

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

// Export the pool directly
export { pool };

export default { query, withTransaction, initializeDatabase };
