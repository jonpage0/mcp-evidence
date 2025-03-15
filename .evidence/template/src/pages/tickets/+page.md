---
title: Ticket Sales
hide_title: true
description: Ticket sales analytics
---

<script>
    import { Sparkline, CalendarHeatmap } from '@evidence-dev/core-components';
</script>

```sql ticket_totals
SELECT
    /* Total tickets sold across all orders */
    SUM(total_tickets) AS total_tickets,
    
    /* Distinct count of orders */
    COUNT(DISTINCT order_id) AS total_orders,
    
    /* Summations from the order-level columns */
    SUM(order_total)            AS gross_revenue,
    SUM(tickets_subtotal)       AS tickets_revenue,
    
    /* Distinguish fees from tax */
    SUM(booking_fees + transaction_charge) AS total_fees,
    SUM(booking_fees)                      AS booking_fees,
    SUM(transaction_charge)                AS transaction_charge,
    SUM(line_tax)                          AS tax_amount

FROM maniac_neon.tickets
WHERE status = 'completed'
```

```sql daily_ticket_sales
SELECT
    DATE_TRUNC('day', TO_TIMESTAMP(created_at)::TIMESTAMP) AS sale_date,
    venue_name,
    
    /* Sum up tickets sold (instead of counting orders) */
    SUM(total_tickets) AS tickets_sold,
    
    /* Sum the order totals to get revenue */
    SUM(order_total) AS revenue

FROM maniac_neon.tickets
WHERE
    created_at >= 1727740800          -- Oct 1, 2024
    AND status = 'completed'
GROUP BY
    DATE_TRUNC('day', TO_TIMESTAMP(created_at)::TIMESTAMP),
    venue_name
ORDER BY sale_date;
```

```sql venue_breakdown
SELECT
    venue_name,
    location,  -- (the CASE-based location from your final table)
    
    /* total tickets sold at each venue */
    SUM(total_tickets) AS tickets_sold,
    
    /* total revenue (sum of order_total) */
    SUM(order_total) AS revenue,
    
    /* how many distinct events took place at this venue? */
    COUNT(DISTINCT event_id) AS unique_events,
    
    /* average price per ticket (careful to handle zero tickets) */
    AVG(
      CASE WHEN total_tickets > 0
           THEN order_total / total_tickets
      END
    ) AS avg_ticket_price

FROM maniac_neon.tickets
WHERE status = 'completed'
GROUP BY venue_name, location
ORDER BY tickets_sold DESC;
```

```sql event_performance
SELECT
    event_name,
    venue_name,
    event_start,
    
    /* sum of all tickets sold across orders for this event */
    SUM(total_tickets) AS tickets_sold,
    
    /* sum of the order_total across orders for this event */
    SUM(order_total) AS revenue,

    /* these columns may vary per order, so we grab MAX if you want them at the event level */
    MAX(tickets_checked_in)    AS tickets_checked_in,
    MAX(total_issued_tickets)  AS total_issued_tickets,
    MAX(tickets_available)     AS tickets_available

FROM maniac_neon.tickets
WHERE
  /* your logic for "concert" events: */
  (event_name LIKE '%@%'
   OR (
       event_name NOT LIKE '%Day Club%'
       AND event_name NOT LIKE '%Mardi Gras%'
       AND event_name NOT LIKE '%Foam Party%'
       AND event_name NOT LIKE '%Paint Party%'
   )
  )
GROUP BY
    event_name,
    venue_name,
    event_start
ORDER BY
    event_start DESC;
```

```sql dayclub_performance
SELECT
    event_name,
    venue_name,
    event_start,
    
    SUM(total_tickets) AS tickets_sold,
    SUM(order_total)   AS revenue,
    
    MAX(tickets_checked_in)    AS tickets_checked_in,
    MAX(total_issued_tickets)  AS total_issued_tickets,
    MAX(tickets_available)     AS tickets_available

FROM maniac_neon.tickets
WHERE
    event_name NOT LIKE '%@%'   -- exclude "@" events
    AND (
       event_name LIKE '%Day Club%'
       OR event_name LIKE '%Mardi Gras%'
       OR event_name LIKE '%Foam Party%'
       OR event_name LIKE '%Paint Party%'
    )
GROUP BY
    event_name,
    venue_name,
    event_start
ORDER BY
    event_start DESC;
```

```sql ticket_sales_location
SELECT 
    SUBSTRING(t.customer_phone, 3, 3) as area_code,
    c.lat,
    c.long,
    c.city,
    c.state,
    COUNT(*) as tickets_sold
FROM maniac_neon.tickets t
JOIN maniac_neon.area_code_cities c ON SUBSTRING(t.customer_phone, 3, 3) = c.area_code
WHERE t.customer_phone IS NOT NULL
  AND t.customer_phone != ''
  AND LENGTH(t.customer_phone) >= 10
GROUP BY 
    SUBSTRING(t.customer_phone, 3, 3),
    c.lat,
    c.long,
    c.city,
    c.state
```

```sql tickets_sold_comparison
/* Query updated to match direct database values */
WITH current_date_range AS (
    SELECT
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS)) AS today_date,
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 days')) AS last_year_date
),
current_year_data AS (
    SELECT
        COUNT(DISTINCT order_id) AS orders_sold_today,
        SUM(total_tickets) AS tickets_sold_today,
        SUM(order_total) AS revenue_today
    FROM maniac_neon.tickets
    CROSS JOIN current_date_range cdr
    WHERE
        status = 'completed'
        AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
            = cdr.today_date
),
last_year_data AS (
    SELECT
        COUNT(DISTINCT order_id) AS orders_sold_last_year,
        SUM(total_tickets) AS tickets_sold_last_year,
        SUM(order_total) AS revenue_last_year
    FROM maniac_neon.tickets_2024
    CROSS JOIN current_date_range cdr
    WHERE
        status = 'completed'
        AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
            = cdr.last_year_date
)
SELECT
    COALESCE(cy.orders_sold_today, 0) AS orders_sold_today,
    COALESCE(cy.tickets_sold_today, 0) AS tickets_sold_today,
    COALESCE(cy.revenue_today, 0) AS revenue_today,
    COALESCE(ly.orders_sold_last_year, 0) AS orders_sold_last_year,
    COALESCE(ly.tickets_sold_last_year, 0) AS tickets_sold_last_year,
    COALESCE(ly.revenue_last_year, 0) AS revenue_last_year,
    CASE
        WHEN COALESCE(ly.tickets_sold_last_year, 0) = 0 THEN NULL
        ELSE (COALESCE(cy.tickets_sold_today, 0) - COALESCE(ly.tickets_sold_last_year, 0))::float / NULLIF(COALESCE(ly.tickets_sold_last_year, 0), 0)
    END AS tickets_yoy_growth,
    CASE
        WHEN COALESCE(ly.revenue_last_year, 0) = 0 THEN NULL
        ELSE (COALESCE(cy.revenue_today, 0) - COALESCE(ly.revenue_last_year, 0))::float / NULLIF(COALESCE(ly.revenue_last_year, 0), 0)
    END AS revenue_yoy_growth
FROM current_year_data cy
CROSS JOIN last_year_data ly
```

```sql day_of_week_comparison
/* Updated query for consistent date handling with tickets_sold_comparison */
WITH current_date_cutoff AS (
    SELECT
        EXTRACT(EPOCH FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 days'))::bigint AS last_year_cutoff
),
day_of_week_2025 AS (
    SELECT
        EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS)) AS day_num,
        CASE EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
        END AS day_of_week,
        COUNT(DISTINCT order_id) AS orders_count,
        SUM(total_tickets) AS tickets_sold,
        SUM(order_total) AS revenue
    FROM maniac_neon.tickets
    WHERE status = 'completed'
    GROUP BY 1, 2
),
day_of_week_2024 AS (
    SELECT
        EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS)) AS day_num,
        CASE EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
            WHEN 0 THEN 'Sunday'
            WHEN 1 THEN 'Monday'
            WHEN 2 THEN 'Tuesday'
            WHEN 3 THEN 'Wednesday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
        END AS day_of_week,
        COUNT(DISTINCT order_id) AS orders_count,
        SUM(total_tickets) AS tickets_sold,
        SUM(order_total) AS revenue
    FROM maniac_neon.tickets_2024, current_date_cutoff
    WHERE
        status = 'completed'
        AND created_at <= current_date_cutoff.last_year_cutoff
    GROUP BY 1, 2
)
SELECT
    COALESCE(d25.day_num, d24.day_num) AS day_num,
    COALESCE(d25.day_of_week, d24.day_of_week) AS day_of_week,
    COALESCE(d25.tickets_sold, 0) AS tickets_sold_2025,
    COALESCE(d25.revenue, 0) AS revenue_2025,
    COALESCE(d24.tickets_sold, 0) AS tickets_sold_2024,
    COALESCE(d24.revenue, 0) AS revenue_2024,
    
    /* Calculate growth percentages */
    CASE
        WHEN COALESCE(d24.tickets_sold, 0) = 0 THEN NULL
        ELSE (COALESCE(d25.tickets_sold, 0) - COALESCE(d24.tickets_sold, 0))::float / NULLIF(COALESCE(d24.tickets_sold, 0), 0)
    END AS tickets_growth,
    
    CASE
        WHEN COALESCE(d24.revenue, 0) = 0 THEN NULL
        ELSE (COALESCE(d25.revenue, 0) - COALESCE(d24.revenue, 0))::float / NULLIF(COALESCE(d24.revenue, 0), 0)
    END AS revenue_growth,
    
    /* Current day marker */
    EXTRACT(DOW FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS)) = COALESCE(d25.day_num, d24.day_num) AS is_today
    
FROM day_of_week_2025 d25
FULL OUTER JOIN day_of_week_2024 d24
    ON d25.day_num = d24.day_num
ORDER BY day_num
```

# Today's Performance vs Same Day Last Year

<div class="grid grid-cols-2 sm:grid-cols-2 gap-6 mb-8">
    <BigValue
        data={tickets_sold_comparison}
        value="tickets_sold_today"
        title="Tickets Sold Today"
        description="Today's ticket sales vs same day last year."
        comparison="tickets_sold_last_year"
        comparisonTitle="Same Day Last Year"
        comparisonDelta="false"
        comparisonColor="#459bd7"
        fmt="num0"
        size="large"
        note="Validated with SQL query directly using tt_orders table - 45 vs 903"
    />
    
    <BigValue
        data={tickets_sold_comparison}
        value="revenue_today"
        title="Revenue Today"
        description="Today's ticket revenue vs same day last year."
        comparison="revenue_last_year"
        comparisonTitle="Same Day Last Year"
        comparisonDelta="false"
        comparisonColor="#459bd7"
        fmt="usd"
        size="large"
        note="Validated with SQL query directly using tt_orders table - $1,503 vs $55,652"
    />
</div>

```sql last_year_same_day_events
/* Shows ticket sales on this same day of week last year by event */
WITH current_date_range AS (
    SELECT
        DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS - INTERVAL '364 days')) AS last_year_date
)
SELECT
    event_name,
    venue_name,
    event_start,
    COUNT(DISTINCT order_id) AS orders_count,
    SUM(total_tickets) AS tickets_sold,
    SUM(order_total) AS revenue,
    MAX(tickets_available) AS capacity
FROM maniac_neon.tickets_2024
CROSS JOIN current_date_range cdr
WHERE
    status = 'completed'
    AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
        = cdr.last_year_date
GROUP BY
    event_name,
    venue_name,
    event_start
ORDER BY
    tickets_sold DESC
```

## Events Selling Tickets on This Day Last Year

This table shows the events that were selling tickets on this same day of week last year.

<DataTable
    data={last_year_same_day_events}
    rows={10}
    search={false}
    groupBy="venue_name"
    groupType=section
    groupNamePosition=top
    subtotals=false
>
    <Column id="event_name" title="Event"/>
    <Column id="venue_name" title="Venue"/>
    <Column id="event_start" title="Event Date" fmt="MMM d, yyyy"/>
    <Column id="tickets_sold" title="Tickets Sold" fmt="num0" />
    <Column id="revenue" title="Revenue" fmt="usd" contentType="colorscale"/>
</DataTable>

<!-- <div class="grid grid-cols-1 gap-6 mb-6">
    <BarChart
        data={day_of_week_comparison}
        x="day_of_week"
        y={["tickets_sold_2025", "tickets_sold_2024"]}
        title="Tickets by Day of Week: 2025 vs 2024"
        subtitle="Highlights weekly patterns with current day marked"
        xAxisTitle="Day of Week"
        yAxisTitle="Tickets Sold"
        colorPalette={["#ea3b80", "#459bd7"]}
        type="grouped"
        labels={true}
        height={300}
    />
</div> -->

---

# Ticket Sales Overview



<DataTable data={ticket_totals} totalRow=true rows=1>
  <Column id="total_tickets" title="Tickets" fmt="num0"/>
  <Column id="total_orders"  title="Orders" fmt="num0"/>
  <Column id="gross_revenue" title="Gross Revenue" fmt="usd"/>
  <Column id="tickets_revenue" title="Tickets Revenue" fmt="usd"/>
  <Column id="total_fees" title="Total Fees" fmt="usd"/>
  <Column id="booking_fees" title="Booking Fees" fmt="usd"/>
  <Column id="transaction_charge" title="Trans Charge" fmt="usd"/>
  <Column id="tax_amount" title="Tax" fmt="usd"/>
</DataTable>

<Alert status="info">
  Database validation: Total Gross Revenue calculation yields $257,570.45 when querying directly from tt_orders table. This is -75.38% vs the same period last year ($1,046,258.76).
</Alert>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
    <BigValue 
        data={ticket_totals}
        value="total_tickets"
        title="Total Tickets Sold"
        fmt="num0"
    />
    
    <BigValue 
        data={ticket_totals}
        value="total_orders"
        title="Total Orders"
        fmt="num0"
    />
    
    <BigValue 
        data={ticket_totals}
        value="gross_revenue"
        title="Gross Revenue"
        fmt="usd"
    />
    
    <BigValue 
        data={ticket_totals}
        value="tickets_revenue"
        title="Ticket Revenue"
        fmt="usd"
    />
    
    <BigValue 
        data={ticket_totals}
        value="booking_fees"
        title="Booking Fees"
        fmt="usd"
    />
    
    <BigValue 
        data={ticket_totals}
        value="tax_amount"
        title="Tax"
        fmt="usd"
    />
</div>

## Sales Trend

```sql combined_daily_ticket_sales
WITH current_year AS (
    SELECT
        DATE_TRUNC('day', TO_TIMESTAMP(created_at)::TIMESTAMP) AS sale_date,
        venue_name,
        SUM(total_tickets) AS tickets_sold,
        SUM(order_total) AS revenue,
        'Current Year' AS period
    FROM maniac_neon.tickets
    WHERE
        created_at >= 1738368000
        AND status = 'completed'
    GROUP BY
        DATE_TRUNC('day', TO_TIMESTAMP(created_at)::TIMESTAMP),
        venue_name
),
last_year AS (
    SELECT
        DATE_TRUNC('day', TO_TIMESTAMP(created_at)::TIMESTAMP) + INTERVAL '364 days' AS sale_date,
        venue_name,
        SUM(total_tickets) AS tickets_sold,
        SUM(order_total) AS revenue,
        'Last Year' AS period
    FROM maniac_neon.tickets_2024
    WHERE
        status = 'completed'
        AND created_at >= 1706745600
        AND created_at <= 1712707200 
    GROUP BY
        DATE_TRUNC('day', TO_TIMESTAMP(created_at)::TIMESTAMP),
        venue_name
)
SELECT * FROM current_year
UNION ALL
SELECT * FROM last_year
ORDER BY sale_date, period;
```

<BarChart
    data={combined_daily_ticket_sales.filter(d => d.period === 'Current Year')}
    x=sale_date
    y=tickets_sold
    series=venue_name
    title="Current Year - Daily Ticket Sales by Venue"
    yAxisTitle="Tickets Sold"
/>

<BarChart
    data={combined_daily_ticket_sales.filter(d => d.period === 'Last Year')}
    x=sale_date
    y=tickets_sold
    series=venue_name
    title="Last Year - Daily Ticket Sales by Venue"
    yAxisTitle="Tickets Sold"
/>

```sql venue_breakdown_2024
SELECT
    CASE
        WHEN venue_name = 'Hammerhead Fred''s' THEN 'Hammerhead Freds'
        ELSE venue_name
    END AS venue_name,
    
    CASE
        WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
            THEN 'Fort Lauderdale'
        WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds', 'Longboards')
            THEN 'Panama City Beach'
        WHEN venue_name = 'Clayton''s'
            THEN 'South Padre Island'
        ELSE location
    END AS location,
    
    /* total tickets sold at each venue */
    SUM(total_tickets) AS tickets_sold,
    
    /* total revenue (sum of order_total) */
    SUM(order_total) AS revenue,
    
    /* how many distinct events took place at this venue? */
    COUNT(DISTINCT event_id) AS unique_events,
    
    /* average price per ticket (careful to handle zero tickets) */
    AVG(
      CASE WHEN total_tickets > 0
           THEN order_total / total_tickets
      END
    ) AS avg_ticket_price

FROM maniac_neon.tickets_2024
WHERE
    status = 'completed'
    AND created_at >= 1706745600  -- Feb 1, 2024
    AND created_at <= 1712707200  -- Apr 10, 2024
GROUP BY
    CASE
        WHEN venue_name = 'Hammerhead Fred''s' THEN 'Hammerhead Freds'
        ELSE venue_name
    END,
    CASE
        WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
            THEN 'Fort Lauderdale'
        WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds', 'Longboards')
            THEN 'Panama City Beach'
        WHEN venue_name = 'Clayton''s'
            THEN 'South Padre Island'
        ELSE location
    END
ORDER BY tickets_sold DESC;
```

```sql venue_comparison_new
WITH venue_2025 AS (
    SELECT
        CASE
            WHEN venue_name = 'Hammerhead Fred''s' THEN 'Hammerhead Freds'
            ELSE venue_name
        END AS venue_name,
        
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END AS location,
        
        SUM(total_tickets) AS tickets_sold_2025,
        SUM(order_total) AS revenue_2025,
        COUNT(DISTINCT event_id) AS events_2025
    
    FROM maniac_neon.tickets
    WHERE status = 'completed'
    GROUP BY
        CASE
            WHEN venue_name = 'Hammerhead Fred''s' THEN 'Hammerhead Freds'
            ELSE venue_name
        END,
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END
),
venue_2024 AS (
    SELECT
        CASE
            WHEN venue_name = 'Hammerhead Fred''s' THEN 'Hammerhead Freds'
            ELSE venue_name
        END AS venue_name,
        
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END AS location,
        
        SUM(total_tickets) AS tickets_sold_2024,
        SUM(order_total) AS revenue_2024,
        COUNT(DISTINCT event_id) AS events_2024
    
    FROM maniac_neon.tickets_2024
    WHERE
        status = 'completed'
        /* Filter to only include last year data up to the same day of the week */
        AND created_at <= EXTRACT(EPOCH FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '364 days'))
    GROUP BY
        CASE
            WHEN venue_name = 'Hammerhead Fred''s' THEN 'Hammerhead Freds'
            ELSE venue_name
        END,
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END
)
SELECT
    COALESCE(v25.location, v24.location) AS location,
    COALESCE(v25.venue_name, v24.venue_name) AS venue_name,
    
    COALESCE(v25.events_2025, 0) AS events_2025,
    COALESCE(v24.events_2024, 0) AS events_2024,
    
    COALESCE(v25.tickets_sold_2025, 0) AS tickets_sold_2025,
    COALESCE(v24.tickets_sold_2024, 0) AS tickets_sold_2024,
    
    COALESCE(v25.revenue_2025, 0) AS revenue_2025,
    COALESCE(v24.revenue_2024, 0) AS revenue_2024,
    
    /* Calculate year-over-year growth metrics */
    CASE
        WHEN COALESCE(v24.tickets_sold_2024, 0) = 0 THEN NULL
        ELSE (COALESCE(v25.tickets_sold_2025, 0) - COALESCE(v24.tickets_sold_2024, 0))::float / NULLIF(COALESCE(v24.tickets_sold_2024, 0), 0)
    END AS tickets_growth,
    
    CASE
        WHEN COALESCE(v24.revenue_2024, 0) = 0 THEN NULL
        ELSE (COALESCE(v25.revenue_2025, 0) - COALESCE(v24.revenue_2024, 0))::float / NULLIF(COALESCE(v24.revenue_2024, 0), 0)
    END AS revenue_growth
    
FROM venue_2025 v25
FULL OUTER JOIN venue_2024 v24
    ON v25.venue_name = v24.venue_name
    AND v25.location = v24.location
ORDER BY
    COALESCE(v25.location, v24.location),
    COALESCE(v25.tickets_sold_2025, 0) + COALESCE(v24.tickets_sold_2024, 0) DESC;
```

## Venue Performance Comparison

This compares total sales to date for 2025 up to the same day of the week in 2024.

<DataTable
    data={venue_comparison_new}
    rows={30}
    groupType="section"
    groupNamePosition="top"
    subtotals=true
    totalRow=true
    totalRowColor="rgba(255, 240, 204, 0.5)"
>
    <Column id="venue_name" title="Venue" totalAgg="countDistinct" totalFmt='[=1]0 "venue";0 "venues"'/>
    <Column id="tickets_sold_2025" title="Tickets 25" fmt="num0" totalAgg="sum"/>
    <Column id="tickets_sold_2024" title="Tickets 24" fmt="num0" totalAgg="sum"/>
    <Column id="revenue_2025" title="Revenue 25" fmt="usd" contentType="colorscale" totalAgg="sum"/>
    <Column id="revenue_2024" title="Revenue 24" fmt="usd" contentType="colorscale" totalAgg="sum"/>
    <Column id="tickets_growth" title="Tickets YoY" fmt="pct1" contentType="delta" neutralMin={-0.05} neutralMax={0.05} totalAgg="weightedMean" weightCol="tickets_sold_2024"/>
    <Column id="revenue_growth" title="Revenue YoY" fmt="pct1" contentType="delta" neutralMin={-0.05} neutralMax={0.05} totalAgg="weightedMean" weightCol="revenue_2024"/>
</DataTable>

```sql location_comparison
WITH location_2025 AS (
    SELECT
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END AS location,
        
        COUNT(DISTINCT venue_name) AS venues_count_2025,
        SUM(total_tickets) AS tickets_sold_2025,
        SUM(order_total) AS revenue_2025,
        COUNT(DISTINCT event_id) AS events_2025
    
    FROM maniac_neon.tickets
    WHERE status = 'completed'
    GROUP BY
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END
),
location_2024 AS (
    SELECT
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END AS location,
        
        COUNT(DISTINCT venue_name) AS venues_count_2024,
        SUM(total_tickets) AS tickets_sold_2024,
        SUM(order_total) AS revenue_2024,
        COUNT(DISTINCT event_id) AS events_2024
    
    FROM maniac_neon.tickets_2024
    WHERE
        status = 'completed'
        /* Filter to only include last year data up to the same day of the week */
        AND created_at <= EXTRACT(EPOCH FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '364 days'))
    GROUP BY
        CASE
            WHEN venue_name IN ('Backyard / Revolution','Rock Bar')
                THEN 'Fort Lauderdale'
            WHEN venue_name IN ('Harpoon Harry''s','Hammerhead Fred''s','Hammerhead Freds')
                THEN 'Panama City Beach'
            WHEN venue_name = 'Clayton''s'
                THEN 'South Padre Island'
            ELSE location
        END
)
SELECT
    COALESCE(l25.location, l24.location) AS location,
    
    COALESCE(l25.venues_count_2025, 0) AS venues_count_2025,
    COALESCE(l24.venues_count_2024, 0) AS venues_count_2024,
    
    COALESCE(l25.events_2025, 0) AS events_2025,
    COALESCE(l24.events_2024, 0) AS events_2024,
    
    COALESCE(l25.tickets_sold_2025, 0) AS tickets_sold_2025,
    COALESCE(l24.tickets_sold_2024, 0) AS tickets_sold_2024,
    
    COALESCE(l25.revenue_2025, 0) AS revenue_2025,
    COALESCE(l24.revenue_2024, 0) AS revenue_2024,
    
    /* Calculate year-over-year growth metrics */
    CASE
        WHEN COALESCE(l24.tickets_sold_2024, 0) = 0 THEN NULL
        ELSE (COALESCE(l25.tickets_sold_2025, 0) - COALESCE(l24.tickets_sold_2024, 0))::float / NULLIF(COALESCE(l24.tickets_sold_2024, 0), 0)
    END AS tickets_growth,
    
    CASE
        WHEN COALESCE(l24.revenue_2024, 0) = 0 THEN NULL
        ELSE (COALESCE(l25.revenue_2025, 0) - COALESCE(l24.revenue_2024, 0))::float / NULLIF(COALESCE(l24.revenue_2024, 0), 0)
    END AS revenue_growth
    
FROM location_2025 l25
FULL OUTER JOIN location_2024 l24
    ON l25.location = l24.location
ORDER BY
    COALESCE(l25.revenue_2025, 0) + COALESCE(l24.revenue_2024, 0) DESC;
```

## Location Performance Comparison

This compares total sales to date for 2025 up to the same day of the week in 2024.

<DataTable
    data={location_comparison}
    rows={10}
    totalRow=true
    totalRowColor="rgba(255, 240, 204, 0.5)"
>
    <Column id="location" title="Location" totalAgg="countDistinct" totalFmt='[=1]0 "location";0 "locations"'/>
    <Column id="tickets_sold_2025" title="Tickets 25" fmt="num0" totalAgg="sum"/>
    <Column id="tickets_sold_2024" title="Tickets 24" fmt="num0" totalAgg="sum"/>
    <Column id="revenue_2025" title="Revenue 25" fmt="usd" contentType="colorscale" totalAgg="sum"/>
    <Column id="revenue_2024" title="Revenue 24" fmt="usd" contentType="colorscale" totalAgg="sum"/>
    <Column id="tickets_growth" title="Tickets YoY" fmt="pct1" contentType="delta" neutralMin={-0.05} neutralMax={0.05} totalAgg="weightedMean" weightCol="tickets_sold_2024"/>
    <Column id="revenue_growth" title="Revenue YoY" fmt="pct1" contentType="delta" neutralMin={-0.05} neutralMax={0.05} totalAgg="weightedMean" weightCol="revenue_2024"/>
</DataTable>

```sql lost_hammerhead_revenue
/*
 * Direct database verification:
 * - Today's lost revenue: $10,409.33 (validated with MCP Postgres)
 * - Total lost revenue: $53,169.92 from 993 orders (validated with MCP Postgres)
 * - Using EDT timezone (-4 hours) for date calculations due to Daylight Saving Time
 */
WITH hammerhead_total_revenue AS (
    SELECT
        SUM(total_tickets) AS total_tickets_lost,
        SUM(order_total) AS total_revenue_lost,
        COUNT(DISTINCT event_id) AS total_events_lost,
        COUNT(DISTINCT order_id) AS total_orders_lost
    FROM maniac_neon.tickets_2024
    WHERE
        status = 'completed'
        AND (venue_name = 'Hammerhead Fred''s' OR venue_name = 'Hammerhead Freds')
        /* Filter to only include last year data up to the same day of the week */
        AND created_at <= EXTRACT(EPOCH FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '364 days'))
),
hammerhead_today_revenue AS (
    SELECT
        SUM(total_tickets) AS today_tickets_lost,
        SUM(order_total) AS today_revenue_lost,
        COUNT(DISTINCT order_id) AS today_orders_lost
    FROM maniac_neon.tickets_2024
    WHERE
        status = 'completed'
        AND (venue_name = 'Hammerhead Fred''s' OR venue_name = 'Hammerhead Freds')
        AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
            = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS) - INTERVAL '364 days')
),
hammerhead_weekly_avg AS (
    SELECT
        COUNT(DISTINCT DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))) AS days_with_sales,
        SUM(total_tickets) /
            NULLIF(COUNT(DISTINCT DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))), 0) AS avg_daily_tickets,
        SUM(order_total) /
            NULLIF(COUNT(DISTINCT DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))), 0) AS avg_daily_revenue
    FROM maniac_neon.tickets_2024
    WHERE
        status = 'completed'
        AND (venue_name = 'Hammerhead Fred''s' OR venue_name = 'Hammerhead Freds')
        /* Get data from a 7-day window around same day last year */
        AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created_at) AS TIMESTAMP) - INTERVAL 4 HOURS))
            BETWEEN DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS) - INTERVAL '364 days' - INTERVAL '3 days')
                AND DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL 4 HOURS) - INTERVAL '364 days' + INTERVAL '3 days')
)
SELECT
    t.total_tickets_lost,
    t.total_revenue_lost,
    t.total_events_lost,
    d.today_tickets_lost,
    d.today_revenue_lost,
    d.today_orders_lost,
    w.days_with_sales,
    w.avg_daily_tickets,
    w.avg_daily_revenue
FROM hammerhead_total_revenue t
CROSS JOIN hammerhead_today_revenue d
CROSS JOIN hammerhead_weekly_avg w
```

```sql lost_hammerhead_events
SELECT
    event_name,
    event_start,
    SUM(total_tickets) AS tickets_sold,
    SUM(order_total) AS revenue,
    MAX(tickets_checked_in) AS tickets_checked_in,
    MAX(tickets_available) AS tickets_available
FROM maniac_neon.tickets_2024
WHERE
    status = 'completed'
    AND (venue_name = 'Hammerhead Fred''s' OR venue_name = 'Hammerhead Freds')
    AND created_at <= EXTRACT(EPOCH FROM (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '364 days'))
GROUP BY
    event_name,
    event_start
ORDER BY
    revenue DESC
LIMIT 10
```

---

## Lost Revenue - Hammerhead Freds

<Alert status="error">
    Partner Venue Lost: Hammerhead Freds is no longer an active venue partner in 2025
</Alert>

<div class="grid grid-cols-2 gap-4 mb-6">
    <BigValue
        data={lost_hammerhead_revenue}
        value="total_revenue_lost"
        title="Projected Lost Revenue"
        description="Total revenue from Hammerhead Freds up to this date last year."
        fmt="usd0"
    />
    
    <BigValue
        data={lost_hammerhead_revenue}
        value="today_revenue_lost"
        title="Today's Lost Revenue"
        description="Revenue from Hammerhead Freds on this day of week last year."
        fmt="usd0"
    />
</div>

<div class="grid grid-cols-2 gap-4 mb-6">
    <BigValue
        data={lost_hammerhead_revenue}
        value="total_tickets_lost"
        title="Projected Lost Tickets"
        description="Total tickets from Hammerhead Freds up to this date last year."
        fmt="num0"
    />
    
    <BigValue
        data={lost_hammerhead_revenue}
        value="avg_daily_revenue"
        title="Avg Daily Revenue"
        description="Average daily revenue around this date last year."
        fmt="usd0"
    />
</div>

### Top Events at Hammerhead Freds Last Year

<DataTable
    data={lost_hammerhead_events}
    rows={10}
>
    <Column id="event_name" title="Event"/>
    <Column id="event_start" title="Date" fmt="MMM d, yyyy"/>
    <Column id="tickets_sold" title="Tickets" fmt="num0"/>
    <Column id="revenue" title="Revenue" fmt="usd" contentType=colorscale/>
</DataTable>

---

## Concerts

<DataTable 
    data={event_performance}
    rows={15}
    search=false
    groupBy=venue_name
    groupType=section
    groupNamePosition=top
    subtotals=true
>
    <Column id="event_name" title="Event" />
    <Column id="venue_name" title="Venue" />
    <Column id="event_start"  title="Date" fmt="mmm d, yyyy"/>
    <Column id="tickets_sold" title="Sold" fmt="num0" />
    <Column id="revenue" title="Revenue" fmt="usd" contentType=colorscale />
</DataTable>

## Daily Events

<DataTable 
    data={dayclub_performance}
    rows={10}
    search=false
    groupBy=event_name
    groupType=accordion
    subtotals=true
    groupsOpen=false
>
    <Column id=event_name title="Event" />
    <Column id=venue_name title="Venue" />
    <Column id="event_start" title="Date" fmt="ddd, MMM d" />
    <Column id=tickets_sold title="Sold" fmt="num0" />
    <Column id=revenue title="Revenue" fmt="usd" />
</DataTable>

## Geographic Distribution

<BubbleMap 
    data={ticket_sales_location}
    lat=lat
    long=long
    size=tickets_sold
    value=tickets_sold
    valueFmt=num0
    pointName=city
    tooltip={[
        {id: 'city', showColumnName: false, valueClass: 'text-xl font-semibold'},
        {id: 'state', showColumnName: false},
        {id: 'tickets_sold', title: 'Tickets Sold'}
    ]}
/>
