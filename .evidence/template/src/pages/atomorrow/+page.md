---
title: Next 48
hide_title: true
description: Sales Forecast for Today and Tomorrow (EST)
---

```sql date_info
SELECT 
    'Today' AS name,
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR), '%A') AS today_name,
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR), '%b %d, %Y') AS today_date,
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR + INTERVAL '1' DAY), '%A') AS tomorrow_name,
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR + INTERVAL '1' DAY), '%b %d, %Y') AS tomorrow_date,
    -- Find the same day of the week from last year
    -- Go back exactly 364 days (52 weeks) to get the same day of week from last year
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR - INTERVAL '364' DAY), '%A') AS ly_today_name,
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR - INTERVAL '364' DAY), '%b %d, %Y') AS ly_today_date,
    -- For tomorrow, also go back 364 days from tomorrow
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR + INTERVAL '1' DAY - INTERVAL '364' DAY), '%A') AS ly_tomorrow_name,
    STRFTIME((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '5' HOUR + INTERVAL '1' DAY - INTERVAL '364' DAY), '%b %d, %Y') AS ly_tomorrow_date
```

```sql today_hourly_forecast
WITH filtered_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
-- Get current time in EST timezone
current_info AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_dow,
        EXTRACT(HOUR FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_hour,
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) AS current_day
),
-- Last year's equivalent date - exactly 52 weeks back to match day of week
historical_date AS (
    SELECT 
        (SELECT current_day FROM current_info) - INTERVAL '364 DAYS' AS last_year_date
),
-- Generate hours for current day
hours_sequence AS (
    SELECT 0 AS hour UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 
    UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 
    UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 
    UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
),
-- Historical hourly pattern
historical_pattern AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS dow,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS avg_orders,
        SUM(amount_total) AS avg_revenue
    FROM filtered_historical
    WHERE m_type = 'card'
    GROUP BY 1, 2
),
-- Get last year's same day data - adjusted for the day shift (+1 day)
same_day_last_year AS (
    SELECT 
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS orders_ly,
        SUM(amount_total) AS revenue_ly
    FROM filtered_historical
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) 
          = (SELECT last_year_date FROM historical_date)
    GROUP BY 1
),
-- Today's actual sales
today_actual_sales AS (
    SELECT
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS actual_orders,
        SUM(amount_total) AS actual_revenue
    FROM filtered_orders
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) 
          = (SELECT current_day FROM current_info)
    GROUP BY 1
),
-- YTD performance compared to last year for adjustment factor
ytd_performance AS (
    SELECT
        COUNT(*) FILTER (WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') >= 
                               DATE_TRUNC('year', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) - INTERVAL '1 year'
                        ) AS cards_sold_ly,
        COUNT(*) FILTER (WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') >= 
                               DATE_TRUNC('year', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))
                        ) AS cards_sold_cy
    FROM filtered_historical
),
-- Generate forecast
forecast AS (
    SELECT
        hs.hour,
        (SELECT current_dow FROM current_info) AS dow,
        CASE 
            WHEN hs.hour < 12 THEN hs.hour::text || ' AM'
            WHEN hs.hour = 12 THEN '12 PM'
            ELSE (hs.hour - 12)::text || ' PM'
        END AS hour_display,
        COALESCE(hp.avg_orders, 1) AS historical_avg,
        COALESCE(ly.orders_ly, 0) AS last_year_same_day,
        COALESCE(tas.actual_orders, 0) AS actual_orders,
        COALESCE(tas.actual_revenue, 0) AS actual_revenue,
        -- Forecast formula that prioritizes last year's data when available
        CASE 
            WHEN ly.orders_ly > 0 THEN ROUND(ly.orders_ly * 1.15) -- 15% growth from last year's actual data
            ELSE ROUND(
                COALESCE(hp.avg_orders, 1) * 
                COALESCE(perf.cards_sold_cy::float / NULLIF(perf.cards_sold_ly, 0), 1.0)
            )
        END AS forecast_orders,
        CASE 
            WHEN ly.revenue_ly > 0 THEN ROUND(ly.revenue_ly * 1.15) -- 15% growth from last year's revenue
            ELSE ROUND(
                COALESCE(hp.avg_revenue, 100) * 
                COALESCE(perf.cards_sold_cy::float / NULLIF(perf.cards_sold_ly, 0), 1.0)
            )
        END AS forecast_revenue,
        -- Flag to indicate if this hour is in the past, present, or future
        CASE
            WHEN hs.hour < (SELECT current_hour FROM current_info) THEN 'Past'
            WHEN hs.hour = (SELECT current_hour FROM current_info) THEN 'Present'
            ELSE 'Future'
        END AS time_status
    FROM hours_sequence hs
    LEFT JOIN historical_pattern hp 
        ON (SELECT current_dow FROM current_info) = hp.dow AND hs.hour = hp.hour
    LEFT JOIN same_day_last_year ly ON hs.hour = ly.hour
    LEFT JOIN today_actual_sales tas ON hs.hour = tas.hour
    CROSS JOIN ytd_performance perf
)
SELECT 
    hour,
    hour_display,
    forecast_orders,
    forecast_revenue,
    actual_orders,
    actual_revenue,
    time_status,
    SUM(forecast_orders) OVER (ORDER BY hour) AS cumulative_forecast,
    SUM(actual_orders) OVER (ORDER BY hour) AS cumulative_actual
FROM forecast
ORDER BY hour
```

```sql tomorrow_hourly_forecast
WITH filtered_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
-- Get current time in EST timezone
current_info AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_dow,
        EXTRACT(HOUR FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_hour,
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) AS current_day
),
-- Last year's equivalent date for tomorrow - exactly 52 weeks back to match day of week
tomorrow_historical_date AS (
    SELECT 
        (SELECT current_day FROM current_info) + INTERVAL '1 DAY' - INTERVAL '364 DAYS' AS last_year_date
),
-- Generate hours for tomorrow
hours_sequence AS (
    SELECT 0 AS hour UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 
    UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 
    UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 
    UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
),
-- Historical hourly pattern for tomorrow's day of week
historical_pattern AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS dow,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS avg_orders,
        SUM(amount_total) AS avg_revenue
    FROM filtered_historical
    WHERE m_type = 'card'
    GROUP BY 1, 2
),
-- Get last year's equivalent day for tomorrow - adjusted for the day shift (+1 day)
tomorrow_last_year AS (
    SELECT 
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS orders_ly,
        SUM(amount_total) AS revenue_ly
    FROM filtered_historical
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) 
          = (SELECT last_year_date FROM tomorrow_historical_date)
    GROUP BY 1
),
-- YTD performance compared to last year for adjustment factor
ytd_performance AS (
    SELECT
        COUNT(*) FILTER (WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') >= 
                               DATE_TRUNC('year', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) - INTERVAL '1 year'
                        ) AS cards_sold_ly,
        COUNT(*) FILTER (WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') >= 
                               DATE_TRUNC('year', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))
                        ) AS cards_sold_cy
    FROM filtered_historical
),
-- Get tomorrow's day of week
tomorrow_dow AS (
    SELECT
        ((SELECT current_dow FROM current_info) + 1) % 7 AS dow
),
-- Generate tomorrow's forecast
forecast AS (
    SELECT
        hs.hour,
        (SELECT dow FROM tomorrow_dow) AS dow,
        CASE 
            WHEN hs.hour < 12 THEN hs.hour::text || ' AM'
            WHEN hs.hour = 12 THEN '12 PM'
            ELSE (hs.hour - 12)::text || ' PM'
        END AS hour_display,
        COALESCE(hp.avg_orders, 1) AS historical_avg,
        COALESCE(ly.orders_ly, 0) AS last_year_same_day,
        -- Forecast formula that prioritizes last year's data when available
        CASE 
            WHEN ly.orders_ly > 0 THEN ROUND(ly.orders_ly * 1.15) -- 15% growth from last year's actual data
            ELSE ROUND(
                COALESCE(hp.avg_orders, 1) * 
                COALESCE(perf.cards_sold_cy::float / NULLIF(perf.cards_sold_ly, 0), 1.0)
            )
        END AS forecast_orders,
        CASE 
            WHEN ly.revenue_ly > 0 THEN ROUND(ly.revenue_ly * 1.15) -- 15% growth from last year's revenue
            ELSE ROUND(
                COALESCE(hp.avg_revenue, 100) * 
                COALESCE(perf.cards_sold_cy::float / NULLIF(perf.cards_sold_ly, 0), 1.0)
            )
        END AS forecast_revenue
    FROM hours_sequence hs
    LEFT JOIN historical_pattern hp 
        ON (SELECT dow FROM tomorrow_dow) = hp.dow AND hs.hour = hp.hour
    LEFT JOIN tomorrow_last_year ly ON hs.hour = ly.hour
    CROSS JOIN ytd_performance perf
)
SELECT 
    hour,
    hour_display,
    forecast_orders,
    forecast_revenue,
    SUM(forecast_orders) OVER (ORDER BY hour) AS cumulative_forecast
FROM forecast
ORDER BY hour
```

```sql today_by_location
WITH filtered_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
-- Get current time in EST timezone
current_info AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_dow,
        EXTRACT(HOUR FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_hour,
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) AS current_day
),
-- Last year's equivalent date - exactly 52 weeks back to match day of week
historical_date AS (
    SELECT 
        (SELECT current_day FROM current_info) - INTERVAL '364 DAYS' AS last_year_date
),
-- Generate hours for full day
hours_sequence AS (
    SELECT 0 AS hour UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 
    UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 
    UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 
    UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
),
-- Available locations - excluding 'Other'
locations AS (
    SELECT DISTINCT
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location
    FROM filtered_historical
    WHERE m_location_formatted IN ('Panama City Beach', 'Fort Lauderdale', 'South Padre Island')
),
-- Same day last year data by location - adjusted for the day shift (+1 day)
last_year_by_location AS (
    SELECT
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS orders_ly
    FROM filtered_historical
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) 
          = (SELECT last_year_date FROM historical_date)
      AND m_location_formatted IN ('Panama City Beach', 'Fort Lauderdale', 'South Padre Island')
    GROUP BY 1, 2
),
-- Historical hourly pattern by day of week and location
historical_pattern AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS dow,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location,
        COUNT(*) AS avg_orders
    FROM filtered_historical
    WHERE m_type = 'card'
      AND m_location_formatted IN ('Panama City Beach', 'Fort Lauderdale', 'South Padre Island')
    GROUP BY 1, 2, 3
),
-- Base data with all combinations
base_data AS (
    SELECT 
        hs.hour,
        l.location,
        CASE 
            WHEN hs.hour < 12 THEN hs.hour::text || ' AM'
            WHEN hs.hour = 12 THEN '12 PM'
            ELSE (hs.hour - 12)::text || ' PM'
        END AS hour_display
    FROM hours_sequence hs
    CROSS JOIN locations l
)
SELECT 
    bd.hour,
    bd.hour_display,
    bd.location,
    -- Apply growth factor based on last year's data when available, otherwise use standard growth factor
    CASE 
        WHEN ly.orders_ly > 0 THEN ROUND(COALESCE(ly.orders_ly, 0) * 1.15)
        ELSE ROUND(COALESCE(hp.avg_orders, 0) * 1.1)
    END AS forecast_orders
FROM base_data bd
LEFT JOIN historical_pattern hp 
    ON (SELECT current_dow FROM current_info) = hp.dow 
    AND bd.hour = hp.hour 
    AND bd.location = hp.location
LEFT JOIN last_year_by_location ly
    ON bd.hour = ly.hour
    AND bd.location = ly.location
ORDER BY bd.hour, bd.location
```

```sql tomorrow_by_location
WITH filtered_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
-- Get current time in EST timezone
current_info AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_dow,
        EXTRACT(HOUR FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_hour,
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) AS current_day
),
-- Get tomorrow's day of week
tomorrow_dow AS (
    SELECT
        ((SELECT current_dow FROM current_info) + 1) % 7 AS dow
),
-- Last year's equivalent date for tomorrow - exactly 52 weeks back to match day of week
tomorrow_historical_date AS (
    SELECT 
        (SELECT current_day FROM current_info) + INTERVAL '1 DAY' - INTERVAL '364 DAYS' AS last_year_date
),
-- Generate hours for tomorrow
hours_sequence AS (
    SELECT 0 AS hour UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 
    UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 
    UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 
    UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23
),
-- Available locations - excluding 'Other'
locations AS (
    SELECT DISTINCT
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location
    FROM filtered_historical
    WHERE m_location_formatted IN ('Panama City Beach', 'Fort Lauderdale', 'South Padre Island')
),
-- Same day last year data by location - adjusted for the day shift (+1 day)
last_year_by_location AS (
    SELECT
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        COUNT(*) AS orders_ly
    FROM filtered_historical
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) 
          = (SELECT last_year_date FROM tomorrow_historical_date)
      AND m_location_formatted IN ('Panama City Beach', 'Fort Lauderdale', 'South Padre Island')
    GROUP BY 1, 2
),
-- Historical hourly pattern by day of week and location
historical_pattern AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS dow,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS hour,
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location,
        COUNT(*) AS avg_orders
    FROM filtered_historical
    WHERE m_type = 'card'
      AND m_location_formatted IN ('Panama City Beach', 'Fort Lauderdale', 'South Padre Island')
    GROUP BY 1, 2, 3
),
-- Base data with all combinations
base_data AS (
    SELECT 
        hs.hour,
        l.location,
        CASE 
            WHEN hs.hour < 12 THEN hs.hour::text || ' AM'
            WHEN hs.hour = 12 THEN '12 PM'
            ELSE (hs.hour - 12)::text || ' PM'
        END AS hour_display
    FROM hours_sequence hs
    CROSS JOIN locations l
)
SELECT 
    bd.hour,
    bd.hour_display,
    bd.location,
    -- Apply growth factor based on last year's data when available, otherwise use standard growth factor
    CASE 
        WHEN ly.orders_ly > 0 THEN ROUND(COALESCE(ly.orders_ly, 0) * 1.15)
        ELSE ROUND(COALESCE(hp.avg_orders, 0) * 1.1)
    END AS forecast_orders
FROM base_data bd
LEFT JOIN historical_pattern hp 
    ON (SELECT dow FROM tomorrow_dow) = hp.dow 
    AND bd.hour = hp.hour 
    AND bd.location = hp.location
LEFT JOIN last_year_by_location ly
    ON bd.hour = ly.hour
    AND bd.location = ly.location
ORDER BY bd.hour, bd.location
```

```sql today_summary
WITH today_data AS (
    SELECT * FROM ${today_hourly_forecast}
)
SELECT
    SUM(forecast_orders) AS total_forecast_orders,
    SUM(forecast_revenue) AS total_forecast_revenue,
    SUM(actual_orders) AS total_actual_orders,
    SUM(actual_revenue) AS total_actual_revenue
FROM today_data
```

```sql tomorrow_summary
WITH tomorrow_data AS (
    SELECT * FROM ${tomorrow_hourly_forecast}
)
SELECT
    SUM(forecast_orders) AS total_forecast_orders,
    SUM(forecast_revenue) AS total_forecast_revenue
FROM tomorrow_data
```

```sql cash_cards_2025
-- Get cash card metrics for 2025 (current year) up to current day of week
WITH current_info AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_dow,
        DATE_TRUNC('day', CAST((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) AS current_day
)
SELECT 
    COUNT(*) AS total_activated_cards,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS total_maniac_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS total_maniac_vip
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
CROSS JOIN current_info
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND EXTRACT(DOW FROM (CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer <= (SELECT current_dow FROM current_info)
AND (CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') >= DATE_TRUNC('year', CAST((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP))
```

```sql cash_cards_2024
-- Get cash card metrics for 2024 (last year) up to current day of week
WITH current_info AS (
    SELECT 
        EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer AS current_dow,
        DATE_TRUNC('day', CAST((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) AS current_day
)
SELECT 
    COUNT(*) AS total_activated_cards,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS total_maniac_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS total_maniac_vip
FROM maniac_neon_2024.orders o
JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
CROSS JOIN current_info
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND EXTRACT(DOW FROM (CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS'))::integer <= (SELECT current_dow FROM current_info)
AND (CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') >= DATE_TRUNC('year', CAST((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '1 year') AS TIMESTAMP))
```

```sql today_cash_cards_2025
-- Get cash card metrics for today in 2025
SELECT 
    COUNT(*) AS today_activated_cards,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS today_maniac_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS today_maniac_vip
FROM maniac_neon_prod.orders o
JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND date_trunc('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL 4 HOURS)) = date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS))
```

```sql same_day_last_year_cash_cards
-- Get cash card metrics for the same day of week last year
WITH current_info AS (
    SELECT 
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')) AS current_day
),
-- Last year's equivalent date - exactly 52 weeks back to match day of week
historical_date AS (
    SELECT 
        (SELECT current_day FROM current_info) - INTERVAL '364 DAYS' AS last_year_date
)
SELECT 
    COUNT(*) AS ly_activated_cards,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS ly_maniac_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS ly_maniac_vip
FROM maniac_neon_2024.orders o
JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
WHERE o.stripe_checkout_session_id LIKE 'cash_%'
AND DATE_TRUNC('day', (CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS')) = (SELECT last_year_date FROM historical_date)
```

```sql daily_cash_cards_comparison
-- Get daily cash card activations for the past 7 days compared to last year
WITH current_info AS (
    SELECT 
        DATE_TRUNC('day', CAST((CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) AS current_day
),
-- Generate days for the past week using a different approach
days_sequence AS (
    WITH RECURSIVE dates(day_num, day_date) AS (
        SELECT 
            0, 
            CAST((SELECT current_day FROM current_info) AS DATE) 
        UNION ALL
        SELECT 
            day_num - 1, 
            CAST(((SELECT current_day FROM current_info) - INTERVAL (day_num + 1) DAY) AS DATE)
        FROM dates
        WHERE day_num > -6
    )
    SELECT day_date FROM dates
    ORDER BY day_date
),
-- Current year data
current_year_data AS (
    SELECT 
        CAST(DATE_TRUNC('day', CAST((CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) AS DATE) AS activation_date,
        COUNT(*) AS total_activations,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_cards
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND DATE_TRUNC('day', CAST((CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) >= (SELECT current_day FROM current_info) - INTERVAL '6 DAYS'
    GROUP BY activation_date
),
-- Last year data (same days of week)
last_year_data AS (
    SELECT 
        CAST(DATE_TRUNC('day', CAST((CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) + INTERVAL '364 DAYS' AS DATE) AS equivalent_date,
        COUNT(*) AS ly_total_activations,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS ly_maniac_cards,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS ly_maniac_vip_cards
    FROM maniac_neon_2024.orders o
    JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    AND DATE_TRUNC('day', CAST((CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) >= (SELECT current_day FROM current_info) - INTERVAL '370 DAYS'
    AND DATE_TRUNC('day', CAST((CAST(o.created_at AS TIMESTAMP) - INTERVAL '4 HOURS') AS TIMESTAMP)) <= (SELECT current_day FROM current_info) - INTERVAL '364 DAYS'
    GROUP BY equivalent_date
)
SELECT 
    ds.day_date AS date,
    STRFTIME(CAST(ds.day_date AS TIMESTAMP), '%a %b %d') AS day_display,
    COALESCE(cy.total_activations, 0) AS total_activations,
    COALESCE(cy.maniac_cards, 0) AS maniac_cards,
    COALESCE(cy.maniac_vip_cards, 0) AS maniac_vip_cards,
    COALESCE(ly.ly_total_activations, 0) AS ly_total_activations,
    COALESCE(ly.ly_maniac_cards, 0) AS ly_maniac_cards,
    COALESCE(ly.ly_maniac_vip_cards, 0) AS ly_maniac_vip_cards
FROM days_sequence ds
LEFT JOIN current_year_data cy ON ds.day_date = cy.activation_date
LEFT JOIN last_year_data ly ON ds.day_date = ly.equivalent_date
ORDER BY ds.day_date
```

```sql location_cash_cards_comparison
-- Get cash card metrics by location comparing 2024 to 2025
WITH current_year_data AS (
    SELECT 
        l.name AS location_name,
        COUNT(*) AS total_activations,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cards,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_cards
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    GROUP BY l.name
),
last_year_data AS (
    SELECT 
        l.name AS location_name,
        COUNT(*) AS ly_total_activations,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS ly_maniac_cards,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS ly_maniac_vip_cards
    FROM maniac_neon_2024.orders o
    JOIN maniac_neon_2024.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_2024.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_2024.locations l ON c.location_id = l.id
    JOIN maniac_neon_2024.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    GROUP BY l.name
)
SELECT 
    COALESCE(cy.location_name, ly.location_name) AS location,
    COALESCE(cy.total_activations, 0) AS total_activations,
    COALESCE(cy.maniac_cards, 0) AS maniac_cards,
    COALESCE(cy.maniac_vip_cards, 0) AS maniac_vip_cards,
    COALESCE(ly.ly_total_activations, 0) AS ly_total_activations,
    COALESCE(ly.ly_maniac_cards, 0) AS ly_maniac_cards,
    COALESCE(ly.ly_maniac_vip_cards, 0) AS ly_maniac_vip_cards,
    CASE 
        WHEN COALESCE(ly.ly_total_activations, 0) = 0 THEN NULL
        ELSE ROUND((COALESCE(cy.total_activations, 0) - COALESCE(ly.ly_total_activations, 0)) * 100.0 / NULLIF(ly.ly_total_activations, 0), 1)
    END AS growth_percentage
FROM current_year_data cy
FULL OUTER JOIN last_year_data ly ON cy.location_name = ly.location_name
ORDER BY COALESCE(cy.total_activations, 0) DESC
```

# Next 48 Hours Sales Forecast

<LastRefreshed prefix="Forecast Generated" showTime={true} printShowDate={true} dateFmt="h:mm A z" />

<Alert severity="info">
  <div class="font-bold">About This Forecast</div>
  We're showing predictions for <strong><Value data={date_info} value="today_name" /> (<Value data={date_info} value="today_date" />)</strong> and <strong><Value data={date_info} value="tomorrow_name" /> (<Value data={date_info} value="tomorrow_date" />)</strong>.
  
  These predictions are based on the same days of the week from last year:
  - Today's forecast uses data from <strong><Value data={date_info} value="ly_today_name" /> (<Value data={date_info} value="ly_today_date" />)</strong>
  - Tomorrow's forecast uses data from <strong><Value data={date_info} value="ly_tomorrow_name" /> (<Value data={date_info} value="ly_tomorrow_date" />)</strong>
  
  We match by day of week because customer behavior tends to follow weekly patterns rather than exact calendar dates. All times are in Eastern Standard Time (EST).
</Alert>

---
<!-- 
## Cash Card Activations: 2024 vs 2025

<Alert severity="info">
  <div class="font-bold">Cash Card Comparison</div>
  This section compares cash card activations between 2024 and 2025. Cash cards are identified by orders with a stripe_checkout_session_id starting with 'cash_'.
</Alert>

<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <BigValue 
        data={cash_cards_2025}
        value="total_activated_cards"
        title="2025 Total Cards"
        fmt="num0"
    />
    <BigValue 
        data={cash_cards_2024}
        value="total_activated_cards"
        title="2024 Total Cards"
        fmt="num0"
    />
    <BigValue 
        data={today_cash_cards_2025}
        value="today_activated_cards"
        title="Today's Activations"
        fmt="num0"
    />
    <BigValue 
        data={same_day_last_year_cash_cards}
        value="ly_activated_cards"
        title="Same Day Last Year"
        fmt="num0"
    />
</div>

<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <BigValue 
        data={cash_cards_2025}
        value="total_maniac_cards"
        title="2025 Maniac Cards"
        fmt="num0"
    />
    <BigValue 
        data={cash_cards_2024}
        value="total_maniac_cards"
        title="2024 Maniac Cards"
        fmt="num0"
    />
    <BigValue 
        data={cash_cards_2025}
        value="total_maniac_vip"
        title="2025 VIP Cards"
        fmt="num0"
    />
    <BigValue 
        data={cash_cards_2024}
        value="total_maniac_vip"
        title="2024 VIP Cards"
        fmt="num0"
    />
</div>

<BarChart
    data={daily_cash_cards_comparison}
    x="day_display"
    y={["total_activations", "ly_total_activations"]}
    title="Daily Cash Card Activations: This Year vs Last Year"
    subtitle="Comparing the past 7 days with the same days last year"
    yAxisTitle="Cards"
    xAxisTitle="Date"
    type="grouped"
    colorPalette={['#8884d8', '#82ca9d']}
    yNames={["2025", "2024"]}
/>

<BarChart
    data={daily_cash_cards_comparison}
    x="day_display"
    y={["maniac_cards", "maniac_vip_cards", "ly_maniac_cards", "ly_maniac_vip_cards"]}
    title="Daily Cash Card Activations by Type"
    subtitle="Comparing card types between years"
    yAxisTitle="Cards"
    xAxisTitle="Date"
    type="grouped"
    colorPalette={['#7A57C9', '#C46696', '#4B917D', '#E8A838']}
    yNames={["2025 Maniac", "2025 VIP", "2024 Maniac", "2024 VIP"]}
/>

<DataTable 
    data={location_cash_cards_comparison}
    rows={10}
>
    <Column id="location" title="Location"/>
    <Column id="total_activations" title="2025 Total" fmt="num0"/>
    <Column id="ly_total_activations" title="2024 Total" fmt="num0"/>
    <Column id="growth_percentage" title="Growth %" fmt="+0.0%"/>
    <Column id="maniac_cards" title="2025 Maniac" fmt="num0"/>
    <Column id="ly_maniac_cards" title="2024 Maniac" fmt="num0"/>
    <Column id="maniac_vip_cards" title="2025 VIP" fmt="num0"/>
    <Column id="ly_maniac_vip_cards" title="2024 VIP" fmt="num0"/>
</DataTable>

--- -->

## Today's Overview

<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <BigValue 
        data={today_summary}
        value="total_forecast_orders"
        title="Forecasted Cards"
    />
    <BigValue 
        data={today_summary}
        value="total_forecast_revenue"
        title="Forecasted Revenue"
        fmt="usd"
    />
    <BigValue 
        data={today_summary}
        value="total_actual_orders"
        title="Actual Cards Sold"
    />
    <BigValue 
        data={today_summary}
        value="total_actual_revenue"
        title="Actual Revenue"
        fmt="usd"
    />
</div>

<BarChart
    data={today_hourly_forecast}
    x="hour"
    y={["forecast_orders", "actual_orders"]}
    title="Today's Hourly Forecast vs Actual Sales"
    subtitle="Comparing forecast with actual sales so far"
    yAxisTitle="Cards"
    xAxisTitle="Hour (24h format)"
    type=grouped
    colorPalette={['#8884d8', '#ff9999']}
    yNames={["Forecast", "Actual"]}
/>

<LineChart
    data={today_hourly_forecast}
    x="hour"
    y={["cumulative_forecast", "cumulative_actual"]}
    title="Today's Cumulative Card Sales"
    subtitle="Running total throughout the day"
    yAxisTitle="Cards"
    xAxisTitle="Hour (24h format)"
    type=grouped
    colorPalette={['#8884d8', '#ff9999']}
    yNames={["Forecast", "Actual"]}
/>

<BarChart
    data={today_by_location}
    x="hour"
    y="forecast_orders"
    series="location"
    title="Today's Hourly Sales by Location"
    subtitle="24-hour breakdown by location"
    yAxisTitle="Cards"
    xAxisTitle="Hour (24h format)"
/>

<DataTable 
    data={today_hourly_forecast}
    rows={24}
>
    <Column id="hour_display" title="Hour (EST)"/>
    <Column id="forecast_orders" title="Forecast"/>
    <Column id="actual_orders" title="Actual"/>
    <Column id="forecast_revenue" title="Forecast Revenue" fmt="usd"/>
    <Column id="actual_revenue" title="Actual Revenue" fmt="usd"/>
</DataTable>

---

## Tomorrow's Overview

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
    <BigValue 
        data={tomorrow_summary}
        value="total_forecast_orders"
        title="Forecasted Cards"
    />
    <BigValue 
        data={tomorrow_summary}
        value="total_forecast_revenue"
        title="Forecasted Revenue"
        fmt="usd"
    />
</div>

<BarChart
    data={tomorrow_hourly_forecast}
    x="hour"
    y="forecast_orders"
    title="Tomorrow's Hourly Sales Forecast"
    subtitle="24-hour breakdown"
    yAxisTitle="Cards"
    xAxisTitle="Hour (24h format)"
    colorPalette={['#82ca9d']}
/>

<LineChart
    data={tomorrow_hourly_forecast}
    x="hour"
    y="cumulative_forecast"
    title="Tomorrow's Cumulative Card Sales"
    subtitle="Running total throughout the day"
    yAxisTitle="Cards"
    xAxisTitle="Hour (24h format)"
    type=grouped
    colorPalette={['#82ca9d']}
/>

<BarChart
    data={tomorrow_by_location}
    x="hour"
    y="forecast_orders"
    series="location"
    title="Tomorrow's Hourly Sales by Location"
    subtitle="24-hour breakdown by location"
    yAxisTitle="Cards"
    xAxisTitle="Hour (24h format)"
/> 

<DataTable 
    data={tomorrow_hourly_forecast}
    rows={24}
>
    <Column id="hour_display" title="Hour (EST)"/>
    <Column id="forecast_orders" title="Forecast"/>
    <Column id="forecast_revenue" title="Forecast Revenue" fmt="usd"/>
    <Column id="cumulative_forecast" title="Cumulative Cards"/>
</DataTable>

