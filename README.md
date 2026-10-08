# VersionDB

### A Git-Like Version Control System for Databases

> **Team:** CommitX  
> **Project:** VersionDB  

VersionDB is a Git-like version control system designed for managing structured database data. It allows users to safely track changes, create branches, compare versions, review changes, merge data, resolve conflicts, and roll back to previous states.

Instead of treating a database as only the current state of data, VersionDB maintains a history of database states so that users can understand **what changed, who changed it, when it changed, and how to recover from an incorrect change**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [Team Members](#team-members)
- [System Architecture](#system-architecture)
- [Complete Workflow](#complete-workflow)
- [Technologies and Tools](#technologies-and-tools)
- [Project Structure](#project-structure)
- [Major Features and Modules](#major-features-and-modules)
- [Installation and Setup](#installation-and-setup)
- [Running the Project](#running-the-project)
- [Project Milestones](#project-milestones)
- [Current Project Status](#current-project-status)
- [Expected Outcome](#expected-outcome)
- [Future Scope](#future-scope)
- [References](#references)

---

# Project Overview

Traditional databases primarily maintain the current state of records. Once a record is updated, accessing or restoring its previous state can require backups or application-specific history mechanisms.

VersionDB introduces a Git-like version control approach for database data.

The system treats database changes similarly to source-code changes:

```text
Database Data
     |
     v
   Changes
     |
     v
   Commit
     |
     +----------> History
     |
     +----------> Branch
     |
     +----------> Diff
     |
     +----------> Merge
     |
     +----------> Rollback
```

VersionDB combines a relational database with a custom file-based version storage engine. PostgreSQL manages structured metadata, while the custom storage engine manages versioned data on disk.

---

# Problem Statement

Traditional database systems provide transactions, logging, backups, and recovery, but they do not normally provide a complete Git-like workflow for database data.

Some limitations include:

- Previous versions of records are not always easily accessible.
- Experimenting directly on shared data can affect the main state.
- Audit logs show that operations occurred but may not provide a complete version history.
- Comparing two database states can be difficult.
- Restoring a particular historical state may require backups.
- Teams do not normally have a standard branch-review-merge workflow for database changes.

VersionDB addresses these problems by introducing version control concepts such as:

- Commits
- Branches
- Version history
- Diff comparison
- Merge
- Conflict resolution
- Pull/Merge Requests
- Approval
- Rollback
- Audit trails
- Data lineage

---

# Objectives

The primary objectives of VersionDB are:

1. Maintain a complete history of database states.
2. Allow users to commit database changes.
3. Allow users to create isolated branches.
4. Compare different database versions using diff.
5. Merge changes from different branches.
6. Detect and resolve conflicts.
7. Provide a review and approval workflow for controlled changes.
8. Allow previous states to be restored through rollback.
9. Maintain audit information about database changes.
10. Demonstrate the integration of DBMS and Operating System concepts.
11. Provide reliable version storage using a custom file-based engine.
12. Support concurrency control and crash recovery using WAL.

---

# Team Members

## Team — CommitX

| Member | Role |
|---|---|
| **Varshika Saini** | Team Lead |
| **Aanvi Choudhary** | Team Member |
| **Kartik Vishwakarma** | Team Member |

---

# System Architecture

VersionDB follows a layered architecture combining a web application, backend API, PostgreSQL metadata storage, and a custom version-control engine.

```text
                         +------------------+
                         |     Browser      |
                         +--------+---------+
                                  |
                                  v
                         +------------------+
                         |  React Frontend  |
                         |  VersionDB UI    |
                         +--------+---------+
                                  |
                                  v
                         +------------------+
                         |  Express REST    |
                         |       API        |
                         +--------+---------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
     +----------------+  +----------------+  +----------------+
     | Version Control|  |   Background   |  |   PostgreSQL   |
     |     Engine     |  |    Services    |  |    Database    |
     +-------+--------+  +-------+--------+  +-------+--------+
             |                   |                   |
             v                   v                   v
      +-------------+      +-------------+    +--------------+
      | Commit      |      | WAL /       |    | Users        |
      | Manager     |      | Recovery    |    | Repositories |
      +-------------+      +-------------+    | Branches     |
      | Branch      |      | Cache       |    | Commits      |
      | Manager     |      | Manager     |    | Merge Req.   |
      +-------------+      +-------------+    | Conflicts    |
      | Diff Engine |      | Background  |    | Audit Logs   |
      +-------------+      | Processing  |    +--------------+
      | Merge /     |      +-------------+
      | Rollback    |
      +-------------+
      | Storage     |
      | Manager     |
      +-------------+
```

The project separates responsibilities between PostgreSQL and the custom storage engine. PostgreSQL manages structured metadata, while the version-control engine manages the actual versioned data stored on disk.

---

# Complete Workflow

```text
                    +--------------+
                    |     User     |
                    +------+-------+
                           |
                           v
                    +--------------+
                    | Login / Auth |
                    +------+-------+
                           |
                           v
                 +--------------------+
                 | Create Repository  |
                 +---------+----------+
                           |
                           v
                 +--------------------+
                 | Add / Edit Data    |
                 +---------+----------+
                           |
                           v
                    +------------+
                    |   Commit   |
                    +-----+------+
                          |
                          v
                  +---------------+
                  | Create Branch |
                  +-------+-------+
                          |
                          v
                 +------------------+
                 | Edit + Commit    |
                 | on Branch        |
                 +--------+---------+
                          |
                          v
                     +---------+
                     |  Diff   |
                     +----+----+
                          |
                          v
              +----------------------+
              | Create Merge Request|
              +----------+-----------+
                         |
                         v
                 +----------------+
                 |    Reviewer    |
                 | checks changes |
                 +-------+--------+
                         |
                         v
                    +---------+
                    |Conflict?|
                    +---+---+-+
                       Yes  No
                        |    |
                        v    v
                +----------+ +---------+
                | Resolve  | | Approve |
                | Conflict | |  Merge  |
                +----+-----+ +----+----+
                     |             |
                     +------+------+
                            |
                            v
                   +-----------------+
                   | Merge to Main   |
                   |   (Protected)   |
                   +--------+--------+
                            |
                            v
                     +-------------+
                     |    Audit    |
                     +------+------+
                            |
                            v
                     +-------------+
                     |  Rollback   |
                     | if required |
                     +-------------+
```

---

# Technologies and Tools

## Frontend

- React
- Tailwind CSS
- React Router
- Chart.js

## Backend

- Node.js
- Express.js
- JWT

## Database

- PostgreSQL

## Version Storage Engine

- Custom file-based storage engine
- File I/O
- Write-Ahead Logging (WAL)
- Locks / Mutexes
- In-memory cache
- Background processing

## Development and Testing

- Git
- GitHub
- REST API
- Automated testing
- CI/CD

---

# Project Structure

```text
versiondb/
|
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── .gitignore
├── .env.example
├── docker-compose.yml
|
├── backend/
|   └── src/
|       ├── config/
|       ├── http/
|       |   ├── routes/
|       |   ├── controllers/
|       |   ├── middleware/
|       |   └── schemas/
|       ├── application/
|       |   ├── auth/
|       |   ├── repository/
|       |   ├── member/
|       |   ├── record/
|       |   ├── commit/
|       |   ├── history/
|       |   ├── branch/
|       |   ├── diff/
|       |   ├── merge/
|       |   ├── merge-request/
|       |   ├── conflict/
|       |   ├── rollback/
|       |   ├── audit/
|       |   ├── dashboard/
|       |   └── idempotency/
|       ├── domain/
|       ├── ports/
|       ├── adapters/
|       |   ├── postgres/
|       |   ├── storage/
|       |   └── cache/
|       ├── jobs/
|       ├── observability/
|       ├── shared/
|       ├── container.ts
|       ├── app.ts
|       └── server.ts
|
├── storage-engine/
|   └── src/
|       ├── path-guard.ts
|       ├── fs-utils.ts
|       ├── canonical.ts
|       ├── hash.ts
|       ├── objects/
|       ├── tree/
|       ├── refs/
|       ├── wal/
|       ├── locks/
|       ├── recovery/
|       ├── gc/
|       ├── cache/
|       ├── failpoints.ts
|       └── index.ts
|
├── database/
|   ├── migrations/
|   └── seed/
|
├── frontend/
|   └── src/
|       ├── app/
|       ├── api/
|       ├── features/
|       |   ├── auth/
|       |   ├── repositories/
|       |   ├── members/
|       |   ├── records/
|       |   ├── commits/
|       |   ├── branches/
|       |   ├── diff/
|       |   ├── merge/
|       |   ├── merge-requests/
|       |   ├── conflicts/
|       |   ├── rollback/
|       |   ├── audit/
|       |   └── dashboard/
|       ├── components/
|       ├── hooks/
|       ├── utils/
|       ├── types/
|       ├── App.tsx
|       ├── main.tsx
|       └── index.css
|
├── tests/
|   ├── unit/
|   ├── integration/
|   ├── concurrency/
|   ├── e2e/
|   └── fixtures/
|
├── infrastructure/
|   ├── docker/
|   ├── nginx/
|   └── postgres/
|
├── scripts/
├── benchmarks/
├── docs/
|
└── .github/
    └── workflows/
        ├── ci.yml
        ├── security.yml
        └── deploy.yml
```

---

# Major Features and Modules

## 1. Authentication

Provides user registration, login and authentication for accessing VersionDB.

## 2. Repository Management

Users can create and manage repositories that contain version-controlled database data.

## 3. Data Management

Provides the interface for creating, editing and managing structured data within repositories.

## 4. Commit and Version History

Every accepted change is stored as a version.

```text
Version 1
    |
    v
Version 2
    |
    v
Version 3
    |
    v
Version 4
```

This allows users to inspect previous states of the database.

## 5. Branching

Users can create isolated branches to experiment with changes without directly modifying the main version.

```text
                 +-- Feature Branch
                 |
Main ----●-------●---------●---- Main
         |
         +-------●---------●
                 Other Work
```

## 6. Diff Engine

The diff module compares versions and identifies changes between database states.

It allows users to understand:

- Added data
- Modified data
- Deleted data
- Changed fields

## 7. Merge

Changes from different branches can be merged into the main branch.

VersionDB uses conflict detection to identify incompatible changes.

## 8. Merge Request and Review

A branch can be submitted for review before being merged into the protected main branch.

The reviewer can inspect:

- Changes
- Diff
- Commit history
- Conflict information
- Resolution decisions

## 9. Conflict Resolution

When two branches modify the same data differently, a conflict can occur.

The reviewer can resolve a conflict using:

```text
OURS
THEIRS
MANUAL
```

The final decision is then included in the merge process.

## 10. Rollback

VersionDB allows users to recover an earlier database state when an incorrect change has been committed.

Rollback creates a new version rather than destroying existing history.

## 11. Audit Trail

The system records important actions so that database changes can be traced.

The audit information helps identify:

```text
WHO
WHAT
WHEN
```

for important operations.

## 12. Write-Ahead Logging

The custom storage engine uses WAL to record operations before applying them.

This helps the system recover unfinished operations after a crash.

## 13. Concurrency Control

Locks and concurrency mechanisms prevent simultaneous operations from corrupting stored versions.

## 14. Caching

Frequently accessed version data can be cached in memory to improve access performance.

## 15. Background Processing

Background services handle operations such as:

- Garbage collection
- Compression/compaction
- Recovery-related tasks
- Storage maintenance

---

# Installation and Setup

## Prerequisites

Make sure the following are installed:

- Node.js
- npm
- PostgreSQL
- Git
- GitHub account

## 1. Clone the Repository

```bash
git clone <repository-url>
cd versiondb
```

## 2. Install Dependencies

```bash
npm install
```

If the project uses separate workspaces:

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../storage-engine
npm install
```

## 3. Configure Environment Variables

Create a `.env` file using the provided example:

```bash
cp .env.example .env
```

Configure the required PostgreSQL and application settings.

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/versiondb
JWT_SECRET=your-secret-key
PORT=5000
```

## 4. Start PostgreSQL

Make sure PostgreSQL is running and the VersionDB database exists.

Example:

```bash
createdb versiondb
```

## 5. Run Database Migrations

```bash
npm run migrate
```

## 6. Start the Backend

```bash
npm run dev:backend
```

## 7. Start the Frontend

```bash
npm run dev:frontend
```

Open the URL provided by Vite in the browser.

---

# Running the Project

Once the backend, database and frontend are running:

```text
1. Open VersionDB
        |
        v
2. Register / Login
        |
        v
3. Create Repository
        |
        v
4. Add Database Data
        |
        v
5. Commit
        |
        v
6. Create Branch
        |
        v
7. Modify Data
        |
        v
8. Commit Branch
        |
        v
9. View Diff
        |
        v
10. Create Merge Request
        |
        v
11. Review Changes
        |
        v
12. Resolve Conflicts if Required
        |
        v
13. Approve
        |
        v
14. Merge into Main
        |
        v
15. View Audit / History
        |
        v
16. Rollback if Required
```

---

# Project Milestones

The project is planned in three major phases.

## Phase 1 — Core Version Control

- PostgreSQL schema
- Authentication
- Repository management
- Basic commit storage
- Version history

## Phase 2 — Branching and Recovery

- Database branching
- Rollback
- Concurrency control
- Corresponding visualization interfaces

## Phase 3 — Advanced Version Control

- Merge
- Conflict resolution
- WAL-based crash recovery
- Background compression
- Garbage collection
- Caching
- Audit features
- Testing
- Deployment

---

# Current Project Status

**Status: In Development**

### Development Roadmap

```text
Project Design
      |
      v
Database + Backend Foundation
      |
      v
Version Storage Engine
      |
      v
Branching + Version Control
      |
      v
Merge + Review
      |
      v
Recovery + Reliability
      |
      v
Frontend Integration
      |
      v
Testing + Deployment
```

The project is being developed incrementally, with the core version-control workflow implemented before the advanced reliability and deployment features.

---

# Expected Outcome

The final VersionDB prototype will provide:

- Repository creation
- Database data management
- Commits
- Version history
- Branching
- Diff comparison
- Merge
- Conflict resolution
- Pull/Merge Requests
- Approval workflow
- Rollback
- Audit logs
- Data lineage
- Database Time Machine functionality
- Schema Versioning
- Concurrency control
- WAL-based crash recovery
- Caching
- Background processing

The final system will demonstrate the integration of **DBMS concepts and Operating System concepts** through PostgreSQL metadata management and a custom version-control engine.

---

# Future Scope

Possible future improvements include:

- Advanced schema versioning
- Improved data lineage visualization
- More advanced database integrations
- Distributed storage
- Cloud deployment
- Advanced performance optimization
- Additional collaboration and review features

Advanced features will be considered after the core VersionDB workflow is stable and functional.

---

# References

1. [Git Documentation](https://git-scm.com/)
2. [PostgreSQL Documentation](https://www.postgresql.org/docs/)
3. [PostgreSQL WAL Documentation](https://www.postgresql.org/docs/current/wal-intro.html)
4. [MDN Web Docs — HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)
5. Silberschatz, A., Galvin, P. B., and Gagne, G. — *Operating System Concepts*

---

# VersionDB

### Git-like version control for database data

**Team CommitX**

> Track. Branch. Compare. Review. Merge. Recover.
