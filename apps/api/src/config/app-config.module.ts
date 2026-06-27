/**
 * AppConfigModule — wraps @nestjs/config with our typed configuration factory.
 *
 * Import this module in AppModule to make ConfigService available globally.
 * TypeScript consumers use ConfigService<AppEnvironment> for type-safe access.
 *
 * Usage in a service:
 *   constructor(private config: ConfigService<AppEnvironment>) {}
 *   const port = this.config.get('PORT', { infer: true }); // number, not string
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      cache: true,
      // In production, environment variables come from the container/ECS
      // task definition, not from .env files. ignoreEnvFile is set to true
      // when NODE_ENV=production to prevent accidental .env file usage.
      ignoreEnvFile: process.env['NODE_ENV'] === 'production',
    }),
  ],
})
export class AppConfigModule {}
