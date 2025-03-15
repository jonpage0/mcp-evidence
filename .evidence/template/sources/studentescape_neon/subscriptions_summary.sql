WITH subscription_invoices AS (
    SELECT
        i.subscription,
        s.customer,
        SUM(i.amount_paid / 100.00) AS total_billed,
        MAX(i.created) AS last_billing_date
    FROM studentescape.invoices i
    JOIN studentescape.subscriptions s ON i.subscription = s.id
    WHERE i.status = 'paid'
      AND i.created <= EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)
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
combined_subscriptions AS (
    SELECT
        s.id AS subscription_id,
        COALESCE(s.customer, '') AS customer,
        COALESCE(s.status, '') AS status,
        COALESCE(
            CASE 
                WHEN s.status = 'trialing' AND s.trial_end > EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) THEN 'active_trial'
                WHEN s.status = 'trialing' THEN 'trial_ending'
                ELSE s.status
            END,
            ''
        ) AS subscription_status,
        COALESCE(s.application, '') AS application_id,
        COALESCE(si.total_billed, 0) AS total_billed_amount,
        CASE 
            WHEN COALESCE(sb.billing_amount, 0) = 0 THEN COALESCE(np.next_phase_amount, 0)
            ELSE COALESCE(sb.billing_amount, 0)
        END AS future_billing_amount,
        CAST(COALESCE(to_timestamp(si.last_billing_date), CURRENT_TIMESTAMP) AS TIMESTAMP) AS last_billing_date,
        CAST(COALESCE(to_timestamp(s.trial_start), CURRENT_TIMESTAMP) AS TIMESTAMP) AS trial_start_date,
        CAST(COALESCE(to_timestamp(s.trial_end), CURRENT_TIMESTAMP) AS TIMESTAMP) AS trial_end_date,
        CAST(COALESCE(to_timestamp(sp_current.end_date), CURRENT_TIMESTAMP) AS TIMESTAMP) AS current_phase_end_date,
        CAST(COALESCE(to_timestamp(sp_next.start_date), CURRENT_TIMESTAMP) AS TIMESTAMP) AS next_phase_start_date,
        CAST(COALESCE(to_timestamp(sp_next.end_date), CURRENT_TIMESTAMP) AS TIMESTAMP) AS next_phase_end_date,
        COALESCE(p.name, '') AS product_name,
        CASE 
            WHEN s.status = 'trialing' THEN 0
            WHEN s.status = 'active' THEN 1
            WHEN s.status = 'past_due' THEN 2
            WHEN s.status = 'canceled' THEN 3
            ELSE 4
        END AS status_order
    FROM studentescape.subscriptions s
    LEFT JOIN subscription_invoices si ON s.id = si.subscription
    LEFT JOIN subscription_billing sb ON s.id = sb.subscription
    LEFT JOIN next_phase_pricing np ON s.id = np.subscription
    LEFT JOIN subscription_phases sp_current ON s.id = sp_current.subscription 
        AND sp_current.phase_type = 'current'
    LEFT JOIN subscription_phases sp_next ON s.id = sp_next.subscription 
        AND sp_next.phase_type = 'upcoming'
    LEFT JOIN studentescape.prices pr ON s.plan ->> 'id' = pr.id
    LEFT JOIN studentescape.products p ON pr.product = p.id
    LEFT JOIN studentescape.checkout_sessions cs ON s.metadata->>'checkout_session_id' = cs.id
    WHERE s.status IN ('active', 'trialing')
    AND s.application = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
    AND (
        cs.metadata->>'email' IS NULL
        OR (
            LOWER(cs.metadata->>'email') NOT LIKE '%ionakana%'
            AND LOWER(cs.metadata->>'email') NOT LIKE '%jonpage.io%'
            AND LOWER(cs.metadata->>'email') NOT LIKE '%cmgmedia%'
            AND LOWER(cs.metadata->>'email') NOT LIKE '%shiftprojectgroup%'
        )
    )
    
    UNION ALL
    
    SELECT
        s.id AS subscription_id,
        COALESCE(s.customer, '') AS customer,
        COALESCE(s.status, '') AS status,
        COALESCE(
            CASE 
                WHEN s.status = 'past_due' THEN 'past_due_since_' || to_char(to_timestamp(s.current_period_end), 'YYYY_MM_DD')
                WHEN s.status = 'canceled' THEN 'canceled_on_' || to_char(to_timestamp(s.canceled_at), 'YYYY_MM_DD')
                ELSE s.status
            END,
            ''
        ) AS subscription_status,
        COALESCE(s.application, '') AS application_id,
        0 AS total_billed_amount,
        0 AS future_billing_amount,
        CURRENT_TIMESTAMP AS last_billing_date,
        CURRENT_TIMESTAMP AS trial_start_date,
        CURRENT_TIMESTAMP AS trial_end_date,
        CURRENT_TIMESTAMP AS current_phase_end_date,
        CURRENT_TIMESTAMP AS next_phase_start_date,
        CURRENT_TIMESTAMP AS next_phase_end_date,
        '' AS product_name,
        CASE 
            WHEN s.status = 'trialing' THEN 0
            WHEN s.status = 'active' THEN 1
            WHEN s.status = 'past_due' THEN 2
            WHEN s.status = 'canceled' THEN 3
            ELSE 4
        END AS status_order
    FROM studentescape.subscriptions s
    LEFT JOIN studentescape.checkout_sessions cs ON s.metadata->>'checkout_session_id' = cs.id
    WHERE s.status IN ('past_due', 'canceled')
    AND s.application = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
    AND (
        cs.metadata->>'email' IS NULL
        OR (
            LOWER(cs.metadata->>'email') NOT LIKE '%ionakana%'
            AND LOWER(cs.metadata->>'email') NOT LIKE '%jonpage.io%'
            AND LOWER(cs.metadata->>'email') NOT LIKE '%cmgmedia%'
            AND LOWER(cs.metadata->>'email') NOT LIKE '%shiftprojectgroup%'
        )
    )
)
SELECT * FROM combined_subscriptions
ORDER BY status_order, subscription_id DESC;