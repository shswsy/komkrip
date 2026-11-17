-- Bookings. Services and staff live in shared/shop.ts (one source of truth for UI + API).
CREATE TABLE bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  service_id  TEXT    NOT NULL,
  staff_id    TEXT    NOT NULL,
  date        TEXT    NOT NULL,              -- YYYY-MM-DD, Asia/Bangkok
  start_min   INTEGER NOT NULL,              -- minutes from 00:00
  end_min     INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL,              -- digits only
  note        TEXT    NOT NULL DEFAULT '',
  price       INTEGER NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'booked'
              CHECK (status IN ('booked', 'done', 'no_show', 'cancelled')),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_bookings_day ON bookings (date, staff_id, start_min);
CREATE INDEX idx_bookings_phone ON bookings (phone, date);

-- Days the owner closes the shop (holidays, events).
CREATE TABLE closed_dates (
  date    TEXT PRIMARY KEY,
  reason  TEXT NOT NULL DEFAULT ''
);
