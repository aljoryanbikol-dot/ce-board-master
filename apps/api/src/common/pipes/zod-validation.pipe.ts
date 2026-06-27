/**
 * ZodValidationPipe — Validates and transforms request data using Zod schemas.
 *
 * Architecture decision (ADR-008):
 * We use Zod for validation rather than class-validator because:
 * 1. Zod schemas are co-located with the DTO types (no separate class + decorator chaos)
 * 2. Zod types are automatically inferred — no manual type duplication
 * 3. Zod schemas are easily shared between frontend and backend via packages/types
 * 4. Better TypeScript integration and error messages
 *
 * Usage in controllers:
 * @Body(new ZodValidationPipe(RegisterDto)) body: RegisterDtoType
 *
 * Or globally for all body/query/param DTOs:
 * app.useGlobalPipes(new ZodValidationPipe())
 *
 * ZodError is caught by GlobalExceptionFilter and converted to 422 responses.
 *
 * @see common/filters/global-exception.filter.ts
 */
import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T = unknown> implements PipeTransform {
  constructor(private readonly schema?: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T | unknown {
    if (!this.schema) {
      // Without a schema, pass through (used when schema is on the DTO class)
      return value;
    }

    // parse() throws ZodError which GlobalExceptionFilter converts to 422
    return this.schema.parse(value);
  }
}
