import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

// The waiver bot is a standalone long-polling service — no HTTP server.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();

  new Logger("Bootstrap").log("Waiver bot is running");
}

void bootstrap();
