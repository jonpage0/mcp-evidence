SELECT 
    id,
    created_at,
    updated_at,
    scan_type,
    is_entry,
    timestamp,
    staff_user_id,
    venue_id,
    session_id,
    latitude,
    longitude,
    scan_result,
    scan_data,
    issued_card_id,
    issued_ticket_id,
    ticket_tailor_issued_ticket_id
FROM scans;