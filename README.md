# Briefline — Freelance Project Marketplace & Private Delivery Workspace

Briefline is a two-sided freelance project marketplace and private collaboration platform built with React, TypeScript, Tailwind CSS, Express, Drizzle ORM, PostgreSQL (Cloud SQL), and Firebase Authentication.

## Core Capabilities

- **Dual-Role Accounts & Onboarding**: Sign up, log in, Google Sign-In (Firebase Auth), password reset, email verification, and seamless Buyer/Seller role switching on a single account. Dedicated Buyer company profiles and Seller profiles with private CV uploads, skills, availability, and portfolio items.
- **Structured Project Posting**: 4-step project brief wizard with draft persistence, completeness warnings, paid/unpaid work-sample disclosures, screening questions, and explicit publish confirmation.
- **Project Discovery & Proposals**: Searchable, filterable, paginated project marketplace with bookmarking and public Q&A. Freelancers submit tailored proposals with screening answers, milestone plans, portfolio attachments, and private CV/work samples.
- **Buyer Evaluation & Dual-Party Agreements**: Compare applicants side-by-side, shortlist, request information, message candidates, record private decline reasons, and issue contract offers. Both parties must confirm terms before the private workspace activates.
- **Private Project Workspace**: Strictly scoped to the Buyer, hired Freelancer, and authorized Admins. Includes Overview, threaded Messages, 4-column Kanban Task Board with comments, Milestone tracker (Development Demo Payment Flow), Private Versioned File Room, Scope Change Requests, Deliverable Submissions & Revision Feedback, Final Handover, Activity Timeline, and post-completion Mutual Structured Reviews.
- **Admin Governance Console**: Protected `/admin` panel with platform metrics, account restrictions, project moderation, report/dispute adjudication, category management, and a permanent audit trail.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite
- **Backend**: Express (`server.ts`), Zod validation, Node `crypto.scryptSync` + HMAC session tokens & Firebase Admin ID token verification
- **Database**: PostgreSQL via `pg` + Drizzle ORM (`src/db/schema.ts`, 23 normalized tables)

## Environment Variables

See `.env.example` for all supported variables:

- `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` — Application PostgreSQL credentials (injected in Cloud SQL deployments)
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` — Admin credentials used for Drizzle schema migrations (`src/db/drizzle.config.ts`)
- `SESSION_SECRET` — Secret used to sign local email/password session tokens
- `PORT` — Server port (defaults to `3000`)

## Local Development & Testing

```bash
# Install dependencies
npm install

# Run pure domain unit tests (access control, validation, completion calculators)
npm test

# Start full-stack dev server (Express + Vite middleware on port 3000)
npm run dev

# Build production bundle
npm run build
```

## Demo Preview Accounts

The database automatically seeds idempotent sample data on first API request, including four clearly labeled demo accounts (all use password `DemoPass123!`):

- **Buyer / Client**: `maya@northstar.demo`
- **Seller / Freelancer**: `liam@studiofield.demo`
- **Second Freelancer (Dual-Role)**: `priya@atelier.demo`
- **Administrator**: `admin@briefline.demo`

## Security & Compliance Notes

- **Private Document Access**: CVs, proposal work samples, and workspace deliverables are validated on upload (MIME allowlist and 4 MB limit) and served exclusively via `/api/files/:id/download` after server-side permission checks. Unauthorized access attempts return `HTTP 403`.
- **Workspace Isolation**: All `/api/workspaces/:id/*` endpoints enforce participant or admin membership.
- **Development Demo Payments**: Milestone funding, authorization, and release actions operate in a clearly labeled Development Demo Payment Flow and never collect raw card details or hold real escrow funds. Integrate a PCI-compliant provider (e.g., Stripe Connect) before processing live client payments.
