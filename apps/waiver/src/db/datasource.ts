import "reflect-metadata";

import path from "node:path";
import { ConfigService } from "@nestjs/config";
import dotenv from "dotenv";
import { DataSource } from "typeorm";

import { Customer } from "../customers/customer.entity";

dotenv.config();

const config = new ConfigService();

// Used by the TypeORM CLI (migration:* scripts) against compiled dist/.
export default new DataSource({
  type: "postgres",
  synchronize: false,
  logging: ["error", "warn", "migration"],
  url: config.getOrThrow("DATABASE_URL"),
  entities: [Customer],
  migrations: [path.join(__dirname, "./migrations/*.js")],
});
