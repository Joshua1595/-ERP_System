# Enterprise ERP System — Production Deployment Dossier
### *Secure, High-Performance ERP Suite for Resource Management, Finance, Inventory, and HR*

---

## 📋 Executive Overview
This dossier delivers the production-ready deployment specifications, configurations, and handoff instructions for the **Enterprise ERP Systems Suite**. The suite is a modern full-stack web application designed with a decoupled architecture:
1. **Frontend**: A highly polished Single Page Application (SPA) built using React 19, TypeScript, Vite, Tailwind CSS, and Recharts, utilizing optimistic states and React Query caching.
2. **Backend**: An Express.js REST API engine utilizing Helmet, CORS security protocols, strict rate-limit policies, XSS input sanitizers, and structured audit logger middlewares.
3. **Database**: PostgreSQL 16 managed via Prisma ORM for type-safe query compilation, declarative schemas, and structured database migrations.

All code has been audited, linted, compiled, and certified green for production release.

---

## 🏗️ Core Architecture & Tech Stack

```
                           +-------------------------------------+
                           |         Vercel CDN Edge             |
                           |    (React 19 Frontend SPA)         |
                           +-------------------------------------+
                                              |
                                              | (Proxies /api/* requests)
                                              v
                           +-------------------------------------+
                           |         Render Docker Node          |
                           |    (Express.js Web Server API)      |
                           +-------------------------------------+
                             |                |                |
         (Prisma Queries)    |                |                | (File Streams)
                             v                v                v
+-------------------------------+  +---------------------+  +-----------------------------+
|    Managed PostgreSQL DB      |  |   Gemini AI Engine  |  |    Enterprise Cloud Storage |
|  (Schemas, Transactions, WAL) |  |   (Expert Analysis) |  |   (S3 / GCS / Cloudinary)   |
+-------------------------------+  +---------------------+  +-----------------------------+
```

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 19 / Vite 6 | Direct UI execution, lazy routing, fluid animations |
| **Backend Engine** | Node.js 22 / Express 4 | Stateless REST API service, input sanitization, JWT auth |
| **ORM Layer** | Prisma ORM 5.22 | Direct type-safety compiler, schema syncing, transactional queries |
| **Production DB** | PostgreSQL 16 | ACID-compliant relational storage, constraints, transactional logs |
| **Storage Engine** | Cloudinary / Local Disk | Durable attachments and local persistent storage fallback |
| **Intelligence** | Gemini AI SDK 2.4 | Automated financial summaries, product categorization |

---

## 🛠️ Local Development Setup

### 1. Prerequisites
Ensure you have the following environments installed locally:
* **Node.js**: v22.0.0 or higher
* **Docker & Docker Compose**: For containerized database testing
* **PostgreSQL** (Optional): v16 if running raw locally

### 2. Initial Installation
Clone the repository and install dependencies:
```bash
# Install all root dependencies and dev dependencies
npm install
```

### 3. Environment Variable Setup
Copy the environment template and provide values:
```bash
cp .env.example .env
```
Ensure you generate a secure JWT Secret:
```bash
# On Linux / macOS, generate a cryptographically secure key:
openssl rand -base64 32
```
Fill out `JWT_SECRET`, `JWT_REFRESH_SECRET`, and your private `DATABASE_URL` in the `.env` file.

### 4. Setup Database Schema & Migrations
Sync the database with Prisma and generate the client engine:
```bash
# Generate the type-safe Prisma Client
npx prisma generate

# Create initial migration and apply it to your database
npx prisma migrate dev --name init
```

### 5. Start Development Servers
Run the integrated full-stack server (includes Vite HMR asset compiling):
```bash
npm run dev
```
Open your browser to `http://localhost:3000` to interact with the system.

---

## 🐳 Docker & Containerization

A multi-stage, secure `Dockerfile` and self-contained `docker-compose.yml` are provided in the project root to ensure clean environment parity.

### 1. Building and Running with Docker Compose
To boot the full suite (PostgreSQL Database + ERP Web App container) locally:
```bash
docker-compose up -d --build
```
This command:
1. Provisions a PostgreSQL container on port `5432`.
2. Initiates database readiness checks.
3. Once the database is healthy, compiles the web application inside a secure Alpine builder, installs production-only dependencies, generates the matching binary engines, applies all pending migrations using `npx prisma migrate deploy`, and binds the server to port `3000`.

### 2. Useful Container Operations
```bash
# Stop all services and retain persistent volumes
docker-compose down

# Stop services and purge all database volume data
docker-compose down -v

# Check live container logs
docker-compose logs -f erp-app
```

---

## 🚀 Production Deployment Guides

We recommend hosting the **Express Backend & PostgreSQL Database on Render**, while hosting the **Static Frontend assets on Vercel CDN** for absolute zero-latency globally.

### Guide A: Render Backend Deployment

Render uses our `render.yaml` Infrastructure-as-Code (IaC) file to deploy instantly.

1. **Upload the Repo**: Commit your code to your private GitHub/GitLab organization repository.
2. **Connect to Render**: In your Render Dashboard, select **Blueprints** and connect your repository.
3. **Approve Infrastructure**: Render will parse `render.yaml` and provision:
   * **Managed PostgreSQL 16 Database**: Automatic secure database.
   * **10GB Persistent Disk Volume**: Attached to `/app/uploads` for local storage backups.
   * **Full Stack App Container**: Compiled from the production-optimized `Dockerfile`.
4. **Environment Secrets**: Provide any missing production keys (like `GEMINI_API_KEY`) under the Environment Variables section in the Render UI.

---

### Guide B: Vercel Frontend Deployment

Since the frontend is a React Single Page Application, it is highly optimized for serverless CDN hosting on Vercel.

1. **Deploy Frontend Site**: Select **New Project** in Vercel and import your repository.
2. **Select Framework**: Choose **Vite** as the framework template.
3. **Configure Build Commands**:
   * **Build Command**: `vite build`
   * **Output Directory**: `dist`
4. **Environment Variables**: Define `VITE_APP_URL` as your public Render endpoint.
5. **Establish Rewrite Proxies**: Our pre-configured `vercel.json` will automatically rewrite all routing paths:
   * `/api/*` requests are proxied via edge servers to your Render Service.
   * Standard URL requests are safely routed to `/index.html` to allow React Router to handle client-side screen navigation.

---

## 🗄️ PostgreSQL Production Configuration

For enterprise scale (2GB - 4GB instances), we have created `/postgres-prod.conf` detailing parameters to be set in your cloud PostgreSQL database parameters panel.

Key settings implemented in our Postgres config:
* **`shared_buffers`**: Set to `1024MB` (25% of total system memory for lightning-fast internal indexing).
* **`effective_cache_size`**: Tuned to `3072MB` (75% of memory for complex analytic calculations).
* **`random_page_cost`**: Reduced to `1.1` (Assuming SSD storage pools, speeding up query paths).
* **`ssl`**: Forced `on` to ensure encrypted transmission.
* **`password_encryption`**: Enforces secure `scram-sha-256` hashing.

---

## 🔄 Database Migration Strategy

To avoid downtime and coordinate structural updates securely:

### 1. The Deployment Pipeline
* Local updates are created via `npx prisma migrate dev --name your_migration_name`. This builds a SQL schema change in `/prisma/migrations/`.
* During production CI/CD or Docker boot, migrations are executed **automatically** via:
  ```bash
  npx prisma migrate deploy
  ```
* This command uses an transactional advisory lock to prevent concurrent migrations and safely applies updates without resetting or wiping database data.

### 2. Zero-Downtime Structural Rule
When changing the database schema:
* **Add column**: Safe to deploy. Always provide defaults or allow nulls.
* **Remove/Rename column**: Run a two-phase deployment. First, release the code that no longer reads the column. Second, once the first phase is stabilized, apply a migration to remove the database column. This prevents breaking active backend instances.

### 3. Quick Rollbacks
If a schema migration introduces an unexpected error, rollback is performed via:
```bash
# Discard the faulty release and resolve migration conflicts using resolved status
npx prisma migrate resolve --rolled-back "migration_name_here"
```

---

## 💾 Backup & Disaster Recovery Strategy

### 1. Automated Backups (Recommended)
Configure your cloud database provider (AWS, Google Cloud, or Render) to execute **automated daily backups** with a **30-day retention period**.

### 2. Manual Logical Backups
To perform a hot logical dump of the production database:
```bash
# Dump production schema and row records to a compressed SQL file
pg_dump -H erp-db-host.render.com -U erp_admin -d erp_production -F c -b -v -f erp_backup_$(date +%F).dump
```

### 3. Restoration Runbook
In case of database failure or target point recovery:
```bash
# Restore a compressed SQL dump to a fresh target database
pg_restore -H erp-fresh-db-host.com -U erp_admin -d erp_production -v erp_backup_2026-07-06.dump
```

---

## 📈 Monitoring & Alerting Plan

A reliable ERP depends on real-time service visibility. Monitor these critical indicators:

### 1. Golden Metrics
* **Uptime**: Maintain ping tests via New Relic or UptimeRobot to your `/api/health` probe.
* **Latency**: Track HTTP response times. Ensure median response times are under `200ms`.
* **Database Connection Pools**: Ensure active connections do not exceed PostgreSQL's max pool bounds.

### 2. Alert Thresholds
Establish automated webhook integrations to Slack, Discord, or Opsgenie on the following triggers:
* **Service Availability**: Failure of HTTP Health probe for $> 2$ consecutive intervals.
* **Server CPU Utilization**: Sustained CPU load $> 80\%$ for $> 10$ minutes.
* **Server Memory Saturation**: Memory allocation exceeding $90\%$ of container limits.
* **Database Disk Space**: Used storage space exceeding $85\%$ of disk boundaries.

---

## 📝 Logging & Security Auditing

All application events are tracked and stored in both standard stdout streams and durable database audit structures.

### 1. Enterprise Activity Log (`ActivityLog` Table)
Our Express server includes a dedicated security audit logging middleware. It records critical actions:
* User logins, failed authentications, logouts.
* Data creations, updates, and deletions.
* Tracks IP addresses, user-agents, timestamps, and serialized transaction data for complete SOX / GDPR audit compliance.

### 2. Application Engine Logs
Our server utilizes standard output logging, which integrates natively with AWS CloudWatch, Google Cloud Operations (Stackdriver), or Render's unified stream viewer.

To query slow database transactions in production, the `/postgres-prod.conf` captures any SQL queries taking longer than `250ms` using `log_min_duration_statement = 250`.

---

## 🔒 Security Hardening Checklist

| Feature | Production Verification Status | Mitigation Detail |
| :--- | :---: | :--- |
| **HTTP Security Headers** | ✅ Active | Enforced via Helmet, shields against Clickjacking & MIME-sniffing |
| **Stateless Auth Token** | ✅ Active | Auth tokens are signed via secure, high-entropy JWT secrets |
| **CORS Policy** | ✅ Active | Restricts API resource access to specified frontend domains (`APP_URL`) |
| **Input Sanitization** | ✅ Active | Custom deep XSS sanitizer escapes all HTML & JS characters before db writes |
| **Rate Limiters** | ✅ Active | Limits requests per IP (500 per 15 mins for API, 20 per 15 mins for Auth) |
| **Error Leak Protection** | ✅ Active | Custom `errorHandler` masks internal stack traces from clients in production |
| **SQL Injection Shields** | ✅ Active | Enforced natively by Prisma using fully parameterized query prepared statements |
| **Transport Layer Encryption** | ✅ Active | SSL/TLS connection paths are strictly mandated for DB and Client |

---

## ⚡ Performance Optimization Summary

1. **Frontend Bundle Optimizations**:
   * Uses modern ES modules via Vite.
   * Asset minification, tree-shaking, and index compression are completed during the build phase.
   * Implements React Query for offline caching, window-focus overrides, and stale-while-revalidate data loads.

2. **Backend Concurrency Optimization**:
   * Server utilizes Express middleware execution.
   * Pre-compiles TypeScript source code to standard CommonJS using `esbuild` for instant runtime loading.
   * Employs Prisma prepared connection pools to prevent memory exhaustion on PostgreSQL.

3. **Database Performance Rules**:
   * Standard SQL Indexes applied on search constraints (UUID IDs, email lookups, and Order Numbers).
   * Automatically clears idle connection states to maintain high memory overhead reserves.

---

## 📂 Project Handoff Package Verification

Below is the verified checklist of production-ready configuration files created and tested in the project root:

- [x] **`Dockerfile`**: Secure multi-stage production container.
- [x] **`docker-compose.yml`**: Full database and app networking orchestration.
- [x] **`.dockerignore`**: Container build size optimization.
- [x] **`render.yaml`**: Complete infrastructure-as-code Blueprint.
- [x] **`vercel.json`**: Frontend static hosting and reverse proxy configuration.
- [x] **`postgres-prod.conf`**: Performance-tuned PostgreSQL DB settings.
- [x] **`.env.example`**: Complete and secure environment variables template.
- [x] **`README.md`**: Complete, detailed, professional deployment runbook (this document).
