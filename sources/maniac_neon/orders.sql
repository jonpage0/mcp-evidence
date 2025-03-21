SELECT 
  cs.*,
  TRUNC((cs.amount_total / 100.00), 2) AS amount_total,
  TRUNC((cs."final_stripe_total" / 100.00), 2) AS "final_stripe_total"
FROM maniac.checkout_sessions_expanded cs
  LEFT JOIN maniac.refunds r ON cs.payment_intent = r.payment_intent
  LEFT JOIN maniac.disputes d ON cs.payment_intent = d.payment_intent
WHERE cs.status = 'complete'
  AND to_timestamp(cs.created) >= TIMESTAMP '2024-08-01'
  AND cs.livemode = true -- Exclude refunded/disputed:
  AND (
    r.status IS NULL
    OR r.status = ''
  )
  AND (
    d.status IS NULL
    OR d.status <> 'lost'
  ) -- Exclude internal/test emails
  AND (
    cs.m_email IS NULL
    OR (
      LOWER(cs.m_email) NOT LIKE '%ionakana%'
      AND LOWER(cs.m_email) NOT LIKE '%jonpage.io%'
      AND LOWER(cs.m_email) NOT LIKE '%cmgmedia%'
      AND LOWER(cs.m_email) NOT LIKE '%shiftprojectgroup%'
    )
  )
  -- Filter for specific order types
  AND (
    cs."final_type" IN ('card', 'card-upgrade')
    OR (cs."final_type" IS NULL AND cs."final_tier" IN ('maniac-vip-card', 'maniac-card'))
  )