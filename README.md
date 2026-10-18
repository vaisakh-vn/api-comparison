# REST vs GraphQL vs gRPC

A hands-on comparison of three API paradigms built over the same domain — a library of books and authors. Run the demos to see the differences live, and use the visual flows and deep-dives below to prepare for interviews.

---

## Table of Contents

1. [Project setup & running](#setup)
2. [Architecture overview](#architecture)
3. [REST — how it works](#rest)
4. [GraphQL — how it works](#graphql)
5. [gRPC — how it works](#grpc)
6. [Side-by-side comparison](#comparison)
7. [Interview quick-reference](#interview)

---

## Setup <a name="setup"></a>

### With Docker (no Node.js needed)

```bash
# Build and start all three servers in the background
docker compose up --build -d

# Run a demo (servers must be up first)
docker compose run --rm demo-rest
docker compose run --rm demo-graphql
docker compose run --rm demo-grpc

# Start only specific servers
docker compose up -d rest graphql

# Stop everything
docker compose down
```

### Locally (Node.js 18+ required)

```bash
npm install
```

Open three separate terminals:

```bash
npm run rest        # → http://localhost:3001
npm run graphql     # → http://localhost:4000
npm run grpc        # → localhost:50051
```

Run demos from a fourth terminal (servers must be running):

```bash
npm run demo:rest
npm run demo:graphql
npm run demo:grpc
```

---

## Architecture overview <a name="architecture"></a>

All three servers share the same in-memory data from `shared/`. No database — data resets on server restart.

```mermaid
graph TD
    subgraph Project
        SD[(shared/data.ts\nbooks · authors · reviews)]

        REST[REST Server\nExpress · port 3001]
        GQL[GraphQL Server\nApollo · port 4000]
        GRPC[gRPC Server\nport 50051]

        SD --> REST
        SD --> GQL
        SD --> GRPC
    end

    C1[REST Client\ncurl / browser] -->|HTTP/1.1 · JSON| REST
    C2[GraphQL Client\nbrowser / Apollo Sandbox] -->|HTTP/1.1 · JSON| GQL
    C3[gRPC Client\ngrpcurl / demo script] -->|HTTP/2 · Protobuf| GRPC
```

```
shared/               shared types and in-memory data
rest/server.ts        Express — port 3001
graphql/server.ts     Apollo Server — port 4000
grpc/
  proto/library.proto service contract and message definitions
  server.ts           gRPC server — port 50051
demos/                runnable scripts that call each API and explain the output
```

---

## REST — how it works <a name="rest"></a>

### Core idea

REST (Representational State Transfer) is an architectural style proposed by Roy Fielding in 2000. It models an API as a set of **resources**, each with its own URL, interacted with through standard HTTP verbs.

```
GET    /books          → list all books
GET    /books/1        → get one book
POST   /books          → create a book
PUT    /books/1        → replace a book
PATCH  /books/1        → partially update a book
DELETE /books/1        → delete a book
```

### Request / response flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as REST Server

    C->>S: GET /books/1
    S-->>C: 200 { id, title, authorId, genre, description... }

    C->>S: POST /books  body: { title, authorId... }
    S-->>C: 201 { id: "6", title... }

    C->>S: DELETE /books/6
    S-->>C: 204 No Content
```

### The under-fetching problem

To render one book card showing **title + author name + average rating**, REST needs **three separate HTTP requests**:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as REST Server

    C->>S: GET /books/1
    S-->>C: { id, title, authorId: "1", genre... }
    Note over C: Has authorId but NOT the author name.<br/>Must make a second call.

    C->>S: GET /authors/1
    S-->>C: { id, name, bio }
    Note over C: Has author name but NOT reviews.<br/>Must make a third call.

    C->>S: GET /books/1/reviews
    S-->>C: [{ rating: 5 }, { rating: 4 }]
    Note over C: 3 round trips to build 1 UI card.
```

### The over-fetching problem

Even for a simple title list, REST returns every field on every resource:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as REST Server

    C->>S: GET /books  (UI only needs titles for a dropdown)
    S-->>C: [{ id, title, authorId, publishedYear, genre, description }, ...]
    Note over C: Needed 1 field. Received 6 fields × 5 books.<br/>25 fields transferred, 5 used.
```

### The 6 REST constraints (Fielding's original definition)

| Constraint | What it means |
|---|---|
| **Client–server** | UI and data storage are separated |
| **Stateless** | Each request carries all the context it needs — no session on the server |
| **Cacheable** | Responses must declare whether they can be cached |
| **Uniform interface** | Resources are identified by URIs; interactions are standardised |
| **Layered system** | Client doesn't know if it's talking to the real server or a proxy/CDN |
| **Code on demand** *(optional)* | Server can send executable code to the client (e.g. JavaScript) |

### HTTP verbs and idempotency

Idempotent means calling the same operation multiple times produces the same result as calling it once — important for safe retries.

| Verb | Idempotent? | Safe? | Typical use |
|---|---|---|---|
| GET | ✔ | ✔ | Read |
| PUT | ✔ | ✗ | Full replace |
| DELETE | ✔ | ✗ | Remove |
| POST | ✗ | ✗ | Create, non-idempotent actions |
| PATCH | ✗ | ✗ | Partial update |

### HTTP status codes to know

| Code | Meaning |
|---|---|
| 200 OK | Success |
| 201 Created | Resource created (use with POST) |
| 204 No Content | Success, no body (use with DELETE) |
| 400 Bad Request | Malformed request from the client |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Authenticated but not allowed |
| 404 Not Found | Resource doesn't exist |
| 409 Conflict | State conflict (e.g. duplicate) |
| 422 Unprocessable Entity | Validation error |
| 500 Internal Server Error | Server bug |

### REST versioning strategies

| Strategy | Example | Notes |
|---|---|---|
| URL path | `/v1/books` | Simple, explicit — most common |
| Header | `Accept: application/vnd.api.v2+json` | Clean URLs, harder to test in browser |
| Query param | `/books?version=2` | Easy but can pollute caches |

### When to choose REST

- Public-facing APIs (developers expect it)
- Simple CRUD with little nesting
- Teams that need HTTP-level caching (CDNs, ETags)
- When GET requests should be bookmarkable or shareable

---

## GraphQL — how it works <a name="graphql"></a>

### Core idea

GraphQL is a **query language for APIs** developed by Facebook in 2012. Instead of many endpoints there is one (`/graphql`). The **client declares exactly what it needs** — the server sends nothing more, nothing less.

### Request / response flow — solving REST's problems

The same three-request REST scenario becomes a single query:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as GraphQL Server
    participant R as Resolvers

    C->>S: POST /graphql
    Note over C,S: query {<br/>  book(id: "1") {<br/>    title<br/>    author { name }<br/>    averageRating<br/>  }<br/>}

    S->>R: Query.book("1") → finds book row
    R->>R: Book.author → looks up author by authorId
    R->>R: Book.averageRating → computes from reviews
    Note over R: Book.genre, Book.description NOT called.<br/>Client didn't ask for them.

    S-->>C: 200 { data: { book: { title, author: { name }, averageRating } } }
    Note over C: 1 request. Exact fields. No wasted data.
```

### How the resolver chain works

Every field in the schema can have a resolver. GraphQL only calls a resolver if the client's query includes that field. Unused fields cost nothing.

```mermaid
flowchart TD
    Q["query {<br/>  authors {<br/>    name<br/>    books { title reviews { rating } }<br/>  }<br/>}"]

    Q --> QR["Query.authors\n→ returns all authors"]

    QR --> AN["Author.name\n(trivial — direct field)"]
    QR --> BR["Author.books\n→ filters books by authorId"]

    BR --> BT["Book.title\n(trivial — direct field)"]
    BR --> RR["Book.reviews\n→ filters reviews by bookId"]

    RR --> RT["Review.rating\n(trivial — direct field)"]

    style AN fill:#d4edda
    style BT fill:#d4edda
    style RT fill:#d4edda
    style QR fill:#cce5ff
    style BR fill:#cce5ff
    style RR fill:#cce5ff
```

Green = trivial field access. Blue = resolver that does real work.

### The three operation types

| Type | Purpose | REST equivalent |
|---|---|---|
| `query` | Read data | GET |
| `mutation` | Write data | POST / PUT / PATCH / DELETE |
| `subscription` | Real-time event stream | WebSocket / SSE |

### The SDL schema — the client-server contract

```graphql
type Book {
  id: ID!
  title: String!
  author: Author!        # resolver runs only if client asks for this
  averageRating: Float   # computed on demand
}

type Query {
  book(id: ID!): Book
  books: [Book!]!
}
```

`!` means non-nullable. The SDL is self-documenting — clients can introspect it at runtime without reading any external docs.

### The N+1 problem

```mermaid
sequenceDiagram
    participant C as Client
    participant S as GraphQL Server
    participant DB as Database

    C->>S: query { books { title author { name } } }

    S->>DB: SELECT * FROM books  (1 query)
    DB-->>S: [book1, book2, book3, book4, book5]

    S->>DB: SELECT * FROM authors WHERE id = 1
    S->>DB: SELECT * FROM authors WHERE id = 1
    S->>DB: SELECT * FROM authors WHERE id = 2
    S->>DB: SELECT * FROM authors WHERE id = 3
    S->>DB: SELECT * FROM authors WHERE id = 3

    Note over S,DB: 5 books → 5 author queries = N+1 problem.<br/>Fix: DataLoader batches them into<br/>SELECT * FROM authors WHERE id IN (1,2,3)
```

### Exploring this project's GraphQL API

Open **http://localhost:4000** for Apollo Sandbox, then try:

```graphql
# Precise query — only the fields you ask for
query {
  book(id: "1") {
    title
    author { name }
    averageRating
  }
}

# Deeply nested in one shot
query {
  authors {
    name
    books {
      title
      reviews { rating comment }
    }
  }
}

# Mutation
mutation {
  addBook(
    title: "God Emperor of Dune"
    authorId: "1"
    publishedYear: 1981
    genre: "Science Fiction"
    description: "Fourth Dune book."
  ) {
    id
    title
  }
}
```

### When to choose GraphQL

- Mobile clients where bandwidth matters
- Products with multiple front-end clients (web, iOS, Android) needing different shapes of the same data
- Rapidly evolving APIs where adding fields doesn't break existing clients
- Complex, deeply nested data requirements

---

## gRPC — how it works <a name="grpc"></a>

### Core idea

gRPC is a high-performance RPC (Remote Procedure Call) framework from Google. The client calls methods on a remote server **as if they were local functions**. The contract is a `.proto` file that drives code generation for both sides in any language.

### Overall architecture

```mermaid
flowchart LR
    PROTO[library.proto\nservice contract]

    PROTO -->|code generation| SC[Server stub\nTypeScript]
    PROTO -->|code generation| CC[Client stub\nTypeScript / Go / Python / Java...]

    CC -->|HTTP/2 · Protobuf binary| SC
    SC -->|HTTP/2 · Protobuf binary| CC
```

### The four communication patterns

This is gRPC's biggest differentiator — REST only has the first:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as gRPC Server

    Note over C,S: 1. Unary — one request, one response
    C->>S: GetBook { id: "1" }
    S-->>C: Book { title: "Dune", ... }

    Note over C,S: 2. Server Streaming — one request, stream of responses
    C->>S: ListBooks { genre: "" }
    S-->>C: Book { title: "Dune" }
    S-->>C: Book { title: "Foundation" }
    S-->>C: Book { title: "I, Robot" }
    S-->>C: ⟨END OF STREAM⟩

    Note over C,S: 3. Client Streaming — stream of requests, one response
    C->>S: UploadChunk { data: ... }
    C->>S: UploadChunk { data: ... }
    C->>S: UploadChunk { data: ... }
    S-->>C: UploadResult { size: 3072 }

    Note over C,S: 4. Bidirectional Streaming — both sides stream simultaneously
    C->>S: Message { text: "hello" }
    S-->>C: Message { text: "hi there" }
    C->>S: Message { text: "how are you?" }
    S-->>C: Message { text: "fine, thanks" }
```

### Real-time push streaming

```mermaid
sequenceDiagram
    participant C as Client
    participant S as gRPC Server

    C->>S: WatchNewBooks { interval_seconds: 2 }
    Note over S: connection stays open

    S-->>C: Book { title: "Newly Published Book 1" }
    Note over C,S: 2 seconds later...
    S-->>C: Book { title: "Newly Published Book 2" }
    Note over C,S: 2 seconds later...
    S-->>C: Book { title: "Newly Published Book 3" }
    S-->>C: ⟨END OF STREAM⟩

    Note over C: REST needs polling every N seconds.<br/>GraphQL needs a WebSocket subscription.<br/>gRPC streaming is one proto annotation.
```

### Protocol Buffers — the wire format

Instead of JSON, gRPC uses binary Protocol Buffers. Fields are identified by their **number**, not their name.

```protobuf
message Book {
  string id    = 1;   // ← field NUMBER, not value
  string title = 2;
  int32  year  = 3;
}
```

```mermaid
graph LR
    subgraph JSON ~120 bytes
        J['{"id":"1","title":"Dune","publishedYear":1965}']
    end
    subgraph Protobuf ~25 bytes
        P["0a 01 31 12 04 44 75 6e 65 18 9d 0f ..."]
    end
    JSON -->|~40% smaller\n~6x faster to parse| Protobuf
```

**Critical rule:** never delete or reuse a field number. Old clients compiled against the previous schema would silently misread data if a number is reassigned. Deprecated fields are marked `reserved`.

### HTTP/2 transport advantages

| Feature | Benefit vs HTTP/1.1 |
|---|---|
| **Multiplexing** | Many concurrent RPCs over one TCP connection — no head-of-line blocking |
| **Header compression** | Repeated auth tokens and metadata compressed with HPACK |
| **Binary framing** | Lower overhead than HTTP/1.1 text frames |
| **Persistent connection** | Foundation for server streaming without polling |

### gRPC error codes

gRPC uses its own vocabulary — not HTTP status codes:

| Code | Value | Meaning |
|---|---|---|
| OK | 0 | Success |
| CANCELLED | 1 | Client cancelled the request |
| DEADLINE_EXCEEDED | 4 | Request timed out |
| NOT_FOUND | 5 | Resource doesn't exist |
| ALREADY_EXISTS | 6 | Conflict |
| PERMISSION_DENIED | 7 | Not authorised |
| UNAVAILABLE | 14 | Server temporarily unavailable |

### Exploring with grpcurl

```bash
brew install grpcurl

grpcurl -plaintext localhost:50051 list
grpcurl -plaintext -d '{"id":"1"}' localhost:50051 library.LibraryService/GetBook
grpcurl -plaintext -d '{"genre":""}' localhost:50051 library.LibraryService/ListBooks
```

### Browser limitation

```mermaid
flowchart LR
    B[Browser] -->|cannot control\nHTTP/2 frames| X((✗))
    B -->|gRPC-Web\nHTTP/1.1 compatible| P[Envoy Proxy]
    P -->|native gRPC\nHTTP/2| S[gRPC Server]
```

Browsers cannot use native gRPC. **gRPC-Web** is a spec that adapts it to HTTP/1.1 via a server-side proxy (typically Envoy).

### When to choose gRPC

- Internal microservice-to-microservice communication
- High-throughput or low-latency requirements (trading systems, mobile backends)
- Real-time streaming (sensor telemetry, live dashboards, file transfers)
- Polyglot systems where services are in different languages
- When a strictly enforced binary contract matters more than human-readability

---

## Side-by-side comparison <a name="comparison"></a>

```mermaid
flowchart TD
    subgraph REST
        RC[Client] -->|"GET /books/1\nGET /authors/1\nGET /books/1/reviews\n3 requests"| RS[Server]
        RS -->|"JSON\nfixed shape\nall fields always"| RC
    end

    subgraph GraphQL
        GC[Client] -->|"POST /graphql\n{ book { title author { name } } }\n1 request"| GS[Server]
        GS -->|"JSON\nexact fields requested\nnothing extra"| GC
    end

    subgraph gRPC
        PC[Client] -->|"GetBook(id)\nbinary protobuf\nHTTP/2"| PS[Server]
        PS -->|"Book message\nbinary protobuf\nor stream of messages"| PC
    end
```

|  | REST | GraphQL | gRPC |
|---|---|---|---|
| **Endpoint** | One per resource | Single `/graphql` | One per method (in `.proto`) |
| **Schema / contract** | None by default (OpenAPI optional) | SDL — built in | `.proto` — built in |
| **Wire format** | JSON | JSON | Protocol Buffers (binary) |
| **Transport** | HTTP/1.1 | HTTP/1.1 | HTTP/2 |
| **Over-fetching** | Yes — fixed response shape | No — client selects fields | No — message types are exact |
| **Under-fetching** | Yes — multiple round trips | No — nested queries | No — compose messages as needed |
| **Streaming** | Not built in | Subscriptions (WebSocket/SSE) | Built in (4 patterns) |
| **Browser support** | Native | Native | Needs gRPC-Web proxy |
| **Caching** | HTTP caching (CDN-friendly) | Hard (single POST endpoint) | Application-level only |
| **Error model** | HTTP status codes | HTTP 200 + `errors` array | gRPC status codes |
| **Human-readable** | Yes | Yes | No (binary) |
| **Best for** | Public APIs, simple CRUD | Complex/nested data, mobile | Internal services, streaming |

---

## Interview quick-reference <a name="interview"></a>

### Common REST questions

**Q: What makes an API truly RESTful?**  
Following Fielding's six constraints — most importantly: stateless requests, a uniform interface (standard HTTP verbs + meaningful URIs), and cacheability. Most "REST" APIs in the wild are REST-ish — they skip HATEOAS and proper cacheability.

**Q: What is HATEOAS?**  
Hypermedia As The Engine Of Application State — responses include links to related actions so the client can navigate the API without hard-coded URLs. Rarely implemented in practice.

**Q: How do you handle versioning?**  
Most common: URL path (`/v1/`). More RESTful: `Accept` header versioning. Always avoid silent breaking changes.

**Q: GET vs POST — when would you use POST for a read?**  
When query parameters are too large for a URL, or contain sensitive data you don't want in server logs or browser history (e.g. complex search filters with PII).

---

### Common GraphQL questions

**Q: How does GraphQL prevent over-fetching?**  
The client's query lists exactly the fields it needs. Resolvers only execute for requested fields. The server never sends more than was asked for.

**Q: What is the N+1 problem and how do you fix it?**  
When resolving a list of N items where each item triggers a resolver that makes a DB call, you end up with N+1 total queries. Fix: **DataLoader** batches all those calls within one event-loop tick into a single `SELECT … WHERE id IN (…)`.

**Q: Why is HTTP caching harder with GraphQL?**  
All requests go to `POST /graphql`. HTTP caches work on URL + method. Two different queries have the same URL. Workarounds: persisted queries (APQ) and client-side normalised caches (Apollo Client, Relay).

**Q: What is introspection and why might you disable it in production?**  
Clients can query `__schema` to discover every type and field. Useful for tooling, but exposes your full data model to attackers — commonly disabled in production.

---

### Common gRPC questions

**Q: Why can't you use gRPC directly in a browser?**  
Browsers expose `fetch`/`XMLHttpRequest` which don't allow raw control of HTTP/2 frames. gRPC requires that control for streaming and binary framing. **gRPC-Web** adapts gRPC to HTTP/1.1 with a server-side proxy.

**Q: What happens if you reuse a Protocol Buffers field number?**  
The old client will interpret the new field's binary data as the old field's type, silently producing corrupted data. Always mark removed fields as `reserved` to prevent reuse.

**Q: What is the difference between unary and streaming RPCs?**  
Unary: one request, one response. Server streaming: one request, server sends a sequence. Client streaming: client sends a sequence, server replies once. Bidirectional: both sides stream concurrently over one open connection.

**Q: When would you use gRPC over REST internally?**  
When you need lower latency (binary format, HTTP/2 multiplexing), strict contracts between services, server-push streaming, or when services are in different languages and you want generated, type-safe clients everywhere.
