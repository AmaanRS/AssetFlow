# AssetFlow

Enterprise Asset & Resource Management System — track assets through their full
lifecycle, allocate them to employees/departments, book shared resources, run
maintenance approvals and audit cycles, and see it all on a KPI dashboard.

- **Backend:** Node.js + Express + Prisma (MySQL/MariaDB)
- **Frontend:** React + Vite + Mantine

---

## Prerequisites

- **Node.js 18+** (tested on Node 22)
- A running **MySQL / MariaDB** server (default: `localhost:3306`)

---

## 1. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file (copy the example and fill in your values):

```bash
cp .env.example .env
```

Edit `.env`:

```
BACKEND_EXPRESS_SERVER_PORT=5080
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/assetflow"
JWT_SECRET="a-random-string-at-least-32-characters-long"
JWT_EXPIRES_IN="1h"
```

> Create the empty database first, e.g. `CREATE DATABASE assetflow;`
> (SMTP settings are only needed for the "forgot password" email — optional.)

Set up the database schema, generate the Prisma client, and load demo data:

```bash
npx prisma db push      # creates all tables from the schema
npx prisma generate     # generates the Prisma client
npm run seed            # loads demo users, assets, allocations, bookings, etc.
```

Start the backend:

```bash
npm start               # runs on http://localhost:5080
```

---

## 2. Frontend setup

Open a **second terminal**:

```bash
cd frontend
npm install
cp .env.example .env     # make sure VITE_API_PROXY_TARGET matches the backend port
npm run dev              # opens http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Demo accounts

All demo accounts are created by `npm run seed`. Password format is `Name@12345`.

| Role            | Email                  | Password        |
| --------------- | ---------------------- | --------------- |
| Admin           | admin@assetflow.demo   | `Admin@12345`   |
| Asset Manager   | manager@assetflow.demo | `Manager@12345` |
| Department Head | head@assetflow.demo    | `Head@12345`    |
| Employee        | priya@assetflow.demo   | `Priya@12345`   |
| Employee        | raj@assetflow.demo     | `Raj@12345`     |

(Plus more employees: `neha@`, `arjun@`, `meera@`, `vikram@`, `suresh@`, and a
Finance head `farah@` — all `Name@12345`.)

---

## Common commands

| Command (in `backend/`) | What it does                                   |
| ----------------------- | ---------------------------------------------- |
| `npm start`             | Start the API server                           |
| `npm run seed`          | Reset & reload demo data (safe to re-run)      |
| `npx prisma db push`    | Sync the DB schema with `prisma/schema.prisma` |
| `npx prisma generate`   | Regenerate the Prisma client                   |

| Command (in `frontend/`) | What it does         |
| ------------------------ | -------------------- |
| `npm run dev`            | Start the dev server |
| `npm run build`          | Production build     |

---
