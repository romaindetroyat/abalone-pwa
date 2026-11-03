-- Abalone: private storage, capability tokens and atomic authoritative moves.
create schema if not exists abalone;
revoke all on schema abalone from public;
create table abalone.cells (id int primary key, q int not null, r int not null, neighbors int[] not null);
insert into abalone.cells values (0,0,-4,ARRAY[1,6,5,-1,-1,-1]),(1,1,-4,ARRAY[2,7,6,0,-1,-1]),(2,2,-4,ARRAY[3,8,7,1,-1,-1]),(3,3,-4,ARRAY[4,9,8,2,-1,-1]),(4,4,-4,ARRAY[-1,10,9,3,-1,-1]),(5,-1,-3,ARRAY[6,12,11,-1,-1,0]),(6,0,-3,ARRAY[7,13,12,5,0,1]),(7,1,-3,ARRAY[8,14,13,6,1,2]),(8,2,-3,ARRAY[9,15,14,7,2,3]),(9,3,-3,ARRAY[10,16,15,8,3,4]),(10,4,-3,ARRAY[-1,17,16,9,4,-1]),(11,-2,-2,ARRAY[12,19,18,-1,-1,5]),(12,-1,-2,ARRAY[13,20,19,11,5,6]),(13,0,-2,ARRAY[14,21,20,12,6,7]),(14,1,-2,ARRAY[15,22,21,13,7,8]),(15,2,-2,ARRAY[16,23,22,14,8,9]),(16,3,-2,ARRAY[17,24,23,15,9,10]),(17,4,-2,ARRAY[-1,25,24,16,10,-1]),(18,-3,-1,ARRAY[19,27,26,-1,-1,11]),(19,-2,-1,ARRAY[20,28,27,18,11,12]),(20,-1,-1,ARRAY[21,29,28,19,12,13]),(21,0,-1,ARRAY[22,30,29,20,13,14]),(22,1,-1,ARRAY[23,31,30,21,14,15]),(23,2,-1,ARRAY[24,32,31,22,15,16]),(24,3,-1,ARRAY[25,33,32,23,16,17]),(25,4,-1,ARRAY[-1,34,33,24,17,-1]),(26,-4,0,ARRAY[27,35,-1,-1,-1,18]),(27,-3,0,ARRAY[28,36,35,26,18,19]),(28,-2,0,ARRAY[29,37,36,27,19,20]),(29,-1,0,ARRAY[30,38,37,28,20,21]),(30,0,0,ARRAY[31,39,38,29,21,22]),(31,1,0,ARRAY[32,40,39,30,22,23]),(32,2,0,ARRAY[33,41,40,31,23,24]),(33,3,0,ARRAY[34,42,41,32,24,25]),(34,4,0,ARRAY[-1,-1,42,33,25,-1]),(35,-4,1,ARRAY[36,43,-1,-1,26,27]),(36,-3,1,ARRAY[37,44,43,35,27,28]),(37,-2,1,ARRAY[38,45,44,36,28,29]),(38,-1,1,ARRAY[39,46,45,37,29,30]),(39,0,1,ARRAY[40,47,46,38,30,31]),(40,1,1,ARRAY[41,48,47,39,31,32]),(41,2,1,ARRAY[42,49,48,40,32,33]),(42,3,1,ARRAY[-1,-1,49,41,33,34]),(43,-4,2,ARRAY[44,50,-1,-1,35,36]),(44,-3,2,ARRAY[45,51,50,43,36,37]),(45,-2,2,ARRAY[46,52,51,44,37,38]),(46,-1,2,ARRAY[47,53,52,45,38,39]),(47,0,2,ARRAY[48,54,53,46,39,40]),(48,1,2,ARRAY[49,55,54,47,40,41]),(49,2,2,ARRAY[-1,-1,55,48,41,42]),(50,-4,3,ARRAY[51,56,-1,-1,43,44]),(51,-3,3,ARRAY[52,57,56,50,44,45]),(52,-2,3,ARRAY[53,58,57,51,45,46]),(53,-1,3,ARRAY[54,59,58,52,46,47]),(54,0,3,ARRAY[55,60,59,53,47,48]),(55,1,3,ARRAY[-1,-1,60,54,48,49]),(56,-4,4,ARRAY[57,-1,-1,-1,50,51]),(57,-3,4,ARRAY[58,-1,-1,56,51,52]),(58,-2,4,ARRAY[59,-1,-1,57,52,53]),(59,-1,4,ARRAY[60,-1,-1,58,53,54]),(60,0,4,ARRAY[-1,-1,-1,59,54,55]);
create table abalone.rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 black_token bytea not null, white_token bytea, black_name text not null, white_name text,
 board int[] not null default ARRAY[2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1], turn int not null default 1,
 version int not null default 0, winner int not null default 0, status text not null default 'waiting',
 history jsonb not null default '[]', rematch int[] not null default '{}',
 positions jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint valid_board check(array_length(board,1)=61), constraint valid_turn check(turn in (1,2))
);
create table abalone.creation_limits (bucket text primary key, count int not null default 1);
alter table abalone.rooms enable row level security;
alter table abalone.cells enable row level security;
alter table abalone.creation_limits enable row level security;
revoke all on all tables in schema abalone from anon, authenticated, public;
create function abalone.apply_move(b int[], p int, g int[], d int) returns int[] language plpgsql stable set search_path='' as $$
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

create function abalone.dispatch(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
    room.turn:=1;room.winner:=0;room.status:='playing';room.history:='[]';room.positions:='{}';room.rematch:='{}';room.version:=room.version+1;
   end if;
  elsif p_action not in ('join','state') then raise exception 'Action inconnue';end if;
  if p_action<>'state' then
   update abalone.rooms set white_token=room.white_token,white_name=room.white_name,status=room.status,board=room.board,turn=room.turn,version=room.version,winner=room.winner,history=room.history,positions=room.positions,rematch=room.rematch,updated_at=now() where id=room.id;
  end if;
 end if;
 return jsonb_build_object('id',room.id,'code',room.code,'board',room.board,'turn',room.turn,'version',room.version,'winner',room.winner,'status',room.status,'history',room.history,'rematch',room.rematch,'names',jsonb_build_array(room.black_name,room.white_name),'player',player);
end;$$;

-- Only the capability-gated entry point is exposed to the public Data API.
create function public.abalone_api(p_action text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select abalone.dispatch(p_action,p_payload); $$;
revoke all on all functions in schema abalone from public,anon,authenticated;
revoke all on function public.abalone_api(text,jsonb) from public,anon,authenticated;
grant usage on schema abalone to anon;
grant execute on function abalone.dispatch(text,jsonb) to anon;
grant execute on function public.abalone_api(text,jsonb) to anon;
