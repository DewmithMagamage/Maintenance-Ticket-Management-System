-- British Way Holdings — Maintenance Ticket Management System
-- PostgreSQL 14+

-- Organizations as free text on branch; departments for routing

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  organization VARCHAR(128) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(64) UNIQUE NOT NULL,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE user_role AS ENUM ('branch_user', 'dept_staff', 'admin');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(128),
  role user_role NOT NULL DEFAULT 'branch_user',
  branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_branch_user_branch CHECK (
    role <> 'branch_user' OR branch_id IS NOT NULL
  ),
  CONSTRAINT chk_dept_staff_dept CHECK (
    role <> 'dept_staff' OR department_id IS NOT NULL
  )
);

CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE ticket_status AS ENUM (
  'new',
  'assigned',
  'in_progress',
  'completed',
  'closed'
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(16) GENERATED ALWAYS AS ('BW-' || LPAD(id::TEXT, 4, '0')) STORED UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  branch_id INT NOT NULL REFERENCES branches(id),
  category_id INT NOT NULL REFERENCES categories(id),
  priority ticket_priority NOT NULL DEFAULT 'medium',
  location_room VARCHAR(255),
  contact_person VARCHAR(128) NOT NULL,
  contact_number VARCHAR(64) NOT NULL,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  status ticket_status NOT NULL DEFAULT 'new',
  created_by INT NOT NULL REFERENCES users(id),
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  satisfaction_rating SMALLINT CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5)),
  satisfaction_comment TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  stored_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_audit (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id INT REFERENCES tickets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_branch ON tickets(branch_id);
CREATE INDEX idx_tickets_department ON tickets(department_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);
CREATE INDEX idx_tickets_category ON tickets(category_id);
CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_ticket_audit_ticket ON ticket_audit(ticket_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER tr_tickets_updated BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
