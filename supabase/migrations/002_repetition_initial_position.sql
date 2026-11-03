create or replace function abalone.apply_move(b int[], p int, g int[], d int) returns int[] language plpgsql stable set search_path='' as $$
declare ax int:=-1; di int; i int; j int; k int; n int; front int; nx int; own int; pushed int[]:='{}'; result int[]:=b; foundline boolean:=false;
begin
 if p not in (1,2) or d not between 0 and 5 or coalesce(cardinality(g),0) not between 1 and 3 or array_length(b,1)<>61 then raise exception 'Coup invalide'; end if;
 if (select count(distinct v) from unnest(g) v)<>cardinality(g) then raise exception 'Sélection invalide'; end if;
 foreach i in array g loop if i is null or i not between 0 and 60 or b[i+1]<>p then raise exception 'Sélection invalide'; end if; end loop;
 if cardinality(g)>1 then
  for di in 0..2 loop
   foreach i in array g loop
    j:=i;n:=1;
    while n<cardinality(g) loop select neighbors[di+1] into k from abalone.cells where id=j; exit when not(k=any(g)); j:=k;n:=n+1; end loop;
    if n=cardinality(g) then ax:=di;foundline:=true;exit;end if;
   end loop;
   exit when foundline;
  end loop;
  if not foundline then raise exception 'Les billes doivent être alignées et contiguës';end if;
 end if;
 if cardinality(g)=1 or mod(d,3)=ax then
  foreach i in array g loop select neighbors[d+1] into nx from abalone.cells where id=i;if not(nx=any(g)) then front:=i;exit;end if;end loop;
  select neighbors[d+1] into nx from abalone.cells where id=front;
  if nx=-1 then raise exception 'Une bille ne peut pas sortir volontairement';end if;
  while nx>=0 and b[nx+1]=3-p loop
   pushed:=array_append(pushed,nx);
   if cardinality(pushed)>=cardinality(g) then raise exception 'Poussée sans supériorité numérique';end if;
   select neighbors[d+1] into nx from abalone.cells where id=nx;
  end loop;
  if nx>=0 and b[nx+1]<>0 then raise exception 'La ligne est bloquée';end if;
 else
  foreach i in array g loop select neighbors[d+1] into nx from abalone.cells where id=i;if nx<0 or b[nx+1]<>0 then raise exception 'Déplacement latéral bloqué';end if;end loop;
 end if;
 foreach i in array g||pushed loop result[i+1]:=0;end loop;
 foreach i in array g loop select neighbors[d+1] into nx from abalone.cells where id=i;result[nx+1]:=p;end loop;
 foreach i in array pushed loop select neighbors[d+1] into nx from abalone.cells where id=i;if nx>=0 then result[nx+1]:=3-p;end if;end loop;
 return result;
end;$$;

create or replace function abalone.dispatch(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare room abalone.rooms; tok bytea; player int; selected int[]; newboard int[]; captured int; nm text; ip text; v_bucket text; n int; pk text; occurrence int;
begin
 if p_payload is null or length(p_payload::text)>4096 then raise exception 'Requête invalide';end if;
 if coalesce(p_payload->>'token','') !~ '^[a-f0-9]{64}$' then raise exception 'Session invalide';end if;
 tok:=sha256(convert_to(p_payload->>'token','UTF8'));
 nm:=left(trim(coalesce(p_payload->>'name','Joueur')),24);if nm='' then nm:='Joueur';end if;
 if p_action='create' then
  -- Gate room creation per gateway-reported IP/hour and per device capability.
  ip:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for','unknown');
  v_bucket:=encode(sha256(convert_to(ip||to_char(now(),'YYYY-MM-DD-HH24'),'UTF8')),'hex');
  insert into abalone.creation_limits(bucket) values(v_bucket) on conflict(bucket) do update set count=abalone.creation_limits.count+1 returning count into n;
  if n>30 then raise exception 'Trop de créations de parties. Réessaie plus tard.';end if;
  if (select count(*) from abalone.rooms where black_token=tok and created_at>now()-interval '1 hour')>=10 then raise exception 'Limite de parties atteinte pour cette heure';end if;
  insert into abalone.rooms(code,black_token,black_name) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),tok,nm) returning * into room;
  room.positions:=jsonb_build_object(array_to_string(room.board,'')||1,1);
  update abalone.rooms set positions=room.positions where id=room.id;
  player:=1;
 else
  if p_action='join' then
   select * into room from abalone.rooms where code=upper(regexp_replace(p_payload->>'code','[^a-zA-Z0-9]','','g')) for update;
  else select * into room from abalone.rooms where id=(p_payload->>'id')::uuid for update;
  end if;
  if room.id is null or room.updated_at<now()-interval '30 days' then raise exception 'Partie introuvable ou expirée';end if;
  player:=case when tok=room.black_token then 1 when tok=room.white_token then 2 else 0 end;
  if p_action='join' and player=0 then
   if room.white_token is not null or room.status<>'waiting' then raise exception 'Cette partie est déjà complète';end if;
   room.white_token:=tok;room.white_name:=nm;room.status:='playing';room.version:=room.version+1;player:=2;
  end if;
  if player=0 then raise exception 'Accès à la partie refusé';end if;
  if p_action='move' then
   if room.status<>'playing' or room.turn<>player then raise exception 'Ce n’est pas ton tour';end if;
   if (p_payload->>'version')::int is distinct from room.version then raise exception 'La partie a évolué. Synchronisation nécessaire.';end if;
   select array_agg(v::int) into selected from jsonb_array_elements_text(p_payload->'group') v;
   newboard:=abalone.apply_move(room.board,player,selected,(p_payload->>'d')::int);
   select count(*) into captured from unnest(newboard) x where x=3-player;
   room.history:=room.history||jsonb_build_array(jsonb_build_object('player',player,'group',selected,'d',(p_payload->>'d')::int,'capture',captured<(select count(*) from unnest(room.board) x where x=3-player)));
   room.board:=newboard;room.turn:=3-player;room.version:=room.version+1;
   if captured<=8 then room.winner:=player;room.status:='finished';end if;
   -- House rule: a third identical position with the same side to move is a draw.
   pk:=array_to_string(newboard,'')||room.turn;occurrence:=coalesce((room.positions->>pk)::int,0)+1;
   room.positions:=jsonb_set(room.positions,ARRAY[pk],to_jsonb(occurrence));
   if room.status='playing' and (occurrence>=3 or jsonb_array_length(room.history)>=600) then room.status:='draw';end if;
  elsif p_action='resign' then
   if room.status='playing' then room.status:='finished';room.winner:=3-player;room.version:=room.version+1;end if;
  elsif p_action='rematch' then
   if room.status not in ('finished','draw') then raise exception 'La partie n’est pas terminée';end if;
   if not(player=any(room.rematch)) then room.rematch:=array_append(room.rematch,player);room.version:=room.version+1;end if;
   if cardinality(room.rematch)=2 then
    select column_default into ip from information_schema.columns where table_schema='abalone' and table_name='rooms' and column_name='board';
    execute 'select '||ip into room.board;
    room.turn:=1;room.winner:=0;room.status:='playing';room.history:='[]';room.positions:=jsonb_build_object(array_to_string(room.board,'')||1,1);room.rematch:='{}';room.version:=room.version+1;
   end if;
  elsif p_action not in ('join','state') then raise exception 'Action inconnue';end if;
  if p_action<>'state' then
   update abalone.rooms set white_token=room.white_token,white_name=room.white_name,status=room.status,board=room.board,turn=room.turn,version=room.version,winner=room.winner,history=room.history,positions=room.positions,rematch=room.rematch,updated_at=now() where id=room.id;
  end if;
 end if;
 return jsonb_build_object('id',room.id,'code',room.code,'board',room.board,'turn',room.turn,'version',room.version,'winner',room.winner,'status',room.status,'history',room.history,'rematch',room.rematch,'names',jsonb_build_array(room.black_name,room.white_name),'player',player);
end;$$;

-- Only the capability-gated entry point is exposed to the public Data API.
create or replace function public.abalone_api(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select abalone.dispatch(p_action,p_payload); $$;
revoke all on all functions in schema abalone from public,anon,authenticated;
revoke all on function public.abalone_api(text,jsonb) from public,anon,authenticated;
grant usage on schema abalone to anon;
grant execute on function abalone.dispatch(text,jsonb) to anon;
grant execute on function public.abalone_api(text,jsonb) to anon;
