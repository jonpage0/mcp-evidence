WITH exploded_line_items AS (
  SELECT
    -- Basic order info
    o.id AS order_id,
    o.created_at,
    (o.total::float / 100) AS order_total,      -- Full order total from Ticket Tailor
    (o.subtotal::float / 100) AS order_subtotal,
    (o.tax::float / 100) AS order_tax,
    o.status,

    -- Event data from the order's JSON
    o.event_summary->>'name' AS raw_event_name,
    CASE
      WHEN o.event_summary->'venue'->>'name' LIKE '%Harpoon Harry%'
      THEN 'Harpoon Harry''s'
      ELSE o.event_summary->'venue'->>'name'
    END AS raw_venue_name,
    o.event_summary->>'event_id' AS raw_event_id,
    o.event_summary->>'event_series_id' AS raw_event_series_id,
    
    -- We can also grab the numeric "start_date->>'unix'" for accurate timestamps
    (o.event_summary->'start_date'->>'unix')::numeric AS raw_event_start_unix,

    -- Buyer details
    o.buyer_details->>'email'       AS customer_email,
    o.buyer_details->>'first_name'  AS customer_first_name,
    o.buyer_details->>'last_name'   AS customer_last_name,
    o.buyer_details->>'phone'       AS customer_phone,

    -- Explode line items
    li.item->>'type' AS line_type,
    (li.item->>'quantity')::int             AS line_qty,
    ((li.item->>'total')::float / 100)      AS line_total,
    ((li.item->>'booking_fee')::float / 100) AS line_booking_fee,
    li.item->>'description'                 AS line_description

  FROM maniac.tt_2024_orders o
       -- Expand all line items, not just 'ticket' lines
       JOIN LATERAL jsonb_array_elements(o.line_items) li(item) ON true
  WHERE
    o.created_at <= 1712707200
    AND o.created_at >= 1706745600
    AND o.status = 'completed'
    AND (o.event_summary->>'name' NOT LIKE '%Harry''s High Tea%')   -- Exclude certain event name
),

/* 
   Aggregate by order_id. 
   We'll sum up line items by type, so we keep 
   - total_tickets
   - tickets_subtotal
   - booking_fees
   - transaction_charge
   - line_tax
   while preserving the original order-level tax & total. 
*/
aggregated_orders AS (
  SELECT
    order_id,
    created_at,
    order_total,
    order_subtotal,
    order_tax,
    status,

    raw_event_name,
    raw_venue_name,
    raw_event_id,
    raw_event_series_id,
    raw_event_start_unix,

    customer_email,
    customer_first_name,
    customer_last_name,
    customer_phone,

    -- Sum up TICKETS
    SUM(
      CASE WHEN line_type = 'ticket'
           THEN line_qty
           ELSE 0
      END
    ) AS total_tickets,

    SUM(
      CASE WHEN line_type = 'ticket'
           THEN line_total
           ELSE 0
      END
    ) AS tickets_subtotal,

    SUM(
      CASE WHEN line_type = 'ticket'
           THEN line_booking_fee
           ELSE 0
      END
    ) AS booking_fees,

    -- Sum up TRANSACTION CHARGES
    SUM(
      CASE WHEN line_type = 'transaction_charge'
           THEN line_total
           ELSE 0
      END
    ) AS transaction_charge,

    -- Sum up line-item TAX
    SUM(
      CASE WHEN line_type = 'tax'
           THEN line_total
           ELSE 0
      END
    ) AS line_tax,

    -- Concatenate the description only for 'ticket' lines
    STRING_AGG(
      CASE WHEN line_type = 'ticket' THEN line_description END,
      ', '
      ORDER BY line_description
    ) AS ticket_types

  FROM exploded_line_items
  GROUP BY
    order_id, created_at,
    order_total, order_subtotal, order_tax,
    status,
    raw_event_name,
    raw_venue_name,
    raw_event_id,
    raw_event_series_id,
    raw_event_start_unix,
    customer_email,
    customer_first_name,
    customer_last_name,
    customer_phone
),

/* Pull event-level metadata from tt_2024_Events and tt_2024_Events_Series */
event_details AS (
  SELECT
    e.id AS event_id,
    e.event_series_id,
    es.name AS series_name,
    CASE
      WHEN es.venue->>'name' LIKE '%Harpoon Harry%'
      THEN 'Harpoon Harry''s'
      ELSE es.venue->>'name'
    END AS venue_name,
    e.total_issued_tickets,
    e.tickets_available,
    es.name AS event_name,
    (e.start->>'unix')::numeric AS event_start_unix
  FROM maniac.tt_2024_events e
  LEFT JOIN maniac.tt_2024_events_series es 
         ON e.event_series_id = es.id
  WHERE
    (e.start->>'unix')::numeric <= 1712707200
    AND (e.start->>'unix')::numeric >= 1706745600
    AND es.name NOT LIKE '%Harry''s High Tea%'
),

/* Count how many tickets exist and how many are checked in (from Issued Tickets) */
ticket_counts AS (
  SELECT
    it.event_id,
    COUNT(*)::int AS tickets_sold,
    COUNT(*) FILTER (WHERE it.checked_in = 'true')::int AS tickets_checked_in
  FROM maniac.tt_2024_issued_tickets it
  GROUP BY it.event_id
)

/* 
   Final SELECT:

   - Join event_details to aggregated_orders by event_id
   - Bring in check-in stats from ticket_counts 
   - Coalesce to handle missing data 
*/
SELECT
  /* Add CASE statement to simplify recurring event names */
  CASE 
    WHEN COALESCE(ao.raw_event_name, ed.event_name) LIKE '%Hammerhead Fred''s Foam Party Spring Break%' 
      THEN 'HH Fred''s Foam Party'
    WHEN COALESCE(ao.raw_event_name, ed.event_name) LIKE '%Hammerhead Fred''s Paint Party Spring Break%'
      THEN 'HH Fred''s Paint Party'
    WHEN COALESCE(ao.raw_event_name, ed.event_name) LIKE '%Harpoon Harry''s Spring Break Foam Party%'
      THEN 'Harry''s Foam Party'
    WHEN COALESCE(ao.raw_event_name, ed.event_name) LIKE '%Charly Jordon%'
      THEN 'Charly Jordon @ Rock Bar Day Club'
    WHEN COALESCE(ao.raw_event_name, ed.event_name) LIKE '%NFT presents The Spring Break Pool Party @ Rock Bar Day Club%'
      THEN 'NFT SB Pool Party @ Rock Bar Day Club'
    WHEN COALESCE(ao.raw_event_name, ed.event_name) LIKE '%University of Tampa Spring Break Takeover @ Rock Bar Day Club%'
      THEN 'UT SB Takeover @ Rock Bar Day Club'
    ELSE COALESCE(ao.raw_event_name, ed.event_name)
  END AS event_name,
  COALESCE(ao.raw_venue_name, ed.venue_name) AS venue_name,
  ao.order_id,

  /* Turn venue into a location category if desired */
  CASE
    WHEN COALESCE(ao.raw_venue_name, ed.venue_name) IN ('Backyard / Revolution','Rock Bar')
      THEN 'Fort Lauderdale'
    WHEN COALESCE(ao.raw_venue_name, ed.venue_name) IN ('Harpoon Harry''s','Hammerhead Freds')
      THEN 'Panama City Beach'
    WHEN COALESCE(ao.raw_venue_name, ed.venue_name) = 'Clayton''s'
      THEN 'South Padre Island'
  END AS location,

  /* Use the best available event_start_unix to build an actual timestamp */
  TO_TIMESTAMP(
    COALESCE(ao.raw_event_start_unix, ed.event_start_unix)::bigint
  ) AS event_start,

  /* Prefer the order's event_id if present, else from event_details */
  COALESCE(ao.raw_event_id, ed.event_id) AS event_id,
  COALESCE(ao.raw_event_series_id, ed.event_series_id) AS event_series_id,

  ed.series_name,
  ed.total_issued_tickets,
  ed.tickets_available,

  COALESCE(tc.tickets_sold, 0)         AS tickets_sold,
  COALESCE(tc.tickets_checked_in, 0)   AS tickets_checked_in,

  /* Aggregated line-item sums from the orders table */
  COALESCE(ao.total_tickets, 0)        AS total_tickets,
  COALESCE(ao.tickets_subtotal, 0)     AS tickets_subtotal,
  COALESCE(ao.booking_fees, 0)         AS booking_fees,
  COALESCE(ao.transaction_charge, 0)   AS transaction_charge,
  COALESCE(ao.line_tax, 0)            AS line_tax,

  /* Original order-level totals from Ticket Tailor */
  ao.order_total,
  ao.order_subtotal,
  ao.order_tax,

  /* Tickets text plus buyer info */
  ao.ticket_types,
  ao.customer_email,
  ao.customer_first_name,
  ao.customer_last_name,
  ao.customer_phone,
  ao.created_at,
  ao.status

FROM event_details ed
LEFT JOIN aggregated_orders ao
       ON ed.event_id = ao.raw_event_id
LEFT JOIN ticket_counts tc
       ON ed.event_id = tc.event_id
ORDER BY 
  TO_TIMESTAMP(
    COALESCE(ao.raw_event_start_unix, ed.event_start_unix)::bigint
  ) DESC;
