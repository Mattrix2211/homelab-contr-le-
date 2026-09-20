-- Per-user display settings (Paramètres page): JSON, see routes/preferences.ts
ALTER TABLE user_preferences ADD COLUMN display_settings TEXT;
