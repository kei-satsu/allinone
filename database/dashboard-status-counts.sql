CREATE OR REPLACE FUNCTION public.get_dashboard_status_counts(p_branch text DEFAULT NULL)
RETURNS TABLE(status text, order_count bigint)
LANGUAGE sql
STABLE
AS $function$
  SELECT o.status, COUNT(*) AS order_count
  FROM public.orders AS o
  WHERE o.is_deleted IS DISTINCT FROM TRUE
    AND o.status IN (
      'Handover',
      'On Way',
      'Delivered',
      'At Office',
      'Arrived',
      'On Hold',
      'Settled'
    )
    AND (
      NULLIF(BTRIM(p_branch), '') IS NULL
      OR BTRIM(p_branch) = 'ALL'
      OR o.branch = BTRIM(p_branch)
      OR (
        SELECT transit_leg.value ->> 'transit_to'
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(o.transit) = 'array' THEN o.transit
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS transit_leg(value, array_index)
        WHERE NULLIF(transit_leg.value ->> 'transit_date', '') IS NOT NULL
        ORDER BY transit_leg.value ->> 'transit_date' DESC, transit_leg.array_index DESC
        LIMIT 1
      ) = BTRIM(p_branch)
    )
  GROUP BY o.status;
$function$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.get_dashboard_status_orders(
  p_branch text,
  p_status text,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  WITH matched AS MATERIALIZED (
    SELECT o.id, o.created_at, o.status, o.branch,
      last_leg.transit_to, last_leg.transit_date
    FROM public.orders AS o
    LEFT JOIN LATERAL (
      SELECT leg.value ->> 'transit_to' AS transit_to,
        leg.value ->> 'transit_date' AS transit_date
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(o.transit) = 'array' THEN o.transit
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS leg(value, array_index)
      WHERE NULLIF(leg.value ->> 'transit_date', '') IS NOT NULL
      ORDER BY leg.value ->> 'transit_date' DESC, leg.array_index DESC
      LIMIT 1
    ) AS last_leg ON TRUE
    WHERE o.is_deleted IS DISTINCT FROM TRUE
      AND o.status = p_status
      AND p_status IN (
        'Handover',
        'On Way',
        'Delivered',
        'At Office',
        'Arrived',
        'On Hold',
        'Settled'
      )
      AND (
        NULLIF(BTRIM(p_branch), '') IS NULL
        OR BTRIM(p_branch) = 'ALL'
        OR o.branch = BTRIM(p_branch)
        OR last_leg.transit_to = BTRIM(p_branch)
      )
  ),
  page_ids AS (
    SELECT id, created_at
    FROM matched
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
    OFFSET (GREATEST(COALESCE(p_page, 1), 1)::bigint - 1)
      * LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  ),
  page_data AS (
    SELECT jsonb_build_object(
      'id', o.id,
      'image_url', o.image_url,
      'item_id', o.item_id,
      'received_date', o.received_date,
      'branch', o.branch,
      'sender_name', o.sender_name,
      'sender_loc', o.sender_loc,
      'receiver_name', o.receiver_name,
      'receiver_phone', o.receiver_phone,
      'receiver_address', o.receiver_address,
      'receiver_loc', o.receiver_loc,
      'fee_type', o.fee_type,
      'status', o.status,
      'cod_amount', o.cod_amount,
      'deli_fee', o.deli_fee,
      'total_amount', o.total_amount,
      'pickup_rider', CASE
        WHEN pickup_rider.id IS NULL THEN NULL
        ELSE jsonb_build_object('name', pickup_rider.name)
      END,
      'deliver_rider', CASE
        WHEN deliver_rider.id IS NULL THEN NULL
        ELSE jsonb_build_object('name', deliver_rider.name)
      END,
      'deliver_date', o.deliver_date,
      'cleared_date', o.cleared_date,
      'refund_date', o.refund_date,
      'note', o.note,
      'created_at', o.created_at,
      'transit_to', matched.transit_to,
      'transit_date', matched.transit_date,
      'agent_fee', o.agent_fee,
      'remark', o.remark,
      'barcode', o.barcode,
      'last_check', o.last_check
    ) AS order_data, page_ids.created_at, page_ids.id
    FROM page_ids
    JOIN public.orders AS o ON o.id = page_ids.id
    JOIN matched ON matched.id = page_ids.id
    LEFT JOIN public.riders AS pickup_rider ON pickup_rider.id = o.pickup_rider_id
    LEFT JOIN public.riders AS deliver_rider ON deliver_rider.id = o.deliver_rider_id
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (SELECT jsonb_agg(order_data ORDER BY created_at DESC NULLS LAST, id DESC) FROM page_data),
      '[]'::jsonb
    ),
    'total', (SELECT COUNT(*) FROM matched)
  );
$function$;

NOTIFY pgrst, 'reload schema';
