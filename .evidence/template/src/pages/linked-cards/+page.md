```sql total_linked_cards
SELECT COUNT(*) AS total_linked_cards
FROM maniac_neon_prod.linked_cards lc
JOIN users u ON lc.linked_by = u.id
WHERE u.staff_member = true;
```

```sql linked_cards_by_user
SELECT u.full_name, COUNT(lc.id) AS linked_cards_count
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE lc.created_at >= '2025-01-01'
AND u.staff_member = true
GROUP BY u.full_name
ORDER BY linked_cards_count DESC;
```

```sql linked_cards_by_staff_type_week
-- Get linked cards broken down by staff member, card type, and week
WITH week_data AS (
    SELECT 
        lc.id as linked_card_id,
        lc.created_at,
        lc.linked_by,
        u.full_name as staff_name,
        ic.product_card_id,
        -- Use the 2025 Week 1 id for consistency
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN '7BIQI3YlNrVk'
            ELSE w.id
        END as week_id,
        -- Ensure consistent naming for Week 1 2025
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        -- Ensure consistent sort order
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 1
            WHEN w.id IS NULL THEN 1
            ELSE w.id
        END as week_id_for_sort,
        ct.name as card_tier_name
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    week_name,
    staff_name,
    SUM(CASE WHEN card_tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN card_tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    COUNT(*) AS total_cards
FROM week_data
GROUP BY week_name, staff_name, week_id_for_sort
ORDER BY week_id_for_sort, staff_name;
```

```sql linked_cards_by_day
-- Get linked cards by day with dimensions for DimensionGrid
SELECT 
    u.full_name as staff_name,
    CASE 
        -- Ensure consistent week assignment for 2025 Week 1
        WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
        WHEN w.name IS NULL THEN 'Week 1'
        ELSE w.name
    END as week_name,
    ct.name as card_tier,
    CASE
        WHEN ic.fast_pass = true THEN 'Fast Pass'
        WHEN ic.fast_pass_plus = true THEN 'Fast Pass+'
        ELSE 'No FastPass'
    END as fastpass_type,
    DATE_TRUNC('day', lc.created_at)::date as linked_date,
    COUNT(lc.id) as linked_cards_count
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
LEFT JOIN maniac_neon_prod.weeks w ON 
    lc.created_at::date >= w.start_date_cards AND 
    lc.created_at::date <= w.end_date_cards AND
    -- Exclude the 2025 Week 1 from this join to prevent duplicates
    NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
WHERE u.staff_member = true
GROUP BY staff_name, week_name, card_tier, fastpass_type, linked_date
ORDER BY linked_date DESC
```

```sql linked_cards_daily_trend
-- Get daily trend of linked cards based on dimension selection
WITH linked_data AS (
    SELECT 
        DATE_TRUNC('day', lc.created_at)::date as date,
        u.full_name as staff_name,
        CASE 
            -- Ensure consistent week assignment for 2025 Week 1
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        ct.name as card_tier,
        lc.id as linked_card_id
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    date,
    COUNT(linked_card_id) as linked_cards_count
FROM linked_data
WHERE ${inputs.linked_cards_dimensions}
GROUP BY date
ORDER BY date
```

```sql linked_cards_filtered_total
-- Total linked cards based on dimension selections
WITH linked_data AS (
    SELECT 
        lc.id as linked_card_id,
        u.full_name as staff_name,
        CASE 
            -- Ensure consistent week assignment for 2025 Week 1
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        ct.name as card_tier
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    COUNT(linked_card_id) AS filtered_total
FROM linked_data
WHERE ${inputs.linked_cards_dimensions}
```

```sql linked_cards_filtered_breakdown
-- Breakdown of linked cards by card tier based on dimension selections
WITH linked_data AS (
    SELECT 
        lc.id as linked_card_id,
        u.full_name as staff_name,
        CASE 
            -- Ensure consistent week assignment for 2025 Week 1
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        ct.name as card_tier,
        CASE
            WHEN ic.fast_pass = true THEN 'Fast Pass'
            WHEN ic.fast_pass_plus = true THEN 'Fast Pass+'
            ELSE 'No FastPass'
        END as fastpass_type,
        ic.fast_pass,
        ic.fast_pass_plus
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    SUM(CASE WHEN card_tier = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN card_tier = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    SUM(CASE WHEN fastpass_type = 'Fast Pass' THEN 1 ELSE 0 END) AS fast_pass_cards,
    SUM(CASE WHEN fastpass_type = 'Fast Pass+' THEN 1 ELSE 0 END) AS fast_pass_plus_cards
FROM linked_data
WHERE ${inputs.linked_cards_dimensions}
```

```sql location1_linked_cards
-- Get linked cards for first location (Fort Lauderdale)
SELECT 
    l.name as location_name,
    COUNT(lc.id) as linked_cards_count
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE u.staff_member = true
AND l.name = 'Fort Lauderdale'
GROUP BY location_name;
```

```sql location2_linked_cards
-- Get linked cards for second location (Panama City Beach)
SELECT 
    l.name as location_name,
    COUNT(lc.id) as linked_cards_count
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE u.staff_member = true
AND l.name = 'Panama City Beach'
GROUP BY location_name;
```

```sql linked_cards_by_tier
-- Get linked cards by card tier
SELECT 
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE u.staff_member = true;
```

```sql all_staff_members
-- Get staff members who have linked at least one card for dropdown selection
SELECT 
    u.id as value,
    u.full_name as label,
    COUNT(lc.id) as cards_linked
FROM maniac_neon_prod.users u
JOIN maniac_neon_prod.linked_cards lc ON u.id = lc.linked_by
WHERE u.staff_member = true
GROUP BY u.id, u.full_name
HAVING COUNT(lc.id) > 0
ORDER BY u.full_name;
```

```sql staff_date_filtered_cards
-- Get linked cards filtered by staff and date range
SELECT 
    COUNT(lc.id) AS total_linked_cards,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END) AS fast_pass_cards,
    SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS fast_pass_plus_cards
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE u.staff_member = true
    AND u.id LIKE '${inputs.selected_staff.value}'
    AND lc.created_at >= '${inputs.date_range.start}'::date
    AND lc.created_at <= '${inputs.date_range.end}'::date
```

```sql staff_date_filtered_cards_by_location
-- Get linked cards by location filtered by staff and date range
SELECT 
    l.name as location_name,
    COUNT(lc.id) as linked_cards_count
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE u.staff_member = true
    AND u.id LIKE '${inputs.selected_staff.value}'
    AND lc.created_at >= '${inputs.date_range.start}'::date
    AND lc.created_at <= '${inputs.date_range.end}'::date
GROUP BY location_name
```

```sql staff_date_filtered_cards_by_day
-- Get daily trend of linked cards filtered by staff and date range
SELECT 
    DATE_TRUNC('day', lc.created_at)::date as linked_date,
    COUNT(lc.id) as linked_cards_count,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END) AS fast_pass,
    SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS fast_pass_plus
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE u.staff_member = true
    AND u.id LIKE '${inputs.selected_staff.value}'
    AND lc.created_at >= '${inputs.date_range.start}'::date
    AND lc.created_at <= '${inputs.date_range.end}'::date
GROUP BY linked_date
ORDER BY linked_date;
```

```sql staff_date_filtered_cards_by_week
-- Get linked cards by week filtered by staff and date range
SELECT 
    CASE 
        -- Ensure consistent week assignment for 2025 Week 1
        WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
        WHEN w.name IS NULL THEN 'Week 1'
        ELSE w.name
    END as week_name,
    CASE 
        WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 1
        WHEN w.id IS NULL THEN 1
        ELSE w.id
    END as week_id_for_sort,
    COUNT(lc.id) as linked_cards_count,
    SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END) AS fast_pass,
    SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS fast_pass_plus,
    SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END) + 
    SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS total_fastpass
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
LEFT JOIN maniac_neon_prod.weeks w ON 
    lc.created_at::date >= w.start_date_cards AND 
    lc.created_at::date <= w.end_date_cards AND
    -- Exclude the 2025 Week 1 from this join to prevent duplicates
    NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
WHERE u.staff_member = true
    AND u.id LIKE '${inputs.selected_staff.value}'
    AND lc.created_at >= '${inputs.date_range.start}'::date
    AND lc.created_at <= '${inputs.date_range.end}'::date
GROUP BY week_name, week_id_for_sort
ORDER BY week_id_for_sort;
```

```sql linked_cards_by_week_location
-- Get linked cards broken down by week and location
WITH week_location_data AS (
    SELECT 
        lc.id as linked_card_id,
        lc.created_at,
        -- Use the 2025 Week 1 id for consistency
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN '7BIQI3YlNrVk'
            ELSE w.id
        END as week_id,
        -- Ensure consistent naming for Week 1 2025
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        -- Ensure consistent sort order
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 1
            WHEN w.id IS NULL THEN 1
            ELSE w.id
        END as week_id_for_sort,
        l.name as location_name,
        ct.name as card_tier_name
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    week_name,
    location_name,
    SUM(CASE WHEN card_tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN card_tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    COUNT(*) AS total_cards
FROM week_location_data
GROUP BY week_name, location_name, week_id_for_sort
ORDER BY week_id_for_sort, location_name;
```

```sql linked_cards_by_week_location_fastpass
-- Get linked cards broken down by week, location, and FastPass type
WITH week_location_data AS (
    SELECT 
        lc.id as linked_card_id,
        lc.created_at,
        -- Use the 2025 Week 1 id for consistency
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN '7BIQI3YlNrVk'
            ELSE w.id
        END as week_id,
        -- Ensure consistent naming for Week 1 2025
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        -- Ensure consistent sort order
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 1
            WHEN w.id IS NULL THEN 1
            ELSE w.id
        END as week_id_for_sort,
        l.name as location_name,
        ct.name as card_tier_name,
        ic.fast_pass,
        ic.fast_pass_plus
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    JOIN maniac_neon_prod.locations l ON c.location_id = l.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    week_name,
    location_name,
    SUM(CASE WHEN card_tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN card_tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    SUM(CASE WHEN fast_pass = true THEN 1 ELSE 0 END) AS fast_pass,
    SUM(CASE WHEN fast_pass_plus = true THEN 1 ELSE 0 END) AS fast_pass_plus,
    SUM(CASE WHEN fast_pass = true THEN 1 ELSE 0 END) + 
    SUM(CASE WHEN fast_pass_plus = true THEN 1 ELSE 0 END) AS total_fastpass,
    COUNT(*) AS total_cards
FROM week_location_data
GROUP BY week_name, location_name, week_id_for_sort
ORDER BY week_id_for_sort, location_name;
```

```sql linked_cards_by_staff_type_week_fastpass
-- Get linked cards broken down by staff member, card type, week, and FastPass type
WITH week_data AS (
    SELECT 
        lc.id as linked_card_id,
        lc.created_at,
        lc.linked_by,
        u.full_name as staff_name,
        ic.product_card_id,
        -- Use the 2025 Week 1 id for consistency
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN '7BIQI3YlNrVk'
            ELSE w.id
        END as week_id,
        -- Ensure consistent naming for Week 1 2025
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END as week_name,
        -- Ensure consistent sort order
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 1
            WHEN w.id IS NULL THEN 1
            ELSE w.id
        END as week_id_for_sort,
        ct.name as card_tier_name,
        -- Include FastPass information
        ic.fast_pass,
        ic.fast_pass_plus
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    LEFT JOIN maniac_neon_prod.weeks w ON 
        lc.created_at::date >= w.start_date_cards AND 
        lc.created_at::date <= w.end_date_cards AND
        -- Exclude the 2025 Week 1 from this join to prevent duplicates
        NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
    WHERE u.staff_member = true
)
SELECT 
    week_name,
    staff_name,
    SUM(CASE WHEN card_tier_name = 'Maniac Card' THEN 1 ELSE 0 END) AS regular_cards,
    SUM(CASE WHEN card_tier_name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS vip_cards,
    SUM(CASE WHEN fast_pass = true THEN 1 ELSE 0 END) AS fast_pass,
    SUM(CASE WHEN fast_pass_plus = true THEN 1 ELSE 0 END) AS fast_pass_plus,
    SUM(CASE WHEN fast_pass = true THEN 1 ELSE 0 END) + 
    SUM(CASE WHEN fast_pass_plus = true THEN 1 ELSE 0 END) AS total_fastpass,
    COUNT(*) AS total_cards
FROM week_data
GROUP BY week_name, staff_name, week_id_for_sort
ORDER BY week_id_for_sort, staff_name;
```

```sql linked_cards_fastpass_totals
-- Get summary of FastPass and FastPass Plus linked cards
SELECT 
    SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END) AS fast_pass_cards,
    SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS fast_pass_plus_cards
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE u.staff_member = true;
```

# Linked Card Totals

<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
  <BigValue 
      data={total_linked_cards}
      value="total_linked_cards"
      title="Total Linked Cards"
      fmt="num0"
  />
  
  <BigValue 
      data={linked_cards_by_tier}
      value="regular_cards"
      title="Regular Cards"
      fmt="num0"
  />
  
  <BigValue 
      data={linked_cards_by_tier}
      value="vip_cards"
      title="VIP Cards"
      fmt="num0"
  />
</div>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
  <BigValue 
      data={location1_linked_cards}
      value="linked_cards_count"
      title="Fort Lauderdale"
      fmt="num0"
  />
  
  <BigValue 
      data={location2_linked_cards}
      value="linked_cards_count"
      title="Panama City Beach"
      fmt="num0"
  />
  </div>

  <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
  <BigValue 
      data={linked_cards_fastpass_totals}
      value="fast_pass_cards"
      title="Fast Pass"
      fmt="num0"
  />
  
  <BigValue 
      data={linked_cards_fastpass_totals}
      value="fast_pass_plus_cards"
      title="Fast Pass+"
      fmt="num0"
  />
</div>

<DataTable 
    data={linked_cards_by_week_location}
    rows={50}
    search={false}
    groupBy="week_name"
    groupType="section"
    subtotals=true
    totalRow=true
    wrapTitles=true
    title="Tier Breakdown"
>
    <Column id="week_name" title="Week"/>
    <Column id="location_name" title="Location"/>
    <Column id="regular_cards" title="Regular Cards" fmt="num0" totalAgg="sum"/>
    <Column id="vip_cards" title="VIP Cards" fmt="num0" totalAgg="sum"/>
    <Column id="total_cards" title="Total" fmt="num0" totalAgg="sum" totalFmt="num0 ' cards'"/>
</DataTable>

<DataTable 
    data={linked_cards_by_week_location_fastpass}
    rows={50}
    search={false}
    groupBy="week_name"
    groupType="section"
    subtotals=true
    totalRow=true
    wrapTitles=true
    title="FastPass Breakdown"
>
    <Column id="week_name" title="Week"/>
    <Column id="location_name" title="Location"/>
    <Column id="total_fastpass" title="Total FastPass" fmt="num0" totalAgg="sum" totalFmt="num0 ' passes'"/>
    <Column id="fast_pass" title="Fast Pass" fmt="num0" totalAgg="sum"/>
    <Column id="fast_pass_plus" title="Fast Pass+" fmt="num0" totalAgg="sum"/>
</DataTable>

---

## Interactive Analysis

<Alert status="info">
  <div class="text-sm">Select dimensions below to filter the chart and metrics.</div>
</Alert>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4">

<BigValue 
    data={linked_cards_filtered_total}
    value="filtered_total"
    title="Filtered Linked Cards"
    fmt="num0"
/>

<BigValue 
    data={linked_cards_filtered_breakdown}
    value="regular_cards"
    title="Regular Cards"
    fmt="num0"
/>

<BigValue 
    data={linked_cards_filtered_breakdown}
    value="vip_cards"
    title="VIP Cards"
    fmt="num0"
/>

<BigValue 
    data={linked_cards_filtered_breakdown}
    value="fast_pass_cards"
    title="Fast Pass"
    fmt="num0"
/>

<BigValue 
    data={linked_cards_filtered_breakdown}
    value="fast_pass_plus_cards"
    title="Fast Pass+"
    fmt="num0"
/>

</div>

<LineChart
    data={linked_cards_daily_trend}
    x="date"
    y="linked_cards_count"
    title="Daily Linked Cards Trend"
    subtitle="Filtered by selected dimensions"
    yAxisTitle="Linked Cards"
    xAxisTitle="Date"
    handleMissing="zero"
    labels={true}
    colorPalette={['#7A57C9']}
/>

<DimensionGrid
    data={linked_cards_by_day}
    metric="sum(linked_cards_count)"
    name="linked_cards_dimensions"
    title="Linked Cards Dimensions"
    subtitle="Tap to toggle dimensions by staff member, week, card tier, or FastPass type"
    metricLabel="Linked Cards"
    fmt="num0"
    multiple
/>

```sql card_type_matrix
-- Create a matrix view of card types and FastPass combinations
SELECT
    u.full_name AS staff_member,
    SUM(CASE WHEN ct.name = 'Maniac Card' AND ic.fast_pass = false AND ic.fast_pass_plus = false THEN 1 ELSE 0 END) AS regular_no_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac Card' AND ic.fast_pass = true THEN 1 ELSE 0 END) AS regular_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac Card' AND ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS regular_fastpass_plus,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' AND ic.fast_pass = false AND ic.fast_pass_plus = false THEN 1 ELSE 0 END) AS vip_no_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' AND ic.fast_pass = true THEN 1 ELSE 0 END) AS vip_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' AND ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS vip_fastpass_plus,
    COUNT(*) AS total_cards
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE u.staff_member = true
GROUP BY u.full_name
ORDER BY total_cards DESC;
```

```sql weeks_with_linked_cards
-- Get all weeks that have linked cards for dropdown selection
SELECT DISTINCT
    CASE 
        WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
        WHEN w.name IS NULL THEN 'Week 1'
        ELSE w.name
    END as value,
    CASE 
        WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
        WHEN w.name IS NULL THEN 'Week 1'
        ELSE w.name
    END as label,
    CASE 
        WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 1
        WHEN w.id IS NULL THEN 1
        ELSE w.id
    END as week_id_for_sort
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
LEFT JOIN maniac_neon_prod.weeks w ON 
    lc.created_at::date >= w.start_date_cards AND 
    lc.created_at::date <= w.end_date_cards AND
    -- Exclude the 2025 Week 1 from this join to prevent duplicates
    NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
WHERE u.staff_member = true
ORDER BY week_id_for_sort;
```

```sql card_type_matrix_by_week
-- Create a matrix view of card types and FastPass combinations with week filter
SELECT
    u.full_name AS staff_member,
    SUM(CASE WHEN ct.name = 'Maniac Card' AND ic.fast_pass = false AND ic.fast_pass_plus = false THEN 1 ELSE 0 END) AS regular_no_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac Card' AND ic.fast_pass = true THEN 1 ELSE 0 END) AS regular_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac Card' AND ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS regular_fastpass_plus,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' AND ic.fast_pass = false AND ic.fast_pass_plus = false THEN 1 ELSE 0 END) AS vip_no_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' AND ic.fast_pass = true THEN 1 ELSE 0 END) AS vip_fastpass,
    SUM(CASE WHEN ct.name = 'Maniac VIP Card' AND ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS vip_fastpass_plus,
    COUNT(*) AS total_cards
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
LEFT JOIN maniac_neon_prod.weeks w ON 
    lc.created_at::date >= w.start_date_cards AND 
    lc.created_at::date <= w.end_date_cards AND
    -- Exclude the 2025 Week 1 from this join to prevent duplicates
    NOT (lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07')
WHERE u.staff_member = true
    AND (
        '${inputs.selected_week.value}' = 'All Weeks'
        OR
        CASE 
            WHEN lc.created_at::date >= '2025-03-01' AND lc.created_at::date <= '2025-03-07' THEN 'Week 1'
            WHEN w.name IS NULL THEN 'Week 1'
            ELSE w.name
        END = '${inputs.selected_week.value}'
    )
GROUP BY u.full_name
ORDER BY total_cards DESC;
```

---

## Staff Card Matrix View

<div class="mb-4">
  <Dropdown
    name="selected_week"
    data={weeks_with_linked_cards}
    value="value"
    title="Filter by Week"
  >
    <DropdownOption value="All Weeks" valueLabel="All Weeks"/>
  </Dropdown>
</div>

<DataTable 
    data={card_type_matrix_by_week}
    rows={20}
    search={false}
    totalRow={true}
    wrapTitles=true
>
    <Column id="staff_member" title="Staff Member"/>
    <Column id="total_cards" title="Total Cards" fmt="num0" totalAgg="sum"/>
    <Column id="regular_no_fastpass" title="Regular" colGroup="Maniac Card" fmt="num0" totalAgg="sum"/>
    <Column id="regular_fastpass" title="w/ Fast Pass" colGroup="Maniac Card" fmt="num0" totalAgg="sum"/>
    <Column id="regular_fastpass_plus" title="w/ Fast Pass+" colGroup="Maniac Card" fmt="num0" totalAgg="sum"/>
    <Column id="vip_no_fastpass" title="VIP" colGroup="Maniac VIP" fmt="num0" totalAgg="sum"/>
    <Column id="vip_fastpass" title="w/ Fast Pass" colGroup="Maniac VIP" fmt="num0" totalAgg="sum"/>
    <Column id="vip_fastpass_plus" title="w/ Fast Pass+" colGroup="Maniac VIP" fmt="num0" totalAgg="sum"/>
</DataTable>

---

## Linked by Staff & Week

<DataTable 
    data={linked_cards_by_staff_type_week}
    rows={50}
    search={false}
    groupBy="week_name"
    groupType="section"
    subtotals=true
    totalRow=true
    wrapTitles=true
>
    <Column id="week_name" title="Week"/>
    <Column id="staff_name" title="Staff Member"/>
    <Column id="regular_cards" title="Cards" fmt="num0" totalAgg="sum"/>
    <Column id="vip_cards" title="VIP Cards" fmt="num0" totalAgg="sum"/>
    <Column id="total_cards" title="Total" fmt="num0" totalAgg="sum" totalFmt="num0 ' cards'"/>
</DataTable>

## Linked by Staff & Week FastPass

<DataTable 
    data={linked_cards_by_staff_type_week_fastpass}
    rows={50}
    search={false}
    groupBy="week_name"
    groupType="section"
    subtotals=true
    totalRow=true
    wrapTitles=true
>
    <Column id="week_name" title="Week"/>
    <Column id="staff_name" title="Staff Member"/>
    <Column id="total_fastpass" title="Total FastPass" fmt="num0" totalAgg="sum" totalFmt="num0 ' passes'"/>
    <Column id="fast_pass" title="Fast Pass" fmt="num0" totalAgg="sum"/>
    <Column id="fast_pass_plus" title="Fast Pass+" fmt="num0" totalAgg="sum"/>
</DataTable>

---

# Day Inspector

<Alert status="info">
  <div class="text-sm">Use the filters below to analyze linked cards for a specific staff member and day. Select a staff member and date to see detailed information about card activity on that day.</div>
</Alert>

<div class="py-4"></div>

<div class="flex flex-row items-end md:flex-row gap-4 mb-6">
  <div class="flex flex-roww-full md:w-1/2">
    <Dropdown
      name="selected_staff"
      data={all_staff_members}
      value="value"
      label="label"
      title="Staff Member"
    >
      <DropdownOption value="%" valueLabel="All Staff Members"/>
    </Dropdown>


    <DateInput
      name="selected_day"
      data={available_dates}
      dates="value"
      
    />
  </div>
</div>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <BigValue 
          data={staff_day_filtered_cards}
          value="total_linked_cards"
          title="Total Linked Cards"
          subtitle="On selected day"
          fmt="num0"
      />

      <BigValue 
          data={staff_day_filtered_cards}
          value="regular_cards"
          title="Regular Cards"
          subtitle="On selected day"
          fmt="num0"
      />
    
      <BigValue 
          data={staff_day_filtered_cards}
          value="vip_cards"
          title="VIP Cards"
          subtitle="On selected day"
          fmt="num0"
      />
</div>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      <BigValue 
          data={staff_day_filtered_cards}
          value="fast_pass_cards"
          title="Fast Pass"
          subtitle="On selected day"
          fmt="num0"
      />
    
      <BigValue 
          data={staff_day_filtered_cards}
          value="fast_pass_plus_cards"
          title="Fast Pass+"
          subtitle="On selected day"
          fmt="num0"
      />
</div>

<BarChart
    data={staff_day_inspector_data}
    x="card_type"
    y="card_count"
    title="Cards Linked by Type"
    subtitle="For selected day"
    labels={true}
    colorPalette={['#7A57C9', '#FF6B6B', '#4CAF50', '#FFC107']}
    sort={false}
/>

<DataTable 
    data={staff_day_cards_by_location}
    rows={10}
    title="Linked Cards by Location"
    subtitle="For selected day"
>
    <Column id="location_name" title="Location"/>
    <Column id="linked_cards_count" title="Linked Cards" fmt="num0"/>
</DataTable>

---

<!-- # Staff Report

<Alert status="info">
  <div class="text-sm">Use the filters below to analyze linked cards for a specific staff member and date range. Both filters are optional - leave them blank to see data for all staff members or all dates.</div>
</Alert>

<div class="py-4"></div>

<div class="flex flex-col items-end md:flex-row gap-4 mb-6">
  <div class="w-full md:w-1/2">
    <Dropdown
      name="selected_staff"
      data={all_staff_members}
      value="value"
      label="label"
      title="Select Staff Member"
    >
      <DropdownOption value="%" valueLabel="All Staff Members"/>
    </Dropdown>
  </div>
  
  <div class="w-full md:w-1/2">
    <DateRange
      name="date_range"
      title="Select Date Range"
      defaultValue="All Time"
    />
  </div>
</div>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <BigValue 
          data={staff_date_filtered_cards}
          value="total_linked_cards"
          title="Total Linked Cards"
          subtitle="Based on selection"
          fmt="num0"
      />

      <BigValue 
          data={staff_date_filtered_cards}
          value="regular_cards"
          title="Regular Cards"
          subtitle="Based on selection"
          fmt="num0"
      />
    
      <BigValue 
          data={staff_date_filtered_cards}
          value="vip_cards"
          title="VIP Cards"
          subtitle="Based on selection"
          fmt="num0"
      />
</div>

<div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      <BigValue 
          data={staff_date_filtered_cards}
          value="fast_pass_cards"
          title="Fast Pass"
          subtitle="Based on selection"
          fmt="num0"
      />
    
      <BigValue 
          data={staff_date_filtered_cards}
          value="fast_pass_plus_cards"
          title="Fast Pass+"
          subtitle="Based on selection"
          fmt="num0"
      />
</div>

<LineChart
    data={staff_date_filtered_cards_by_day}
    x="linked_date"
    y={["regular_cards", "vip_cards", "fast_pass", "fast_pass_plus"]}
    seriesLabels={["Regular Cards", "VIP Cards", "Fast Pass", "Fast Pass+"]}
    title="Daily Linked Cards by Type"
    subtitle="Filtered by staff and date range"
    yAxisTitle="Linked Cards"
    xAxisTitle="Date"
    handleMissing="zero"
    labels={true}
    colorPalette={['#7A57C9', '#FF6B6B', '#4CAF50', '#FFC107']}
    stacked={false}
/>

<DataTable 
    data={staff_date_filtered_cards_by_week}
    rows={10}
    title="Card Tiers by Week"
    subtitle="Filtered by staff and date range"
    totalRow={true}
    subtotals={false}
>
    <Column id="week_name" title="Week"/>
    <Column id="linked_cards_count" title="Total Cards" fmt="num0" totalAgg="sum" totalFmt="num0 ' cards'"/>
    <Column id="regular_cards" title="Regular Cards" fmt="num0" totalAgg="sum"/>
    <Column id="vip_cards" title="VIP Cards" fmt="num0" totalAgg="sum"/>
</DataTable>

<DataTable 
    data={staff_date_filtered_cards_by_week}
    rows={10}
    title="FastPass Usage by Week"
    subtitle="Filtered by staff and date range"
    totalRow={true}
    subtotals={false}
>
    <Column id="week_name" title="Week"/>
    <Column id="total_fastpass" title="Total FastPass" fmt="num0" totalAgg="sum" totalFmt="num0 ' passes'"/>
    <Column id="fast_pass" title="Fast Pass" fmt="num0" totalAgg="sum"/>
    <Column id="fast_pass_plus" title="Fast Pass+" fmt="num0" totalAgg="sum"/>
</DataTable>

<DataTable 
    data={staff_date_filtered_cards_by_location}
    rows={10}
    title="Linked Cards by Location"
    subtitle="Filtered by staff and date range"
>
    <Column id="location_name" title="Location"/>
    <Column id="linked_cards_count" title="Linked Cards" fmt="num0"/>
</DataTable> -->

```sql staff_day_inspector_data
-- Get linked cards breakdown for a specific day
WITH card_data AS (
    SELECT 
        'Regular Cards' as card_type,
        1 as sort_order,
        SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END) AS card_count
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE u.staff_member = true
        AND u.id LIKE '${inputs.selected_staff.value}'
        AND DATE_TRUNC('day', lc.created_at)::date = '${inputs.selected_day.value}'::date

    UNION ALL

    SELECT 
        'VIP Cards' as card_type,
        2 as sort_order,
        SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END) AS card_count
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
    JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
    WHERE u.staff_member = true
        AND u.id LIKE '${inputs.selected_staff.value}'
        AND DATE_TRUNC('day', lc.created_at)::date = '${inputs.selected_day.value}'::date

    UNION ALL

    SELECT 
        'Fast Pass' as card_type,
        3 as sort_order,
        SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END) AS card_count
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    WHERE u.staff_member = true
        AND u.id LIKE '${inputs.selected_staff.value}'
        AND DATE_TRUNC('day', lc.created_at)::date = '${inputs.selected_day.value}'::date

    UNION ALL

    SELECT 
        'Fast Pass+' as card_type,
        4 as sort_order,
        SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END) AS card_count
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
    WHERE u.staff_member = true
        AND u.id LIKE '${inputs.selected_staff.value}'
        AND DATE_TRUNC('day', lc.created_at)::date = '${inputs.selected_day.value}'::date
)
SELECT 
    card_type,
    card_count
FROM card_data
ORDER BY sort_order
```

```sql available_dates
-- Get all dates with linked cards for the date picker
WITH available_dates AS (
    SELECT DISTINCT
        DATE_TRUNC('day', lc.created_at)::date as value,
        strftime(DATE_TRUNC('day', lc.created_at)::date, '%B %d, %Y') as label
    FROM maniac_neon_prod.linked_cards lc
    JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
    WHERE u.staff_member = true
        AND u.id LIKE '${inputs.selected_staff.value}'
)
SELECT 
    value,
    label
FROM available_dates
WHERE value IS NOT NULL

UNION ALL

-- Add a default date if no records match
SELECT 
    CURRENT_DATE as value,
    strftime(CURRENT_DATE, '%B %d, %Y') as label
WHERE NOT EXISTS (
    SELECT 1 FROM available_dates
)

ORDER BY value DESC
```

```sql staff_day_filtered_cards
-- Get linked cards summary for the selected day
SELECT 
    COALESCE(COUNT(lc.id), 0) AS total_linked_cards,
    COALESCE(SUM(CASE WHEN ct.name = 'Maniac Card' THEN 1 ELSE 0 END), 0) AS regular_cards,
    COALESCE(SUM(CASE WHEN ct.name = 'Maniac VIP Card' THEN 1 ELSE 0 END), 0) AS vip_cards,
    COALESCE(SUM(CASE WHEN ic.fast_pass = true THEN 1 ELSE 0 END), 0) AS fast_pass_cards,
    COALESCE(SUM(CASE WHEN ic.fast_pass_plus = true THEN 1 ELSE 0 END), 0) AS fast_pass_plus_cards
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.card_tiers ct ON c.card_tier_id = ct.id
WHERE u.staff_member = true
    AND u.id LIKE '${inputs.selected_staff.value}'
    AND (
        '${inputs.selected_day.value}' IS NULL
        OR DATE_TRUNC('day', lc.created_at)::date = '${inputs.selected_day.value}'::date
    )
```

```sql staff_day_cards_by_location
-- Get linked cards by location for the selected day
SELECT 
    l.name as location_name,
    COUNT(lc.id) as linked_cards_count
FROM maniac_neon_prod.linked_cards lc
JOIN maniac_neon_prod.issued_cards ic ON lc.issued_card_id = ic.id
JOIN maniac_neon_prod.cards c ON ic.product_card_id = c.id
JOIN maniac_neon_prod.locations l ON c.location_id = l.id
JOIN maniac_neon_prod.users u ON lc.linked_by = u.id
WHERE u.staff_member = true
    AND u.id LIKE '${inputs.selected_staff.value}'
    AND (
        '${inputs.selected_day.value}' IS NULL
        OR DATE_TRUNC('day', lc.created_at)::date = '${inputs.selected_day.value}'::date
    )
GROUP BY location_name
ORDER BY linked_cards_count DESC
```
