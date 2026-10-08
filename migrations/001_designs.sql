CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS designs_user_updated_idx ON designs (user_id, updated_at DESC);
