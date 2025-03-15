SELECT 
    id,
    created_at,
    updated_at,
    product_card_id,
    clerk_user_id,
    issued_card_status_id,
    stripe_checkout_session_id,
    stripe_checkout_session,
    stripe_subscription,
    stripe_schedule,
    passkit_installed,
    fast_pass,
    fast_pass_plus,
    god_mode
FROM issued_cards;