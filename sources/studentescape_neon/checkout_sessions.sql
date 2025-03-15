SELECT
  cs.*,
  COALESCE(cs.m_locked, FALSE) AS m_locked,
  trunc((cs.amount_total / 100.00), 2) AS amount_total
FROM studentescape.checkout_sessions_expanded cs
WHERE cs.status = 'complete'
  AND TO_TIMESTAMP(cs.created) >= timestamp '2024-08-01'
  AND cs.livemode = true
  AND (
    refund_status IS NULL
    OR refund_status = ''
  )
  AND (
    dispute_status IS NULL
    OR dispute_status <> 'lost'
  )
  AND (
    m_email IS NULL
    OR (
      LOWER(m_email) NOT LIKE '%ionakana%'
      AND LOWER(m_email) NOT LIKE '%jonpage.io%'
      AND LOWER(m_email) NOT LIKE '%cmgmedia%'
      AND LOWER(m_email) NOT LIKE '%shiftprojectgroup%'
    )
  )
ORDER BY cs.created DESC;