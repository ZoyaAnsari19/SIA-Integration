-- Migration: Add display_title and display_title_icon_url to users (admin-set title + icon for dashboard/leaderboard)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_title text NULL,
ADD COLUMN IF NOT EXISTS display_title_icon_url text NULL;
