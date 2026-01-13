# AT Protocol (ATProto) Research

## Overview

The **AT Protocol** (Authenticated Transfer Protocol, commonly "atproto" or "ATP") is a decentralized social networking protocol developed by Bluesky Social PBC. It creates a standard format for user identity, follows, and data on social apps, allowing apps to interoperate and users to move across them freely.

Key principles:
- **Federated network** with account portability
- **Speech vs. Reach separation** - speech layer is permissive, reach layer is flexible
- Combines P2P technology with high-scale distributed systems practices

---

## Core Architecture

### Network Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Users    │────▶│     PDS     │────▶│    Relay    │
│  (Clients)  │     │  (Storage)  │     │ (Firehose)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  App Views  │
                                        │ (Services)  │
                                        └─────────────┘
```

### 1. Personal Data Server (PDS)

Your "home in the cloud" - hosts your data, distributes it, manages your identity.

**Key functions:**
- Hosts user repositories (data storage)
- Maintains Merkle Search Tree data structure
- Handles mutations and generates diffs
- Streams real-time updates to relays via WebSockets
- Supports account migration via CAR file export/import

**Scale:** A single PDS can host 1 to hundreds of thousands of accounts. Users can self-host on modest hardware.

### 2. Relay

Aggregates firehose streams from all PDSes into one massive stream.

**Key functions:**
- Subscribes to multiple PDS hosts
- Outputs combined "firehose" event stream
- Verifies repo data structure integrity
- Validates identity signatures
- Provides `com.atproto.sync.subscribeRepos` endpoint

### 3. App Views

Backend services that consume the firehose and present data to users.

**Examples:**
- **Bluesky** - Microblogging (largest App View)
- **WhiteWind** - Long-form blogging
- **Frontpage** - Hacker News-style social news
- **Smoke Signal** - RSVP management

App Views can implement custom algorithms, moderation strategies, monetization, etc.

---

## Identity System

### DIDs (Decentralized Identifiers)

Every user has a permanent, immutable **DID** as their primary identifier.

**Supported DID methods:**
- `did:plc` - Novel method developed by Bluesky (most common)
- `did:web` - W3C standard based on HTTPS/DNS

**DID Document contains:**
- Handle (human-readable name)
- Signing key (cryptographic verification)
- PDS URL (where user's data lives)

### Handles

Human-readable identifiers that are DNS domain names.

```
alice.bsky.social     → Standard Bluesky handle
alice.example.com     → Custom domain handle
```

Handles can be changed; DIDs are permanent.

---

## Data Model

### Repository Structure

```
User Repository
├── Collection: app.bsky.feed.post
│   ├── Record: 3k2abc123 (a post)
│   ├── Record: 3k2abc124 (another post)
│   └── ...
├── Collection: app.bsky.feed.like
│   └── Records...
├── Collection: app.bsky.graph.follow
│   └── Records...
└── Collection: your.custom.lexicon
    └── Records...
```

### Records

JSON documents stored in collections. Every record:
- Has a `$type` field identifying its Lexicon schema
- Is stored in a collection matching its type
- Can contain links (references) to other records or blobs

### Encoding

- **JSON** - Human-readable, used in API responses
- **DAG-CBOR** - Binary format for signing, hashing, and efficient storage
- **CAR files** - Archive format for repository export/import

### Merkle Search Tree (MST)

Repositories use an MST data structure that:
- Enables efficient sync between servers
- Allows cryptographic verification of data integrity
- Supports incremental updates (diffs)

---

## Lexicon (Schema Language)

Lexicon is ATProto's schema definition language. It defines:
- **Record schemas** - Structure of data in repositories
- **XRPC methods** - API endpoints (queries and procedures)
- **Tokens and objects** - Reusable type definitions

### Lexicon Structure

```json
{
  "lexicon": 1,
  "id": "app.bsky.feed.post",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["text", "createdAt"],
        "properties": {
          "text": {"type": "string", "maxLength": 3000},
          "createdAt": {"type": "string", "format": "datetime"}
        }
      }
    }
  }
}
```

### NSIDs (Namespaced Identifiers)

Lexicons are identified by reverse-DNS style names:
- `app.bsky.feed.post` - Bluesky post record
- `com.atproto.repo.createRecord` - Core protocol method
- `your.domain.custom.type` - Your custom schema

---

## XRPC API

HTTP API conventions for client-server and server-server communication.

### Request Types

| Type | HTTP Method | Cacheable | Mutates State |
|------|-------------|-----------|---------------|
| Query | GET | Yes | No |
| Procedure | POST | No | Yes |

### Endpoint Format

```
/xrpc/{nsid}

Examples:
GET  /xrpc/app.bsky.feed.getTimeline
POST /xrpc/com.atproto.repo.createRecord
```

### Authentication

- **Session tokens** - `accessJwt` and `refreshJwt`
- **OAuth** - Recommended for third-party apps
- **App passwords** - For programmatic access

---

## Firehose / Event Stream

Real-time stream of all changes across the network.

### Connecting

```
WebSocket: wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos
```

### Message Format

Each WebSocket frame contains two DAG-CBOR objects:
1. **Header** - Message type info
2. **Body** - The actual event data

### Event Types

- `#commit` - Repository changes (creates, updates, deletes)
- `#identity` - Identity updates
- `#account` - Account status changes
- `#handle` - Handle changes

---

## Available SDKs

### TypeScript/JavaScript (Official)

```bash
npm install @atproto/api
```

**Packages:**
- `@atproto/api` - Client library
- `@atproto/crypto` - Cryptographic operations
- `@atproto/identity` - DID/handle resolution
- `@atproto/lexicon` - Schema tools
- `@atproto/repo` - Repository data structures
- `@atproto/xrpc` - HTTP API client
- `@atproto/xrpc-server` - HTTP API server

### Python

```bash
pip install atproto
```

GitHub: https://github.com/MarshalX/atproto

### Dart/Flutter

https://atprotodart.com/

### Go (Indigo)

https://github.com/bluesky-social/indigo

---

## Building Applications

### App Types

1. **Client Apps** - Connect to PDS, read/write user data
2. **Feed Generators** - Custom algorithms consuming firehose
3. **Labelers** - Content moderation services
4. **App Views** - Full backend services with custom collections

### Quick Start Pattern

```typescript
import { AtpAgent } from '@atproto/api'

// Create agent
const agent = new AtpAgent({ service: 'https://bsky.social' })

// Authenticate
await agent.login({
  identifier: 'your-handle.bsky.social',
  password: 'your-app-password'
})

// Create a post
await agent.post({
  text: 'Hello from ATProto!'
})

// Read timeline
const timeline = await agent.getTimeline()
```

### Custom Lexicons

You can define your own record types:

1. Create lexicon JSON schema
2. Register your domain for the NSID namespace
3. Write records to user repositories
4. Build App View to index/display your data

---

## Account Portability

Users can migrate between PDS providers:

1. Export repository as CAR file from old PDS
2. Import CAR file to new PDS
3. Update DID document to point to new PDS
4. Identity and data preserved, followers maintained

---

## Key Resources

### Official Documentation
- Protocol Overview: https://atproto.com/guides/overview
- Specifications: https://atproto.com/specs
- Application Guide: https://atproto.com/guides/applications
- Lexicon Style Guide: https://atproto.com/guides/lexicon-style-guide

### GitHub Repositories
- Reference Implementation: https://github.com/bluesky-social/atproto
- Go Implementation (Indigo): https://github.com/bluesky-social/indigo
- Python SDK: https://github.com/MarshalX/atproto

### Community
- Bluesky Docs: https://docs.bsky.app
- AT Protocol Wiki: https://atproto.wiki
- Discord: Bluesky API community

---

## Example: Listening to Firehose (Python)

```python
from atproto import FirehoseSubscribeReposClient, parse_subscribe_repos_message

client = FirehoseSubscribeReposClient()

def on_message(message):
    commit = parse_subscribe_repos_message(message)
    for op in commit.ops:
        if op.action == 'create' and op.path.startswith('app.bsky.feed.post'):
            print(f"New post from {commit.repo}")

client.start(on_message)
```

---

## Summary

AT Protocol provides a foundation for building decentralized social applications with:

- **User sovereignty** - Users own their identity and data
- **Portability** - Accounts can migrate between providers
- **Interoperability** - Apps share data through common schemas
- **Scalability** - Architecture designed for millions of users
- **Extensibility** - Custom Lexicons enable new app types

The protocol is actively developing and was submitted to the IETF in 2025 for standardization.
