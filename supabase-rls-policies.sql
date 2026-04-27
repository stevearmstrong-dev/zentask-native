-- Enable Row Level Security on tasks table
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Policy: Users can insert their own tasks
CREATE POLICY "Users can insert their own tasks"
ON tasks
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email'::text) = user_email
);

-- Policy: Users can view their own tasks
CREATE POLICY "Users can view their own tasks"
ON tasks
FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email'::text) = user_email
);

-- Policy: Users can update their own tasks
CREATE POLICY "Users can update their own tasks"
ON tasks
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email'::text) = user_email
)
WITH CHECK (
  (auth.jwt() ->> 'email'::text) = user_email
);

-- Policy: Users can delete their own tasks
CREATE POLICY "Users can delete their own tasks"
ON tasks
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email'::text) = user_email
);
