-- Selected readers augment private pages. Old dm/shared pages retain their audience.
CREATE TABLE journal_recipients (
    campaign_id TEXT NOT NULL,
    journal_id TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    PRIMARY KEY(journal_id,user_id),
    FOREIGN KEY(campaign_id,user_id) REFERENCES memberships(campaign_id,user_id) ON DELETE CASCADE
);
CREATE INDEX journal_recipients_reader ON journal_recipients(campaign_id,user_id,journal_id);
