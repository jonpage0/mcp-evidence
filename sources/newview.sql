CREATE OR REPLACE VIEW "maniac"."checkout_sessions_expanded" AS  SELECT cs.id,
    cs.url,
    cs.mode,
    cs.locale,
    cs.object,
    cs.status,
    cs.consent,
    cs.created,
    cs.invoice,
    cs.ui_mode,
    cs.currency,
    cs.customer,
    cs.livemode,
    cs.cancel_url,
    cs.expires_at,
    cs.success_url,
    cs.payment_intent,
    cs.amount_total,
    (cs.metadata ->> 'tax'::text)::numeric AS m_tax,
    cs.metadata ->> 'name'::text AS m_name,
    cs.metadata ->> 'tier'::text AS m_tier,
    cs.metadata ->> 'type'::text AS m_type,
    cs.metadata ->> 'week'::text AS m_week,
    cs.metadata ->> 'email'::text AS m_email,
    cs.metadata ->> 'phone'::text AS m_phone,
    cs.metadata ->> 'group_code'::text AS m_group_code,
    cs.metadata ->> 'group_name'::text AS m_group_name,
    (cs.metadata ->> 'price'::text)::numeric AS m_price,
    (cs.metadata ->> 'locked'::text)::boolean AS m_locked,
    (cs.metadata ->> 'upgrade'::text)::numeric AS m_upgrade,
    (cs.metadata ->> 'discount'::text)::numeric AS m_discount,
    cs.metadata ->> 'location'::text AS m_location,
    (cs.metadata ->> 'subtotal'::text)::numeric AS m_subtotal,
    cs.metadata ->> 'last_name'::text AS m_last_name,
    (cs.metadata ->> 'totalFees'::text)::numeric AS m_total_fees,
    (cs.metadata ->> 'feeBooking'::text)::numeric AS m_fee_booking,
    cs.metadata ->> 'first_name'::text AS m_first_name,
    cs.metadata ->> 'product_id'::text AS m_product_id,
    cs.metadata ->> 'description'::text AS m_description,
    cs.metadata ->> 'distinct_id'::text AS m_distinct_id,
    (cs.metadata ->> 'feeProcessing'::text)::numeric AS m_fee_processing,
    cs.metadata ->> 'paymentMethod'::text AS m_payment_method,
    (cs.metadata ->> 'totalAfterTax'::text)::numeric AS m_total_after_tax,
    (cs.metadata ->> 'feePaymentPlan'::text)::numeric AS m_fee_payment_plan,
    cs.metadata ->> 'payment_method'::text AS m_payment_method_legacy,
    cs.metadata ->> 'tier_formatted'::text AS m_tier_formatted,
    (cs.metadata ->> 'totalBeforeTax'::text)::numeric AS m_total_before_tax,
    cs.metadata ->> 'week_formatted'::text AS m_week_formatted,
    cs.metadata ->> 'location_formatted'::text AS m_location_formatted,
    (cs.metadata ->> 'subtotalDiscounted'::text)::numeric AS m_subtotal_discounted,
    (cs.metadata ->> 'remainder'::text)::numeric AS m_remainder,
    cs.metadata ->> 'payment_interval'::text AS m_payment_interval,
    (cs.metadata ->> 'payment_interval_count'::text)::numeric AS m_payment_interval_count,
    (cs.metadata ->> 'payment_number_of_installments'::text)::numeric AS m_payment_number_of_installments,
    (cs.metadata ->> 'payment_installment_tax'::text)::numeric AS m_payment_installment_tax,
    (cs.metadata ->> 'total_after_tax_first_installment'::text)::numeric AS m_total_after_tax_first_installment,
    (cs.metadata ->> 'total_before_tax_first_installment'::text)::numeric AS m_total_before_tax_first_installment,
    (cs.metadata ->> 'payment_installment_amount_after_tax'::text)::numeric AS m_payment_installment_amount_after_tax,
    (cs.metadata ->> 'payment_installment_amount_before_tax'::text)::numeric AS m_payment_installment_amount_before_tax,
    cs.metadata ->> 'referral'::text AS m_referral,
    cs.metadata ->> 'upgrade_type'::text AS m_upgrade_type,
    (cs.metadata ->> 'upgrade'::text)::numeric AS m_upgrade_price,
    cs.customer_details ->> 'name'::text AS m_customer_name,
    cs.customer_details ->> 'email'::text AS m_customer_email,
    (cs.customer_details -> 'address'::text) ->> 'country'::text AS m_customer_country,
    (cs.customer_details -> 'address'::text) ->> 'postal_code'::text AS m_customer_postal_code,
    COALESCE((cs.metadata ->> 'totalAfterTax'::text)::numeric, (cs.metadata ->> 'total_pay_now'::text)::numeric) AS m_c_total_after_tax,
    COALESCE((cs.metadata ->> 'tax'::text)::numeric, (cs.metadata ->> 'tax_pay_now'::text)::numeric) AS m_c_tax,
    COALESCE((cs.metadata ->> 'feePaymentPlan'::text)::numeric, (cs.metadata ->> 'payment_plan_fee'::text)::numeric) AS m_c_fee_payment_plan,
    COALESCE((cs.metadata ->> 'totalFees'::text)::numeric, (cs.metadata ->> 'processing_fee'::text)::numeric) AS m_c_total_fees,
    COALESCE((cs.metadata ->> 'price'::text)::numeric, (cs.metadata ->> 'unit_amount'::text)::numeric) AS m_c_price,
    COALESCE((cs.metadata ->> 'payment_installment_amount_before_tax'::text)::numeric, (cs.metadata ->> 'price_per_installment'::text)::numeric) AS m_c_payment_installment_amount_before_tax,
    COALESCE((cs.metadata ->> 'payment_installment_amount_after_tax'::text)::numeric, (cs.metadata ->> 'price_per_installment_with_tax'::text)::numeric) AS m_c_payment_installment_amount_after_tax,
    COALESCE((cs.metadata ->> 'totalAfterTax'::text)::numeric, (cs.metadata ->> 'amount_due_today'::text)::numeric) AS m_c_amount_due_today,
    r.status AS refund_status,
    d.status AS dispute_status,
    (cs.metadata ->> 'total_after_tax'::text)::numeric AS sub_total_after_tax,
    (cs.metadata ->> 'fee_booking'::text)::numeric AS sub_fee_booking,
    (cs.metadata ->> 'fee_processing'::text)::numeric AS sub_fee_processing,
    (cs.metadata ->> 'fee_payment_plan'::text)::numeric AS sub_fee_payment_plan,
    (cs.metadata ->> 'application_fee'::text)::numeric AS sub_fee_application,
    (cs.metadata ->> 'total_fees'::text)::numeric AS sub_fee_total,
    (cs.metadata ->> 'tax'::text)::numeric AS sub_tax,


    /* NEW */

    cs.metadata ->> 'referral'::text AS "2025_referral",

    cs.metadata ->> 'type'::text AS "2025_type",

    /* Tier fields - directly use metadata values without falling back to original tier for upgrades */
    cs.metadata ->> 'tier'::text AS "2025_tier",
    cs.metadata ->> 'tier_formatted'::text AS "2025_tier_formatted",

    /* Week fields with lookup for upgrades */
    COALESCE(
        cs.metadata ->> 'week'::text, 
        CASE WHEN cs.metadata ->> 'type'::text = 'card-upgrade' THEN o.original_week ELSE NULL END
    ) AS "2025_week",

    COALESCE(
        cs.metadata ->> 'week_formatted'::text, 
        CASE WHEN cs.metadata ->> 'type'::text = 'card-upgrade' THEN o.original_week_formatted ELSE NULL END
    ) AS "2025_week_formatted",

    /* Coalesced location fields that handle card upgrades */
    COALESCE(
        cs.metadata ->> 'location'::text, 
        CASE WHEN cs.metadata ->> 'type'::text = 'card-upgrade' THEN o.original_location ELSE NULL END
    ) AS "2025_location",
    
    COALESCE(
        cs.metadata ->> 'location_formatted'::text, 
        CASE WHEN cs.metadata ->> 'type'::text = 'card-upgrade' THEN o.original_location_formatted ELSE NULL END
    ) AS "2025_location_formatted",

    COALESCE((cs.metadata ->> 'price'::text)::numeric, (cs.metadata ->> 'unit_amount'::text)::numeric) AS "2025_price",

    (cs.metadata ->> 'upgrade'::text)::numeric AS "2025_upgrade_price",
    cs.metadata ->> 'upgrade_type'::text AS "2025_upgrade_type",

    COALESCE((cs.metadata ->> 'tax'::text)::numeric, (cs.metadata ->> 'tax_pay_now'::text)::numeric) AS "2025_tax",
    COALESCE((cs.metadata ->> 'feeBooking'::text)::numeric, (cs.metadata ->> 'fee_booking'::text)::numeric) AS "2025_fee_booking",
    COALESCE((cs.metadata ->> 'feeProcessing'::text)::numeric, (cs.metadata ->> 'fee_processing'::text)::numeric) AS "2025_fee_processing",
    COALESCE((cs.metadata ->> 'feePaymentPlan'::text)::numeric, (cs.metadata ->> 'payment_plan_fee'::text)::numeric, (cs.metadata ->> 'fee_payment_plan'::text)::numeric) AS "2025_fee_payment_plan",
    ROUND(COALESCE(NULLIF(TRIM(cs.metadata ->> 'application_fee'::text), '')::numeric, 0), 2) AS "2025_fee_application",
    
    /* Total Fees COALESCED */
    (
    /* Booking fees */
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'feeBooking'::text), '')::numeric, 0) +
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'booking_fee'::text), '')::numeric, 0) +
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'fee_booking'::text), '')::numeric, 0) +
    
    /* Processing fees */
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'feeProcessing'::text), '')::numeric, 0) +
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'processing_fee'::text), '')::numeric, 0) +
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'fee_processing'::text), '')::numeric, 0) +
    
    /* Payment plan fees */
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'feePaymentPlan'::text), '')::numeric, 0) +
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'payment_plan_fee'::text), '')::numeric, 0) +
    COALESCE(NULLIF(TRIM(cs.metadata ->> 'fee_payment_plan'::text), '')::numeric, 0) 
    
    ) AS "2025_total_fees",

    /* Total */
    cs.amount_total AS "2025_stripe_total"


   FROM checkout_sessions cs
     LEFT JOIN refunds r ON cs.payment_intent::text = r.payment_intent::text
     LEFT JOIN disputes d ON cs.payment_intent::text = d.payment_intent::text
     LEFT JOIN original_card_locations o ON LOWER(cs.customer_details ->> 'email'::text) = o.customer_email_lower;