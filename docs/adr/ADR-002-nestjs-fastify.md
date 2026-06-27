# ADR-002: NestJS with Fastify Adapter

**Status:** Accepted  
**Date:** 2026-06-25  

## Decision

Use NestJS 10 with the Fastify HTTP adapter instead of the default Express adapter.

## Rationale

- Fastify provides ~2x throughput vs Express under load testing
- Critical for mock exam sessions with concurrent answer submissions
- NestJS abstracts the HTTP layer — swap requires changing only the adapter
- Pino logger is native to Fastify (JSON structured logging with no overhead)

## Consequences

- Some Express-specific middleware (body-parser, morgan) not compatible
- Must use `@fastify/helmet` instead of `helmet` (Express version)
- `app.getHttpAdapter()` returns FastifyAdapter, not ExpressAdapter
