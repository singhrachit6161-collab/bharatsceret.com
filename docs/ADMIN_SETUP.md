# Admin account provisioning

Roles live in the protected `public.user_roles` table. They are **never** read from user metadata or anything the client sends. No user can grant themselves a role: the table has no insert/update policies for clients. The first registered customer is **not** promoted automatically.

| Role | Access |
|---|---|
| `owner` | Everything (same as admin). Intended for the business owner. |
| `admin` | Catalogue, prices, coupons, homepage, settings, refunds, COD collection, newsletter export, audit log. |
| `operations` | Dashboard, orders (fulfilment, shipments, cancellation, return restock), inventory adjustments, customers, reviews, support. No prices, refunds or settings. |

## Bootstrap the first owner

1. Register normally on the site (`/register`) using the owner's email. Confirm the email if confirmations are enabled.
2. In the Supabase Dashboard → SQL editor (this runs as a privileged role), run:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner' from auth.users where email = 'owner@yourdomain.in'
on conflict do nothing;
```

3. Sign out and back in, then open `/admin`.

## Adding / removing staff

Use the same SQL with `'admin'` or `'operations'`. To revoke access:

```sql
delete from public.user_roles
where user_id = (select id from auth.users where email = 'person@yourdomain.in');
```

After changing roles, record the change in `audit_logs`:

```sql
insert into public.audit_logs (action, entity_type, entity_id, details)
values ('role.grant', 'user', '<user id>', '{"role":"operations","by":"owner"}');
```

Enable MFA for staff accounts in Supabase Auth if your plan supports it.
