import {writeFileSync} from 'node:fs';
import {CELLS,NEIGHBORS,initialBoard} from '../src/engine.js';
const setup=`-- Abalone: private storage, capability tokens and atomic authoritative moves.
create schema if not exists abalone;
revoke all on schema abalone from public;
create table abalone.cells (id int primary key, q int not null, r int not null, neighbors int[] not null);
insert into abalone.cells values ${CELLS.map((c,i)=>`(${i},${c.q},${c.r},ARRAY[${NEIGHBORS[i]}])`).join(',')};
create table abalone.rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 black_token bytea not null, white_token bytea, black_name text not null, white_name text,
 board int[] not null default ARRAY[${Array.from(initialBoard())}], turn int not null default 1,
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
`;
writeFileSync('supabase/migrations/001_game.sql',setup);
