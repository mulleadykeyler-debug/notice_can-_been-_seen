CREATE TABLE IF NOT EXISTS events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  category text,
  detail text,
  raw_message_preview text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON events
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert" ON events
  FOR INSERT
  WITH CHECK (true);
