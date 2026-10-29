-- Opt-in safe formatting; existing text is never reinterpreted during upgrade.
ALTER TABLE journals ADD COLUMN body_format TEXT NOT NULL DEFAULT 'plain' CHECK(body_format IN ('plain','markdown'));
