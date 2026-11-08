-- One face descriptor per member (RF-08, phase 2). A descriptor is 128 numbers that cannot be turned back into
-- an image. No image, name or DNI is stored here: the member is only a reference to the members file.
-- The table is small, so an exact scan finds the nearest profile and no approximate index is needed.
CREATE TABLE face_profiles (
  member_id    text PRIMARY KEY,
  descriptor   vector(128) NOT NULL,
  consented_at timestamptz NOT NULL,
  -- The id of the staff member who recorded the consent.
  consented_by text NOT NULL,
  enrolled_at  timestamptz NOT NULL
);
