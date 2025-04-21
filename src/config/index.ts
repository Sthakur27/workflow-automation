// src/config/index.ts
import dotenv from "dotenv";
dotenv.config();

export const config = {
  db: {
    host: process.env.POSTGRES_HOST!,
    user: process.env.POSTGRES_USER!,
    password: process.env.POSTGRES_PASSWORD!,
    database: process.env.POSTGRES_DB!,
    port: Number(process.env.POSTGRES_PORT || 5432),
  },
  port: process.env.PORT || 3000,
};
