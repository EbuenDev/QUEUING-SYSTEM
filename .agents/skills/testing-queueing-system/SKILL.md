---
name: testing-queueing-system
description: How to run and end-to-end test the RHU II QUEUING-SYSTEM app locally (PHP dev server, Postgres backend, admin login, doctor/admin/public pages).
---

# Testing the RHU II Queuing System locally

## Serving the app
```bash
sudo apt-get install -y php-cli            # php is often missing on fresh VMs
cd <repo root>
DB_PASSWORD=postgres php -S 0.0.0.0:8000 -t .
```
Pages: `/admin.html` (register/manage patients), `/doctor.html` (doctor panel), `/index.html`
(public display board), `/bhw.html`.

## The frontend talks to Postgres, not queue.json
`app.js` (`fetchState`, `postAction`, `loginAdmin`) hits **`backend/api_postgres.php`**, not
`backend/api.php`. The JSON-file API still exists but is unused by the UI, so tests will fail
with "Database connection failed" until Postgres is up. Set up:
```bash
sudo apt-get install -y php-pgsql postgresql
sudo pg_ctlcluster 14 main start
sudo -u postgres psql -c "CREATE DATABASE rhu_queue_system;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
cp backend/database/schema.sql /tmp/ && sudo -u postgres psql -d rhu_queue_system -f /tmp/schema.sql
```
Config defaults (backend/database/config.php): host localhost:5432, db `rhu_queue_system`,
user `postgres`, password from `DB_PASSWORD` env (empty by default → export it for the server).
Sanity check: `curl -s localhost:8000/backend/api_postgres.php` should return
`{"success":true,"state":{...}}`.

## Login
Admin credentials are hardcoded: **admin / admin123** (`app.js` ADMIN_CREDENTIALS and
`backend/database/config.php`). Log in on `admin.html`; only the `add`, `edit`, `delete` API
actions require the PHP session, so serve/skip/recall/follow-up work from `doctor.html`
without its own login — but log in on admin.html first in the same browser so the PHPSESSID
cookie is shared.

## Useful flows / gotchas
- Register a patient: admin.html top form (Full Name, PhilHealth ID, type select
  REGULAR/SENIOR/PWD/EMERGENCY, PhilHealth status) → "Add Patient".
- Doctor page rows/buttons use event delegation on `data-doctor-action`
  (serve/finish/skip/recall/ready-for-doctor/call-followup) — a single delegated listener in
  `app.js`, so markup changes (li → tr) can silently break clicks; always click the actual
  per-row buttons when testing.
- Cross-tab sync uses BroadcastChannel + localStorage + a 5s poll, so changes made in the
  admin tab appear in the doctor tab within ~5s without reloading.
- "Send to Follow-up" needs a patient in `serving` state first (Serve the row, then use the
  toolbar button, pick a reason, Confirm). Follow-up patients are removed from the main list
  and rendered in the "Return / Follow-up Patients" card list.
- Known quirk: `renderDoctorQueue()` returns early when `state.patients` is empty, so the
  follow-up section can keep stale content after "Reset Queue" until reload.
- Narrow-viewport testing: `.queue-table-wrap` has `overflow-x:auto`, but it only scrolls if its
  flex/grid ancestor can shrink — `.card { min-width: 0 }` plus `.queue-table { min-width: 640px }`
  (styles.css) is what makes this work; if either is missing the table forces page-level
  horizontal overflow and the Actions column becomes unreachable. Verify numerically:
  pass = `document.documentElement.scrollWidth === clientWidth` AND `wrap.scrollWidth > wrap.clientWidth`;
  fail = the inverse. Then scroll right over the wrapper (`scroll` action, direction right) and
  confirm in a screenshot that the Actions buttons are visible AND clickable (click Serve → the
  row's Status must flip to `serving` and the button relabel to `Done`).
  Resize with `wmctrl -r :ACTIVE: -b remove,maximized_vert,maximized_horz` then
  `wmctrl -r :ACTIVE: -e 0,0,0,510,1100` (~485px viewport); maximize back with
  `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.
- CSS caching gotcha: `php -S` serves `styles.css` with caching headers that Chrome honours, so
  after editing CSS a plain reload can show stale styles (this produced a false "fix didn't work"
  reading). Always hard-reload (`ctrl+shift+r`) before measuring layout.

## Devin Secrets Needed
None — admin credentials and the DB password are local/hardcoded.
