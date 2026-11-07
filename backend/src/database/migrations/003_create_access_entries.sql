-- One row per identified entrance check (RF-08): who came in, by which door method, with what result, and which
-- staff member ran the check. The member is only a reference to the members file. No DNI, name, amount or
-- descriptor is stored; numbers and names are resolved when the day is read. Unknown DNIs and unrecognized
-- faces are not logged because there is no member to name.
CREATE TABLE access_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  text NOT NULL,
  result     text NOT NULL CHECK (result IN ('green', 'yellow', 'red')),
  -- The access reason code (for example up_to_date or debtor), never free text.
  reason     text,
  method     text NOT NULL CHECK (method IN ('dni', 'face')),
  checked_at timestamptz NOT NULL,
  -- The id of the staff member who ran the check.
  checked_by text NOT NULL
);

CREATE INDEX access_entries_checked_at_idx ON access_entries (checked_at);
