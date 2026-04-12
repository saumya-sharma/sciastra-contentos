# SciAstra ContentOS: Technical Specification & Implementation Log

This document provides a comprehensive technical overview of the **SciAstra Content Operations (ContentOS)** platform, including architecture, granular logic, and data schemas.

---

## 🏗️ 1. System Architecture

The platform is built as a high-fidelity, real-time operations engine for managing content pipelines across multiple channels and scientific exam cycles.

### Infrastructure Layer
- **Hosting**: Vercel (Production)
- **Database**: Supabase (PostgreSQL) — Powers all persistent state, from content lifecycles to team roles.
- **Media CDN**: Cloudinary — Native integration for proxy and thumbnail storage, optimized for designer-to-editor workflows.

### Service Layer (Next.js API Hub)
| Endpoint | Function | Key Technology |
| :--- | :--- | :--- |
| `/api/db` | Central GET/PUT/POST hub for Supabase operations | `@supabase/supabase-js` |
| `/api/analytics` | Computes velocity, bottlenecks, and campaign readiness | PostgreSQL Aggregations |
| `/api/cron` | Automated scraper for live exam dates | `cheerio`, `node-fetch` |
| `/api/notify` | Triggers WATI templates for WhatsApp alerts | WATI Business API |
| `/api/upload` | Multipart file handling and Cloudinary persistence | `cloudinary` SDK |

---

## 🧠 2. Granular Logic & "Chunk-Level" Breakdown

### Role-Based Access Control (RBAC) Logic
The application utilizes a synchronized role system (stored in `localStorage` and mapped to `team_members` entries) to filter the visible content queue (`visibleItems`):
- **ADMIN**: Unrestricted access to all views, Analytics, and Team Management.
- **SMM**: Filtered view showing only content assigned to their specific channels.
- **CREATOR**: Task inbox view showing only items in "Sent to Editor" or "Ready to Publish" stages.

### The "Analytics Engine" Algorithm
Located in `/api/analytics/route.ts`, the engine performs real-time calculations:
1. **Pipeline Velocity**: Calculated by extracting the timestamp of the `Created` action and the `Published` action from the `auditLog` JSONB field, then averaging the difference.
2. **Bottleneck Detection**: Identifies the status stage with the highest count of items that haven't moved (updated) for >3 days.
3. **Exam Readiness**: Cross-references `campaigns` with `content_items` to calculate the percentage of assets published relative to the campaign's upcoming exam target date.

### Optimistic UI & State Synchronization
The main `ContentOS` component (`app/page.tsx`) maintains a single source of truth for items. 
- **Chunk Detail**: Every status move or property update triggers an **Optimistic Update** (updating the local state immediately) followed by an async `PUT` request to `/api/db`. If the server fails, the state is refreshed from the DB via `fetch`.

---

## 📊 3. Data Shema (PostgreSQL)

### `content_items`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | Unique identifier for the content card. |
| `title` | TEXT | Item headline. |
| `status` | TEXT | Ideation, Scripting, Sent to Editor, Ready to Publish, Published. |
| `assignees` | JSONB | Map of `smm`, `editor`, and `designer` IDs. |
| `auditLog` | JSONB[] | History of status changes with user and timestamp. |
| `assets` | JSONB[] | List of Cloudinary URLs and metadata. |
| `campaignId` | TEXT | Link to the parent campaign. |

### `team_members`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT (PK) | Unique ID (usually initials or username). |
| `name` | TEXT | Full name. |
| `role` | TEXT | ADMIN, SMM, or CREATOR. |
| `active` | BOOLEAN | Deactivation flag (Soft delete). |
| `channels` | JSONB[] | List of channel IDs the user manages. |

---

## 🤖 4. Automation & Integration Details

### WhatsApp Notification Flow (WATI)
- **Trigger**: Status changed to "Ready to Publish" or "Sent to Editor".
- **Payload**: Pings the WATI `broadcast` endpoint using site-specific templates.
- **Mock Mode**: Logs transmission attempts to the internal `notifications` table if `WATI_API_KEY` is undefined, displaying an admin alert in the dashboard.

### Cloudinary Media Pipeline
- Files are uploaded via a custom multipart form handler in `app/page.tsx`'s `handleFileUpload`.
- The API returns a `secure_url`, which is instantly appended to the `assets` array of the specific `content_item` record.

### Exam Synchronizer (Scraper)
- **Targets**: `nestexam.in`, `iiseradmission.in`.
- **Logic**: Parses HTML for specific CSS selectors containing exam dates. Converts strings (e.g., "June 15, 2026") into ISO date formats for the `Exams` channel and analytics engine.
