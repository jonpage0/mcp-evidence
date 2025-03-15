SELECT
  p.*,
  COALESCE(p.is_deleted, FALSE) AS is_deleted
FROM studentescape.prices p;