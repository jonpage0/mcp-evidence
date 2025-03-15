---
title: CMG Analytics
hide_title: true
description: 2025 CMG Analytics
image: /logo.png
---

<LastRefreshed prefix="Last Updated" showTime={true} printShowDate={true} dateFmt="h:mm A z" />

<Alert type="info">All times are quoted in and calcualtions done in New York/Eastern Time which is currently UTC-4 EDT due to Daylight Savings Time.</Alert>

# Totals

```sql cards_tickets_totals
WITH 
tickets_totals AS (
    SELECT
    /* Total tickets sold across all orders */
    SUM(total_tickets) AS tickets_count,
    
    /* Distinct count of orders */
    COUNT(DISTINCT order_id) AS tickets_orders_count,
    
    /* Summations from the order-level columns */
    SUM(order_total)            AS tickets_gross_revenue,
    SUM(tickets_subtotal)       AS tickets_subtotal_revenue,
    
    /* Distinguish fees from tax */
    SUM(booking_fees + transaction_charge) AS tickets_fees_total,
    SUM(booking_fees)                      AS tickets_fees_booking,
    SUM(transaction_charge)                AS tickets_fees_transaction_charge,
    SUM(line_tax)                          AS tickets_tax_total
    
    FROM maniac_neon.tickets
),
cards_totals AS (
    SELECT
    /* Revenue breakdown */
    SUM("2025_stripe_total") AS cards_gross_revenue,
    SUM(CASE WHEN "2025_type" = 'card' THEN "2025_stripe_total" ELSE 0 END) AS cards_sales_revenue,
    SUM(CASE WHEN "2025_type" = 'card-upgrade' THEN "2025_stripe_total" ELSE 0 END) AS cards_upgrade_revenue,

    /* Tax */
    SUM("2025_tax") AS cards_tax_total,

    /* Individual fees */
    SUM("2025_fee_processing") AS cards_fees_processing,
    SUM("2025_fee_booking") AS cards_fees_booking,
    SUM("2025_fee_payment_plan") AS cards_fees_subscription,

    /* Application fee */
    SUM("2025_fee_application") AS cards_fees_application,

    /* Total fees */
    SUM("2025_total_fees") AS cards_fees_total,

    /* Count metrics */
    COUNT(CASE WHEN "2025_type" = 'card' THEN 1 ELSE NULL END) AS cards_count,
    COUNT(CASE WHEN "2025_type" = 'card-upgrade' THEN 1 ELSE NULL END) AS cards_upgrades_count,
    COUNT(CASE WHEN "2025_payment_method" = 'installment-plan' THEN 1 ELSE NULL END) AS cards_subscriptions_count
    
    FROM maniac_neon.orders
),
cards_tickets_combined AS (
    SELECT
    /* Combined revenue metrics */
    (SELECT tickets_gross_revenue FROM tickets_totals) + 
      (SELECT cards_gross_revenue FROM cards_totals) AS combined_total_gross_revenue,
    
    /* Combined fee metrics */
    (SELECT tickets_fees_total FROM tickets_totals) + 
      (SELECT cards_fees_total FROM cards_totals) AS combined_total_fees,
    
    /* Combined tax metrics */
    (SELECT tickets_tax_total FROM tickets_totals) + 
      (SELECT cards_tax_total FROM cards_totals) AS combined_total_tax,
    
    /* Transaction counts */
    (SELECT tickets_orders_count FROM tickets_totals) AS tickets_orders_count,
    (SELECT cards_count FROM cards_totals) AS cards_count,
    (SELECT cards_upgrades_count FROM cards_totals) AS cards_upgrades_count,
    (SELECT cards_subscriptions_count FROM cards_totals) AS cards_subscriptions_count,
    (SELECT tickets_count FROM tickets_totals) AS tickets_count,
    (SELECT (cards_sales_revenue - cards_upgrade_revenue) FROM cards_totals) AS cards_sales_revenue_no_upgrades,
)
SELECT * FROM tickets_totals, cards_totals, cards_tickets_combined
```


```sql cards_tickets_totals_historical
WITH 
-- 2024 data from historical sources
tickets_totals_2024 AS (
    SELECT
    /* Total tickets sold across all orders */
    SUM(total_tickets) AS tickets_count_2024,
    
    /* Distinct count of orders */
    COUNT(DISTINCT order_id) AS tickets_orders_count_2024,
    
    /* Summations from the order-level columns */
    SUM(order_total) AS tickets_gross_revenue_2024,
    SUM(tickets_subtotal) AS tickets_subtotal_revenue_2024,
    
    /* Distinguish fees from tax */
    SUM(booking_fees + transaction_charge) AS tickets_fees_total_2024,
    SUM(booking_fees) AS tickets_fees_booking_2024,
    SUM(transaction_charge) AS tickets_fees_transaction_charge_2024,
    SUM(line_tax) AS tickets_tax_total_2024
    
    FROM maniac_neon.tickets_2024
),
cards_totals_2024 AS (
    SELECT
    /* Revenue breakdown */
    SUM("2025_stripe_total") AS cards_gross_revenue_2024,
    SUM(CASE WHEN "2025_type" = 'card' THEN "2025_stripe_total" ELSE 0 END) AS cards_sales_revenue_2024,
    SUM(CASE WHEN "2025_type" = 'card-upgrade' THEN "2025_stripe_total" ELSE 0 END) AS cards_upgrade_revenue_2024,

    /* Tax */
    SUM("2025_tax") AS cards_tax_total_2024,

    /* Total fees */
    SUM("2025_total_fees") AS cards_fees_total_2024,

    /* Count metrics */
    COUNT(CASE WHEN "2025_type" = 'card' THEN 1 ELSE NULL END) AS cards_count_2024,
    COUNT(CASE WHEN "2025_type" = 'card-upgrade' THEN 1 ELSE NULL END) AS cards_upgrades_count_2024,
    COUNT(CASE WHEN "2025_payment_method" = 'installment-plan' THEN 1 ELSE NULL END) AS cards_subscriptions_count_2024
    
    FROM maniac_neon.orders_historical
    WHERE 
    /* Apply date alignment to compare same weekday 2024 to 2025 */
    CAST(TO_TIMESTAMP(created) AS TIMESTAMP) + INTERVAL '364 days' - INTERVAL '4 hours' <= CURRENT_TIMESTAMP
),
cards_tickets_combined_2024 AS (
    SELECT
    /* Combined revenue metrics */
    (SELECT tickets_gross_revenue_2024 FROM tickets_totals_2024) + 
      (SELECT cards_gross_revenue_2024 FROM cards_totals_2024) AS combined_total_gross_revenue_2024,
    
    /* Combined fee metrics */
    (SELECT tickets_fees_total_2024 FROM tickets_totals_2024) + 
      (SELECT cards_fees_total_2024 FROM cards_totals_2024) AS combined_total_fees_2024,
    
    /* Combined tax metrics */
    (SELECT tickets_tax_total_2024 FROM tickets_totals_2024) + 
      (SELECT cards_tax_total_2024 FROM cards_totals_2024) AS combined_total_tax_2024
),

-- Get 2025 data from the cards_tickets_totals query
current_totals AS (
    SELECT * FROM ${cards_tickets_totals}
)

-- Calculate absolute differences and percentages
SELECT
    -- 2024 totals (for reference)
    (SELECT combined_total_gross_revenue_2024 FROM cards_tickets_combined_2024) AS gross_revenue_2024,
    (SELECT combined_total_fees_2024 FROM cards_tickets_combined_2024) AS fees_total_2024,
    (SELECT combined_total_tax_2024 FROM cards_tickets_combined_2024) AS tax_total_2024,
    
    -- Absolute changes for Delta components
    (SELECT combined_total_gross_revenue FROM current_totals) - 
    (SELECT combined_total_gross_revenue_2024 FROM cards_tickets_combined_2024) AS gross_revenue_abs_change,
    
    (SELECT combined_total_fees FROM current_totals) - 
    (SELECT combined_total_fees_2024 FROM cards_tickets_combined_2024) AS fees_abs_change,
    
    (SELECT combined_total_tax FROM current_totals) - 
    (SELECT combined_total_tax_2024 FROM cards_tickets_combined_2024) AS tax_abs_change,
    
    -- Percentage changes (optional)
    ((SELECT combined_total_gross_revenue FROM current_totals) / 
     NULLIF((SELECT combined_total_gross_revenue_2024 FROM cards_tickets_combined_2024), 0)) - 1 
     AS gross_revenue_pct_change,
    
    ((SELECT combined_total_fees FROM current_totals) / 
     NULLIF((SELECT combined_total_fees_2024 FROM cards_tickets_combined_2024), 0)) - 1 
     AS fees_pct_change,
    
    ((SELECT combined_total_tax FROM current_totals) / 
     NULLIF((SELECT combined_total_tax_2024 FROM cards_tickets_combined_2024), 0)) - 1 
     AS tax_pct_change

FROM cards_tickets_combined_2024, current_totals
```

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">
    <div>
        <BigValue
            data={cards_tickets_totals}
            value="combined_total_gross_revenue"
            title="Total Gross Revenue"
            description="All revenue from cards and tickets."
            fmt="usd"
        />
        <Delta
            data={cards_tickets_totals_historical}
            column="gross_revenue_abs_change"
            fmt="usd"
            chip=true
            text="vs 2024"
        />
    </div>

    <div>
        <BigValue
            data={cards_tickets_totals}
            value="combined_total_fees"
            title="Total Fees Collected"
            description="All fees from cards and tickets."
            fmt="usd"
        />
        <Delta
            data={cards_tickets_totals_historical}
            column="fees_abs_change"
            fmt="usd" 
            chip=true
            text="vs 2024"
        />
    </div>

    <div>
        <BigValue
            data={cards_tickets_totals}
            value="combined_total_tax"
            title="Total Tax Collected"
            description="All taxes from cards and tickets."
            fmt="usd"
        />
        <Delta
            data={cards_tickets_totals_historical}
            column="tax_abs_change"
            fmt="usd"
            chip=true
            text="vs 2024"
        />
    </div>
</div>


---


# Card Totals
Includes all card sales and upgrades. Does not include cash sale cards.

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">
    <BigValue
        data={cards_tickets_totals}
        value="cards_gross_revenue"
        title="Gross Card Revenue"
        description="Gross revenue from cards and card upgrades."
        fmt="usd"
    />

    <BigValue
        data={cards_tickets_totals}
        value="cards_sales_revenue_no_upgrades"
        title="Card Revenue (No Upgrades)"
        description="Card sales revenue excluding card upgrades."
        fmt="usd"
    />
</div>
<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">

    <BigValue
        data={cards_tickets_totals}
        value="cards_fees_total"
        title="Card Fees"
        description="All card fees collected."
        fmt="usd"
    />

    <BigValue
        data={cards_tickets_totals}
        value="cards_tax_total"
        title="Card Tax"
        description="All card tax collected."
        fmt="usd"
    />

</div>

### Card Fees

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">
    <BigValue
        data={cards_tickets_totals}
        value="cards_fees_booking"
        title="Booking Fees"
        description="Sum of all card booking fees collected."
        fmt="usd"
    />

    <BigValue
        data={cards_tickets_totals}
        value="cards_fees_processing"
        title="Processing Fees"
        description="Sum of all card processing fees collected."
        fmt="usd"
    />

    <BigValue
        data={cards_tickets_totals}
        value="cards_fees_subscription"
        title="Subscription Fees"
        description="Sum of all card subscription fees collected."
        fmt="usd"
    />
</div>

<div class="w-full flex justify-start">
  <hr class="border-t border-gray-50/10 my-4 w-1/6" style="border-width: 0.5px;" />
</div>

## Cards Online

```sql card_counts
SELECT 
  CASE WHEN GROUPING("2025_location") = 1 THEN 'All Locations' ELSE "2025_location" END as location,
  CASE WHEN GROUPING("2025_location_formatted") = 1 THEN 'All Locations' ELSE "2025_location_formatted" END as location_formatted,
  COUNT(*) as total_cards,
  COUNT(CASE WHEN "2025_tier" = 'maniac-card' THEN 1 END) as maniac_cards,
  COUNT(CASE WHEN "2025_tier" = 'maniac-vip-card' THEN 1 END) as maniac_vip_cards
FROM maniac_neon.orders
WHERE "2025_type" IN ('card')
  AND "2025_tier" IN ('maniac-card', 'maniac-vip-card')
GROUP BY GROUPING SETS (
  ("2025_location", "2025_location_formatted"),
  ()
)
ORDER BY 
  GROUPING("2025_location") DESC,
  location
```

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">
    <BigValue
        data={card_counts}
        value="total_cards"
        title="Total Cards"
        description="Total number of cards sold."
        fmt="integer"
    />

    <BigValue
        data={card_counts}
        value="maniac_cards"
        title="Maniac Cards"
        description="Total number of maniac cards sold."
        fmt="integer"
    />

    <BigValue
        data={card_counts}
        value="maniac_vip_cards"
        title="Maniac VIP Cards"
        description="Total number of maniac vip cards sold."
        fmt="integer"
    />
</div>

{#each card_counts.filter(d => d.location !== 'All Locations') as location}

    ### {location.location_formatted}
    <div class="grid grid-cols-3 sm:grid-cols-3 gap-4 mt-2">
      <BigValue
          data={location}
          value="total_cards"
          title="Total Cards"
          fmt="integer"
      />

      <BigValue
          data={location}
          value="maniac_cards"
          title="Maniac Cards"
          fmt="integer"
      />

      <BigValue
          data={location}
          value="maniac_vip_cards"
          title="Maniac VIP Cards"
          fmt="integer"
      />
    </div>

{/each}

<div class="w-full flex justify-start">
  <hr class="border-t border-gray-50/10 my-4 w-1/6" style="border-width: 0.5px;" />
</div>

```sql card_upgrade_counts
SELECT 
  CASE WHEN GROUPING("2025_location") = 1 THEN 'All Locations' ELSE "2025_location" END as location,
  CASE WHEN GROUPING("2025_location_formatted") = 1 THEN 'All Locations' ELSE "2025_location_formatted" END as location_formatted,
  COUNT(*) as total_cards,
  COUNT(CASE WHEN "2025_tier" = 'maniac-card' THEN 1 END) as maniac_cards,
  COUNT(CASE WHEN "2025_tier" = 'maniac-vip-card' THEN 1 END) as maniac_vip_cards
FROM maniac_neon.orders
WHERE "2025_type" IN ('card-upgrade')
GROUP BY GROUPING SETS (
  ("2025_location", "2025_location_formatted"),
  ()
)
HAVING 
  GROUPING("2025_location") = 1 OR "2025_location" IS NOT NULL
ORDER BY 
  GROUPING("2025_location") DESC,
  location
```

```sql upgrade_type_breakdown
WITH categorized_upgrades AS (
  SELECT
    id,
    "2025_type",
    "2025_upgrade_type",
    "2025_tier",
    cancel_url,
    CASE
      WHEN cancel_url LIKE '%cardUpgrade=true%' THEN 'Tier Upgrade'
      WHEN "2025_upgrade_type" = 'fastPass' THEN 'Fast Pass'
      WHEN "2025_upgrade_type" = 'fastPassPlus' THEN 'Fast Pass+'
      WHEN "2025_upgrade_type" IS NOT NULL THEN 'Other'
      ELSE 'Unknown'
    END AS upgrade_category
  FROM maniac_neon.orders
  WHERE "2025_type" = 'card-upgrade'
)
SELECT
  COUNT(*) AS total_upgrades,
  COUNT(CASE WHEN upgrade_category = 'Tier Upgrade' THEN 1 END) AS tier_upgrades,
  COUNT(CASE WHEN upgrade_category = 'Fast Pass' THEN 1 END) AS fastpass_upgrades,
  COUNT(CASE WHEN upgrade_category = 'Fast Pass+' THEN 1 END) AS fastpassplus_upgrades,
  COUNT(CASE WHEN upgrade_category = 'Other' THEN 1 END) AS other_upgrades,
  COUNT(CASE WHEN upgrade_category = 'Unknown' THEN 1 END) AS unknown_upgrades
FROM categorized_upgrades
```

## Card Upgrades

<BigValue
    data={card_upgrade_counts}
    value="total_cards"
    title="Total Card Upgrades"
    fmt="integer"
/>

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
    <BigValue
        data={upgrade_type_breakdown}
        value="tier_upgrades"
        title="Card Tier Upgrades"
        fmt="integer"
    />
    
    <BigValue
        data={upgrade_type_breakdown}
        value="fastpass_upgrades"
        title="FastPass Upgrades"
        fmt="integer"
    />
    
    <BigValue
        data={upgrade_type_breakdown}
        value="fastpassplus_upgrades"
        title="FastPass+ Upgrades"
        fmt="integer"
    />
</div>

---

# Activated Cards <Info description="Activated cards are cash sale cards that have been activated." />

```sql activated_cards
SELECT 
  CASE WHEN GROUPING(location_name) = 1 THEN 'All Locations' ELSE location_name END as location,
  CASE WHEN GROUPING(location_name) = 1 THEN 'All Locations' ELSE location_name END as location_formatted,
  COUNT(*) as total_cards,
  SUM(CASE WHEN tier_name = 'Maniac Card' THEN 1 ELSE 0 END) as maniac_cards,
  SUM(CASE WHEN tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) as maniac_vip_cards
FROM (
  SELECT 
    o.id,
    l.name as location_name,
    ct.name as tier_name
  FROM maniac_neon_prod.orders o
  JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
  JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
  JOIN maniac_neon_prod.locations l ON c.location_id = l.id
  JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
  WHERE o.stripe_checkout_session_id LIKE 'cash_%'
) as location_data
GROUP BY GROUPING SETS (
  (location_name),
  ()
)
ORDER BY 
  GROUPING(location_name) DESC,
  location
```

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">

    <BigValue
        data={activated_cards}
        value="total_cards"
        title="Activated Cards"
        fmt="integer"
    />

    <BigValue
        data={activated_cards}
        value="maniac_cards"
        title="Maniac Cards"
        fmt="integer"
    />

    <BigValue
        data={activated_cards}
        value="maniac_vip_cards"
        title="Maniac VIP Cards"
        fmt="integer"
    />

</div>

{#each activated_cards.filter(d => d.location !== 'All Locations') as location}
    ### {location.location_formatted}
    <div class="grid grid-cols-3 sm:grid-cols-3 gap-4 mt-2">
      <BigValue
          data={location}
          value="total_cards"
          title="Total Cards"
          fmt="integer"
      />

      <BigValue
          data={location}
          value="maniac_cards"
          title="Maniac Cards"
          fmt="integer"
      />

      <BigValue
          data={location}
          value="maniac_vip_cards"
          title="Maniac VIP Cards"
          fmt="integer"
      />
    </div>
{/each}


---


# Ticket Totals

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">

    <BigValue
        data={cards_tickets_totals}
        value="tickets_count"
        title="Ticket Sold"
        description="Total number of tickets sold"
        fmt="integer"
    />

    <BigValue
        data={cards_tickets_totals}
        value="tickets_orders_count"
        title="Ticket Orders"
        description="Number of ticket orders. Can include multiple tickets per order."
        fmt="integer"
    />

</div>

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">

    <BigValue
        data={cards_tickets_totals}
        value="tickets_gross_revenue"
        title="Ticket Revenue"
        description="Total revenue from tickets"
        fmt="usd"
    />

    <BigValue
        data={cards_tickets_totals}
        value="tickets_fees_total"
        title="Ticket Fees"
        description="Total fees from tickets"
        fmt="usd"
    />

    <BigValue
        data={cards_tickets_totals}
        value="tickets_tax_total"
        title="Ticket Tax"
        description="Total tax from tickets"
        fmt="usd"
    />

</div>

<div class="w-full flex justify-start">
  <hr class="border-t border-gray-50/10 my-4 w-1/6" style="border-width: 0.5px;" />
</div>

### Ticket Fees

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">

    <BigValue
        data={cards_tickets_totals}
        value="tickets_fees_total"
        title="Ticket Fees Total"
        description="Total fees collected on tickets"
        fmt="usd"
    />
    
    <BigValue
        data={cards_tickets_totals}
        value="tickets_fees_booking"
        title="Booking Fees"
        description="Total booking fees"
        fmt="usd"
    />
    
    <BigValue
        data={cards_tickets_totals}
        value="tickets_fees_transaction_charge"
        title="Transaction Fees"
        description="Total transaction charges"
        fmt="usd"
    />


</div>

---

# Card Details

```sql cards_sold_today_comparison
WITH current_day_data AS (
    SELECT COUNT(*) AS cards_sold_today
    FROM maniac_neon.orders
    WHERE "2025_type" = 'card'
      AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
          = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))
),
last_year_day_data AS (
    SELECT COUNT(*) AS cards_sold_last_year_today
    FROM maniac_neon.orders_historical
    WHERE "2025_type" = 'card'
      AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
          = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 DAYS'))
)
SELECT
    cd.cards_sold_today,
    ly.cards_sold_last_year_today,
    (CAST(cd.cards_sold_today AS FLOAT)/NULLIF(CAST(ly.cards_sold_last_year_today AS FLOAT),0))-1 AS yoy_growth
FROM current_day_data cd
CROSS JOIN last_year_day_data ly
```

```sql cards_sold_last_hour
SELECT
    COUNT(*) AS cards_sold_last_hour
FROM maniac_neon.orders
WHERE "2025_type" = 'card'
  AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')
      >= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '2 HOURS')
```

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">

    <BigValue
        data={cards_sold_today_comparison}
        value="cards_sold_today"
        title="Cards Sold Today"
        description="Today's sales vs full day, same weekday last year."
        comparison="cards_sold_last_year_today"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />

    <BigValue
        data={cards_sold_last_hour}
        value="cards_sold_last_hour"
        title="Last 2 Hours"
        description="Cards sold within the past 2 hours."
    />

</div>

```sql weekly_sales_by_location
WITH online_sales AS (
    SELECT 
        "2025_location_formatted" as location,
        "2025_week" as week_num,
        CASE 
          WHEN "2025_week"::text = '0'  THEN 'Week 0'
          WHEN "2025_week"::text = '1'  THEN 'Week 1'
          WHEN "2025_week"::text = '2'  THEN 'Week 2'
          WHEN "2025_week"::text = '3'  THEN 'Week 3'
          WHEN "2025_week"::text = '4'  THEN 'Week 4'
          WHEN "2025_week"::text = '5'  THEN 'Week 5'
          WHEN "2025_week"::text = '6'  THEN 'Week 6'
        END AS week_formatted,
        SUM(CASE WHEN "2025_tier" = 'maniac-card' THEN 1 ELSE 0 END) AS maniac_online_count,
        SUM(CASE WHEN "2025_tier" = 'maniac-vip-card' THEN 1 ELSE 0 END) AS maniac_vip_online_count,
        COUNT(*) AS online_total_count
    FROM maniac_neon.orders
    WHERE "2025_type" = 'card'
      AND "2025_week" IS NOT NULL
      AND "2025_location_formatted" IS NOT NULL
    GROUP BY "2025_location_formatted", "2025_week"
),
cash_sales AS (
    SELECT 
        l.name as location,
        /* Extract week number based on date ranges in DuckDB format */
        CAST(CASE 
            WHEN STRFTIME(o.created_at, '%m-%d') BETWEEN '02-23' AND '03-01' THEN '0'
            WHEN STRFTIME(o.created_at, '%m-%d') BETWEEN '03-02' AND '03-08' THEN '1'
            WHEN STRFTIME(o.created_at, '%m-%d') BETWEEN '03-09' AND '03-15' THEN '2'
            WHEN STRFTIME(o.created_at, '%m-%d') BETWEEN '03-16' AND '03-22' THEN '3'
            WHEN STRFTIME(o.created_at, '%m-%d') BETWEEN '03-23' AND '03-29' THEN '4'
            WHEN STRFTIME(o.created_at, '%m-%d') BETWEEN '03-30' AND '04-05' THEN '5'
            ELSE '0' /* Default */
        END AS text) AS week_num,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS maniac_cash_count,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS maniac_vip_cash_count,
        COUNT(*) AS cash_total_count
    FROM maniac_neon_prod.orders o
    JOIN maniac_neon_prod.issued_cards ic ON o.issued_cards_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE o.stripe_checkout_session_id LIKE 'cash_%'
    GROUP BY l.name, week_num
),
all_locations_weeks AS (
    SELECT DISTINCT 
        COALESCE(o.location, c.location) as location,
        COALESCE(o.week_num, c.week_num) as week_num,
        CASE 
          WHEN COALESCE(o.week_num, c.week_num)::text = '0'  THEN 'Week 0'
          WHEN COALESCE(o.week_num, c.week_num)::text = '1'  THEN 'Week 1'
          WHEN COALESCE(o.week_num, c.week_num)::text = '2'  THEN 'Week 2'
          WHEN COALESCE(o.week_num, c.week_num)::text = '3'  THEN 'Week 3'
          WHEN COALESCE(o.week_num, c.week_num)::text = '4'  THEN 'Week 4'
          WHEN COALESCE(o.week_num, c.week_num)::text = '5'  THEN 'Week 5'
          WHEN COALESCE(o.week_num, c.week_num)::text = '6'  THEN 'Week 6'
        END AS week_formatted
    FROM (
        SELECT DISTINCT location, week_num FROM online_sales
        UNION
        SELECT DISTINCT location, week_num FROM cash_sales
    ) as combined_data(location, week_num)
    LEFT JOIN online_sales o ON combined_data.location = o.location AND combined_data.week_num = o.week_num
    LEFT JOIN cash_sales c ON combined_data.location = c.location AND combined_data.week_num = c.week_num
)
SELECT 
    lw.location,
    lw.week_formatted,
    COALESCE(o.maniac_online_count, 0) AS maniac_online,
    COALESCE(o.maniac_vip_online_count, 0) AS maniac_vip_online,
    COALESCE(c.maniac_cash_count, 0) AS maniac_cash,
    COALESCE(c.maniac_vip_cash_count, 0) AS maniac_vip_cash,
    (COALESCE(o.online_total_count, 0) + COALESCE(c.cash_total_count, 0)) AS total
FROM all_locations_weeks lw
LEFT JOIN online_sales o ON lw.location = o.location AND lw.week_num = o.week_num
LEFT JOIN cash_sales c ON lw.location = c.location AND lw.week_num = c.week_num
WHERE lw.location IS NOT NULL
ORDER BY lw.location, lw.week_num
```

## Sales by Location & Week

<DataTable 
  data={weekly_sales_by_location} 
  totalRow=true 
  totalRowColor="#f2f2f2"
  groupBy="location"
  groupType="section"
  subtotals=true
  subtotalRowColor="#f9f9f9"
>
  <Column id="location" title="Location" align="left" />
  <Column id="week_formatted" title="Week" align="left" />
  <Column 
    id="maniac_online" 
    title="Maniac" 
    fmt="#,##0" 
    totalAgg=sum 
    colGroup="Online Sales" 
  />
  <Column 
    id="maniac_vip_online" 
    title="VIP" 
    fmt="#,##0" 
    totalAgg=sum 
    colGroup="Online Sales" 
  />
  <Column 
    id="maniac_cash" 
    title="Maniac" 
    fmt="#,##0" 
    totalAgg=sum 
    colGroup="Cash Sales" 
  />
  <Column 
    id="maniac_vip_cash" 
    title="VIP" 
    fmt="#,##0" 
    totalAgg=sum 
    colGroup="Cash Sales" 
  />
  <Column 
    id="total" 
    title="Total Cards" 
    fmt="#,##0" 
    totalAgg=sum 
    totalFmt="#,##0 'Cards'" 
    colGroup="Summary" 
  />
</DataTable>


---


```sql daily_revenue_comparison
WITH RECURSIVE date_series AS (
    SELECT MIN(DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))) as sale_date
    FROM (
        SELECT created FROM maniac_neon.orders
        UNION ALL
        SELECT created FROM maniac_neon.orders_historical
    ) all_orders
    UNION ALL
    SELECT sale_date + INTERVAL '1 day'
    FROM date_series
    WHERE sale_date < CURRENT_DATE
),
daily_revenue_current AS (
    SELECT 
        ds.sale_date as sale_date,
        COALESCE(SUM(o."2025_stripe_total"), 0) as daily_revenue,
        COALESCE(SUM(SUM(o."2025_stripe_total")) OVER (ORDER BY ds.sale_date), 0) as revenue,
        '2025' as year
    FROM date_series ds
    LEFT JOIN maniac_neon.orders o 
        ON DATE_TRUNC('DAY', (CAST(TO_TIMESTAMP(o.created) AS TIMESTAMP) - INTERVAL '4 HOURS')) = ds.sale_date
    GROUP BY ds.sale_date
),
daily_revenue_previous AS (
    SELECT 
        ds.sale_date + INTERVAL '1 years' as sale_date,
        COALESCE(SUM(o."2025_stripe_total"), 0) as daily_revenue,
        COALESCE(SUM(SUM(o."2025_stripe_total")) OVER (ORDER BY ds.sale_date), 0) as revenue,
        '2024' as year
    FROM date_series ds
    LEFT JOIN maniac_neon.orders_historical o 
        ON DATE_TRUNC('DAY', (CAST(TO_TIMESTAMP(o.created) AS TIMESTAMP) - INTERVAL '4 HOURS')) = ds.sale_date
    WHERE ds.sale_date <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 days')
    GROUP BY ds.sale_date
)
SELECT * FROM (
    SELECT * FROM daily_revenue_current
    UNION ALL
    SELECT * FROM daily_revenue_previous
) all_data
WHERE sale_date >= TIMESTAMP '2025-03-01'
ORDER BY sale_date
```

<div class="grid grid-cols-1 sm:grid-cols-1 gap-4">

    <LineChart
        data={daily_revenue_comparison}
        x="sale_date"
        y="revenue"
        series="year"
        title="Cumulative Daily Card Revenue YoY"
        subtitle="2024 vs 2025 - Revenue comparison at same weekday and time."
        yAxisTitle="Revenue (USD)"
        connectGroup="revenue"
        labelFmt="usd"
        yFmt="usd"
        colorPalette={['#ea3b80','#459bd7']}
        seriesOrder={['2025','2024']}
    />

</div>



```sql dimensions_data
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE "2025_type" = 'card'
)
SELECT 
    CASE "2025_location_formatted"
        WHEN 'Panama City Beach' THEN 'PCB'
        WHEN 'Fort Lauderdale'   THEN 'FLL'
        WHEN 'South Padre Island' THEN 'SPI'
    END AS location,
    CASE "2025_tier"
        WHEN 'maniac-card'     THEN 'Maniac'
        WHEN 'maniac-vip-card' THEN 'VIP'
    END AS tier,
    CASE "2025_week_formatted"
        WHEN 'Week 0' THEN 'Week 0'
        WHEN 'Week 1' THEN 'Week 1'
        WHEN 'Week 2' THEN 'Week 2'
        WHEN 'Week 3' THEN 'Week 3'
        WHEN 'Week 4' THEN 'Week 4'
        WHEN 'Week 5' THEN 'Week 5'
        WHEN 'Week 6' THEN 'Week 6'
        WHEN 'Week 7' THEN 'Week 7'
    END AS week,
    CASE "2025_upgrade_type"
        WHEN 'fastPass'     THEN 'Fast Pass'
        WHEN 'fastPassPlus' THEN 'Fast Pass+'
        ELSE 'None'
    END AS fp,
    amount_total AS revenue
FROM filtered_orders
```

```sql filtered_totals
WITH filtered_orders AS (
    SELECT
        id,
        "2025_stripe_total",
        CASE "2025_location_formatted"
            WHEN 'Panama City Beach' THEN 'PCB'
            WHEN 'Fort Lauderdale'   THEN 'FLL'
            WHEN 'South Padre Island' THEN 'SPI'
        END AS location,
        CASE "2025_tier"
            WHEN 'maniac-card'     THEN 'Maniac'
            WHEN 'maniac-vip-card' THEN 'VIP'
        END AS tier,
        CASE "2025_week_formatted"
            WHEN 'Week 0' THEN 'Week 0'
            WHEN 'Week 1' THEN 'Week 1'
            WHEN 'Week 2' THEN 'Week 2'
            WHEN 'Week 3' THEN 'Week 3'
            WHEN 'Week 4' THEN 'Week 4'
            WHEN 'Week 5' THEN 'Week 5'
            WHEN 'Week 6' THEN 'Week 6'
            WHEN 'Week 7' THEN 'Week 7'
        END AS week,
        CASE "2025_upgrade_type"
            WHEN 'fastPass'     THEN 'Fast Pass'
            WHEN 'fastPassPlus' THEN 'Fast Pass+'
            ELSE 'None'
        END AS fp
    FROM maniac_neon.orders
    WHERE "2025_type" = 'card'
)
SELECT 
    COUNT(*) AS total_sold,
    SUM("2025_stripe_total") AS total_revenue
FROM filtered_orders
WHERE ${inputs.selected_dimensions}
```

```sql filtered_sales
WITH dim AS (
    SELECT
        id,
        CASE "2025_location_formatted"
            WHEN 'Panama City Beach' THEN 'PCB'
            WHEN 'Fort Lauderdale'   THEN 'FLL'
            WHEN 'South Padre Island' THEN 'SPI'
        END AS location,
        CASE "2025_tier"
            WHEN 'maniac-card'     THEN 'Maniac'
            WHEN 'maniac-vip-card' THEN 'VIP'
        END AS tier,
        CASE "2025_week_formatted"
            WHEN 'Week 0' THEN 'Week 0'
            WHEN 'Week 1' THEN 'Week 1'
            WHEN 'Week 2' THEN 'Week 2'
            WHEN 'Week 3' THEN 'Week 3'
            WHEN 'Week 4' THEN 'Week 4'
            WHEN 'Week 5' THEN 'Week 5'
            WHEN 'Week 6' THEN 'Week 6'
            WHEN 'Week 7' THEN 'Week 7'
        END AS week,
        CASE "2025_upgrade_type"
            WHEN 'fastPass'     THEN 'Fast Pass'
            WHEN 'fastPassPlus' THEN 'Fast Pass+'
            ELSE 'None'
        END AS fp
    FROM maniac_neon.orders
    WHERE "2025_type" = 'card'
)
SELECT
    DATE_TRUNC('day', (CAST(TO_TIMESTAMP(o.created) AS TIMESTAMP) - INTERVAL '4 HOURS')) AS day,
    COUNT(*) AS sales
FROM maniac_neon.orders o
JOIN dim ON o.id = dim.id
WHERE ${inputs.selected_dimensions}
GROUP BY 1
ORDER BY 1
```

## Sales Analysis

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue 
        data={filtered_totals}
        value="total_sold"
        title="Total Cards Sold"
        fmt="integer"
    />
    <BigValue 
        data={filtered_totals}
        value="total_revenue"
        title="Total Revenue"
        fmt="usd"
    />
</div>

<BarChart
    data={filtered_sales}
    x="day"
    y="sales"
    title="Cards Sold Over Time"
    subtitle="Daily trend of card sales based on selected dimension filters (accurate up to the minute)."
    yAxisTitle="Number of Cards"
    colorPalette={['#FF0066','#FF0040','#CC0033','#990033','#800020','#4A0010']}
    echartsOptions={{
        xAxis: {
            min: '2025-02-01'
        }
    }}
/>

<div class="hidden sm:flex flex-col">
    <Alert>Click dimensions below the chart to explore sales patterns</Alert>
    <div class="hidden sm:flex flex-col gap-4 -mb-24">
        <DimensionGrid
            data={dimensions_data}
            dimensions={["location","tier","week","fp"]}
            dimensionLabels={["Location","Card Type","Week","Fast Pass"]}
            metric="sum(revenue)"
            metricLabel="$"
            fmt="usd"
            name="selected_dimensions"
            multiple
        />
    </div>
</div>

```sql weekly_sales
WITH week_dates AS (
    SELECT 
        "2025_week",
        CASE 
          WHEN "2025_week"::text = '0'  THEN 'Week 0'
          WHEN "2025_week"::text = '1'  THEN 'Week 1'
          WHEN "2025_week"::text = '2'  THEN 'Week 2'
          WHEN "2025_week"::text = '3'  THEN 'Week 3'
          WHEN "2025_week"::text = '4'  THEN 'Week 4'
          WHEN "2025_week"::text = '5'  THEN 'Week 5'
          WHEN "2025_week"::text = '6'  THEN 'Week 6'
        END AS week_formatted,
        SUM(CASE WHEN "2025_tier" = 'maniac-card' THEN 1 ELSE 0 END) AS maniac_card_count,
        SUM(CASE WHEN "2025_tier" = 'maniac-vip-card' THEN 1 ELSE 0 END) AS maniac_vip_count,
        COUNT(*) AS total_count
    FROM maniac_neon.orders
    WHERE "2025_type" = 'card'
    GROUP BY "2025_week"
    ORDER BY "2025_week"
)
SELECT 
    week_formatted,
    maniac_card_count,
    maniac_vip_count,
    total_count
FROM week_dates
```

---

```sql fp_fpp_total
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT COUNT(*) AS total_fp_fpp
FROM filtered_orders
WHERE m_upgrade_type IN ('fastPass','fastPassPlus')
```

```sql fp_total
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT COUNT(*) AS total_fp
FROM filtered_orders
WHERE m_upgrade_type = 'fastPass'
```

```sql fpp_total
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT COUNT(*) AS total_fpp
FROM filtered_orders
WHERE m_upgrade_type = 'fastPassPlus'
```

```sql fp_fpp_revenue
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT SUM(m_upgrade_price) AS total_fp_fpp_revenue
FROM filtered_orders
WHERE m_upgrade_type IN ('fastPass','fastPassPlus')
```

```sql fp_fpp_total_last_year
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
current_year_data AS (
    SELECT 
        COUNT(*) AS total_fp_fpp_current_year,
        SUM(m_upgrade_price) AS total_fp_fpp_revenue_current_year
    FROM filtered_orders
    WHERE m_upgrade_type IN ('fastPass','fastPassPlus')
),
last_year_data AS (
    SELECT 
        COUNT(*) AS total_fp_fpp_last_year,
        SUM(m_upgrade_price) AS total_fp_fpp_revenue_last_year
    FROM filtered_orders_historical
    WHERE m_upgrade_type IN ('fastPass','fastPassPlus')
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
          <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') - INTERVAL '364 days'
)
SELECT
    cy.total_fp_fpp_current_year,
    ly.total_fp_fpp_last_year,
    cy.total_fp_fpp_revenue_current_year,
    ly.total_fp_fpp_revenue_last_year,
    (CAST(cy.total_fp_fpp_current_year AS FLOAT)/NULLIF(CAST(ly.total_fp_fpp_last_year AS FLOAT),0))-1 AS yoy_growth,
    (CAST(cy.total_fp_fpp_revenue_current_year AS FLOAT)/NULLIF(CAST(ly.total_fp_fpp_revenue_last_year AS FLOAT),0))-1 AS revenue_yoy_growth,
    -((CAST(cy.total_fp_fpp_current_year AS FLOAT)/NULLIF(CAST(ly.total_fp_fpp_last_year AS FLOAT),0))-1) AS reversed_growth,
    -((CAST(cy.total_fp_fpp_revenue_current_year AS FLOAT)/NULLIF(CAST(ly.total_fp_fpp_revenue_last_year AS FLOAT),0))-1) AS reversed_revenue_growth,
    (cy.total_fp_fpp_current_year - ly.total_fp_fpp_last_year) AS absolute_growth,
    (cy.total_fp_fpp_revenue_current_year - ly.total_fp_fpp_revenue_last_year) AS absolute_revenue_growth,
    (ly.total_fp_fpp_last_year - cy.total_fp_fpp_current_year) AS absolute_reversed_growth,
    (ly.total_fp_fpp_revenue_last_year - cy.total_fp_fpp_revenue_current_year) AS absolute_reversed_revenue_growth
FROM current_year_data cy
CROSS JOIN last_year_data ly
```

```sql fp_by_location_comparison
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
current_year AS (
    SELECT 
        CASE 
            WHEN m_location='panama-city-beach' 
                 OR m_location_formatted='Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location='fort-lauderdale' 
                 OR m_location_formatted='Fort Lauderdale'   THEN 'Fort Lauderdale'
            WHEN m_location='south-padre' 
                 OR m_location_formatted='South Padre Island' THEN 'South Padre Island'
        END AS location,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPass') AS fast_pass,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPassPlus') AS fast_pass_plus,
        COUNT(*) FILTER (WHERE m_upgrade_type IN ('fastPass','fastPassPlus')) AS total_fp,
        SUM(CASE WHEN m_upgrade_type IN ('fastPass','fastPassPlus') THEN m_upgrade_price ELSE 0 END) AS fp_revenue
    FROM filtered_orders
    WHERE (m_location IS NOT NULL OR m_location_formatted IS NOT NULL)
      AND m_upgrade_type IN ('fastPass','fastPassPlus')
    GROUP BY 1
),
last_year AS (
    SELECT 
        CASE 
            WHEN m_location='panama-city-beach' 
                 OR m_location_formatted='Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location='fort-lauderdale' 
                 OR m_location_formatted='Fort Lauderdale'   THEN 'Fort Lauderdale'
            WHEN m_location='south-padre' 
                 OR m_location_formatted='South Padre Island' THEN 'South Padre Island'
        END AS location,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPass') AS fast_pass_ly,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPassPlus') AS fast_pass_plus_ly,
        COUNT(*) FILTER (WHERE m_upgrade_type IN ('fastPass','fastPassPlus')) AS total_fp_ly,
        SUM(CASE WHEN m_upgrade_type IN ('fastPass','fastPassPlus') THEN m_upgrade_price ELSE 0 END) AS fp_revenue_ly
    FROM filtered_orders_historical
    WHERE (m_location IS NOT NULL OR m_location_formatted IS NOT NULL)
      AND m_upgrade_type IN ('fastPass','fastPassPlus')
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
          <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') - INTERVAL '364 days'
    GROUP BY 1
)
SELECT 
    COALESCE(cy.location, ly.location) as location,
    COALESCE(cy.fast_pass, 0) as fast_pass,
    COALESCE(ly.fast_pass_ly, 0) as fast_pass_ly,
    COALESCE(cy.fast_pass_plus, 0) as fast_pass_plus,
    COALESCE(ly.fast_pass_plus_ly, 0) as fast_pass_plus_ly,
    COALESCE(cy.total_fp, 0) as total_fp,
    COALESCE(ly.total_fp_ly, 0) as total_fp_ly,
    COALESCE(cy.fp_revenue, 0) as fp_revenue,
    COALESCE(ly.fp_revenue_ly, 0) as fp_revenue_ly,
    (CAST(COALESCE(cy.total_fp, 0) AS FLOAT)/NULLIF(CAST(COALESCE(ly.total_fp_ly, 0) AS FLOAT),0))-1 AS yoy_growth,
    (CAST(COALESCE(cy.fp_revenue, 0) AS FLOAT)/NULLIF(CAST(COALESCE(ly.fp_revenue_ly, 0) AS FLOAT),0))-1 AS revenue_yoy_growth,
    (COALESCE(cy.total_fp, 0) - COALESCE(ly.total_fp_ly, 0)) AS absolute_growth,
    (COALESCE(cy.fp_revenue, 0) - COALESCE(ly.fp_revenue_ly, 0)) AS absolute_revenue_growth
FROM current_year cy
FULL OUTER JOIN last_year ly ON cy.location = ly.location
WHERE COALESCE(cy.location, ly.location) IS NOT NULL
ORDER BY COALESCE(cy.total_fp, 0) DESC
```

```sql fp_by_location
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    m_location_formatted AS location,
    SUM(CASE WHEN m_upgrade_type='fastPass'     THEN 1 ELSE 0 END) AS "Fast Pass",
    SUM(CASE WHEN m_upgrade_type='fastPassPlus' THEN 1 ELSE 0 END) AS "Fast Pass Plus"
FROM filtered_orders
WHERE m_upgrade_type IN ('fastPass','fastPassPlus')
  AND m_location_formatted IN ('Panama City Beach','Fort Lauderdale')
GROUP BY 1
ORDER BY 1
```

```sql last_fp_sale
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    DATE_TRUNC('second', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) AS last_fp_sale
FROM filtered_orders
WHERE m_upgrade_type IN ('fastPass','fastPassPlus')
ORDER BY created DESC
LIMIT 1
```

# FastPass Sales

<!-- <Alert status="info">
    {#each last_fp_sale as sale}
        Last FastPass Sale: {new Date(sale.last_fp_sale).toLocaleString()}
    {/each}
</Alert> -->

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue
        data={fp_fpp_total_last_year}
        value="total_fp_fpp_current_year"
        title="Total FP & FPP"
        description="FastPass and FastPass+ sales vs same weekday and time last year."
        comparison="absolute_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="num0"
    />
    <BigValue
        data={fp_fpp_total_last_year}
        value="total_fp_fpp_revenue_current_year"
        title="Total $ FP & FPP"
        description="FastPass and FastPass+ revenue vs same weekday and time last year."
        comparison="absolute_revenue_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="usd0"
        fmt="usd"
    />
</div>

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue
        data={fp_fpp_total_last_year}
        value="total_fp_fpp_last_year"
        title="2024 FP & FPP TDLY"
        description="FastPass sales at same weekday and time last year."
        comparison="absolute_growth"
        comparisonTitle="vs This Year"
        comparisonDelta="true"
        comparisonFmt="num0"
        comparisonNegative="true"
    />
    <BigValue
        data={fp_fpp_total_last_year}
        value="total_fp_fpp_revenue_last_year"
        title="2024 $ FP & FPP TDLY"
        description="FastPass revenue at same weekday and time last year."
        comparison="absolute_revenue_growth"
        comparisonTitle="vs This Year"
        comparisonDelta="true"
        comparisonFmt="usd0"
        fmt="usd"
        comparisonNegative="true"
    />
</div>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
    <BigValue
        data={fp_total}
        value="total_fp"
        title="Total FP"
        description="Total FastPass sales (standard tier)."
    />
    <BigValue
        data={fpp_total}
        value="total_fpp"
        title="Total FP Plus"
        description="Total FastPass+ sales (premium tier)."
    />
</div>

<BarChart
    data={fp_by_location}
    x="location"
    y={["Fast Pass","Fast Pass Plus"]}
    title="FastPass by Location"
    subtitle="Breakdown of FastPass and FastPass+ sales by location."
    type="grouped"
    yAxisTitle="Sold"
/>

















# OLD


```sql daily_pattern
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    -- Base filters already applied in source
)
SELECT 
    EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) AS day_num,
    CASE EXTRACT(DOW FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END AS day_of_week,
    COUNT(*) AS orders,
    SUM(amount_total) AS revenue
FROM filtered_orders
GROUP BY 1, 2
ORDER BY day_num
```

```sql gross_revenue
SELECT
    SUM(amount_total) AS gross_revenue
FROM maniac_neon.orders
```

```sql total_fees
SELECT
    SUM(m_total_fees) + SUM(sub_fee_total) + SUM(sub_fee_application) AS total_fees
FROM maniac_neon.orders
```



```sql tax_total
SELECT
    SUM(m_c_tax) AS tax_total
FROM maniac_neon.orders
```

```sql subscription_count
SELECT
    COUNT(*) AS subscription_count
FROM maniac_neon.orders
WHERE m_payment_method_legacy = 'installment-plan'
```

```sql location_breakdown
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
tier_location_counts AS (
    SELECT 
        CASE
            WHEN m_location_formatted = 'Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location_formatted = 'Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location_formatted = 'South Padre Island' THEN 'South Padre Island'
        END AS location,
        SUM(CASE WHEN m_tier = 'maniac-card' THEN 1 ELSE 0 END) AS maniac_card_count,
        SUM(CASE WHEN m_tier = 'maniac-vip-card' THEN 1 ELSE 0 END) AS maniac_vip_count,
        COUNT(*) AS total_count
    FROM filtered_orders
    WHERE m_tier IN ('maniac-card','maniac-vip-card')
      AND m_location_formatted IN ('Panama City Beach','Fort Lauderdale','South Padre Island')
    GROUP BY 1
    ORDER BY 1
)
SELECT 
    location,
    maniac_card_count AS "Maniac Card",
    maniac_vip_count AS "Maniac VIP",
    total_count      AS "Total"
FROM tier_location_counts
WHERE location IS NOT NULL
```

```sql total_cards
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT
    COUNT(*) AS total_cards_sold
FROM filtered_orders
WHERE m_type = 'card'
```

```sql today_cards
SELECT
    COUNT(*) AS cards_sold_today
FROM maniac_neon.orders
WHERE m_type = 'card'
  AND DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
      = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))
```





```sql cards_sold_comparison
WITH current_year_data AS (
    SELECT COUNT(*) AS total_cards_current_year
    FROM maniac_neon.orders
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')
),
last_year_data AS (
    SELECT COUNT(*) AS total_cards_last_year
    FROM maniac_neon.orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
          <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') - INTERVAL '364 days'
)
SELECT
    ly.total_cards_last_year,
    cy.total_cards_current_year,
    (CAST(cy.total_cards_current_year AS FLOAT)/NULLIF(CAST(ly.total_cards_last_year AS FLOAT),0))-1 AS yoy_growth,
    -((CAST(cy.total_cards_current_year AS FLOAT)/NULLIF(CAST(ly.total_cards_last_year AS FLOAT),0))-1) AS yoy_growth_inverted
FROM last_year_data ly
CROSS JOIN current_year_data cy
```

```sql gross_revenue_comp
WITH current_year AS (
    SELECT SUM(amount_total) AS gross_revenue
    FROM maniac_neon.orders
),
last_year AS (
    SELECT SUM(amount_total) AS last_year_revenue
    FROM maniac_neon.orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
          <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') - INTERVAL '364 days'
)
SELECT 
    cy.gross_revenue,
    ly.last_year_revenue,
    (CAST(cy.gross_revenue AS FLOAT)/NULLIF(CAST(ly.last_year_revenue AS FLOAT),0))-1 AS yoy_growth,
    -((CAST(cy.gross_revenue AS FLOAT)/NULLIF(CAST(ly.last_year_revenue AS FLOAT),0))-1) AS yoy_growth_inverted
FROM current_year cy
CROSS JOIN last_year ly
```

```sql seven_day_total_comparison
WITH date_range AS (
    SELECT 
        date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours') - INTERVAL '7 days' as start_date,
        date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours') as end_date
),
current_period AS (
    SELECT COUNT(*) as current_total
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 hours') 
          BETWEEN (SELECT start_date FROM date_range) 
          AND (SELECT end_date FROM date_range)
),
last_period AS (
    SELECT COUNT(*) as last_total
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 hours') 
          BETWEEN ((SELECT start_date FROM date_range) - INTERVAL '364 days')
          AND ((SELECT end_date FROM date_range) - INTERVAL '364 days')
)
SELECT 
    cp.current_total,
    lp.last_total,
    ((cp.current_total::float / NULLIF(lp.last_total, 0)) - 1) as growth
FROM current_period cp
CROSS JOIN last_period lp
```

```sql seven_day_comparison
WITH date_range AS (
    SELECT 
        date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours') - INTERVAL '7 days' as start_date,
        date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours') as end_date
),
current_year AS (
    SELECT 
        date_trunc('day', CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 hours') as sale_date,
        COUNT(*) as cards_sold,
        ROUND(AVG(COUNT(*)) OVER (
            ORDER BY date_trunc('day', CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 hours')
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )) as rolling_avg,
        'This Year' as series
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 hours') 
          BETWEEN (SELECT start_date FROM date_range) 
          AND (SELECT end_date FROM date_range)
    GROUP BY 1
),
last_year AS (
    SELECT 
        date_trunc('day', CAST(TO_TIMESTAMP(created) AS TIMESTAMP) + INTERVAL '364 days' - INTERVAL '4 hours') as sale_date,
        COUNT(*) as cards_sold,
        ROUND(AVG(COUNT(*)) OVER (
            ORDER BY date_trunc('day', CAST(TO_TIMESTAMP(created) AS TIMESTAMP) + INTERVAL '364 days' - INTERVAL '4 hours')
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )) as rolling_avg,
        'Last Year' as series
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 hours') 
          BETWEEN ((SELECT start_date FROM date_range) - INTERVAL '364 days')
          AND ((SELECT end_date FROM date_range) - INTERVAL '364 days')
    GROUP BY 1
),
combined_data AS (
    SELECT * FROM current_year
    UNION ALL 
    SELECT * FROM last_year
)
SELECT 
    cd.sale_date,
    cd.cards_sold,
    cd.rolling_avg,
    cd.series,
    CASE 
        WHEN cd.series = 'This Year' THEN 
            ROUND(((cd.cards_sold::float / NULLIF(
                (SELECT cards_sold FROM last_year ly WHERE ly.sale_date = cd.sale_date)
            , 0)) - 1) * 100, 1)
        ELSE NULL
    END as daily_growth
FROM combined_data cd
ORDER BY cd.sale_date, cd.series DESC
```



<!-- 
<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <BigValue
        data={gross_revenue_comp}
        value="gross_revenue"
        title="Total Gross Revenue"
        description="Revenue vs same weekday and time last year."
        comparison="yoy_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="usd"
    />

    <BigValue
        data={gross_revenue_comp}
        value="last_year_revenue"
        title="2024 Gross Revenue TDLY"
        description="Revenue at same weekday and time last year."
        comparison="yoy_growth_inverted"
        comparisonTitle="vs This Year"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="usd"
    />
</div> -->
<!-- 

<BigValue
    data={cards_sold_comparison}
    value="total_cards_current_year"
    title="This Year"
    description="Cards sold vs same weekday and time last year."
    comparisonFmt="pct1"
    comparison="yoy_growth"
    comparisonTitle="vs Last Year"
    comparisonDelta="true"
    fmt="num0"
/>
<BigValue
    data={cards_sold_comparison}
    value="total_cards_last_year"
    title="2024 Cards Sold TDLY"
    description="Cards sold at same weekday and time last year."
    comparison="yoy_growth_inverted"
    comparisonTitle="vs This Year"
    comparisonDelta="true"
    comparisonFmt="pct1"
    fmt="num0"
/>
 -->



```sql locations
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT DISTINCT
    m_location_formatted AS location
FROM filtered_orders
WHERE m_location_formatted IS NOT NULL
  AND m_location_formatted <> ''
ORDER BY 1
```

```sql location_metrics
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
current_year AS (
    SELECT 
        CASE 
            WHEN m_location='panama-city-beach' 
                 OR m_location_formatted='Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location='fort-lauderdale' 
                 OR m_location_formatted='Fort Lauderdale'   THEN 'Fort Lauderdale'
            WHEN m_location='south-padre' 
                 OR m_location_formatted='South Padre Island' THEN 'South Padre Island'
        END AS location,
        SUM(amount_total) AS gross_revenue,
        COUNT(*) FILTER (WHERE m_type='card') AS total_cards,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPass') AS fast_pass,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPassPlus') AS fast_pass_plus
    FROM filtered_orders
    WHERE (m_location IS NOT NULL OR m_location_formatted IS NOT NULL)
    GROUP BY 1
),
last_year AS (
    SELECT 
        CASE 
            WHEN m_location='panama-city-beach' 
                 OR m_location_formatted='Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location='fort-lauderdale' 
                 OR m_location_formatted='Fort Lauderdale'   THEN 'Fort Lauderdale'
            WHEN m_location='south-padre' 
                 OR m_location_formatted='South Padre Island' THEN 'South Padre Island'
        END AS location,
        SUM(amount_total) AS last_year_revenue
    FROM filtered_orders_historical
    WHERE (m_location IS NOT NULL OR m_location_formatted IS NOT NULL)
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 days')
    GROUP BY 1
)
SELECT 
    cy.location,
    cy.gross_revenue,
    cy.total_cards,
    cy.fast_pass,
    cy.fast_pass_plus,
    ly.last_year_revenue,
    (CAST(cy.gross_revenue AS FLOAT)/NULLIF(CAST(ly.last_year_revenue AS FLOAT),0))-1 AS growth,
    -((CAST(cy.gross_revenue AS FLOAT)/NULLIF(CAST(ly.last_year_revenue AS FLOAT),0))-1) AS reversed_growth
FROM current_year cy
LEFT JOIN last_year ly ON cy.location = ly.location
ORDER BY cy.gross_revenue DESC
```

```sql location_weekly_sales
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND m_type NOT IN ('package','card-upgrade','ticket')
),
week_dates AS (
    SELECT 
        m_location_formatted AS location,
        m_week,
        CASE
            WHEN m_week='0'  THEN 'Feb 24 - Mar 1'
            WHEN m_week='1'  THEN 'Mar 1 - Mar 7'
            WHEN m_week='2'  THEN 'Mar 8 - Mar 14'
            WHEN m_week='3'  THEN 'Mar 15 - Mar 21'
            WHEN m_week='4'  THEN 'Mar 22 - Mar 28'
            WHEN m_week='5'  THEN 'Mar 29 - Apr 4'
            WHEN m_week='6'  THEN 'Apr 5 - Apr 11'
            WHEN m_week='g1' THEN 'May 18 - May 24'
            WHEN m_week='g2' THEN 'May 25 - May 31'
        END AS week_formatted,
        SUM(CASE WHEN m_tier='maniac-card'     THEN 1 ELSE 0 END) AS maniac_card_count,
        SUM(CASE WHEN m_tier='maniac-vip-card' THEN 1 ELSE 0 END) AS maniac_vip_count,
        COUNT(*) AS total_count
    FROM filtered_orders
    GROUP BY m_location_formatted, m_week
    ORDER BY m_week
)
SELECT 
    location,
    week_formatted,
    maniac_card_count,
    maniac_vip_count,
    total_count
FROM week_dates
```

```sql fastpass_weekly_sales
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND m_upgrade_type IN ('fastPass','fastPassPlus')
),
week_dates AS (
    SELECT 
        m_location_formatted AS location,
        m_week,
        CASE
            WHEN m_week='0'  THEN 'Feb 24 - Mar 1'
            WHEN m_week='1'  THEN 'Mar 1 - Mar 7'
            WHEN m_week='2'  THEN 'Mar 8 - Mar 14'
            WHEN m_week='3'  THEN 'Mar 15 - Mar 21'
            WHEN m_week='4'  THEN 'Mar 22 - Mar 28'
            WHEN m_week='5'  THEN 'Mar 29 - Apr 4'
            WHEN m_week='6'  THEN 'Apr 5 - Apr 11'
            WHEN m_week='g1' THEN 'May 18 - May 24'
            WHEN m_week='g2' THEN 'May 25 - May 31'
        END AS week_formatted,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPass') AS fastpass_count,
        COUNT(*) FILTER (WHERE m_upgrade_type='fastPassPlus') AS fastpass_plus_count,
        COUNT(*) AS total_count
    FROM filtered_orders
    GROUP BY m_location_formatted, m_week
    ORDER BY m_week
)
SELECT 
    location,
    week_formatted,
    fastpass_count,
    fastpass_plus_count,
    total_count
FROM week_dates
```

```sql daily_sales
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
daily AS (
    SELECT 
        m_location_formatted AS location,
        DATE_TRUNC('day',(CAST(TO_TIMESTAMP(created) AS TIMESTAMP)-INTERVAL '4 HOURS')) AS sale_date,
        COUNT(*) FILTER (WHERE m_type='card') AS cards_sold
    FROM filtered_orders
    WHERE m_location_formatted IS NOT NULL
      AND m_location_formatted <> ''
    GROUP BY 1, 2
)
SELECT * FROM daily
ORDER BY sale_date
```

```sql hourly_sales_by_location
WITH RECURSIVE filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
locations_list AS (
    SELECT DISTINCT
        m_location_formatted AS location
    FROM maniac_neon.orders
    WHERE m_location_formatted IS NOT NULL
      AND m_location_formatted <> ''
),
hours(hour) AS (
    SELECT 0
    UNION ALL
    SELECT hour + 1 
    FROM hours 
    WHERE hour < 23
),
current_day_sales AS (
    SELECT 
        m_location_formatted AS location,
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) AS hour,
        CASE 
            WHEN m_tier = 'maniac-card' AND m_upgrade_type = 'fastPass' THEN 'Maniac+FP'
            WHEN m_tier = 'maniac-card' AND m_upgrade_type = 'fastPassPlus' THEN 'Maniac+FPP'
            WHEN m_tier = 'maniac-card' THEN 'Maniac'
            WHEN m_tier = 'maniac-vip-card' AND m_upgrade_type = 'fastPass' THEN 'VIP+FP'
            WHEN m_tier = 'maniac-vip-card' AND m_upgrade_type = 'fastPassPlus' THEN 'VIP+FPP'
            WHEN m_tier = 'maniac-vip-card' THEN 'VIP'
            ELSE 'Other'
        END AS card_category,
        COUNT(*) AS orders
    FROM filtered_orders
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
          = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))
      AND m_type = 'card'
      AND m_location_formatted IS NOT NULL
      AND m_location_formatted <> ''
    GROUP BY 1, 2, 3
),
-- Create a cross product of all hours, locations, and card categories
base_data AS (
    SELECT 
        h.hour,
        l.location,
        c.card_category
    FROM hours h
    CROSS JOIN locations_list l
    CROSS JOIN (SELECT unnest(ARRAY['Maniac', 'Maniac+FP', 'Maniac+FPP', 'VIP', 'VIP+FP', 'VIP+FPP']) AS card_category) c
)
SELECT 
    b.hour,
    b.location,
    b.card_category,
    COALESCE(s.orders, 0) AS orders
FROM base_data b
LEFT JOIN current_day_sales s 
    ON b.hour = s.hour 
    AND b.location = s.location 
    AND b.card_category = s.card_category
ORDER BY b.location, b.hour, b.card_category
```

```sql cards_sold_last_year_by_location
WITH filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
current_year_data AS (
    SELECT 
        CASE 
            WHEN m_location='panama-city-beach' 
                 OR m_location_formatted='Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location='fort-lauderdale' 
                 OR m_location_formatted='Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location='south-padre' 
                 OR m_location_formatted='South Padre Island' THEN 'South Padre Island'
        END AS location,
        COUNT(*) AS total_cards_current_year
    FROM filtered_orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') >= TIMESTAMP '2024-10-01'
      AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')
      AND (m_location IS NOT NULL OR m_location_formatted IS NOT NULL)
    GROUP BY 1
),
last_year_data AS (
    SELECT 
        CASE 
            WHEN m_location='panama-city-beach' 
                 OR m_location_formatted='Panama City Beach' THEN 'Panama City Beach'
            WHEN m_location='fort-lauderdale' 
                 OR m_location_formatted='Fort Lauderdale' THEN 'Fort Lauderdale'
            WHEN m_location='south-padre' 
                 OR m_location_formatted='South Padre Island' THEN 'South Padre Island'
        END AS location,
        COUNT(*) AS total_cards_last_year
    FROM filtered_orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
          <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS') - INTERVAL '364 days'
      AND (m_location IS NOT NULL OR m_location_formatted IS NOT NULL)
    GROUP BY 1
)
SELECT
    cy.location,
    ly.total_cards_last_year,
    cy.total_cards_current_year,
    (CAST(cy.total_cards_current_year AS FLOAT)/NULLIF(CAST(ly.total_cards_last_year AS FLOAT),0))-1 AS yoy_growth,
    -((CAST(cy.total_cards_current_year AS FLOAT)/NULLIF(CAST(ly.total_cards_last_year AS FLOAT),0))-1) AS reversed_growth
FROM current_year_data cy
JOIN last_year_data ly USING (location)
ORDER BY cy.total_cards_current_year DESC
```

# Sales by Location

```sql today_cards_by_location
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
today_data AS (
    SELECT 
        m_location_formatted AS location,
        COUNT(*) FILTER (WHERE m_type = 'card') AS total_cards_today,
        COUNT(*) FILTER (WHERE m_tier = 'maniac-card') AS maniac_cards_today,
        COUNT(*) FILTER (WHERE m_tier = 'maniac-vip-card') AS vip_cards_today,
        COUNT(*) FILTER (WHERE m_upgrade_type = 'fastPass') AS fp_today,
        COUNT(*) FILTER (WHERE m_upgrade_type = 'fastPassPlus') AS fpp_today,
        COUNT(*) FILTER (WHERE m_upgrade_type IN ('fastPass', 'fastPassPlus')) AS total_fp_today
    FROM filtered_orders
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
          = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS'))
    GROUP BY m_location_formatted
),
last_year_data AS (
    SELECT 
        m_location_formatted AS location,
        COUNT(*) FILTER (WHERE m_type = 'card') AS total_cards_tdly,
        COUNT(*) FILTER (WHERE m_tier = 'maniac-card') AS maniac_cards_tdly,
        COUNT(*) FILTER (WHERE m_tier = 'maniac-vip-card') AS vip_cards_tdly,
        COUNT(*) FILTER (WHERE m_upgrade_type = 'fastPass') AS fp_tdly,
        COUNT(*) FILTER (WHERE m_upgrade_type = 'fastPassPlus') AS fpp_tdly,
        COUNT(*) FILTER (WHERE m_upgrade_type IN ('fastPass', 'fastPassPlus')) AS total_fp_tdly
    FROM filtered_orders_historical
    WHERE DATE_TRUNC('day', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
          = DATE_TRUNC('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 DAYS'))
    GROUP BY m_location_formatted
)
SELECT 
    COALESCE(td.location, ly.location) as location,
    COALESCE(td.total_cards_today, 0) as total_cards_today,
    COALESCE(ly.total_cards_tdly, 0) as total_cards_tdly,
    COALESCE(td.maniac_cards_today, 0) as maniac_cards_today,
    COALESCE(ly.maniac_cards_tdly, 0) as maniac_cards_tdly,
    COALESCE(td.vip_cards_today, 0) as vip_cards_today,
    COALESCE(ly.vip_cards_tdly, 0) as vip_cards_tdly,
    COALESCE(td.fp_today, 0) as fp_today,
    COALESCE(ly.fp_tdly, 0) as fp_tdly,
    COALESCE(td.fpp_today, 0) as fpp_today,
    COALESCE(ly.fpp_tdly, 0) as fpp_tdly,
    COALESCE(td.total_fp_today, 0) as total_fp_today,
    COALESCE(ly.total_fp_tdly, 0) as total_fp_tdly
FROM today_data td
FULL OUTER JOIN last_year_data ly USING (location)
WHERE COALESCE(td.location, ly.location) IS NOT NULL
  AND COALESCE(td.location, ly.location) <> ''
ORDER BY COALESCE(td.total_cards_today, 0) DESC
```

{#each locations as loc}


<div class="-mb-4">
<Sparkline 
    data={daily_sales.filter(d => d.location === loc.location)}
    dateCol="sale_date"
    valueCol="cards_sold"
    type="bar"
    color="pink"
    height={40}
    width={180}
/>
</div>

## {loc.location}

<Alert status="info">
  Last Sold: <Value data={last_card_by_location.filter(d => d.location === loc.location)} column="card_type" /> for <Value data={last_card_by_location.filter(d => d.location === loc.location)} column="price" fmt="usd2" /> on <Value data={last_card_by_location.filter(d => d.location === loc.location)} column="sold_at" fmt="MMM d, yyyy H:MM:SS AM/PM" /> 
  {#if last_card_by_location.filter(d => d.location === loc.location)[0]?.fast_pass !== 'None'}
  with <Value data={last_card_by_location.filter(d => d.location === loc.location)} column="fast_pass" />
  {/if} <br />
  <div class="text-sm text-gray-500">Referral: <Value data={last_card_by_location.filter(d => d.location === loc.location)} column="referral" /></div>
</Alert>

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue
        data={location_metrics.filter(d => d.location === loc.location)}
        value="gross_revenue"
        title="Gross Revenue"
        description="Revenue in {loc.location} vs same weekday and time last year."
        comparison="growth"
        comparisonTitle="vs 2024"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="usd"
    />
    <BigValue
        data={location_metrics.filter(d => d.location === loc.location)}
        value="last_year_revenue"
        title="Gross Revenue TDLY"
        description="Revenue in {loc.location} at same weekday and time last year."
        comparison="reversed_growth"
        comparisonTitle="vs 2025"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="usd"
    />
    <BigValue
        data={cards_sold_last_year_by_location.filter(d => d.location === loc.location)}
        value="total_cards_current_year"
        title="Cards Sold"
        description="Cards sold in {loc.location} vs same weekday and time last year."
        comparison="yoy_growth"
        comparisonTitle="vs 2024"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="num0"
    />
    <BigValue
        data={cards_sold_last_year_by_location.filter(d => d.location === loc.location)}
        value="total_cards_last_year"
        title="Cards Sold TDLY"
        description="Cards sold in {loc.location} at same weekday and time last year."
        comparison="reversed_growth"
        comparisonTitle="vs 2025"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="num0"
    />
</div>

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue
        data={location_metrics.filter(d => d.location === loc.location)}
        value="fast_pass"
        title="FastPass"
        description="Total FastPass sales in {loc.location}."
    />
    <BigValue
        data={location_metrics.filter(d => d.location === loc.location)}
        value="fast_pass_plus"
        title="FastPass Plus"
        description="Total FastPass+ sales in {loc.location}."
    />
</div>

### FastPass Comparison

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue
        data={fp_by_location_comparison.filter(d => d.location === loc.location)}
        value="total_fp"
        title="Total FastPass"
        description="FastPass sales in {loc.location} vs same weekday and time last year."
        comparison="absolute_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="num0"
    />
    <BigValue
        data={fp_by_location_comparison.filter(d => d.location === loc.location)}
        value="fp_revenue"
        title="FastPass Revenue"
        description="FastPass revenue in {loc.location} vs same weekday and time last year."
        comparison="absolute_revenue_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="usd0"
        fmt="usd"
    />
</div>

<div class="grid grid-cols-2 sm:grid-cols-2 gap-4">
    <BigValue
        data={fp_by_location_comparison.filter(d => d.location === loc.location)}
        value="total_fp_ly"
        title="2024 FastPass TDLY"
        description="FastPass sales in {loc.location} last year up to this same moment (accurate to the minute)."
        fmt="num0"
    />
    <BigValue
        data={fp_by_location_comparison.filter(d => d.location === loc.location)}
        value="fp_revenue_ly"
        title="2024 FastPass Revenue TDLY"
        description="FastPass revenue in {loc.location} last year up to this same moment (accurate to the minute)."
        fmt="usd"
    />
</div>

### Cards Sold Today

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">
    <BigValue
        data={today_cards_by_location.filter(d => d.location === loc.location)}
        value="total_cards_today"
        title="Total"
        description="Today's sales in {loc.location} vs full day, same weekday last year."
        comparison="total_cards_tdly"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />
    <BigValue 
        data={today_cards_by_location.filter(d => d.location === loc.location)}
        value="maniac_cards_today"
        title="Maniac"
        comparison="maniac_cards_tdly"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />
    <BigValue 
        data={today_cards_by_location.filter(d => d.location === loc.location)}
        value="vip_cards_today"
        title="VIP"
        comparison="vip_cards_tdly"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />
</div>

<div class="grid grid-cols-3 sm:grid-cols-3 gap-4">
    <BigValue
        data={today_cards_by_location.filter(d => d.location === loc.location)}
        value="total_fp_today"
        title="Total FastPass"
        description="Today's FastPass sales in {loc.location} vs full day, same weekday last year."
        comparison="total_fp_tdly"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />
    <BigValue 
        data={today_cards_by_location.filter(d => d.location === loc.location)}
        value="fp_today"
        title="FastPass"
        comparison="fp_tdly"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />
    <BigValue 
        data={today_cards_by_location.filter(d => d.location === loc.location)}
        value="fpp_today"
        title="FastPass+"
        comparison="fpp_tdly"
        comparisonTitle="LY"
        comparisonDelta="false"
        comparisonColor="#459bd7"
    />
</div>

### {loc.location} Cards Sold by Week Online

<DataTable
    data={location_weekly_sales.filter(d => d.location === loc.location)}
    rows={10}
>
    <Column id="week_formatted" title="Week"/>
    <Column id="maniac_card_count" title="Maniac"/>
    <Column id="maniac_vip_count" title="VIP"/>
    <Column id="total_count" title="Total"/>
</DataTable>

### {loc.location} FastPass Sales by Week Online

<DataTable
    data={fastpass_weekly_sales.filter(d => d.location === loc.location)}
    rows={10}
>
    <Column id="week_formatted" title="Week"/>
    <Column id="fastpass_count" title="FastPass"/>
    <Column id="fastpass_plus_count" title="FastPass Plus"/>
    <Column id="total_count" title="Total"/>
</DataTable>

<BarChart
    data={hourly_sales_by_location.filter(d => d.location === loc.location && d.card_category.startsWith('Maniac'))}
    x="hour"
    y={["orders"]}
    series="card_category"
    title="Maniac Card Sales by Hour"
    subtitle={`${new Date().toLocaleDateString()} - Hourly breakdown of Maniac Card sales by type`}
    xAxisTitle="Hour (24h format)"
    yAxisTitle="Cards Sold"
    colorPalette={['#E91E63', '#9C27B0', '#FFC107']}
    type="stacked"
    xMin={0}
    xMax={23}
    yMin={0}
    labels={false}
/>

<BarChart
    data={hourly_sales_by_location.filter(d => d.location === loc.location && d.card_category.startsWith('VIP'))}
    x="hour"
    y={["orders"]}
    series="card_category"
    title="VIP Card Sales by Hour"
    subtitle={`${new Date().toLocaleDateString()} - Hourly breakdown of VIP Card sales by type`}
    xAxisTitle="Hour (24h format)"
    yAxisTitle="Cards Sold"
    colorPalette={['#0D47A1', '#00BCD4', '#FFD600']}
    type="stacked"
    xMin={0}
    xMax={23}
    yMin={0}
    labels={false}
/>

***

{/each}

```sql referrals
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    COALESCE(NULLIF(m_referral,''),'Direct') AS referral_source,
    COUNT(*) AS orders,
    SUM(amount_total) AS total_revenue,
    AVG(amount_total) AS avg_order_value
FROM filtered_orders
GROUP BY 1
ORDER BY orders DESC
```

```sql last_card_by_location
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND m_type = 'card'
)
SELECT 
    m_location_formatted AS location,
    CASE 
        WHEN m_tier = 'maniac-card' THEN 'Maniac Card'
        WHEN m_tier = 'maniac-vip-card' THEN 'VIP Card'
        ELSE m_tier
    END AS card_type,
    amount_total AS price,
    DATE_TRUNC('second', (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) AS sold_at,
    CASE 
        WHEN m_upgrade_type = 'fastPass' THEN 'Fast Pass'
        WHEN m_upgrade_type = 'fastPassPlus' THEN 'Fast Pass+'
        ELSE 'None'
    END AS fast_pass,
    COALESCE(NULLIF(m_referral,''),'Direct') AS referral
FROM filtered_orders
WHERE m_location_formatted IS NOT NULL
  AND m_location_formatted <> ''
QUALIFY ROW_NUMBER() OVER (PARTITION BY m_location_formatted ORDER BY created DESC) = 1
ORDER BY m_location_formatted
```

```sql hourly_sales
WITH RECURSIVE filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
hours(hour) AS (
    SELECT 0
    UNION ALL
    SELECT hour + 1 
    FROM hours 
    WHERE hour < 23
),
sales AS (
    SELECT 
        EXTRACT(HOUR FROM (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')) AS hour,
        COUNT(*) AS orders,
        SUM(amount_total) AS revenue
    FROM filtered_orders
    GROUP BY 1
)
SELECT 
    h.hour,
    COALESCE(s.orders,0) AS orders,
    COALESCE(s.revenue,0) AS revenue
FROM hours h
LEFT JOIN sales s ON h.hour=s.hour
ORDER BY h.hour
```

# Sales Time Stats

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <BarChart
        data={daily_pattern}
        x="day_of_week"
        y="orders"
        title="Orders by Day of Week"
        subtitle="Distribution of orders across days of the week."
        xAxisTitle="Day"
        yAxisTitle="Number of Orders"
    />
    <ScatterPlot
        data={hourly_sales}
        x="hour"
        y="orders"
        xAxisTitle="Hour (24h)"
        yAxisTitle="Number of Orders"
        title="Orders by Hour of Day"
        subtitle="Distribution of orders throughout the day by hour."
        xMin={0}
        xMax={24}
        yMin={0}
    />
</div>

# Referral Performance

```sql direct_referrals_current
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    COUNT(*) AS direct_referrals,
    SUM(amount_total) AS revenue
FROM filtered_orders
WHERE COALESCE(NULLIF(m_referral,''),'Direct') = 'Direct'
```

```sql direct_referrals_last_year
WITH filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    COUNT(*) AS direct_referrals_ly,
    SUM(amount_total) AS revenue_ly
FROM filtered_orders_historical
WHERE COALESCE(NULLIF(m_referral,''),'Direct') = 'Direct'
  AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')
      <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours' - INTERVAL '364 days')
```

```sql direct_referrals_comparison
SELECT 
    c.direct_referrals        AS current_year,
    l.direct_referrals_ly     AS last_year,
    (CAST(c.direct_referrals AS FLOAT)/NULLIF(CAST(l.direct_referrals_ly AS FLOAT),0))-1 AS yoy_growth,
    c.revenue                 AS current_revenue,
    l.revenue_ly              AS last_year_revenue,
    (CAST(c.revenue AS FLOAT)/NULLIF(CAST(l.revenue_ly AS FLOAT),0))-1 AS revenue_growth
FROM ${direct_referrals_current} c
CROSS JOIN ${direct_referrals_last_year} l
```

<div class="grid grid-cols-2 gap-4">
    <BigValue
        data={direct_referrals_comparison}
        value="current_year"
        title="Direct Sales"
        description="Direct sales vs same weekday and time last year."
        comparison="yoy_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="num0"
    />

    <BigValue
        data={direct_referrals_comparison}
        value="current_revenue"
        title="Direct Revenue"
        description="Direct revenue vs same weekday and time last year."
        comparison="revenue_growth"
        comparisonTitle="vs Last Year"
        comparisonDelta="true"
        comparisonFmt="pct1"
        fmt="usd0"
    />
</div>

```sql referral_sales_current
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    COUNT(*) AS referral_sales,
    SUM(amount_total) AS revenue
FROM filtered_orders
WHERE COALESCE(NULLIF(m_referral,''),'Direct') != 'Direct'
```

```sql referral_sales_last_year
WITH filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    COUNT(*) AS referral_sales_ly,
    SUM(amount_total) AS revenue_ly
FROM filtered_orders_historical
WHERE COALESCE(NULLIF(m_referral,''),'Direct') != 'Direct'
  AND (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS')
      <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours' - INTERVAL '364 days')
```

```sql referral_sales_comparison
SELECT 
    c.referral_sales          AS current_year,
    l.referral_sales_ly       AS last_year,
    -(l.referral_sales_ly - c.referral_sales) AS sales_decrease,
    c.revenue                 AS current_revenue,
    l.revenue_ly              AS last_year_revenue,
    -(l.revenue_ly - c.revenue)  AS revenue_decrease
FROM ${referral_sales_current} c
CROSS JOIN ${referral_sales_last_year} l
```

<div class="grid grid-cols-2 gap-4">
    <BigValue
        data={referral_sales_comparison}
        value="current_year"
        title="Referral Sales"
        description="Referral sales vs same weekday and time last year."
        comparison="sales_decrease"
        comparisonTitle="Sales from 2024"
        comparisonDelta="true"
        fmt="num0"
        comparisonFmt="num0"
    />

    <BigValue
        data={referral_sales_comparison}
        value="current_revenue"
        title="Referral Revenue"
        description="Referral revenue vs same weekday and time last year."
        comparison="revenue_decrease"
        comparisonTitle="from 2024"
        comparisonDelta="true"
        fmt="usd0"
        comparisonFmt="usd0"
    />
</div>

```sql revenue_decrease_breakdown
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
),
current_year AS (
    SELECT 
        SUM(CASE WHEN COALESCE(NULLIF(m_referral,''),'Direct') != 'Direct' 
            THEN amount_total ELSE 0 END) as referral_revenue,
        SUM(amount_total) as total_revenue
    FROM filtered_orders
),
last_year AS (
    SELECT 
        SUM(CASE WHEN COALESCE(NULLIF(m_referral,''),'Direct') != 'Direct' 
            THEN amount_total ELSE 0 END) as referral_revenue,
        SUM(amount_total) as total_revenue
    FROM filtered_orders_historical
    WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
          <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours' - INTERVAL '364 days')
)
SELECT 
    ly.referral_revenue - cy.referral_revenue AS referral_revenue_decrease,
    (ly.total_revenue - cy.total_revenue) AS total_revenue_decrease,
    cy.total_revenue + (ly.referral_revenue - cy.referral_revenue) AS potential_revenue,
    (ROUND(100.0 * ((cy.total_revenue + (ly.referral_revenue - cy.referral_revenue)) / NULLIF(cy.total_revenue, 0) - 1), 1))/100 AS potential_growth_pct
FROM current_year cy
CROSS JOIN last_year ly
```

<!-- <div class="grid grid-cols-2 gap-4 pt-8">
<div class="col-span-1">
    <Alert status="warning">
        Hypothetical Revenue with 2024 Referrals
    </Alert>
        <BigValue 
            data={revenue_decrease_breakdown}
            value="potential_revenue"
            title="Revenue with 2024 Referrals"
            comparison="potential_growth_pct"
            comparisonTitle="vs 2024"
            comparisonDelta="true"
            fmt="usd0"
            comparisonFmt="pct1"
        />
    </div>
</div> -->

---

```sql referral_rolling_avg
WITH RECURSIVE date_series AS (
    SELECT 
        TIMESTAMP '2023-12-01' - INTERVAL '4 HOURS' AS sale_date
    UNION ALL
    SELECT 
        sale_date + INTERVAL '1 day'
    FROM date_series
    WHERE sale_date < TIMESTAMP '2024-05-01' - INTERVAL '4 HOURS'
),
last_year_referrals AS (
    SELECT 
        ds.sale_date,
        COALESCE(COUNT(oh.id), 0) AS referral_cards_sold
    FROM date_series ds
    LEFT JOIN orders_historical oh
        ON date_trunc('day', ds.sale_date) = 
           date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
        AND COALESCE(NULLIF(oh.m_referral, ''), 'Direct') != 'Direct'
    GROUP BY ds.sale_date
),
current_year_referrals AS (
    SELECT 
        ds.sale_date,
        COALESCE(COUNT(oh.id), 0) AS referral_cards_sold
    FROM date_series ds
    LEFT JOIN orders_historical oh
        ON date_trunc('day', ds.sale_date + INTERVAL '364 days') = 
           date_trunc('day', (CAST(TO_TIMESTAMP(oh.created) AS TIMESTAMP) - INTERVAL '4 HOURS'))
        AND COALESCE(NULLIF(oh.m_referral, ''), 'Direct') != 'Direct'
    WHERE ds.sale_date + INTERVAL '364 days' <= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')
    GROUP BY ds.sale_date
),
referral_rolling AS (
    SELECT 
        ly.sale_date as month,
        ROUND(AVG(ly.referral_cards_sold) OVER (
            ORDER BY ly.sale_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )) as avg_last_year,
        CASE 
            WHEN ly.sale_date + INTERVAL '364 days' <= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS')
            THEN ROUND(AVG(cy.referral_cards_sold) OVER (
                ORDER BY cy.sale_date
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ))
            ELSE NULL
        END as avg_this_year,
        date_trunc('day', (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 days'))::date as last_year_today
    FROM last_year_referrals ly
    LEFT JOIN current_year_referrals cy USING (sale_date)
)
SELECT *
FROM referral_rolling
WHERE month >= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 days' - INTERVAL '20 days')
  AND month <= date_trunc('day', CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 HOURS' - INTERVAL '364 days' + INTERVAL '30 days')
ORDER BY month
```

<LineChart
    data={referral_rolling_avg}
    x="month"
    y={["avg_last_year","avg_this_year"]}
    title="Referral Partner Sales Trend"
    subtitle="7-Day Rolling Average (Excluding Direct Sales) - Comparison at same weekday and time"
    yAxisTitle="Cards Sold"
    colorPalette={['#8a89a6','#7baea7']}
>
    <ReferenceLine
        data={referral_rolling_avg}
        x="last_year_today"
        label="LYTD"
        lineWidth={2}
        lineType="dashed"
        hideValue={true}
        color="accent"
    />
</LineChart>

## This Year

<DataTable
    data={referrals}
    rows={10}
    search={true}
>
    <Column id="referral_source" title="Source"/>
    <Column id="orders" title="Orders"/>
    <Column id="total_revenue" title="Revenue" fmt="usd"/>
</DataTable>

## 2024 LYTD

```sql referrals_2024
WITH filtered_orders_historical AS (
    SELECT *
    FROM orders_historical
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
)
SELECT 
    COALESCE(NULLIF(m_referral,''),'Direct') AS m_referral,
    COUNT(*) AS total_orders,
    SUM(amount_total) AS total_revenue
FROM filtered_orders_historical
WHERE (CAST(TO_TIMESTAMP(created) AS TIMESTAMP) - INTERVAL '4 HOURS') 
      <= (CAST(CURRENT_TIMESTAMP AS TIMESTAMP) - INTERVAL '4 hours' - INTERVAL '364 days')
GROUP BY 1
ORDER BY total_orders DESC
```

<DataTable
    data={referrals_2024}
    search={false}
>
    <Column id="m_referral" title="Source"/>
    <Column id="total_orders" title="Orders"/>
    <Column id="total_revenue" title="Revenue" fmt="usd2"/>
</DataTable>

---

```sql card_sales_location
WITH filtered_orders AS (
    SELECT *
    FROM maniac_neon.orders
    WHERE status = 'complete'
      AND livemode = true
      AND (refund_status IS NULL OR refund_status = '')
      AND (dispute_status IS NULL OR dispute_status <> 'lost')
      AND m_type='card'
),
zip_joined AS (
    SELECT 
       cs.m_customer_postal_code AS zipcode,
       z.lat,
       z.long,
       z.city,
       z.state,
       COUNT(*) AS card_sales
    FROM filtered_orders cs
    JOIN studentescape_neon.zip_codes z 
      ON cs.m_customer_postal_code = z.zipcode
    WHERE cs.m_customer_postal_code IS NOT NULL
      AND cs.m_customer_postal_code <> ''
    GROUP BY cs.m_customer_postal_code, z.lat, z.long, z.city, z.state
)
SELECT * FROM zip_joined
```

# Geographic Distribution

<BubbleMap
    data={card_sales_location}
    lat="lat"
    long="long"
    size="card_sales"
    value="card_sales"
    valueFmt="num0"
    pointName="city"
    subtitle="Geographic distribution of card sales across the United States by zip code."
    tooltip={[
      {id: 'city', showColumnName: false, valueClass: 'text-xl font-semibold'},
      {id: 'state', showColumnName: false},
      {id: 'card_sales', title: 'Cards Sold'}
    ]}
/>

## Sales by Zip Code

<DataTable
    data={card_sales_location}
    rows={10}
    search={true}
>
    <Column id="zipcode" title="Zip Code"/>
    <Column id="city" title="City"/>
    <Column id="state" title="State"/>
    <Column id="card_sales" title="Cards Sold"/>
</DataTable>



<LineChart
    data={seven_day_comparison}
    x="sale_date"
    y="cards_sold"
    series="series"
    title="Daily Card Sales"
    subtitle="Last 7 Days vs Same Period Last Year - Using complete days"
    yAxisTitle="Cards Sold"
    colorPalette={['#FF0066','#4A90E2']}
/>