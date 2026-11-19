-- Stock receipt and fulfilment RPCs run with the caller's privileges.
-- Their callers already have the required table grants and tenant/role RLS policies.
-- This avoids SECURITY DEFINER bypass of RLS for client-invoked functions.
alter function public.receive_stock_purchase_order_item(bigint, numeric, bigint) security invoker;
alter function public.fulfil_stock_student_order_item(bigint, bigint) security invoker;
