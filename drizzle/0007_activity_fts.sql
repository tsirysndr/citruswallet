-- Trigram indexes preserve literal substring search. Short queries use the
-- participant-scoped fallback in Gleam. External content avoids copying text.
CREATE VIRTUAL TABLE payments_fts USING fts5(
  id UNINDEXED, description, recipient_label, sender_did, recipient_did, address, from_address, tx_hash,
  content='payments', content_rowid='rowid', tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER payments_fts_insert AFTER INSERT ON payments BEGIN
  INSERT INTO payments_fts(rowid, id, description, recipient_label, sender_did, recipient_did, address, from_address, tx_hash) VALUES (new.rowid, new.id, new.description, new.recipient_label, new.sender_did, new.recipient_did, new.address, new.from_address, new.tx_hash);
END;
--> statement-breakpoint
CREATE TRIGGER payments_fts_delete AFTER DELETE ON payments BEGIN
  INSERT INTO payments_fts(payments_fts, rowid, id, description, recipient_label, sender_did, recipient_did, address, from_address, tx_hash) VALUES ('delete', old.rowid, old.id, old.description, old.recipient_label, old.sender_did, old.recipient_did, old.address, old.from_address, old.tx_hash);
END;
--> statement-breakpoint
CREATE TRIGGER payments_fts_update AFTER UPDATE OF rowid, id, description, recipient_label, sender_did, recipient_did, address, from_address, tx_hash ON payments BEGIN
  INSERT INTO payments_fts(payments_fts, rowid, id, description, recipient_label, sender_did, recipient_did, address, from_address, tx_hash) VALUES ('delete', old.rowid, old.id, old.description, old.recipient_label, old.sender_did, old.recipient_did, old.address, old.from_address, old.tx_hash);
  INSERT INTO payments_fts(rowid, id, description, recipient_label, sender_did, recipient_did, address, from_address, tx_hash) VALUES (new.rowid, new.id, new.description, new.recipient_label, new.sender_did, new.recipient_did, new.address, new.from_address, new.tx_hash);
END;
--> statement-breakpoint
INSERT INTO payments_fts(payments_fts) VALUES ('rebuild');
--> statement-breakpoint
CREATE VIRTUAL TABLE user_profiles_fts USING fts5(
  did UNINDEXED, handle, display_name,
  content='user_profiles', content_rowid='rowid', tokenize='trigram'
);
--> statement-breakpoint
CREATE TRIGGER user_profiles_fts_insert AFTER INSERT ON user_profiles BEGIN
  INSERT INTO user_profiles_fts(rowid, did, handle, display_name) VALUES (new.rowid, new.did, new.handle, new.display_name);
END;
--> statement-breakpoint
CREATE TRIGGER user_profiles_fts_delete AFTER DELETE ON user_profiles BEGIN
  INSERT INTO user_profiles_fts(user_profiles_fts, rowid, did, handle, display_name) VALUES ('delete', old.rowid, old.did, old.handle, old.display_name);
END;
--> statement-breakpoint
CREATE TRIGGER user_profiles_fts_update AFTER UPDATE OF rowid, id, did, handle, display_name ON user_profiles BEGIN
  INSERT INTO user_profiles_fts(user_profiles_fts, rowid, did, handle, display_name) VALUES ('delete', old.rowid, old.did, old.handle, old.display_name);
  INSERT INTO user_profiles_fts(rowid, did, handle, display_name) VALUES (new.rowid, new.did, new.handle, new.display_name);
END;
--> statement-breakpoint
INSERT INTO user_profiles_fts(user_profiles_fts) VALUES ('rebuild');
