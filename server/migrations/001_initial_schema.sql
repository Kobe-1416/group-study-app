-- Group Study App — migration 001
-- PostgreSQL 17+; apply with `npm run migrate` from /server.
-- This migration creates the MVP schema; data and file contents are NOT moved.
-- The migration runner wraps this file in a transaction and records its version.

-- 1. Student accounts
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_valid CHECK (length(trim(email)) BETWEEN 3 AND 320),
  CONSTRAINT users_display_name_valid CHECK (length(trim(display_name)) BETWEEN 2 AND 100)
);
CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

-- 2. Server-side sessions for cookie-based login (store only a hash of the token)
CREATE TABLE auth_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT auth_sessions_valid_expiry CHECK (expires_at > created_at)
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions (expires_at);

-- 3. Study groups: notes are shared within a group, not publicly by default
CREATE TABLE study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  join_code VARCHAR(20) NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT study_groups_name_valid CHECK (length(trim(name)) BETWEEN 2 AND 120)
);

-- 4. Many-to-many relation between groups and users
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id),
  CONSTRAINT group_members_role_valid CHECK (role IN ('owner', 'member'))
);
CREATE INDEX group_members_user_id_idx ON group_members (user_id);

-- 5. A group can host many individual live sessions
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(160) NOT NULL,
  join_code VARCHAR(20) NOT NULL UNIQUE,
  status VARCHAR(10) NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT study_sessions_title_valid CHECK (length(trim(title)) BETWEEN 2 AND 160),
  CONSTRAINT study_sessions_status_valid CHECK (
    (status = 'active' AND ended_at IS NULL)
    OR (status = 'ended' AND ended_at IS NOT NULL AND ended_at >= started_at)
  )
);
CREATE INDEX study_sessions_group_started_idx ON study_sessions (group_id, started_at DESC);

-- 6. One record per student per study session; useful for attendance leaderboards
CREATE TABLE session_participants (
  session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id),
  CONSTRAINT session_participants_time_valid CHECK (left_at IS NULL OR left_at >= joined_at)
);
CREATE INDEX session_participants_user_id_idx ON session_participants (user_id);

-- 7. File contents live in object storage; PostgreSQL stores metadata only
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  file_size_bytes BIGINT NOT NULL,
  page_count INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_title_valid CHECK (length(trim(title)) BETWEEN 1 AND 200),
  CONSTRAINT documents_pdf_only CHECK (mime_type = 'application/pdf'),
  CONSTRAINT documents_file_size_positive CHECK (file_size_bytes > 0),
  CONSTRAINT documents_page_count_positive CHECK (page_count IS NULL OR page_count > 0)
);
CREATE INDEX documents_group_uploaded_idx ON documents (group_id, uploaded_at DESC);

-- 8. Many-to-many relation between live sessions and existing PDF documents
CREATE TABLE session_documents (
  session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, document_id)
);
CREATE INDEX session_documents_document_idx ON session_documents (document_id);

-- 9. Per-student, per-document progress in each live session
CREATE TABLE reading_progress (
  session_id UUID NOT NULL,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  current_page INTEGER NOT NULL DEFAULT 1,
  furthest_page INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, document_id, user_id),
  FOREIGN KEY (session_id, document_id)
    REFERENCES session_documents(session_id, document_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id, user_id)
    REFERENCES session_participants(session_id, user_id) ON DELETE CASCADE,
  CONSTRAINT reading_progress_page_valid CHECK (
    current_page >= 1 AND furthest_page >= current_page
  )
);
CREATE INDEX reading_progress_furthest_idx
  ON reading_progress (session_id, document_id, furthest_page DESC);

-- 10. Chat messages, page-specific questions, and their answers
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  document_id UUID,
  reply_to_message_id UUID,
  kind VARCHAR(10) NOT NULL,
  page_number INTEGER,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, id),
  FOREIGN KEY (session_id, author_id)
    REFERENCES session_participants(session_id, user_id),
  FOREIGN KEY (session_id, document_id)
    REFERENCES session_documents(session_id, document_id),
  FOREIGN KEY (session_id, reply_to_message_id)
    REFERENCES messages(session_id, id),
  CONSTRAINT messages_kind_valid CHECK (kind IN ('chat', 'question', 'answer')),
  CONSTRAINT messages_body_valid CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  CONSTRAINT messages_page_valid CHECK (page_number IS NULL OR page_number >= 1),
  CONSTRAINT messages_structure_valid CHECK (
    (kind = 'chat' AND reply_to_message_id IS NULL)
    OR (kind = 'question' AND document_id IS NOT NULL
      AND page_number IS NOT NULL AND reply_to_message_id IS NULL)
    OR (kind = 'answer' AND reply_to_message_id IS NOT NULL)
  )
);
CREATE INDEX messages_session_recent_idx ON messages (session_id, created_at DESC, id DESC);
CREATE INDEX messages_author_kind_idx ON messages (author_id, kind);
CREATE INDEX messages_reply_idx ON messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- Design notes / upcoming API checks:
-- (a) A study-session document must belong to the same group as the session.
-- (b) Joining a session requires membership of its group.
-- (c) An answer must reply to a question (not another answer).
-- (d) A submitted page must not exceed the uploaded PDF's page_count.
-- (e) Access to private notes and rooms must be authorized per group.
-- These cross-row/business rules will be enforced in services using transactions.
