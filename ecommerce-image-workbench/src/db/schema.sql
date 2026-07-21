CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT UNIQUE,
  project_name TEXT,
  parent_sku TEXT,
  product_name TEXT,
  project_path TEXT,
  source_file_path TEXT,
  total_skus INTEGER DEFAULT 0,
  total_images INTEGER DEFAULT 0,
  downloaded_images INTEGER DEFAULT 0,
  failed_images INTEGER DEFAULT 0,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS project_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  image_type TEXT,
  sku TEXT,
  source_url TEXT,
  local_path TEXT,
  download_status TEXT,
  error_message TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS skus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT,
  sku TEXT,
  variation_name TEXT,
  variation_option TEXT,
  color_name TEXT,
  source_image_url TEXT,
  local_image_path TEXT,
  download_status TEXT,
  created_at TEXT
);
