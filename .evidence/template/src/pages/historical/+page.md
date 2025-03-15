<script>
    import { CalendarHeatmap } from '@evidence-dev/core-components';
</script>

# Historical Card Sales Analysis

```sql cards_2024_by_today
SELECT COUNT(*) as total_cards,
       (SUM(amount_total) + 94) as total_revenue,
FROM orders_historical
WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS) <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS) - interval 1 year
```

```sql daily_card_sales
WITH RECURSIVE date_series AS (
    SELECT 
        TIMESTAMP '2023-12-01' - INTERVAL 5 HOURS AS sale_date
    UNION ALL
    SELECT 
        sale_date + INTERVAL '1 day'
    FROM date_series
    WHERE sale_date < TIMESTAMP '2024-05-01' - INTERVAL 5 HOURS
)
SELECT 
    ds.sale_date,
    COALESCE(COUNT(oh.id), 50) AS cards_sold,
    COALESCE(SUM(oh.amount_total), 50) AS revenue_usd,
    COALESCE(SUM(oh.amount_total) / NULLIF(COUNT(oh.id), 50), 50) AS avg_price_usd
FROM date_series ds
LEFT JOIN orders_historical oh
    ON date_trunc('day', ds.sale_date) = 
       date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL 5 HOURS))
GROUP BY ds.sale_date
ORDER BY ds.sale_date
```

```sql cards_sold_last_year
WITH current_year_data AS (
    SELECT COUNT(*) as total_cards_current_year
    FROM orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS) >= TIMESTAMP '2024-10-01'
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS) <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS)
),
last_year_data AS (
    SELECT COUNT(*) as total_cards_last_year
    FROM orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS) <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS) - interval 1 year
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS) >= TIMESTAMP '2023-10-01'
)
SELECT
    ly.total_cards_last_year,
    cy.total_cards_current_year,
    (cy.total_cards_current_year::float / ly.total_cards_last_year) - 1 as yoy_growth
FROM last_year_data ly
CROSS JOIN current_year_data cy
```

```sql next_14_days_last_year
WITH date_range AS (
  -- Get the equivalent date range from last year
  SELECT 
    date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS - INTERVAL '1 year')) as start_date,
    date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS - INTERVAL '1 year' + INTERVAL '14 days')) as end_date
)
SELECT 
    date_trunc('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS)) as sale_date,
    COUNT(*) as cards_sold,
    SUM(amount_total) as revenue_usd
FROM orders_historical
WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS) 
    BETWEEN (SELECT start_date FROM date_range) 
    AND (SELECT end_date FROM date_range)
GROUP BY date_trunc('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL 5 HOURS))
ORDER BY sale_date
```

```sql daily_card_sales_this_year
WITH RECURSIVE date_series AS (
    SELECT 
        CAST('2024-12-03' AS TIMESTAMP) - INTERVAL 5 HOURS AS sale_date
    UNION ALL
    SELECT 
        sale_date + INTERVAL '1 day'
    FROM date_series
    WHERE sale_date < CAST('2025-04-30' AS TIMESTAMP) - INTERVAL 5 HOURS
)
SELECT 
    ds.sale_date,
    COALESCE(COUNT(oh.id), 50) AS cards_sold,
    COALESCE(SUM(oh.amount_total), 50) AS revenue_usd,
    COALESCE(SUM(oh.amount_total) / NULLIF(COUNT(oh.id), 50), 50) AS avg_price_usd
FROM date_series ds
LEFT JOIN orders_historical oh
    ON date_trunc('day', ds.sale_date) = 
       date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL 5 HOURS))
WHERE oh.m_type = 'card' OR oh.m_type IS NULL
GROUP BY ds.sale_date
ORDER BY ds.sale_date
```

```sql rolling_avg_card_sales
WITH RECURSIVE date_series AS (
    SELECT 
        TIMESTAMP '2023-12-01' - INTERVAL 5 HOURS AS sale_date
    UNION ALL
    SELECT 
        sale_date + INTERVAL '1 day'
    FROM date_series
    WHERE sale_date < TIMESTAMP '2024-05-01' - INTERVAL 5 HOURS
),
daily_sales AS (
    SELECT 
        ds.sale_date,
        COALESCE(COUNT(oh.id), 50) AS cards_sold
    FROM date_series ds
    LEFT JOIN orders_historical oh
        ON date_trunc('day', ds.sale_date) = 
           date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL 5 HOURS))
    GROUP BY ds.sale_date
),
full_rolling_avg AS (
    SELECT 
        sale_date,
        cards_sold,
        AVG(cards_sold) OVER (
            ORDER BY sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) as rolling_7day_avg,
        date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS - INTERVAL '1 year'))::date as last_year_today
    FROM daily_sales
)
SELECT *
FROM full_rolling_avg
WHERE sale_date >= TIMESTAMP '2024-01-15' - INTERVAL 5 HOURS
  AND sale_date <= TIMESTAMP '2024-04-01' - INTERVAL 5 HOURS
ORDER BY sale_date
```

```sql combined_rolling_avg
WITH RECURSIVE date_series AS (
    SELECT 
        TIMESTAMP '2023-12-01' - INTERVAL 5 HOURS AS sale_date
    UNION ALL
    SELECT 
        sale_date + INTERVAL '1 day'
    FROM date_series
    WHERE sale_date < TIMESTAMP '2024-05-01' - INTERVAL 5 HOURS
),
last_year_sales AS (
    SELECT 
        ds.sale_date,
        COALESCE(COUNT(oh.id), 0) AS cards_sold
    FROM date_series ds
    LEFT JOIN orders_historical oh
        ON date_trunc('day', ds.sale_date) = 
           date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL 5 HOURS))
    GROUP BY ds.sale_date
),
current_year_sales AS (
    SELECT 
        ds.sale_date,
        COALESCE(COUNT(oh.id), 0) AS cards_sold
    FROM date_series ds
    LEFT JOIN orders_historical oh
        ON date_trunc('day', ds.sale_date + INTERVAL '1 year') = 
           date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL 5 HOURS))
    WHERE ds.sale_date + INTERVAL '1 year' <= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS)
    GROUP BY ds.sale_date
),
rolling_averages AS (
    SELECT 
        ly.sale_date as month,
        ROUND(AVG(ly.cards_sold) OVER (
            ORDER BY ly.sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )) as avg_last_year,
        CASE 
            WHEN ly.sale_date + INTERVAL '1 year' <= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS)
            THEN ROUND(AVG(cy.cards_sold) OVER (
                ORDER BY cy.sale_date
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ))
            ELSE NULL
        END as avg_this_year,
        date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS - INTERVAL '1 year'))::date as last_year_today
    FROM last_year_sales ly
    LEFT JOIN current_year_sales cy USING (sale_date)
)
SELECT *
FROM rolling_averages
WHERE month >= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS - INTERVAL '1 year' - INTERVAL '15 days')
  AND month <= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 5 HOURS - INTERVAL '1 year' + INTERVAL '25 days')
ORDER BY month
```

<LineChart
    data={next_14_days_last_year}
    x=sale_date
    y=cards_sold
    title="Card Sales - Next 14 Days (Last Year)"
    subtitle="Shows sales from the equivalent period last year"
    yAxisTitle="Cards Sold"
/>

## Average Card Price by Location

### March 2024 vs March 2025 Analysis

```sql march_2024_by_location
WITH order_data AS (
    SELECT 
        date_trunc('day', created_at) AS sale_date,
        json_extract_string(stripe_checkout_session, '$.metadata.location') AS location,
        CAST(json_extract_string(stripe_checkout_session, '$.amount_total') AS FLOAT) / 100 AS amount_total
    FROM maniac_neon_2024.orders
    WHERE stripe_checkout_session IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IN ('fort-lauderdale', 'panama-city-beach')
      AND EXTRACT(MONTH FROM created_at) = 3
      AND EXTRACT(YEAR FROM created_at) = 2024
)
SELECT 
    sale_date,
    location,
    AVG(amount_total) AS avg_price_usd,
    COUNT(*) AS cards_sold
FROM order_data
GROUP BY sale_date, location
ORDER BY sale_date, location
```

```sql march_2024_by_location_lytd
WITH order_data AS (
    SELECT 
        date_trunc('day', created_at) AS sale_date,
        json_extract_string(stripe_checkout_session, '$.metadata.location') AS location,
        CAST(json_extract_string(stripe_checkout_session, '$.amount_total') AS FLOAT) / 100 AS amount_total
    FROM maniac_neon_2024.orders
    WHERE stripe_checkout_session IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IN ('fort-lauderdale', 'panama-city-beach')
      AND EXTRACT(MONTH FROM created_at) = 3
      AND EXTRACT(YEAR FROM created_at) = 2024
      AND created_at <= DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 DAYS'))
)
SELECT 
    sale_date,
    location,
    AVG(amount_total) AS avg_price_usd,
    COUNT(*) AS cards_sold
FROM order_data
GROUP BY sale_date, location
ORDER BY sale_date, location
```

```sql march_2025_by_location
WITH order_data AS (
    SELECT 
        date_trunc('day', created_at) AS sale_date,
        json_extract_string(stripe_checkout_session, '$.metadata.location') AS location,
        CAST(json_extract_string(stripe_checkout_session, '$.amount_total') AS FLOAT) / 100 AS amount_total
    FROM maniac_neon_prod.orders
    WHERE stripe_checkout_session IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IN ('fort-lauderdale', 'panama-city-beach')
      AND EXTRACT(MONTH FROM created_at) = 3
      AND EXTRACT(YEAR FROM created_at) = 2025
)
SELECT 
    sale_date,
    location,
    AVG(amount_total) AS avg_price_usd,
    COUNT(*) AS cards_sold
FROM order_data
GROUP BY sale_date, location
ORDER BY sale_date, location
```

```sql march_2024_totals
SELECT
    COUNT(*) AS total_cards_sold,
    ROUND(AVG(amount_total), 2) AS avg_price_usd
FROM (
    SELECT 
        CAST(json_extract_string(stripe_checkout_session, '$.amount_total') AS FLOAT) / 100 AS amount_total
    FROM maniac_neon_2024.orders
    WHERE stripe_checkout_session IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IN ('fort-lauderdale', 'panama-city-beach')
      AND EXTRACT(MONTH FROM created_at) = 3
      AND EXTRACT(YEAR FROM created_at) = 2024
)
```

```sql march_2025_totals
SELECT
    COUNT(*) AS total_cards_sold,
    ROUND(AVG(amount_total), 2) AS avg_price_usd
FROM (
    SELECT 
        CAST(json_extract_string(stripe_checkout_session, '$.amount_total') AS FLOAT) / 100 AS amount_total
    FROM maniac_neon_prod.orders
    WHERE stripe_checkout_session IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IS NOT NULL
      AND json_extract_string(stripe_checkout_session, '$.metadata.location') IN ('fort-lauderdale', 'panama-city-beach')
      AND EXTRACT(MONTH FROM created_at) = 3
      AND EXTRACT(YEAR FROM created_at) = 2025
)
```

<div class="grid grid-cols-2 gap-4">
    <BigValue 
        data={march_2024_totals}
        value="total_cards_sold"
        title="March 2024 Cards Sold"
    />
    <BigValue 
        data={march_2024_totals}
        value="avg_price_usd"
        title="March 2024 Avg. Price"
        fmt="usd"
    />
    <BigValue 
        data={march_2025_totals}
        value="total_cards_sold"
        title="March 2025 Cards Sold"
    />
    <BigValue 
        data={march_2025_totals}
        value="avg_price_usd"
        title="March 2025 Avg. Price"
        fmt="usd"
    />
</div>

<BarChart
    data={march_2024_by_location}
    x=sale_date
    y="avg_price_usd"
    series=location
    title="March 2024 Average Card Price by Location"
    subtitle="Fort Lauderdale vs Panama City Beach"
    yAxisTitle="USD"
    yFmt="usd"
    type="grouped"
    labels=true
/>

<BarChart
    data={march_2024_by_location_lytd}
    x=sale_date
    y="avg_price_usd"
    series=location
    title="March 2024 Average Card Price by Location (LYTD)"
    subtitle="Fort Lauderdale vs Panama City Beach"
    yAxisTitle="USD"
    yFmt="usd"
    type="grouped"
    labels=true
/>

<BarChart
    data={march_2025_by_location}
    x=sale_date
    y="avg_price_usd"
    series=location
    title="March 2025 Average Card Price by Location"
    subtitle="Fort Lauderdale vs Panama City Beach"
    yAxisTitle="USD"
    yFmt="usd"
    type="grouped"
    labels=true
/>

<LineChart
    data={daily_card_sales}
    x=sale_date
    y=avg_price_usd
    title="Average Price per Card"
    subtitle="August 2023 - May 2024"
    yAxisTitle="USD"
    fmt="usd"
    connectGroup="2024"
/>

<LineChart
    data={daily_card_sales_this_year}
    x=sale_date
    y=avg_price_usd
    title="Average Price per Card This Year"
    subtitle="Same time range as previous analysis"
    yAxisTitle="Average Price (USD)"
    fmt="usd"
    yMin=0
    yMax=180
/>

<LineChart
    data={daily_card_sales}
    x=sale_date
    y=cards_sold
    title="Daily Card Sales"
    subtitle="August 2023 - May 2024"
    connectGroup="2024"
/>

<LineChart
    data={daily_card_sales}
    x=sale_date
    y=revenue_usd
    title="Daily Revenue"
    subtitle="August 2023 - May 2024"
    yAxisTitle="Revenue (USD)"
    fmt="usd"
    connectGroup="2024"
/>

<LineChart
    data={rolling_avg_card_sales}
    x=sale_date
    y=rolling_7day_avg
    title="7-Day Rolling Average Card Sales"
    subtitle="Moving average over previous 7 days"
    yAxisTitle="Average Cards Sold"
>
    <ReferenceLine 
        data={rolling_avg_card_sales}
        x=last_year_today
        label="LYTD"
        lineWidth=2 
        lineType=dashed
        hideValue=true
        color=accent
    />
</LineChart>

<LineChart 
    data={combined_rolling_avg}
    x=month
    y={["avg_last_year", "avg_this_year"]}
    title="Rolling Average Comparison"
    subtitle="7-Day Average Cards Sold"
    yAxisTitle="Cards Sold"
        colorPalette={
        [
        '#459bd7',
        '#cf4845',
        ]
    }
>
    <ReferenceLine 
        data={combined_rolling_avg}
        x=last_year_today
        label="LYTD"
        lineWidth=2 
        lineType=dashed
        hideValue=true
        color=accent
    />
</LineChart>
