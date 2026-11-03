begin;
set local role anon;
do $$
declare r jsonb; j jsonb; m jsonb; id text; code text; denied boolean;
begin
 r:=public.abalone_api('create',jsonb_build_object('token',repeat('a',64),'name','Test noir'));id:=r->>'id';code:=r->>'code';
 assert r->>'status'='waiting';assert r->>'player'='1';
 j:=public.abalone_api('join',jsonb_build_object('token',repeat('b',64),'code',code,'name','Test ivoire'));
 assert j->>'status'='playing';assert j->>'player'='2';
 denied:=false;begin perform public.abalone_api('join',jsonb_build_object('token',repeat('c',64),'code',code));exception when others then denied:=true;end;assert denied,'Third player must be refused';
 denied:=false;begin perform public.abalone_api('state',jsonb_build_object('token',repeat('c',64),'id',id));exception when others then denied:=true;end;assert denied,'Invalid capability must be refused';
 denied:=false;begin perform public.abalone_api('move',jsonb_build_object('token',repeat('b',64),'id',id,'version',1,'group',jsonb_build_array(0),'d',0));exception when others then denied:=true;end;assert denied,'Out-of-turn move must be refused';
 denied:=false;begin perform public.abalone_api('move',jsonb_build_object('token',repeat('a',64),'id',id,'version',0,'group',jsonb_build_array(45),'d',3));exception when others then denied:=true;end;assert denied,'Stale move must be refused';
 m:=public.abalone_api('move',jsonb_build_object('token',repeat('a',64),'id',id,'version',1,'group',jsonb_build_array(45),'d',3));
 assert m->>'turn'='2';assert m->>'version'='2';assert jsonb_array_length(m->'history')=1;
 j:=public.abalone_api('state',jsonb_build_object('token',repeat('b',64),'id',id));assert j->'board'=m->'board';
 j:=public.abalone_api('resign',jsonb_build_object('token',repeat('b',64),'id',id));assert j->>'winner'='1';
 j:=public.abalone_api('rematch',jsonb_build_object('token',repeat('a',64),'id',id));assert j->>'status'='finished';
 j:=public.abalone_api('rematch',jsonb_build_object('token',repeat('b',64),'id',id));assert j->>'status'='playing';assert j->'board'=r->'board';assert jsonb_array_length(j->'history')=0;
 assert not has_table_privilege('anon','abalone.rooms','SELECT');
 assert not has_table_privilege('anon','abalone.rooms','UPDATE');
end $$;
rollback;
select 'PASS: room creation, joining, capability checks, illegal turns, stale moves, sync, resignation, mutual rematch and table isolation' as result;
