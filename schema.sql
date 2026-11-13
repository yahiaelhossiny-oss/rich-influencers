-- RICH Influencer Portal schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',          -- admin | editor | viewer
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  notif_seen_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS influencers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | info_requested | approved | rejected
  source TEXT NOT NULL DEFAULT 'registration',  -- registration | import | manual

  full_name TEXT NOT NULL,
  photo_key TEXT,                               -- R2 key (uploaded)
  photo_url TEXT,                               -- external URL (imports)
  city TEXT,                                    -- Dubai | Abu Dhabi | Sharjah | other
  gender TEXT,                                  -- female | male | other
  nationality TEXT,
  languages TEXT NOT NULL DEFAULT '[]',         -- JSON array
  email TEXT,
  whatsapp TEXT,
  agency TEXT,
  bio TEXT,
  content_types TEXT,
  availability TEXT NOT NULL DEFAULT 'unknown', -- available | limited | unavailable | unknown
  audience_country TEXT,
  audience_city TEXT,

  ig_username TEXT,
  ig_followers INTEGER,
  ig_er REAL,
  ig_avg_views INTEGER,
  ig_avg_likes INTEGER,
  ig_avg_comments INTEGER,

  tt_username TEXT,
  tt_followers INTEGER,
  tt_er REAL,
  tt_avg_views INTEGER,
  tt_avg_likes INTEGER,
  tt_avg_comments INTEGER,

  price_ig_reel INTEGER,
  price_ig_story INTEGER,
  price_ig_post INTEGER,
  price_ig_carousel INTEGER,
  price_tt_video INTEGER,
  price_tt_live INTEGER,
  price_package INTEGER,
  price_source TEXT,                            -- influencer | management | rate_card | team

  -- derived on every write
  total_followers INTEGER NOT NULL DEFAULT 0,
  tier TEXT,
  min_price INTEGER,
  search_text TEXT,

  consent_at INTEGER,
  admin_notes TEXT,
  info_request TEXT,
  reject_reason TEXT,
  duplicate_of INTEGER,
  duplicate_reason TEXT,
  stats_updated_at INTEGER,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  approved_at INTEGER,
  approved_by TEXT
);

CREATE INDEX IF NOT EXISTS ix_inf_status ON influencers(status);
CREATE INDEX IF NOT EXISTS ix_inf_city ON influencers(city);
CREATE INDEX IF NOT EXISTS ix_inf_ig ON influencers(ig_username);
CREATE INDEX IF NOT EXISTS ix_inf_tt ON influencers(tt_username);
CREATE INDEX IF NOT EXISTS ix_inf_email ON influencers(email);
CREATE INDEX IF NOT EXISTS ix_inf_igf ON influencers(ig_followers);
CREATE INDEX IF NOT EXISTS ix_inf_ttf ON influencers(tt_followers);
CREATE INDEX IF NOT EXISTS ix_inf_total ON influencers(total_followers);

CREATE TABLE IF NOT EXISTS influencer_categories (
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (influencer_id, category_id)
);
CREATE INDEX IF NOT EXISTS ix_ic_cat ON influencer_categories(category_id);

-- Influencer self-service logins
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  influencer_id INTEGER REFERENCES influencers(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- Changes an approved influencer submitted that need admin review
CREATE TABLE IF NOT EXISTS profile_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  data TEXT NOT NULL,                           -- JSON {field: newValue}
  photo_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | approved | rejected
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS ix_pu_status ON profile_updates(status);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  client TEXT,
  brief TEXT,
  budget INTEGER,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planning',      -- planning | active | completed | archived
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_influencers (
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  influencer_id INTEGER NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'shortlisted',   -- shortlisted | sent_to_client | client_approved | contacted | confirmed | live | completed | declined
  deliverables TEXT,
  agreed_price INTEGER,
  notes TEXT,
  added_by TEXT,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, influencer_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id INTEGER,
  at INTEGER NOT NULL,
  by_name TEXT,
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS ix_act_inf ON activity(influencer_id);

CREATE TABLE IF NOT EXISTS throttle (
  k TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_thr ON throttle(k, at);

INSERT OR IGNORE INTO categories (name, sort) VALUES
 ('Lifestyle',10),('Food & Restaurants',20),('Beauty & Skincare',30),('Fashion',40),
 ('Motherhood & Parenting',50),('Family & Kids',60),('Travel',70),('Fitness & Wellness',80),
 ('Automotive',90),('Technology',100),('Entertainment',110),('Luxury',120),
 ('Home & Interior Design',130),('Business & Entrepreneurship',140),('Education',150),
 ('Gaming',160),('Sports',170),('Other',999);
