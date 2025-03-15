SELECT
  id,
  order_id,
  customer_email,
  customer_phone,
  event_id,
  event_series_id,
  referral_tag,
  refund_amount,
  tax,
  subtotal,
  total,
  status,
  order_created_at,
  payload,
  created_at,
  updated_at
FROM
  ticket_tailor_orders
ORDER BY
  order_created_at DESC
