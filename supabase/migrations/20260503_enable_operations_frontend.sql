-- =============================================================================
-- enable_operations_frontend.sql  (applied 2026-05-03)
-- =============================================================================
-- Creates fn_user_is_tenant_member() and frontend RLS policies for:
-- contacts, contact_channels, conversations, messages,
-- orders, order_items, order_status_history, audit_logs
-- Pattern: auth.uid() + tenant_users membership (additive to backend policies)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_user_is_tenant_member(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = p_tenant_id AND tu.user_id = auth.uid() AND tu.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.fn_user_is_tenant_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_user_is_tenant_member(uuid) TO authenticated;

-- contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_frontend_select ON public.contacts;
CREATE POLICY contacts_frontend_select ON public.contacts FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));
DROP POLICY IF EXISTS contacts_frontend_insert ON public.contacts;
CREATE POLICY contacts_frontend_insert ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.fn_user_is_tenant_member(tenant_id));
DROP POLICY IF EXISTS contacts_frontend_update ON public.contacts;
CREATE POLICY contacts_frontend_update ON public.contacts FOR UPDATE TO authenticated USING (public.fn_user_is_tenant_member(tenant_id)) WITH CHECK (public.fn_user_is_tenant_member(tenant_id));

-- contact_channels
ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_channels_frontend_select ON public.contact_channels;
CREATE POLICY contact_channels_frontend_select ON public.contact_channels FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));
DROP POLICY IF EXISTS contact_channels_frontend_insert ON public.contact_channels;
CREATE POLICY contact_channels_frontend_insert ON public.contact_channels FOR INSERT TO authenticated WITH CHECK (public.fn_user_is_tenant_member(tenant_id));
DROP POLICY IF EXISTS contact_channels_frontend_update ON public.contact_channels;
CREATE POLICY contact_channels_frontend_update ON public.contact_channels FOR UPDATE TO authenticated USING (public.fn_user_is_tenant_member(tenant_id)) WITH CHECK (public.fn_user_is_tenant_member(tenant_id));

-- conversations (read-only)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conversations_frontend_select ON public.conversations;
CREATE POLICY conversations_frontend_select ON public.conversations FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));

-- messages (read-only)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_frontend_select ON public.messages;
CREATE POLICY messages_frontend_select ON public.messages FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));

-- orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_frontend_select ON public.orders;
CREATE POLICY orders_frontend_select ON public.orders FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));
DROP POLICY IF EXISTS orders_frontend_update ON public.orders;
CREATE POLICY orders_frontend_update ON public.orders FOR UPDATE TO authenticated USING (public.fn_user_is_tenant_member(tenant_id)) WITH CHECK (public.fn_user_is_tenant_member(tenant_id));

-- order_items (read-only)
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_items_frontend_select ON public.order_items;
CREATE POLICY order_items_frontend_select ON public.order_items FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));

-- order_status_history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_status_history_frontend_select ON public.order_status_history;
CREATE POLICY order_status_history_frontend_select ON public.order_status_history FOR SELECT TO authenticated USING (public.fn_user_is_tenant_member(tenant_id));
DROP POLICY IF EXISTS order_status_history_frontend_insert ON public.order_status_history;
CREATE POLICY order_status_history_frontend_insert ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (public.fn_user_is_tenant_member(tenant_id));

-- audit_logs (insert only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_frontend_insert ON public.audit_logs;
CREATE POLICY audit_logs_frontend_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.fn_user_is_tenant_member(tenant_id));
