---
title: Sales Staff
hide_title: true
description: Ticket sales analytics
---

```sql total_activated_cards
SELECT COUNT(*) AS total_activated_cards
FROM maniac_neon_prod.orders
WHERE orders.stripe_checkout_session_id LIKE 'cash_%'
```

```sql cash_orders
-- Basic query to check if there are orders with cash_ prefix
SELECT 
    id,
    stripe_checkout_session_id,
    issued_cards_id
FROM maniac_neon_prod.orders
WHERE stripe_checkout_session_id LIKE 'cash_%'
LIMIT 5;
```

```sql activated_cards_breakdown
WITH filtered_orders AS (
    SELECT o.*, ic.product_card_id
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
),
location_data AS (
    SELECT fo.*, 
           l.name as location_name,
           ct.name as tier_name
    FROM filtered_orders fo
    JOIN maniac_neon_prod.cards c ON fo.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
)
SELECT 
    location_name AS location,
    SUM(CASE WHEN tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS "Maniac Card",
    SUM(CASE WHEN tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS "Maniac VIP",
    COUNT(*) AS "Total"
FROM location_data
GROUP BY location_name
ORDER BY location_name;
```

```sql daily_card_activations
-- Get daily card activations starting from February 27, 2025
WITH filtered_orders AS (
    SELECT 
        o.*,
        ic.product_card_id,
        date_trunc('day', o.created_at) AS activation_date
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND o.created_at >= '2025-02-27'
),
daily_data AS (
    SELECT 
        fo.activation_date,
        ct.name as tier_name
    FROM filtered_orders fo
    JOIN maniac_neon_prod.cards c ON fo.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
)
SELECT 
    activation_date AS date,
    SUM(CASE WHEN tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
    SUM(CASE WHEN tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_cards,
    COUNT(*) AS total_activations
FROM daily_data
GROUP BY activation_date
ORDER BY activation_date;
```

```sql location_metrics_simplified
-- Simplified query to find location metrics
SELECT 
    l.id AS location_id,
    l.name AS location_name,
    COUNT(o.id) AS total_activated,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
GROUP BY l.id, l.name
ORDER BY l.name;
```

```sql fort_lauderdale_metrics
-- Get metrics for Fort Lauderdale
SELECT 
    COUNT(o.id) AS total_activated,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND l.name = 'Fort Lauderdale';
```

```sql fort_lauderdale_today_metrics
-- Get metrics for Fort Lauderdale for today only
SELECT 
    COUNT(o.id) AS total_activated,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND l.name = 'Fort Lauderdale'
AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS))
```

```sql pcb_metrics
-- Get metrics for Panama City Beach
SELECT 
    COUNT(o.id) AS total_activated,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND l.name = 'Panama City Beach';
```

```sql pcb_today_metrics
-- Get metrics for Panama City Beach for today only
SELECT 
    COUNT(o.id) AS total_activated,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND l.name = 'Panama City Beach'
AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS))
```

```sql total_card_types
-- Get total cards activated by type across all locations
WITH filtered_orders AS (
    SELECT o.*, ic.product_card_id
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
)
SELECT 
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS total_maniac_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS total_maniac_vip
FROM filtered_orders fo
JOIN maniac_neon_prod.cards c ON fo.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
```

```sql card_tier_to_location_sankey
-- Query to create data for Sankey diagram: Card Tiers to Locations
WITH card_data AS (
    SELECT 
        ct.name AS card_tier,
        l.name AS location,
        COUNT(o.id) AS total_cards
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    GROUP BY ct.name, l.name
),
total_count AS (
    SELECT SUM(total_cards) AS overall_total FROM card_data
)
SELECT 
    card_tier AS source,
    location AS target,
    total_cards AS value,
    ROUND((total_cards * 100.0) / (SELECT overall_total FROM total_count), 1) AS percent
FROM card_data
ORDER BY card_tier, location;
```

```sql sales_channel_to_location_sankey
-- Query to create data for Sankey diagram: Sales Channels to Locations
WITH sales_data AS (
    -- Cash/activated sales
    SELECT 
        'Cash Activations' AS source,
        l.name AS target,
        COUNT(o.id) AS value
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    GROUP BY source, target
    
    UNION ALL
    
    -- Referral sales
    SELECT 
        'Referral Sales' AS source,
        l.name AS target,
        COUNT(o.id) AS value
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    WHERE o.referral_code IS NOT NULL
    AND (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
    GROUP BY source, target
),
total_count AS (
    SELECT SUM(value) AS overall_total FROM sales_data
)
SELECT 
    source,
    target,
    value,
    ROUND((value * 100.0) / (SELECT overall_total FROM total_count), 1) AS percent
FROM sales_data
ORDER BY source, target;
```

```sql staff_marketing_referral_sales
-- Get sales data for referral codes associated with staff users
-- Break down by Card Tier with separate columns and include ticket sales
WITH card_orders AS (
    SELECT 
        rc.slug,
        COUNT(CASE 
            WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND (o.stripe_checkout_session IS NULL 
                 OR coalesce(o.stripe_checkout_session->'metadata'->>'type', '') != 'card-upgrade')
            THEN o.id END) AS card_orders,
        SUM(CASE 
            WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac Card' 
            AND (o.stripe_checkout_session IS NULL 
                 OR coalesce(o.stripe_checkout_session->'metadata'->>'type', '') != 'card-upgrade')
            THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE 
            WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac VIP Card' 
            AND (o.stripe_checkout_session IS NULL 
                 OR coalesce(o.stripe_checkout_session->'metadata'->>'type', '') != 'card-upgrade')
            THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    GROUP BY rc.slug
),
ticket_orders AS (
    SELECT 
        rc.slug,
        COUNT(CASE WHEN tto.status != 'refunded' THEN tto.order_id END) AS tickets_sold
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.ticket_tailor_orders tto ON tto.referral_tag = rc.slug
    GROUP BY rc.slug
)
SELECT 
    rc.details AS description,
    rc.slug AS referral_code,
    COALESCE(co.card_orders, 0) AS total_orders,
    COALESCE(co.maniac_cards, 0) AS maniac_cards,
    COALESCE(co.vip_cards, 0) AS vip_cards,
    COALESCE(tco.tickets_sold, 0) AS tickets_sold
FROM maniac_neon_prod.referral_codes rc
LEFT JOIN card_orders co ON co.slug = rc.slug
LEFT JOIN ticket_orders tco ON tco.slug = rc.slug
LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
WHERE (u.staff_member = true OR rc.type = 'sales' OR rc.type = 'marketing')
ORDER BY total_orders DESC;
```

```sql staff_referral_summary
-- Summary metrics for all staff referral codes (excluding lb%)
SELECT 
    COUNT(DISTINCT rc.id) AS total_referral_codes,
    COUNT(DISTINCT u.id) AS total_staff_with_codes,
    COUNT(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) THEN o.id END) AS total_orders
FROM maniac_neon_prod.referral_codes rc
LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
WHERE (u.staff_member = true OR rc.type = 'sales')
AND rc.slug NOT LIKE 'lb%';
```

```sql top_staff_referrers
-- Top staff members by orders across all their referral codes
WITH card_orders AS (
    SELECT 
        rc.slug,
        CASE 
            WHEN u.full_name IS NULL OR TRIM(u.full_name) = '' THEN 'No User Linked'
            ELSE u.full_name
        END AS staff_name,
        rc.details AS code_description,
        COUNT(CASE 
            WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) 
            AND (o.stripe_checkout_session IS NULL 
                 OR coalesce(o.stripe_checkout_session->'metadata'->>'type', '') != 'card-upgrade')
            THEN o.id END) AS card_orders,
        SUM(CASE 
            WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) 
            AND ct.name = 'Maniac Card' 
            AND (o.stripe_checkout_session IS NULL 
                 OR coalesce(o.stripe_checkout_session->'metadata'->>'type', '') != 'card-upgrade')
            THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE 
            WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) 
            AND ct.name = 'Maniac VIP Card' 
            AND (o.stripe_checkout_session IS NULL 
                 OR coalesce(o.stripe_checkout_session->'metadata'->>'type', '') != 'card-upgrade')
            THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
    LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE (u.staff_member = true OR rc.type = 'sales' OR rc.type = 'marketing')
    AND (o.created_at IS NULL OR o.created_at >= '2025-02-27')
    GROUP BY rc.slug, staff_name, rc.details
),
ticket_orders AS (
    SELECT 
        rc.slug,
        COUNT(CASE WHEN tto.status != 'refunded' THEN tto.order_id END) AS tickets_sold
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.ticket_tailor_orders tto ON tto.referral_tag = rc.slug
    WHERE (tto.created_at IS NULL OR tto.created_at >= '2025-02-27')
    GROUP BY rc.slug
)
SELECT 
    co.staff_name,
    rc.slug AS referral_code,
    co.code_description,
    COALESCE(co.card_orders, 0) AS total_orders,
    COALESCE(co.maniac_cards, 0) AS maniac_cards,
    COALESCE(co.vip_cards, 0) AS vip_cards,
    COALESCE(tco.tickets_sold, 0) AS tickets_sold
FROM maniac_neon_prod.referral_codes rc
LEFT JOIN card_orders co ON co.slug = rc.slug
LEFT JOIN ticket_orders tco ON tco.slug = rc.slug
LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
WHERE (u.staff_member = true OR rc.type = 'sales' OR rc.type = 'marketing')
AND (COALESCE(co.card_orders, 0) > 0 OR COALESCE(tco.tickets_sold, 0) > 0)
ORDER BY total_orders DESC, co.staff_name;
```

```sql staff_referral_hourly_trend
-- Hourly trend of orders from staff referral codes starting February 27, broken down by card tier
WITH hourly_data AS (
    SELECT 
        date_trunc('hour', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) AS hour,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) AND ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) AND ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.referral_codes rc ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE (u.staff_member = true OR rc.type = 'sales')
    AND rc.slug NOT LIKE 'lb%'
    AND o.created_at IS NOT NULL
    AND o.created_at >= '2025-02-27'
    GROUP BY hour
    ORDER BY hour
)
SELECT 
    hour,
    maniac_cards,
    vip_cards
FROM hourly_data
WHERE hour IS NOT NULL
ORDER BY hour;
```

```sql top_referral_codes_orders
-- Orders for top 5 referral codes by total orders
SELECT 
    rc.slug AS referral_code,
    rc.details AS description,
    COALESCE(u.full_name, rc.details) AS staff_member,
    COUNT(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) THEN o.id END) AS total_orders
FROM maniac_neon_prod.referral_codes rc
LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
WHERE (u.staff_member = true OR rc.type = 'sales')
AND rc.slug NOT LIKE 'lb%'
GROUP BY rc.slug, rc.details, COALESCE(u.full_name, rc.details)
ORDER BY total_orders DESC
LIMIT 5;
```

```sql lightbox_summary
-- Summary metrics for Lightbox referral codes
SELECT 
    COUNT(DISTINCT rc.id) AS total_referral_codes,
    COUNT(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) THEN o.id END) AS total_orders
FROM maniac_neon_prod.referral_codes rc
LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
WHERE rc.slug LIKE 'lb%';
```

```sql lightbox_card_types
-- Lightbox sales by card type
WITH card_orders AS (
    SELECT 
        rc.slug,
        COUNT(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            THEN o.id END) AS card_orders,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE rc.slug LIKE 'lb%'
    GROUP BY rc.slug
)
SELECT 
    SUM(COALESCE(card_orders, 0)) AS total_orders,
    SUM(COALESCE(maniac_cards, 0)) AS total_maniac_cards,
    SUM(COALESCE(vip_cards, 0)) AS total_vip_cards
FROM card_orders;
```

```sql lightbox_daily_trend
-- Daily trend of Lightbox sales
WITH daily_data AS (
    SELECT 
        date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) AS day,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.referral_codes rc ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE rc.slug LIKE 'lb%'
    AND o.created_at >= '2025-02-27'
    GROUP BY day
)
SELECT 
    day as date,
    maniac_cards,
    vip_cards,
    (maniac_cards + vip_cards) AS total_sales
FROM daily_data
WHERE day IS NOT NULL
ORDER BY day;
```

```sql lightbox_location_breakdown
-- Lightbox sales by location
WITH filtered_orders AS (
    SELECT o.*, ic.product_card_id
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.referral_codes rc ON o.referral_code = rc.slug
    WHERE rc.slug LIKE 'lb%'
    AND (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
),
location_data AS (
    SELECT fo.*, 
           l.name as location_name,
           ct.name as tier_name
    FROM filtered_orders fo
    JOIN maniac_neon_prod.cards c ON fo.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
)
SELECT 
    location_name AS location,
    SUM(CASE WHEN tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS "Maniac Card",
    SUM(CASE WHEN tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS "Maniac VIP",
    COUNT(*) AS "Total"
FROM location_data
GROUP BY location_name
ORDER BY "Total" DESC;
```

```sql lightbox_referral_details
-- Detailed breakdown by Lightbox referral code
WITH card_orders AS (
    SELECT 
        rc.slug,
        rc.details AS code_description,
        COUNT(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            THEN o.id END) AS card_orders,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
            AND ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.orders o ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE rc.slug LIKE 'lb%'
    GROUP BY rc.slug, rc.details
),
ticket_orders AS (
    SELECT 
        rc.slug,
        COUNT(CASE WHEN tto.status != 'refunded' THEN tto.order_id END) AS tickets_sold
    FROM maniac_neon_prod.referral_codes rc
    LEFT JOIN maniac_neon_prod.ticket_tailor_orders tto ON tto.referral_tag = rc.slug
    WHERE rc.slug LIKE 'lb%'
    GROUP BY rc.slug
)
SELECT 
    co.code_description AS description,
    co.slug AS referral_code,
    COALESCE(co.card_orders, 0) AS total_orders,
    COALESCE(co.maniac_cards, 0) AS maniac_cards,
    COALESCE(co.vip_cards, 0) AS vip_cards,
    COALESCE(tco.tickets_sold, 0) AS tickets_sold
FROM maniac_neon_prod.referral_codes rc
LEFT JOIN card_orders co ON co.slug = rc.slug
LEFT JOIN ticket_orders tco ON tco.slug = rc.slug
WHERE rc.slug LIKE 'lb%'
ORDER BY total_orders DESC;
```

```sql total_activated_cards_ly
SELECT COALESCE(COUNT(*), 0) AS total_activated_cards_ly
FROM maniac_neon_2024.orders
WHERE orders.stripe_checkout_session_id LIKE 'cash_%'
AND created_at <= DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 DAYS'))
```

```sql total_card_types_ly
-- Get total cards activated by type across all locations - Last Year To Date
WITH filtered_orders AS (
    SELECT o.*, ic.product_card_id
    FROM maniac_neon_2024.orders o
    JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND o.created_at <= DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 DAYS'))
)
SELECT 
    COALESCE(SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END), 0) AS total_maniac_cards_ly,
    COALESCE(SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END), 0) AS total_maniac_vip_ly
FROM filtered_orders fo
JOIN maniac_neon_2024.cards c ON fo.product_card_id = c.id
JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
```

```sql combined_card_metrics
-- Combined query with both current and last year metrics in a single result set
SELECT
    tc.total_activated_cards,
    tly.total_activated_cards_ly,
    ct.total_maniac_cards,
    ctly.total_maniac_cards_ly,
    ct.total_maniac_vip,
    ctly.total_maniac_vip_ly,
    
    -- Calculate absolute differences
    (tc.total_activated_cards - tly.total_activated_cards_ly) AS total_cards_diff,
    (ct.total_maniac_cards - ctly.total_maniac_cards_ly) AS maniac_cards_diff,
    (ct.total_maniac_vip - ctly.total_maniac_vip_ly) AS vip_cards_diff,
    
    -- Calculate percentage changes
    CASE 
        WHEN tly.total_activated_cards_ly = 0 THEN 100
        ELSE ((tc.total_activated_cards - tly.total_activated_cards_ly) * 100.0 / tly.total_activated_cards_ly)
    END AS total_cards_pct,
    
    CASE 
        WHEN ctly.total_maniac_cards_ly = 0 THEN 100
        ELSE ((ct.total_maniac_cards - ctly.total_maniac_cards_ly) * 100.0 / ctly.total_maniac_cards_ly)
    END AS maniac_cards_pct,
    
    CASE 
        WHEN ctly.total_maniac_vip_ly = 0 THEN 100
        ELSE ((ct.total_maniac_vip - ctly.total_maniac_vip_ly) * 100.0 / ctly.total_maniac_vip_ly)
    END AS vip_cards_pct
FROM 
    ${total_activated_cards} tc
CROSS JOIN
    ${total_activated_cards_ly} tly
CROSS JOIN
    ${total_card_types} ct
CROSS JOIN
    ${total_card_types_ly} ctly
```

# Cash / Activated Cards

<div class="flex flex-row w-full md:w-3/4 justify-between">

<BigValue 
    data={combined_card_metrics}
    value="total_activated_cards"
    title="Total Cards Activated"
    fmt="num0"
    comparison="total_activated_cards_ly"
    comparisonTitle="vs LYTD"
    comparisonFmt="num0"
    emptySet="pass"
    comparisonDelta=false
/>

<BigValue 
    data={combined_card_metrics}
    value="total_maniac_cards"
    title="Total Maniac Cards"
    fmt="num0"
    comparison="total_maniac_cards_ly"
    comparisonTitle="vs LYTD"
    comparisonFmt="num0"
    emptySet="pass"
    comparisonDelta=false
/>

<BigValue 
    data={combined_card_metrics}
    value="total_maniac_vip"
    title="Total Maniac VIP Cards"
    fmt="num0"
    comparison="total_maniac_vip_ly"
    comparisonTitle="vs LYTD"
    comparisonFmt="num0"
    emptySet="pass"
    comparisonDelta=false
/>

</div>

<BarChart
    data={daily_card_activations}
    x=date
    y={["maniac_cards", "maniac_vip_cards"]}
    title="Card Activations by Day"
    type="grouped"
    xAxisTitle="Date"
    yAxisTitle="Cards Activated"
    labels=true
    legend=true
    colorPalette={[
      '#7A57C9',
      '#C46696',
    ]}
/>

<Alert status="info">
Switch between Today and All Time by clicking the tabs below.
</Alert>

<Tabs id="activated_timeframe">
    <Tab label="Today">
        <h2>Fort Lauderdale</h2>
        <div class="flex flex-row w-full justify-between">
            <BigValue 
                data={fort_lauderdale_today_metrics}
                value="total_activated"
                title="Cards Activated Today"
                fmt="num0"
            />

            <BigValue 
                data={fort_lauderdale_today_metrics}
                value="maniac_cards_activated"
                title="Maniac Cards Today"
                fmt="num0"
            />

            <BigValue 
                data={fort_lauderdale_today_metrics}
                value="maniac_vip_activated"
                title="Maniac VIP Cards Today"
                fmt="num0"
            />
        </div>

        <h2>Panama City Beach</h2>
        <div class="flex flex-row w-full justify-between">
            <BigValue 
                data={pcb_today_metrics}
                value="total_activated"
                title="Cards Activated Today"
                fmt="num0"
            />

            <BigValue 
                data={pcb_today_metrics}
                value="maniac_cards_activated"
                title="Maniac Cards Today"
                fmt="num0"
            />

            <BigValue 
                data={pcb_today_metrics}
                value="maniac_vip_activated"
                title="Maniac VIP Cards Today"
                fmt="num0"
            />
        </div>
    </Tab>
    <Tab label="All Time">
        <h2>Fort Lauderdale</h2>
        <div class="flex flex-row w-full justify-between">
            <BigValue 
                data={fort_lauderdale_metrics}
                value="total_activated"
                title="Total Cards Activated"
                fmt="num0"
            />

            <BigValue 
                data={fort_lauderdale_metrics}
                value="maniac_cards_activated"
                title="Maniac Cards"
                fmt="num0"
            />

            <BigValue 
                data={fort_lauderdale_metrics}
                value="maniac_vip_activated"
                title="Maniac VIP Cards"
                fmt="num0"
            />
        </div>

        <h2>Panama City Beach</h2>
        <div class="flex flex-row w-full justify-between">
            <BigValue 
                data={pcb_metrics}
                value="total_activated"
                title="Total Cards Activated"
                fmt="num0"
            />

            <BigValue 
                data={pcb_metrics}
                value="maniac_cards_activated"
                title="Maniac Cards"
                fmt="num0"
            />

            <BigValue 
                data={pcb_metrics}
                value="maniac_vip_activated"
                title="Maniac VIP Cards"
                fmt="num0"
            />
        </div>
    </Tab>
</Tabs>


---

# Staff & Marketing Referral Code Sales

<div class="flex flex-row w-full md:w-3/4 justify-between">

<BigValue 
    data={staff_referral_summary}
    value="total_referral_codes"
    title="Total Staff Referral Codes"
    fmt="num0"
/>

<BigValue 
    data={staff_referral_summary}
    value="total_orders"
    title="Total Orders"
    fmt="num0"
/>

<BigValue 
    data={staff_referral_summary}
    value="total_staff_with_codes"
    title="Staff Members"
    fmt="num0"
/>

</div>

<BarChart
    data={staff_referral_daily_trend}
    x=date
    y={["maniac_cards", "vip_cards"]}
    title="Staff Referral Orders by Day and Card Type"
    type=stacked
    xAxisTitle="Date"
    yAxisTitle="Orders"
    labels=true
    legend=true
    colorPalette={[
        '#7A57C9',
        '#C46696',
    ]}
    chartAreaHeight={250}
/>

## Sales Staff

<DataTable 
    data={top_staff_referrers}
    rows=10
    sort="total_orders desc"
    groupBy="staff_name"
    subtotals=true
    totalRow=true
    groupsOpen=false
>
    <Column id="staff_name" title="Staff Member"/>
    <Column id="referral_code" title="Referral Code"/>
    <Column id="code_description" title="Description"/>
    <Column id="total_orders" title="Total Cards" fmt="num0"/>
    <Column id="maniac_cards" title="Maniac Cards" fmt="num0" contentType="colorscale" colorScale="info"/>
    <Column id="vip_cards" title="VIP Cards" fmt="num0" contentType="colorscale" colorScale="info"/>
    <Column id="tickets_sold" title="Tickets" fmt="num0" contentType="colorscale" colorScale="info"/>
</DataTable>

## All Sales & Marketing Referral Codes

<DataTable 
    data={staff_marketing_referral_sales}
    rows={15}
    search={true}
>
    <Column id="description" title="Description"/>
    <Column id="referral_code" title="Referral Code"/>
    <Column id="total_orders" title="Total Cards" fmt="num0"/>
    <Column id="maniac_cards" title="Cards" fmt="num0"/>
    <Column id="vip_cards" title="VIP Cards" fmt="num0"/>
    <Column id="tickets_sold" title="Tickets" fmt="num0"/>
</DataTable>

---

# Lightbox Referral Sales

<div class="flex flex-row w-full md:w-3/4 justify-between">

<BigValue 
    data={lightbox_summary}
    value="total_referral_codes"
    title="Total Lightbox Codes"
    fmt="num0"
/>

<BigValue 
    data={lightbox_summary}
    value="total_orders"
    title="Total Orders"
    fmt="num0"
/>

<BigValue 
    data={lightbox_card_types}
    value="total_maniac_cards"
    title="Maniac Cards"
    fmt="num0"
/>

<BigValue 
    data={lightbox_card_types}
    value="total_vip_cards"
    title="VIP Cards"
    fmt="num0"
/>

</div>

<BarChart
    data={lightbox_daily_trend}
    x=date
    y={["maniac_cards", "vip_cards"]}
    title="Daily Lightbox Sales by Card Type"
    type="stacked"
    xAxisTitle="Date"
    yAxisTitle="Orders"
    labels=true
    legend=true
    colorPalette={[
        '#7A57C9',
        '#C46696',
    ]}
/>

## Lightbox Sales by Location

<DataTable 
    data={lightbox_location_breakdown}
    rows=10
>
    <Column id="location" title="Location"/>
    <Column id="Maniac Card" title="Maniac Cards" fmt="num0" contentType="colorscale" colorScale="info"/>
    <Column id="Maniac VIP" title="VIP Cards" fmt="num0" contentType="colorscale" colorScale="info"/>
    <Column id="Total" title="Total" fmt="num0"/>
</DataTable>

## Lightbox Referral Codes Breakdown

<DataTable 
    data={lightbox_referral_details}
    rows={15}
    search={true}
>
    <Column id="description" title="Description"/>
    <Column id="referral_code" title="Referral Code"/>
    <Column id="total_orders" title="Total Cards" fmt="num0"/>
    <Column id="maniac_cards" title="Maniac Cards" fmt="num0"/>
    <Column id="vip_cards" title="VIP Cards" fmt="num0"/>
    <Column id="tickets_sold" title="Tickets" fmt="num0"/>
</DataTable>

---

# Card Upgrades

```sql upgrade_referral_metrics
-- Get upgrade orders by referral code
WITH upgrade_orders AS (
  SELECT
    o.*,
    rc.slug,
    rc.details AS code_description,
    CASE 
      WHEN u.full_name IS NULL OR TRIM(u.full_name) = '' THEN 'No User Linked'
      ELSE u.full_name
    END AS staff_name
  FROM maniac_neon_prod.orders o
  JOIN maniac_neon_prod.referral_codes rc ON o.referral_code = rc.slug
  LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
  WHERE coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'
)
SELECT
  staff_name,
  slug AS referral_code,
  code_description,
  COUNT(*) AS total_upgrades,
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'card_upgrade', '') = 'true' THEN 1 ELSE 0 END) AS tier_upgrades,
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'upgrade_type', '') = 'fastPass' THEN 1 ELSE 0 END) AS fast_pass_upgrades,
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'upgrade_type', '') = 'fastPassPlus' THEN 1 ELSE 0 END) AS fast_pass_plus_upgrades
FROM upgrade_orders o
GROUP BY staff_name, slug, code_description
ORDER BY total_upgrades DESC;
```

```sql total_upgrade_metrics
-- Summary of all upgrade types
SELECT
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade' THEN 1 ELSE 0 END) AS total_upgrades,
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'card_upgrade', '') = 'true' THEN 1 ELSE 0 END) AS tier_upgrades,
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'upgrade_type', '') = 'fastPass' THEN 1 ELSE 0 END) AS fast_pass_upgrades,
  SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'upgrade_type', '') = 'fastPassPlus' THEN 1 ELSE 0 END) AS fast_pass_plus_upgrades
FROM maniac_neon_prod.orders o
WHERE coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade';
```

```sql daily_upgrade_trends
-- Daily trend of upgrade orders starting from February 27, broken down by upgrade type
SELECT 
    date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) AS date,
    SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'card_upgrade', '') = 'true' THEN 1 ELSE 0 END) AS tier_upgrades,
    SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'upgrade_type', '') = 'fastPass' THEN 1 ELSE 0 END) AS fast_pass_upgrades,
    SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'upgrade_type', '') = 'fastPassPlus' THEN 1 ELSE 0 END) AS fast_pass_plus_upgrades,
    COUNT(*) AS total_upgrades
FROM maniac_neon_prod.orders o
WHERE coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'
AND o.created_at >= '2025-02-27'
GROUP BY date
ORDER BY date;
```

```sql upgrade_percentage
-- Calculate the percentage of upgrade orders compared to total orders
WITH orders_summary AS (
  SELECT
    COUNT(CASE WHEN (status = 'succeeded' OR (status IS NULL AND coalesce(stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) THEN 1 END) AS total_orders,
    SUM(CASE WHEN coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade' THEN 1 ELSE 0 END) AS upgrade_orders
  FROM maniac_neon_prod.orders o
  WHERE (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade'))
  AND o.created_at >= '2025-02-27'
)
SELECT
  total_orders,
  upgrade_orders,
  ROUND((upgrade_orders::numeric / total_orders::numeric) * 100, 2) AS upgrade_percentage
FROM orders_summary;
```

<div class="flex flex-row w-full md:w-3/4 justify-between">

<BigValue 
    data={total_upgrade_metrics}
    value="total_upgrades"
    title="Total Upgrades"
    fmt="num0"
/>

<BigValue 
    data={total_upgrade_metrics}
    value="tier_upgrades"
    title="Tier Upgrades"
    fmt="num0"
/>

<BigValue 
    data={total_upgrade_metrics}
    value="fast_pass_upgrades"
    title="Fast Pass Upgrades"
    fmt="num0"
/>

<BigValue 
    data={total_upgrade_metrics}
    value="fast_pass_plus_upgrades"
    title="Fast Pass Plus Upgrades"
    fmt="num0"
/>

</div>

<div class="flex flex-row w-full justify-between">
<!-- <BigValue 
    data={upgrade_percentage}
    value="upgrade_percentage"
    title="Upgrade % of Total Orders"
    fmt=".2%"
/> -->
</div>

## Upgrade Orders by Referral Code

<DataTable 
    data={upgrade_referral_metrics}
    rows={15}
    search={true}
    groupBy="staff_name"
    subtotals=true
    totalRow=true
    groupsOpen=false
>
    <Column id="staff_name" title="Staff Member"/>
    <Column id="referral_code" title="Referral Code"/>
    <Column id="code_description" title="Description"/>
    <Column id="total_upgrades" title="Total Upgrades" fmt="num0" contentType="colorscale" colorScale="info"/>
    <Column id="tier_upgrades" title="Tier Upgrades" fmt="num0"/>
    <Column id="fast_pass_upgrades" title="Fast Pass" fmt="num0"/>
    <Column id="fast_pass_plus_upgrades" title="Fast Pass+" fmt="num0"/>
</DataTable>

<BarChart
    data={daily_upgrade_trends}
    x=date
    y={["tier_upgrades", "fast_pass_upgrades", "fast_pass_plus_upgrades"]}
    title="Upgrade Orders by Day and Type"
    type="stacked"
    xAxisTitle="Date"
    yAxisTitle="Number of Upgrades"
    labels=true
    legend=true
    colorPalette={[
      '#7A57C9',
      '#4B917D',
      '#E8A838',
    ]}
/>

---

# Sankey Diagrams

<SankeyDiagram 
    data={card_tier_to_location_sankey}
    title="Cash Card Distribution by Tier and Location" 
    subtitle="Flow of cash cards from tier type to location"
    sourceCol=target
    targetCol=source
    valueCol=value
    percentCol=percent
    valueFmt="num0"
    colorPalette={['#7A57C9', '#C46696']}
    nodeLabels=full
/>

<SankeyDiagram 
    data={sales_channel_to_location_sankey}
    title="Sales Channels by Location" 
    subtitle="Distribution of sales channels across locations"
    sourceCol=target
    targetCol=source
    valueCol=value
    percentCol=percent
    valueFmt="num0"
    colorPalette={['#4B917D', '#E8A838']}
    nodeLabels=full
/>

```sql staff_referral_daily_trend
-- Daily trend of orders from staff referral codes starting February 27, broken down by card tier
WITH daily_data AS (
    SELECT 
        date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) AS day,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) AND ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN (o.status = 'succeeded' OR (o.status IS NULL AND coalesce(o.stripe_checkout_session->'metadata'->>'type', '') = 'card-upgrade')) AND ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.referral_codes rc ON o.referral_code = rc.slug
    LEFT JOIN maniac_neon_prod.users u ON rc.clerk_user_id = u.id
    LEFT JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    LEFT JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    LEFT JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE (u.staff_member = true OR rc.type = 'sales')
    AND rc.slug NOT LIKE 'lb%'
    AND o.created_at IS NOT NULL
    AND o.created_at >= '2025-02-27'
    GROUP BY day
    ORDER BY day
)
SELECT 
    day as date,
    maniac_cards,
    vip_cards,
    (maniac_cards + vip_cards) AS total_orders
FROM daily_data
WHERE day IS NOT NULL
ORDER BY day;
```


```sql fort_lauderdale_today_metrics_ly
-- Get metrics for Fort Lauderdale for the same day last year
SELECT 
    COUNT(o.id) AS total_activated_ly,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated_ly,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated_ly
FROM maniac_neon_2024.orders o
JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_2024.locations l ON c.location_id = l.id
JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND l.name = 'Fort Lauderdale'
AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = 
    date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 DAYS'));
```

```sql pcb_today_metrics_ly
-- Get metrics for Panama City Beach for the same day last year
SELECT 
    COUNT(o.id) AS total_activated_ly,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated_ly,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated_ly
FROM maniac_neon_2024.orders o
JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_2024.locations l ON c.location_id = l.id
JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND l.name = 'Panama City Beach'
AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = 
    date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 DAYS'));
```

```sql fort_lauderdale_combined_today
-- Combined query for Fort Lauderdale today metrics with LYTD comparison
WITH today_metrics AS (
    -- Get metrics for Fort Lauderdale for today only
    SELECT 
        COUNT(o.id) AS total_activated,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND l.name = 'Fort Lauderdale'
    AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS))
),
lytd_metrics AS (
    -- Get metrics for Fort Lauderdale for the same day last year
    SELECT 
        COUNT(o.id) AS total_activated_ly,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated_ly,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated_ly
    FROM maniac_neon_2024.orders o
    JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_2024.locations l ON c.location_id = l.id
    JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND l.name = 'Fort Lauderdale'
    AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = 
        date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 DAYS'))
)
SELECT
    t.total_activated,
    t.maniac_cards_activated,
    t.maniac_vip_activated,
    ly.total_activated_ly,
    ly.maniac_cards_activated_ly,
    ly.maniac_vip_activated_ly,
    
    -- Calculate absolute differences
    (t.total_activated - ly.total_activated_ly) AS total_diff,
    (t.maniac_cards_activated - ly.maniac_cards_activated_ly) AS maniac_diff,
    (t.maniac_vip_activated - ly.maniac_vip_activated_ly) AS vip_diff
FROM 
    today_metrics t
CROSS JOIN
    lytd_metrics ly
```

```sql pcb_combined_today
-- Combined query for Panama City Beach today metrics with LYTD comparison
WITH today_metrics AS (
    -- Get metrics for Panama City Beach for today only
    SELECT 
        COUNT(o.id) AS total_activated,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND l.name = 'Panama City Beach'
    AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS))
),
lytd_metrics AS (
    -- Get metrics for Panama City Beach for the same day last year
    SELECT 
        COUNT(o.id) AS total_activated_ly,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards_activated_ly,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_activated_ly
    FROM maniac_neon_2024.orders o
    JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_2024.locations l ON c.location_id = l.id
    JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND l.name = 'Panama City Beach'
    AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = 
        date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 DAYS'))
)
SELECT
    t.total_activated,
    t.maniac_cards_activated,
    t.maniac_vip_activated,
    ly.total_activated_ly,
    ly.maniac_cards_activated_ly,
    ly.maniac_vip_activated_ly,
    
    -- Calculate absolute differences
    (t.total_activated - ly.total_activated_ly) AS total_diff,
    (t.maniac_cards_activated - ly.maniac_cards_activated_ly) AS maniac_diff,
    (t.maniac_vip_activated - ly.maniac_vip_activated_ly) AS vip_diff
FROM 
    today_metrics t
CROSS JOIN
    lytd_metrics ly
```

<Tabs id="activated_timeframe">
    <Tab label="Today">
        <h2>Fort Lauderdale</h2>
        <div class="flex flex-row w-full justify-between">
            <BigValue 
                data={fort_lauderdale_combined_today}
                value="total_activated"
                title="Cards Activated Today"
                fmt="num0"
                comparison="total_activated_ly"
                comparisonTitle="vs LYTD"
                comparisonFmt="num0"
                emptySet="pass"
                comparisonDelta=false
            />

            <BigValue 
                data={fort_lauderdale_combined_today}
                value="maniac_cards_activated"
                title="Maniac Cards Today"
                fmt="num0"
                comparison="maniac_cards_activated_ly"
                comparisonTitle="vs LYTD"
                comparisonFmt="num0"
                emptySet="pass"
                comparisonDelta=false
            />

            <BigValue 
                data={fort_lauderdale_combined_today}
                value="maniac_vip_activated"
                title="Maniac VIP Cards Today"
                fmt="num0"
                comparison="maniac_vip_activated_ly"
                comparisonTitle="vs LYTD"
                comparisonFmt="num0"
                emptySet="pass"
                comparisonDelta=false
            />
        </div>

        <h2>Panama City Beach</h2>
        <div class="flex flex-row w-full justify-between">
            <BigValue 
                data={pcb_combined_today}
                value="total_activated"
                title="Cards Activated Today"
                fmt="num0"
                comparison="total_activated_ly"
                comparisonTitle="vs LYTD"
                comparisonFmt="num0"
                emptySet="pass"
                comparisonDelta=false
            />

            <BigValue 
                data={pcb_combined_today}
                value="maniac_cards_activated"
                title="Maniac Cards Today"
                fmt="num0"
                comparison="maniac_cards_activated_ly"
                comparisonTitle="vs LYTD"
                comparisonFmt="num0"
                emptySet="pass"
                comparisonDelta=false
            />

            <BigValue 
                data={pcb_combined_today}
                value="maniac_vip_activated"
                title="Maniac VIP Cards Today"
                fmt="num0"
                comparison="maniac_vip_activated_ly"
                comparisonTitle="vs LYTD"
                comparisonFmt="num0"
                emptySet="pass"
                comparisonDelta=false
            />
        </div>
    </Tab>
    <Tab label="Yesterday">
    </Tab>
</Tabs>