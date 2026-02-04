CREATE TABLE IF NOT EXISTS invoice_overrides (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    override_value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    UNIQUE(invoice_id, field_name)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
