---
title: StudentEscape
---

```sql most_recent_purchase
SELECT 
    CAST(created_at_est AS TIMESTAMP) as latest_purchase
FROM orders_summary
WHERE status = 'complete'
ORDER BY initial_purchase_date_est DESC
LIMIT 1
```

<Alert status="info">
<div class="text-xs md:text-base">🕒 Most Recent Purchase: <Value data={most_recent_purchase} fmt="fulldate"/> at <Value data={most_recent_purchase} fmt="hms"/></div>
</Alert>

```sql active
SELECT COUNT(*) as count
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status = 'active'
```

```sql trialing
SELECT COUNT(*) as count
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status = 'trialing'
```

```sql past_due_subscriptions
SELECT COUNT(*) as count
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status = 'past_due'
```

```sql canceled_subscriptions
SELECT COUNT(*) as count
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status = 'canceled'
```

```sql active_and_trialing
SELECT COUNT(*) as count
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status IN ('active', 'trialing')
```

```sql deposit_only
SELECT COUNT(*) as count
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND net_billed_amount_subscription = 0
  AND status IN ('active', 'trialing')
  AND payment_type = 'plan'
```

```sql plans_total_billed
SELECT SUM(net_billed_amount_subscription) as total
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status IN ('active', 'trialing', 'past_due', 'canceled')
  AND payment_type = 'plan'
```

```sql total_deposits
SELECT SUM(total_deposits) as total
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status IN ('active', 'trialing', 'past_due', 'canceled')
  AND payment_type = 'plan'
```

```sql net_billed_amount
SELECT SUM(net_billed_amount) as total
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status IN ('active', 'trialing', 'past_due', 'canceled')
  AND payment_type = 'plan'
```

```sql plans_total_next
SELECT SUM(future_billing_amount) as total
FROM orders_summary
WHERE application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
  AND status IN ('active', 'trialing')
  AND payment_type = 'plan'
```

```sql one_time_payments
SELECT COUNT(*) as count
FROM orders_summary
WHERE payment_type = 'upfront'
  AND status = 'complete'
```

```sql total_one_time
SELECT SUM(total_billed_amount) as total
FROM orders_summary
WHERE payment_type = 'upfront'
```

```sql total_collected_all
SELECT SUM(net_billed_amount) as total
FROM orders_summary
WHERE status IN ('active', 'trialing', 'past_due', 'complete', 'canceled')
```

```sql trip_counts
SELECT
    product_name AS trip_name,
    COUNT(*) AS count,
    SUM(net_billed_amount) AS total_revenue
FROM orders_summary
WHERE status IN ('trialing', 'active', 'complete', 'past_due')
GROUP BY product_name
ORDER BY total_revenue DESC
```

```sql trip_counts_past_due
SELECT
    product_name AS trip_name,
    COUNT(*) AS count
FROM orders_summary
WHERE status = 'past_due'
  AND payment_type = 'plan'
GROUP BY product_name
ORDER BY count DESC
```

<BigValue 
    data={total_collected_all}
    value="total"
    title="Total Collected (Minus Refunds)"
    fmt=usd2
/>

```sql subscription_sales_over_time
WITH filtered_orders AS (
    SELECT 
        DATE_TRUNC('day', CAST(initial_purchase_date_est AS TIMESTAMP)) AS sale_date,
        COUNT(*) FILTER (WHERE payment_type = 'plan') as plan_sales,
        COUNT(*) FILTER (WHERE payment_type = 'upfront') as paid_in_full,
        COUNT(*) as total_sales,
        SUM(CASE WHEN payment_type = 'plan' THEN total_deposits ELSE 0 END) as deposits,
        SUM(net_billed_amount) as revenue,
        SUM(net_billed_amount) as daily_revenue
    FROM orders_summary
    WHERE status IN ('active', 'trialing', 'past_due', 'canceled', 'complete')
    GROUP BY 1
    ORDER BY 1
)
SELECT 
    sale_date,
    plan_sales,
    paid_in_full,
    total_sales,
    deposits,
    revenue,
    daily_revenue,
    SUM(plan_sales) OVER (ORDER BY sale_date) as cumulative_plans,
    SUM(paid_in_full) OVER (ORDER BY sale_date) as cumulative_paid_in_full,
    SUM(total_sales) OVER (ORDER BY sale_date) as cumulative_total,
    SUM(deposits) OVER (ORDER BY sale_date) as cumulative_deposits,
    SUM(revenue) OVER (ORDER BY sale_date) as cumulative_revenue
FROM filtered_orders
```

## Sales Over Time

<div class="flex items-center gap-2 mb-4">
    <span class="text-sm">Cumulative Total Sales:</span>
    <Sparkline 
        data={subscription_sales_over_time} 
        dateCol=sale_date 
        valueCol=cumulative_revenue
        valueFmt=usd
        type=area
        height=30
        width=200
        interactive=true
        color="#4F46E5"
        connectGroup=daily_sales
        tooltip={[
            {id: "sale_date", title: "Date", fmt: "MMM D, YYYY"},
            {id: "cumulative_revenue", title: "Total Revenue", fmt: "usd"}
        ]}
    />
</div>

<BarChart
    data={subscription_sales_over_time}
    x=sale_date
    y={["plan_sales", "paid_in_full"]}
    title="Daily Sales by Payment Type"
    yAxisTitle="New Sales"
    stacked=true
    chartAreaHeight=300
    seriesNames={["Payment Plans", "Paid in Full"]}
    connectGroup=daily_sales
/>

***

```sql location_summary_backup
SELECT
    location,
    COUNT(*) as number_of_trips,
    SUM(CASE WHEN payment_type = 'upfront' THEN total_billed_amount ELSE 0 END) AS total_one_time,
    SUM(CASE WHEN payment_type = 'plan' THEN total_deposits ELSE 0 END) AS total_deposits,
    SUM(CASE WHEN payment_type = 'plan' THEN (total_billed_amount - total_deposits) ELSE 0 END) AS total_payments,
    SUM(net_billed_amount) AS total_collected
FROM orders_summary
GROUP BY location
ORDER BY total_collected DESC
```

```sql location_summary
SELECT
    location,
    COUNT(*) as number_of_trips,
    SUM(net_billed_amount) AS total_collected
FROM orders_summary
WHERE status NOT IN ('canceled')
GROUP BY location
ORDER BY total_collected DESC
```

```sql weekly_totals_by_location
WITH trip_weeks AS (
    SELECT 
        location,
        CASE 
            WHEN product_name LIKE '% - Week 1%' THEN 'Week 1'
            WHEN product_name LIKE '% - Week 2%' THEN 'Week 2'
            WHEN product_name LIKE '% - Week 3%' THEN 'Week 3'
            WHEN product_name LIKE '% - Week 4%' THEN 'Week 4'
            ELSE 'Other'
        END as week_number,
        COUNT(*) as bookings,
        SUM(net_billed_amount) as revenue
    FROM orders_summary
    WHERE status NOT IN ('canceled')
    GROUP BY 
        location,
        CASE 
            WHEN product_name LIKE '% - Week 1%' THEN 'Week 1'
            WHEN product_name LIKE '% - Week 2%' THEN 'Week 2'
            WHEN product_name LIKE '% - Week 3%' THEN 'Week 3'
            WHEN product_name LIKE '% - Week 4%' THEN 'Week 4'
            ELSE 'Other'
        END
)
SELECT
    location,
    week_number,
    SUM(bookings) as bookings,
    SUM(revenue) as revenue
FROM trip_weeks
WHERE week_number != 'Other'
GROUP BY location, week_number
ORDER BY 
    location,
    CASE 
        WHEN week_number = 'Week 1' THEN 1
        WHEN week_number = 'Week 2' THEN 2
        WHEN week_number = 'Week 3' THEN 3
        WHEN week_number = 'Week 4' THEN 4
    END
```

{#each location_summary as location}

## {location.location}

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
    <BigValue 
        data={[location]}
        value="number_of_trips"
        title="Number of Trips"
    />
    <BigValue 
        data={[location]}
        value="total_collected"
        title="Total Collected"
        fmt="usd2"
    />
</div>

<DataTable 
    data={weekly_totals_by_location.filter(row => row.location === location.location)}
    search=false
>
    <Column id=week_number title="Week"/>
    <Column id=bookings title="Bookings"/>
    <Column id=revenue title="Revenue" fmt=usd2/>
</DataTable>

{/each}

***

## One-Time Payments
Trips purchased with a one-time payment.

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
<BigValue 
    data={one_time_payments}
    value="count"
    title="One-Time Payments"
/>

<BigValue 
    data={total_one_time}
    value="total"
    title="Total Collected"
    fmt=usd2
/>
</div>

***

## Payment Plans
Trips purchased with a payment plan.  

<Details title="Notes">

  - Total deposits represent the initial deposit paid at the time of purchase.
  - Total payments represent the total amount paid to date including deposits.
  - The <Value data={plans_total_next} fmt=usd2/> Total Due Next Month does not include past-due plans.

</Details>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
<BigValue 
    data={total_deposits}
    value="total"
    title="Total Deposits"
    fmt=usd2
/>
<BigValue 
    data={plans_total_billed}
    value="total"
    title="Total Payments"
    fmt=usd2
/>
<BigValue 
    data={net_billed_amount}
    value="total"
    title="Total Collected"
    fmt=usd2
/>
</div>

<!-- <BigValue 
    data={plans_total_next}
    value="total"
    title="Total Due Next Month"
    fmt=usd2
/> -->

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
  <BigValue 
    data={active_and_trialing}
    value="count"
    title="Active Plans"
  />
  <BigValue 
    data={deposit_only}
    value="count"
    title="Pending First Payment"
  />
</div>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
  <BigValue 
    data={past_due_subscriptions}
    value="count"
    title="Past Due Plans"
  />
  <BigValue 
    data={canceled_subscriptions}
    value="count"
    title="Canceled Plans"
  />
</div>

```sql deposit_amounts
SELECT 
    CASE 
        WHEN total_deposits IS NULL THEN 'No Deposit Data'
        WHEN total_deposits = 0 THEN 'No Deposit Paid'
        WHEN total_deposits = 50 THEN '$50 Deposit'
        WHEN total_deposits = 100 THEN '$100 Deposit'
        ELSE CONCAT('Other Amount ($', total_deposits::text, ')')
    END as deposit_type,
    status,
    COUNT(*) as count,
    SUM(COALESCE(total_deposits, 0)) as total_collected
FROM orders_summary
WHERE payment_type = 'plan'
GROUP BY 
    CASE 
        WHEN total_deposits IS NULL THEN 'No Deposit Data'
        WHEN total_deposits = 0 THEN 'No Deposit Paid'
        WHEN total_deposits = 50 THEN '$50 Deposit'
        WHEN total_deposits = 100 THEN '$100 Deposit'
        ELSE CONCAT('Other Amount ($', total_deposits::text, ')')
    END,
    status
ORDER BY 
    CASE deposit_type
        WHEN 'No Deposit Data' THEN 0
        WHEN 'No Deposit Paid' THEN 1
        WHEN '$50 Deposit' THEN 2
        WHEN '$100 Deposit' THEN 3
        ELSE 4
    END,
    status
```

## Deposit Amount Distribution
Shows the breakdown of initial deposit amounts for all payment plans, including their current status. This helps us reconcile the total deposits collected over time.

<DataTable 
    data={deposit_amounts}
    search=false
    groupBy=deposit_type
    totalRow=true
>
    <Column id=deposit_type title="Deposit Amount"/>
    <Column id=status title="Status"/>
    <Column id=count title="Number of Plans"/>
    <Column id=total_collected title="Total Collected" fmt=usd2/>
</DataTable>

***

## Booking Locations

```sql location_revenue
SELECT 
    cs.m_customer_postal_code as zipcode,
    SUM(os.net_billed_amount) as revenue
FROM studentescape_neon.checkout_sessions cs
JOIN orders_summary os ON cs.id = os.checkout_session_id
WHERE cs.m_customer_postal_code IS NOT NULL
  AND cs.m_customer_postal_code != ''
GROUP BY cs.m_customer_postal_code
```

```sql booking_locations
SELECT 
    cs.m_customer_postal_code as zipcode,
    z.lat,
    z.long,
    z.city,
    z.state,
    COUNT(*) as bookings,
    COALESCE(lr.revenue, 0) as revenue
FROM studentescape_neon.checkout_sessions cs
JOIN orders_summary os ON cs.id = os.checkout_session_id
JOIN studentescape_neon.zip_codes z ON cs.m_customer_postal_code = z.zipcode
LEFT JOIN ${location_revenue} lr ON cs.m_customer_postal_code = lr.zipcode
WHERE cs.m_customer_postal_code IS NOT NULL
  AND cs.m_customer_postal_code != ''
GROUP BY 
    cs.m_customer_postal_code,
    z.lat,
    z.long,
    z.city,
    z.state,
    lr.revenue
```

<BubbleMap 
    data={booking_locations} 
    lat=lat
    long=long
    size=bookings
    value=revenue
    valueFmt=usd
    pointName=city
    tooltip={[
        {id: 'city', showColumnName: false, valueClass: 'text-xl font-semibold'},
        {id: 'state', showColumnName: false},
        {id: 'bookings', title: 'Number of Bookings'},
        {id: 'revenue', fmt: 'usd', title: 'Collected Revenue'}
    ]}
/>

***

```sql referral_counts
SELECT 
    CASE 
        WHEN cs.m_referral IN ('dshowker', 'Dave Showker') THEN 'Dave Showker'
        ELSE cs.m_referral 
    END as referral_source,
    COUNT(*) as count
FROM studentescape_neon.checkout_sessions cs
WHERE cs.m_referral IS NOT NULL
  AND cs.m_referral != ''
GROUP BY CASE 
    WHEN cs.m_referral IN ('dshowker', 'Dave Showker') THEN 'Dave Showker'
    ELSE cs.m_referral 
END
ORDER BY count DESC
```

<DataTable 
    data={referral_counts}
    search=false
>
    <Column id=referral_source title="Referral Source"/>
    <Column id=count title="Number of Bookings"/>
</DataTable>

## Groups

```sql group_code_counts
SELECT 
    cs.m_group_code as group_code,
    cs.m_group_name as group_name,
    COUNT(*) as count
FROM studentescape_neon.checkout_sessions cs
WHERE cs.m_group_code IS NOT NULL
  AND cs.m_group_code != ''
GROUP BY cs.m_group_code, cs.m_group_name
ORDER BY count DESC
```

<DataTable 
    data={group_code_counts}
    search=true
>
    <Column id=group_code title="Group Code"/>
    <Column id=group_name title="Group Name"/>
    <Column id=count title="Number of Bookings"/>
</DataTable>

***

```sql weekly_sales_by_location
WITH initial_sales AS (
    SELECT
        DATE_TRUNC('week', CAST(initial_purchase_date_est AS TIMESTAMP) - INTERVAL '7 days') AS week_start,
        location,
        payment_type,
        1 AS sale_count
    FROM orders_summary
    WHERE 
        CAST(initial_purchase_date_est AS TIMESTAMP) >= DATE '2024-06-01'
        AND status != 'canceled'
        AND total_refunds = 0
)
SELECT 
    julian(week_start) AS week_start_order,
    strftime(week_start, '%b %d, %Y') AS week_start_str,
    location,
    SUM(CASE WHEN payment_type = 'upfront' THEN sale_count ELSE 0 END) AS one_time_sales,
    SUM(CASE WHEN payment_type = 'plan' THEN sale_count ELSE 0 END) AS payment_plan_sales,
    SUM(sale_count) AS total_sales
FROM initial_sales
GROUP BY 
    week_start,
    location
ORDER BY 
    week_start,
    location

```

## Weekly Sales by Location

<Alert status="warning">
<div class="text-xs md:text-base">Weeks start on Monday.</div>
</Alert>

<BarChart
    data={weekly_sales_by_location}
    x=week_start_str
    y=total_sales
    series=location
    stacked=true
    sort=false
    tooltip={[
        {id: 'week_start_str', fmt: 'MMM D, YYYY', title: 'Week Starting'},
        {id: 'location', title: 'Location'},
        {id: 'total_sales', title: 'Total Sales'},
        {id: 'one_time_sales', title: 'One-Time Sales'},
        {id: 'payment_plan_sales', title: 'Payment Plan Sales'}
    ]}
/>

<DataTable
    data={weekly_sales_by_location}
    groupBy=location
    groupType=section
    sort="week_start_order asc"
    subtotals=true
    subtotalRowColor=#f2f2f2
    totalRow=true
    totalRowColor=#f2f2f2
    wrapTitles=true
    rowShading=false
    groupNamePosition=top
>
    <Column id=week_start_str title="Week Starting" totalAgg=Total/> 
    <Column id=location title="Location" />
    <Column id=one_time_sales title="One-Time" align=center />
    <Column id=payment_plan_sales title="Plans" align=center />
    <Column id=total_sales title="Total Sales" align=right contentType=colorscale colorScale=green />
</DataTable>

***

## All Bookings
###### excludes bookings with a cancelled subscription
###### this does not exclude past due plans

<div class="text-xs text-gray-500 -mb-4 md:hidden">➡️ Swipe left on tables to see more.</div>
<DataTable 
    data={trip_counts}
    search=false
    totalRow=true
    sort="trip_name asc"
    wrapTitles=true
    rows=all
>
    <Column id=trip_name title="Trip Name"/>
    <Column id=count title="Number of Bookings"/>
    <Column id=total_revenue title="Total Revenue Collected" fmt=usd2 />
</DataTable>

## Past Due Bookings by Trip

<DataTable 
    data={trip_counts_past_due}
    search=false
    sort="trip_name asc"
    rows=all
>
    <Column id=trip_name title="Trip Name"/>
    <Column id=count title="Bookings"/>
</DataTable>

```sql past_due_subscriptions_list
SELECT 
    COALESCE(customer_name, 'Unknown') as customer_name,
    
    subscription_id,
    CASE 
        WHEN status = 'past_due' THEN 'Past Due Since ' || strftime(CAST(last_billing_date_est AS timestamp), '%m-%d-%y')
        ELSE status
    END as subscription_status,
    total_billed_amount,
    strftime(CAST(last_billing_date_est AS timestamp), '%m-%d-%y') as last_billing_date,
    product_name,
    location
FROM orders_summary
WHERE status = 'past_due'
    AND application_id = 'ca_QpvN2rzkF1OM8vchXLyvXkpU7Uk5F86w'
ORDER BY last_billing_date_est DESC;
```

## Past-Due Subscriptions Detailed List

<DataTable 
    data={past_due_subscriptions_list}
    search={true}
    sort="last_billing_date desc"
    wrapTitles={true}
>
    <Column id="customer_name" title="Customer Name"/>
    <Column id="product_name" title="Trip"/>
    <Column id="location" title="Location"/>
    <Column id="subscription_status" title="Status"/>
    <Column id="total_billed_amount" title="Total Billed" fmt="usd2"/>
    <Column id="last_billing_date" title="Last Billed Date"/>
    <Column id="subscription_id" title="Subscription ID" width=200/>
</DataTable>


```sql orders_summary_full
SELECT 
    customer_name,
    customer_email,
    payment_type,
    subscription_id,
    status,
    checkout_session_id,
    product_name,
    location,
    total_billed_amount,
    total_deposits,
    total_refunds,
    net_billed_amount,
    last_billing_date_est,
    initial_purchase_date_est
FROM orders_summary
ORDER BY initial_purchase_date_est DESC;
```

## Orders Summary Full Data
<div class="text-xs text-gray-500 -mb-4 md:hidden">➡️ Swipe left on tables to see more.</div>

<DataTable 
    data={orders_summary_full}
    search={true}
    rowShading={false}
    wrapTitles={true}
>
    <Column id="customer_name" title="Customer Name"/>
    <Column id="customer_email" title="Customer Email"/>
    <Column id="payment_type" title="Payment Type"/>
    <Column id="status" title="Status"/>
    <Column id="location" title="Location"/>
    <Column id="product_name" title="Product Name"/>
    <Column id="total_billed_amount" title="Total Billed" fmt="usd2"/>
    <Column id="total_deposits" title="Total Deposits" fmt="usd2"/>
    <Column id="total_refunds" title="Total Refunds" fmt="usd2"/>
    <Column id="net_billed_amount" title="Net Billed" fmt="usd2"/>
    <Column id="last_billing_date_est" title="Last Billing Date"/>
    <Column id="initial_purchase_date_est" title="Purchase Date"/>
    <Column id="subscription_id" title="Subscription ID"/>
    <Column id="checkout_session_id" title="Checkout Session ID"/>
</DataTable>

