SELECT
  i.*,
  COALESCE(i.closed, FALSE) AS closed,
  COALESCE(i.forgiven, FALSE) AS forgiven,
  COALESCE(i.is_deleted, FALSE) AS is_deleted
FROM studentescape.invoices i;