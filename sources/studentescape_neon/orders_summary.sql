WITH session_refunds AS (
    SELECT
        cs.id AS session_id,
        SUM(r.amount)/100.00 AS total_session_refunds
    FROM studentescape.checkout_sessions_expanded cs
    LEFT JOIN studentescape.refunds r ON cs.payment_intent = r.payment_intent
    LEFT JOIN studentescape.disputes d ON cs.payment_intent = d.payment_intent
    WHERE (d.status IS NULL OR d.status <> 'lost')
    GROUP BY cs.id
),
subscription_invoices AS (
    SELECT
        i.subscription,
        s.customer,
        SUM(i.amount_paid / 100.00) AS total_billed,
        MAX(i.created) AS last_billing_date
    FROM studentescape.invoices i
    JOIN studentescape.subscriptions s ON i.subscription = s.id
    LEFT JOIN studentescape.disputes d ON i.payment_intent = d.payment_intent
    WHERE i.status = 'paid'
      AND i.created <= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)
      AND (d.status IS NULL OR d.status <> 'lost')
    GROUP BY i.subscription, s.customer
),
subscription_phases AS (
    SELECT
        ss.subscription,
        phase.value->>'id' AS phase_id,
        (phase.value->>'start_date')::bigint AS start_date,
        (phase.value->>'end_date')::bigint AS end_date,
        phase.value->'items'->0->'price' AS phase_price_id,
        CASE 
            WHEN (phase.value->>'start_date')::bigint <= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) 
             AND (phase.value->>'end_date')::bigint >= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) THEN 'current'
            WHEN (phase.value->>'start_date')::bigint > EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) THEN 'upcoming'
            ELSE 'past'
        END AS phase_type,
        phase.ordinality AS phase_order
    FROM studentescape.subscription_schedule ss,
         jsonb_array_elements(ss.phases) WITH ORDINALITY phase
    WHERE (phase.value->>'end_date')::bigint >= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)
),
next_phase_pricing AS (
    SELECT 
        sp.subscription,
        MIN(pr.unit_amount / 100.00) AS next_phase_amount
    FROM subscription_phases sp
    JOIN studentescape.prices pr ON pr.id = sp.phase_price_id#>>'{}'
    WHERE sp.phase_type = 'upcoming'
    GROUP BY sp.subscription
),
subscription_billing AS (
    SELECT
        ili.subscription,
        SUM(ili.amount / 100.00) AS billing_amount
    FROM studentescape.invoice_line_items ili
    GROUP BY ili.subscription
),
payment_plan_deposits AS (
    SELECT
        s.id AS subscription_id,
        COALESCE(SUM(cs.m_total_after_tax_first_installment), 0) AS total_deposits,
        MAX(
            CASE
                WHEN cs.m_name LIKE '% - Week %' THEN
                    TRIM(SUBSTRING(cs.m_name FROM 1 FOR POSITION(' - Week' IN cs.m_name)-1))
                ELSE cs.m_name
            END
        ) AS location,
        MAX(cs.m_customer_name) AS customer_name,
        MAX(cs.m_customer_email) AS customer_email
    FROM studentescape.subscriptions s
    JOIN studentescape.checkout_sessions_expanded cs ON s.customer = cs.customer
    WHERE cs.m_payment_method_legacy = 'installment-plan'
      AND cs.status = 'complete'
      AND (cs.refund_status IS NULL OR cs.refund_status = '')
      AND (cs.dispute_status IS NULL OR cs.dispute_status <> 'lost')
    GROUP BY s.id
),
subscription_refunds AS (
    SELECT
        s.id AS subscription_id,
        COALESCE(SUM(r.amount)/100.00, 0) AS total_refunds
    FROM studentescape.subscriptions s
    JOIN studentescape.invoices i ON i.subscription = s.id
    JOIN studentescape.refunds r ON i.payment_intent = r.payment_intent
    LEFT JOIN studentescape.disputes d ON i.payment_intent = d.payment_intent
    WHERE r.status = 'succeeded'
      AND (d.status IS NULL OR d.status <> 'lost')
    GROUP BY s.id
),
products_from_cs AS (
    SELECT DISTINCT cs.m_product_id AS product_id, p.name AS product_name
    FROM studentescape.checkout_sessions_expanded cs
    LEFT JOIN studentescape.products p ON cs.m_product_id = p.id
    WHERE cs.m_product_id IS NOT NULL
)

SELECT
    s.id AS subscription_id,
    s.customer,
    COALESCE(s.status, 'complete') AS status,
    CASE 
        WHEN s.status = 'trialing' AND s.trial_end > EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) THEN 'active_trial'
        WHEN s.status = 'trialing' THEN 'trial_ending'
        WHEN s.status = 'past_due' THEN 'past_due_since_' || to_char((to_timestamp(s.current_period_end) AT TIME ZONE 'America/New_York'), 'YYYY_MM_DD')
        WHEN s.status = 'canceled' THEN 'canceled_on_' || to_char((to_timestamp(s.canceled_at) AT TIME ZONE 'America/New_York'), 'YYYY_MM_DD')
        WHEN s.status IS NULL THEN 'complete'
        ELSE s.status
    END AS subscription_status,
    s.application AS application_id,
    cs.id AS checkout_session_id,
    
    -- Customer Information
    COALESCE(ppd.customer_name, cs.m_customer_name) AS customer_name,
    COALESCE(ppd.customer_email, cs.m_customer_email) AS customer_email,

    -- Product Information
    COALESCE(
        p.name, 
        (SELECT pf.product_name FROM products_from_cs pf WHERE pf.product_id = cs.m_product_id),
        cs.m_name
    ) AS product_name_original,
    COALESCE(
        REGEXP_REPLACE(REGEXP_REPLACE(p.name, ' - Deposit$', ''), ' - Installment$', ''),
        (SELECT REGEXP_REPLACE(REGEXP_REPLACE(pf.product_name, ' - Deposit$', ''), ' - Installment$', '') 
         FROM products_from_cs pf 
         WHERE pf.product_id = cs.m_product_id),
        REGEXP_REPLACE(REGEXP_REPLACE(cs.m_name, ' - Deposit$', ''), ' - Installment$', '')
    ) AS product_name,
    COALESCE(ppd.location,
        CASE 
            WHEN cs.m_name LIKE '% - Week %' THEN TRIM(SUBSTRING(cs.m_name FROM 1 FOR POSITION(' - Week' IN cs.m_name)-1)) 
            ELSE cs.m_name 
        END
    ) AS location,

    -- Billing Information
    CASE
        WHEN cs.m_payment_method_legacy = 'pay-now' THEN 'upfront'
        WHEN cs.m_payment_method_legacy = 'installment-plan' THEN 'plan'
        ELSE 'other'
    END AS payment_type,
    (COALESCE(si.total_billed, 0) 
     + CASE WHEN cs.m_payment_method_legacy = 'pay-now' THEN COALESCE(cs.m_total_after_tax, 0) ELSE 0 END
     + COALESCE(ppd.total_deposits, 0)
    ) AS total_billed_amount,
    COALESCE(ppd.total_deposits, 0) AS total_deposits,
    (COALESCE(sr.total_refunds, 0) 
     + COALESCE(sf.total_session_refunds, 0)
    ) AS total_refunds,
    (
      (COALESCE(si.total_billed, 0) 
       + CASE WHEN cs.m_payment_method_legacy = 'pay-now' THEN COALESCE(cs.m_total_after_tax, 0) ELSE 0 END
       + COALESCE(ppd.total_deposits, 0)
      )
      - (COALESCE(sr.total_refunds, 0) + COALESCE(sf.total_session_refunds, 0))
    ) AS net_billed_amount,
    (
      (COALESCE(si.total_billed, 0) 
       + CASE WHEN cs.m_payment_method_legacy = 'pay-now' THEN COALESCE(cs.m_total_after_tax, 0) ELSE 0 END
      )
      - (COALESCE(sr.total_refunds, 0) + COALESCE(sf.total_session_refunds, 0))
    ) AS net_billed_amount_subscription,
    CASE 
        WHEN s.status = 'canceled' THEN 0
        WHEN cs.m_payment_method_legacy = 'pay-now' THEN 0
        WHEN COALESCE(sb.billing_amount, 0) = 0 THEN COALESCE(np.next_phase_amount, 0)
        ELSE COALESCE(sb.billing_amount, 0)
    END AS future_billing_amount,

    -- Date Information
    to_char((CASE 
        WHEN cs.m_payment_method_legacy = 'pay-now' THEN (to_timestamp(cs.created) AT TIME ZONE 'America/New_York')
        ELSE (to_timestamp(si.last_billing_date) AT TIME ZONE 'America/New_York')
     END), 'YYYY-MM-DD HH24:MI:SS') AS last_billing_date_est,
    to_char((to_timestamp(cs.created) AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD HH24:MI:SS') AS initial_purchase_date_est,
    to_char((to_timestamp(s.trial_start) AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD HH24:MI:SS') AS trial_start_date_est,
    to_char((to_timestamp(s.trial_end) AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD HH24:MI:SS') AS trial_end_date_est,
    to_char((to_timestamp(sp_current.end_date) AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD HH24:MI:SS') AS current_phase_end_date_est,
    to_char((to_timestamp(sp_next.start_date) AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD HH24:MI:SS') AS next_phase_start_date_est,
    to_char((to_timestamp(sp_next.end_date) AT TIME ZONE 'America/New_York'), 'YYYY-MM-DD HH24:MI:SS') AS next_phase_end_date_est,
    to_timestamp(cs.created) AT TIME ZONE 'America/New_York' AS created_at_est,

    -- Status Order
    CASE 
        WHEN s.status = 'trialing' THEN 0
        WHEN s.status = 'active' THEN 1
        WHEN s.status = 'past_due' THEN 2
        WHEN s.status = 'canceled' THEN 3
        ELSE 4
    END AS status_order

FROM studentescape.checkout_sessions_expanded cs
LEFT JOIN studentescape.subscriptions s 
  ON s.customer = cs.customer 
  AND s.application = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND s.livemode = true
LEFT JOIN subscription_invoices si ON s.id = si.subscription
LEFT JOIN subscription_billing sb ON s.id = sb.subscription
LEFT JOIN next_phase_pricing np ON s.id = np.subscription
LEFT JOIN subscription_phases sp_current ON s.id = sp_current.subscription AND sp_current.phase_type = 'current'
LEFT JOIN subscription_phases sp_next ON s.id = sp_next.subscription AND sp_next.phase_type = 'upcoming'
LEFT JOIN studentescape.prices pr ON s.plan->>'id' = pr.id
LEFT JOIN studentescape.products p ON pr.product = p.id
LEFT JOIN payment_plan_deposits ppd ON s.id = ppd.subscription_id
LEFT JOIN subscription_refunds sr ON s.id = sr.subscription_id
LEFT JOIN session_refunds sf ON cs.id = sf.session_id
WHERE cs.status = 'complete'
  AND cs.livemode = true
  AND (cs.refund_status IS NULL OR cs.refund_status = '')
  AND (cs.dispute_status IS NULL OR cs.dispute_status <> 'lost')
  AND (
    cs.m_email IS NULL
    OR (
      LOWER(cs.m_email) NOT LIKE '%ionakana%'
      AND LOWER(cs.m_email) NOT LIKE '%jonpage.io%'
      AND LOWER(cs.m_email) NOT LIKE '%cmgmedia%'
      AND LOWER(cs.m_email) NOT LIKE '%shiftprojectgroup%'
      AND LOWER(cs.m_email) NOT LIKE '%felix.vemmer%'
      AND LOWER(cs.m_email) NOT LIKE '%studentescape.com%'
    )
  )
  AND (
    (cs.m_payment_method_legacy = 'pay-now')
    OR (
      s.application = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
      AND s.livemode = true
    )
  )
  AND NOT (
    cs.m_payment_method_legacy = 'pay-now'
    AND (
      cs.m_name LIKE '% - Deposit'
      OR cs.m_total_after_tax = 50.0
    )
  )
ORDER BY status_order, subscription_id DESC;