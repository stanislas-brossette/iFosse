-- Read-only diagnostics for ifosse-staging. No Vault, recipients, message
-- bodies, credentials, provider responses or mutations. Single result table.
begin read only;
with checks as (
 select 'configuration'::text as category, 'account_email'::text as object_name,
   jsonb_build_object('enabled',enabled,'environment',environment,'project_ref',project_ref,
     'recipient_mode',staging_recipient_mode,'allowlist_count',cardinality(staging_recipients)) as details
 from public.member_notification_settings where singleton
 union all
 select 'queue', status,
   jsonb_build_object('count',count(*),'attempts_total',sum(attempts),'oldest',min(occurred_at),'latest',max(occurred_at))
 from public.member_notifications group by status
 union all
 select 'scheduler', 'account_email',jsonb_build_object('matching_jobs',count(*),'active_jobs',count(*) filter(where active))
 from cron.job where jobname='ifosse-member-notifications'
 union all
 select 'pg_net_all_http_last_hour', coalesce(status_code::text,'no_status'),
   jsonb_build_object('count',count(*),'latest',max(created),'timed_out',count(*) filter(where timed_out))
 from net._http_response where created>now()-interval '1 hour' group by status_code
)
select category,object_name,details from checks order by category,object_name;
rollback;
