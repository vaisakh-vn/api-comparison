# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Educational project comparing REST, GraphQL, and gRPC side-by-side using the same domain (a library of books and authors). All three implementations share the same in-memory data from `shared/data.ts` so differences are purely in the API layer.

## Setup

```bash
npm install
```

## Running the Servers

Each API runs on a different port — open three terminals:

```bash
npm run rest      # Express REST API   →  http://localhost:3001
npm run graphql   # Apollo GraphQL     →  http://localhost:4000  (Sandbox UI at that URL)
npm run grpc      # gRPC server        →  localhost:50051
```

Or run all three with Docker:

```bash
docker compose up --build       # start all three servers
docker compose up rest graphql  # start a subset
docker compose down             # stop and remove containers
```

## Running the Demos

Each demo requires its corresponding server to already be running, then run from the host:

```bash
npm run demo:rest      # Shows over-fetching and under-fetching
npm run demo:graphql   # Shows one-query solution to the same problem
npm run demo:grpc      # Shows streaming and binary protocol
```

## Architecture

```
shared/               ← shared types (types.ts) and in-memory data store (data.ts)
rest/server.ts        ← Express server, port 3001
graphql/server.ts     ← Apollo Server, port 4000
grpc/
  proto/library.proto ← contract, message definitions, and service methods
  server.ts           ← gRPC server, port 50051
demos/                ← standalone scripts that call each API and explain the output
```

No database — data lives in module-level arrays and resets on server restart.

## Key Concepts Per Implementation

**REST** (`rest/server.ts`): The educational moments are at `GET /books` (over-fetching — all fields always returned) and `GET /books/:id` (under-fetching — `authorId` present but no author object, requires a second call to `GET /authors/:id`). The demo drives three chained requests for data that GraphQL returns in one.

**GraphQL** (`graphql/server.ts`): The `typeDefs` SDL is the client-server contract. Field resolvers on `Book.author` and `Book.reviews` only execute when the client's query includes those fields — not otherwise. The `averageRating` resolver computes on demand. The demo shows the same three-request REST pattern collapsed into a single query.

**gRPC** (`grpc/`): The `.proto` file is the single source of truth — it defines both the schema and the wire format (Protocol Buffers). Field numbers in the proto (e.g. `= 1`, `= 2`) must never be reused or removed — doing so breaks backward compatibility. The `stream` keyword on `ListBooks` and `WatchNewBooks` enables server-side streaming, which is the key capability REST and basic GraphQL lack. The demo illustrates typed error codes (`grpc.status.NOT_FOUND`) vs HTTP status codes, and shows streaming in action.

## When to use each (the summary the demos build toward)

| | REST | GraphQL | gRPC |
|---|---|---|---|
| **Best for** | Public APIs, simple CRUD | Complex/nested data, mobile clients | Internal microservices, streaming, polyglot |
| **Schema** | None (or OpenAPI) | SDL (built-in) | .proto (built-in) |
| **Transport** | HTTP/1.1 + JSON | HTTP/1.1 + JSON | HTTP/2 + Protocol Buffers |
| **Browser support** | Native | Native | Needs gRPC-Web proxy |
| **Streaming** | No | Subscriptions only | Built-in (4 patterns) |
