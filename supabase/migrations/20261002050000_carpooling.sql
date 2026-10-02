begin;
-- Manual transport preference only; driver/passenger states are derived from
-- canonical offers/seat rows, never independently written to participation.
alter table public.session_participations add constraint manual_transport_only check(transport_mode in('unset','needs','own'));
create table public.car_offers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  driver_member_id uuid not null references public.members(id) on delete cascade,
  passenger_capacity integer not null check(passenger_capacity between 1 and 8),
  meeting_point text not null default '' check(char_length(meeting_point)<=200),
  departure_time time check(departure_time<time '24:00'),
  note text not null default '' check(char_length(note)<=300),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(session_id,driver_member_id),unique(id,session_id),
  foreign key(session_id,driver_member_id) references public.session_participations(session_id,member_id) on delete cascade
);
create table public.car_passengers (
  session_id uuid not null references public.sessions(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  car_offer_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key(session_id,member_id),
  foreign key(car_offer_id,session_id) references public.car_offers(id,session_id) on delete cascade,
  foreign key(session_id,member_id) references public.session_participations(session_id,member_id) on delete cascade
);
create index car_passengers_offer_idx on public.car_passengers(car_offer_id);
create trigger car_offer_touch before update on public.car_offers for each row execute function public.touch_updated_at();
alter table public.car_offers enable row level security;
alter table public.car_passengers enable row level security;
create policy car_offers_read on public.car_offers for select to authenticated using(public.current_member_id() is not null);
create policy car_passengers_read on public.car_passengers for select to authenticated using(public.current_member_id() is not null);
grant select on public.car_offers,public.car_passengers to authenticated,service_role;

create function public.transport_eligible(p_session_id uuid,p_member_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.session_participations where session_id=p_session_id and member_id=p_member_id and rsvp='yes')
  and not exists(select 1 from public.selection_publication_members pm where pm.member_id=p_member_id and pm.state='declined' and pm.publication_id=(select id from public.selection_publications where session_id=p_session_id order by version desc limit 1))
$$;
create function public.lock_transport_session(p_session_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=public.current_member_id(); v_status public.session_status;
begin
  if v_actor is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  select status into v_status from public.sessions where id=p_session_id for update;
  if not found or v_status='closed' then raise exception using errcode='22023',message='Séance ouverte requise.'; end if;
  if not public.transport_eligible(p_session_id,v_actor) then raise exception using errcode='22023',message='Répondez Oui et vérifiez votre sélection avant d’organiser votre trajet.'; end if;
  return v_actor;
end;
$$;
create function public.guard_car_offer() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.sessions where id=new.session_id for update;
  if not public.transport_eligible(new.session_id,new.driver_member_id) or exists(select 1 from public.car_passengers where session_id=new.session_id and member_id=new.driver_member_id) then raise exception using errcode='22023',message='Conducteur non disponible.'; end if;
  if new.passenger_capacity<(select count(*) from public.car_passengers where car_offer_id=new.id) then raise exception using errcode='22023',message='La capacité est inférieure au nombre de passagers.'; end if;
  return new;
end;
$$;
create trigger car_offer_guard before insert or update on public.car_offers for each row execute function public.guard_car_offer();
create function public.guard_car_passenger() returns trigger language plpgsql security definer set search_path='' as $$
declare v_car public.car_offers;
begin
  perform 1 from public.sessions where id=new.session_id for update;
  select * into v_car from public.car_offers where id=new.car_offer_id and session_id=new.session_id;
  if not found or new.member_id=v_car.driver_member_id or not public.transport_eligible(new.session_id,new.member_id)
    or not public.transport_eligible(new.session_id,v_car.driver_member_id) or exists(select 1 from public.car_offers where session_id=new.session_id and driver_member_id=new.member_id) then
    raise exception using errcode='22023',message='Voiture ou passager non disponible.';
  end if;
  if (select count(*) from public.car_passengers where car_offer_id=new.car_offer_id and member_id<>new.member_id)>=v_car.passenger_capacity then raise exception using errcode='22023',message='Cette voiture est complète.'; end if;
  return new;
end;
$$;
create trigger car_passenger_guard before insert or update on public.car_passengers for each row execute function public.guard_car_passenger();
create function public.displace_car_passengers() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.session_participations set transport_mode='needs' where session_id=old.session_id and (member_id=old.driver_member_id or member_id in(select member_id from public.car_passengers where car_offer_id=old.id)) and rsvp='yes';
  return old;
end;
$$;
create trigger car_offer_displacement before delete on public.car_offers for each row execute function public.displace_car_passengers();
create function public.car_rsvp_withdrawal() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.rsvp<>'yes' then
    delete from public.car_offers where session_id=new.session_id and driver_member_id=new.member_id;
    delete from public.car_passengers where session_id=new.session_id and member_id=new.member_id;
    update public.session_participations set transport_mode='unset' where session_id=new.session_id and member_id=new.member_id;
  end if;
  return new;
end;
$$;
create trigger participation_car_withdrawal after update of rsvp on public.session_participations for each row execute function public.car_rsvp_withdrawal();
create function public.car_selection_exclusion() returns trigger language plpgsql security definer set search_path='' as $$
declare v_session uuid;
begin
  if new.state='declined' then
    select session_id into v_session from public.selection_publications where id=new.publication_id;
    delete from public.car_offers where session_id=v_session and driver_member_id=new.member_id;
    delete from public.car_passengers where session_id=v_session and member_id=new.member_id;
    if found then update public.session_participations set transport_mode='needs' where session_id=v_session and member_id=new.member_id and rsvp='yes'; end if;
  end if;
  return new;
end;
$$;
-- Runs inside the publication transaction; no cleanup occurs for private drafts.
create trigger selection_car_exclusion after insert on public.selection_publication_members for each row execute function public.car_selection_exclusion();

create function public.offer_car(p_session_id uuid,p_passenger_capacity integer,p_meeting_point text,p_note text,p_departure_time time default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor:=public.lock_transport_session(p_session_id);
  delete from public.car_passengers where session_id=p_session_id and member_id=v_actor;
  insert into public.car_offers(session_id,driver_member_id,passenger_capacity,meeting_point,note,departure_time) values(p_session_id,v_actor,p_passenger_capacity,btrim(p_meeting_point),btrim(p_note),p_departure_time)
  on conflict(session_id,driver_member_id) do update set passenger_capacity=excluded.passenger_capacity,meeting_point=excluded.meeting_point,note=excluded.note,departure_time=excluded.departure_time returning id into v_id;
  update public.session_participations set transport_mode='needs' where session_id=p_session_id and member_id=v_actor;
  return v_id;
end;
$$;
create function public.set_own_transport(p_session_id uuid,p_mode public.transport_state) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid;
begin
  v_actor:=public.lock_transport_session(p_session_id);
  if p_mode is null or p_mode not in('unset','needs','own') then raise exception using errcode='22023',message='Mode de transport invalide.'; end if;
  delete from public.car_offers where session_id=p_session_id and driver_member_id=v_actor;
  delete from public.car_passengers where session_id=p_session_id and member_id=v_actor;
  update public.session_participations set transport_mode=p_mode where session_id=p_session_id and member_id=v_actor;
end;
$$;
create function public.join_car(p_session_id uuid,p_car_offer_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid;
begin
  v_actor:=public.lock_transport_session(p_session_id);
  insert into public.car_passengers(session_id,member_id,car_offer_id) values(p_session_id,v_actor,p_car_offer_id)
  on conflict(session_id,member_id) do update set car_offer_id=excluded.car_offer_id,joined_at=case when public.car_passengers.car_offer_id=excluded.car_offer_id then public.car_passengers.joined_at else now() end;
  update public.session_participations set transport_mode='needs' where session_id=p_session_id and member_id=v_actor;
end;
$$;
create function public.get_car_offers(p_session_id uuid)
returns table(id uuid,driver_member_id uuid,first_name text,last_name text,passenger_capacity integer,occupied bigint,meeting_point text,departure_time time,note text)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select c.id,c.driver_member_id,m.first_name,m.last_name,c.passenger_capacity,(select count(*) from public.car_passengers where car_offer_id=c.id),c.meeting_point,c.departure_time,c.note from public.car_offers c join public.members m on m.id=c.driver_member_id where c.session_id=p_session_id order by c.created_at;
end;
$$;
create function public.get_session_transport(p_session_id uuid)
returns table(member_id uuid,first_name text,last_name text,mode public.transport_state,car_offer_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if public.current_member_id() is null then raise exception using errcode='42501',message='Adhérent actif requis.'; end if;
  return query select p.member_id,m.first_name,m.last_name,case when c.id is not null then 'driver'::public.transport_state when seat.car_offer_id is not null then 'passenger'::public.transport_state else p.transport_mode end,coalesce(c.id,seat.car_offer_id)
  from public.session_participations p join public.members m on m.id=p.member_id left join public.car_offers c on c.session_id=p.session_id and c.driver_member_id=p.member_id left join public.car_passengers seat on seat.session_id=p.session_id and seat.member_id=p.member_id where p.session_id=p_session_id and p.rsvp in('yes','maybe');
end;
$$;
revoke all on function public.transport_eligible(uuid,uuid),public.lock_transport_session(uuid),public.guard_car_offer(),public.guard_car_passenger(),public.displace_car_passengers(),public.car_rsvp_withdrawal(),public.car_selection_exclusion(),public.offer_car(uuid,integer,text,text,time),public.set_own_transport(uuid,public.transport_state),public.join_car(uuid,uuid),public.get_car_offers(uuid),public.get_session_transport(uuid) from public,anon,authenticated,service_role;
grant execute on function public.offer_car(uuid,integer,text,text,time),public.set_own_transport(uuid,public.transport_state),public.join_car(uuid,uuid),public.get_car_offers(uuid),public.get_session_transport(uuid) to authenticated;
commit;
