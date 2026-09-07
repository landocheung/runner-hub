import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './styles.css';

const sbUrl=import.meta.env.VITE_SUPABASE_URL;
const sbKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=sbUrl&&sbKey?createClient(sbUrl,sbKey):null;
const STORE='runner-hub-v1';
const therapistNames=['Therapist 1','Therapist 2','Therapist 3'];
const sample=[
  ['001','Alex Morgan'],['002','Jamie Chan'],['003','Taylor Wong'],['004','Sam Lee'],['005','Jordan Smith'],['006','Casey Lam'],['007','Riley Ho'],['008','Morgan Patel']
].map(([bib,name])=>({id:crypto.randomUUID(),bib_number:bib,name,checkin_time:null,massage_status:'not_requested',queue_joined_at:null,massage_start_time:null,massage_end_time:null,therapist:null,skip_count:0}));

function fmt(ts){if(!ts)return '—';return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts));}
function mins(ts){if(!ts)return 0;return Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/60000));}
function normalise(row){return {id:row.id||crypto.randomUUID(),bib_number:String(row.bib_number||row.bib||'').trim(),name:String(row.name||'').trim(),checkin_time:row.checkin_time||null,massage_status:row.massage_status||'not_requested',queue_joined_at:row.queue_joined_at||null,massage_start_time:row.massage_start_time||null,massage_end_time:row.massage_end_time||null,therapist:row.therapist||null,skip_count:Number(row.skip_count||0)}}

async function loadRunners(){
  if(supabase){const {data,error}=await supabase.from('runners').select('*').order('bib_number');if(error)throw error;return data.map(normalise)}
  const raw=localStorage.getItem(STORE); if(raw) return JSON.parse(raw).map(normalise); localStorage.setItem(STORE,JSON.stringify(sample)); return sample;
}
async function saveRunner(r){
  if(supabase){const {error}=await supabase.from('runners').upsert(r);if(error)throw error;return}
  const rows=JSON.parse(localStorage.getItem(STORE)||'[]'); const i=rows.findIndex(x=>x.id===r.id); if(i>=0)rows[i]=r;else rows.push(r);localStorage.setItem(STORE,JSON.stringify(rows));
}
async function saveMany(rows){if(supabase){const {error}=await supabase.from('runners').upsert(rows);if(error)throw error;}else localStorage.setItem(STORE,JSON.stringify(rows));}

function App(){
 const [runners,setRunners]=useState([]); const [page,setPage]=useState('checkin'); const [q,setQ]=useState(''); const [selected,setSelected]=useState(null); const [notice,setNotice]=useState(''); const [tick,setTick]=useState(0);
 const refresh=async()=>setRunners(await loadRunners());
 useEffect(()=>{refresh(); const t=setInterval(()=>setTick(x=>x+1),30000); let channel; if(supabase){channel=supabase.channel('runner-updates').on('postgres_changes',{event:'*',schema:'public',table:'runners'},refresh).subscribe()} return()=>{clearInterval(t); if(channel)supabase.removeChannel(channel)}} ,[]);
 const searched=useMemo(()=>{const s=q.trim().toLowerCase(); if(!s)return []; return runners.filter(r=>r.bib_number.toLowerCase().includes(s)||r.name.toLowerCase().includes(s)).slice(0,8)},[q,runners]);
 const arrived=runners.filter(r=>r.checkin_time); const waiting=runners.filter(r=>['waiting','skipped'].includes(r.massage_status)).sort((a,b)=>new Date(a.queue_joined_at)-new Date(b.queue_joined_at)); const active=runners.filter(r=>r.massage_status==='in_service'); const completed=runners.filter(r=>r.massage_status==='completed');
 async function patch(r,p){const n={...r,...p}; await saveRunner(n); setRunners(prev=>prev.map(x=>x.id===r.id?n:x)); setSelected(n);}
 async function checkin(r){await patch(r,{checkin_time:r.checkin_time||new Date().toISOString()});setNotice(`${r.name} checked in at ${fmt(new Date())}`)}
 async function joinQueue(r){await patch(r,{massage_status:'waiting',queue_joined_at:r.queue_joined_at||new Date().toISOString()});setNotice(`${r.name} joined the massage queue.`)}
 async function startNext(t){const candidate=waiting.find(r=>r.massage_status==='waiting')||waiting[0]; if(!candidate){setNotice('No runners are currently waiting.');return} await patch(candidate,{massage_status:'in_service',therapist:t,massage_start_time:new Date().toISOString()}); setNotice(`${candidate.name} assigned to ${t}.`)}
 async function complete(r){await patch(r,{massage_status:'completed',massage_end_time:new Date().toISOString()});setNotice(`${r.name}'s massage has been completed.`)}
 async function notFound(r){await patch(r,{massage_status:'skipped',skip_count:(r.skip_count||0)+1}); setNotice(`${r.name} marked as not found. The next runner may be called.`)}
 async function returnQueue(r){await patch(r,{massage_status:'waiting',queue_joined_at:new Date().toISOString()});setNotice(`${r.name} returned to the queue.`)}
 function importCsv(file){const fr=new FileReader();fr.onload=async e=>{const lines=e.target.result.split(/\r?\n/).filter(Boolean);const head=lines.shift().split(',').map(x=>x.trim().toLowerCase());const bi=head.findIndex(x=>['bib','bib_number','bib number'].includes(x));const ni=head.findIndex(x=>x==='name');if(bi<0||ni<0){setNotice('CSV must contain bib_number and name columns.');return}const parsed=lines.map(line=>{const parts=line.split(',');return normalise({bib_number:parts[bi],name:parts[ni]})}).filter(x=>x.bib_number&&x.name);await saveMany(parsed);await refresh();setNotice(`${parsed.length} runners imported.`)};fr.readAsText(file)}
 return <div className="app">
   <header><div><div className="eyebrow">HALF MARATHON EVENT</div><h1>Runner Hub</h1></div><div className="mode">{supabase?'Live database':'Local demo mode'}</div></header>
   <nav>{[['checkin','Check-in'],['queue','Massage Queue'],['therapists','Therapists'],['dashboard','Dashboard']].map(([k,l])=><button key={k} className={page===k?'active':''} onClick={()=>setPage(k)}>{l}</button>)}</nav>
   {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}</div>}
   <main>
   {page==='checkin'&&<section><div className="sectionHead"><div><h2>Runner Check-in</h2><p>Search by bib number or name, then record the runner's arrival.</p></div><label className="import">Import CSV<input type="file" accept=".csv" onChange={e=>e.target.files[0]&&importCsv(e.target.files[0])}/></label></div>
     <input className="search" autoFocus placeholder="Search by bib number or name" value={q} onChange={e=>setQ(e.target.value)}/>
     <div className="results">{searched.map(r=><article className="runner" key={r.id}><div><span className="bib">Bib {r.bib_number}</span><h3>{r.name}</h3><p>{r.checkin_time?`Checked in at ${fmt(r.checkin_time)}`:'Not yet arrived'}</p></div><div className="actions">{!r.checkin_time?<button className="primary" onClick={()=>checkin(r)}>Check In</button>:<span className="success">✓ Checked in</span>}{r.checkin_time&&r.massage_status==='not_requested'&&<button onClick={()=>joinQueue(r)}>Join Massage Queue</button>}{['waiting','skipped','in_service','completed'].includes(r.massage_status)&&<span className="tag">Massage: {r.massage_status.replace('_',' ')}</span>}</div></article>)}{q&&searched.length===0&&<div className="empty">No matching runner found.</div>}</div>
   </section>}
   {page==='queue'&&<section><h2>Massage Queue</h2><p>{waiting.length} waiting · {active.length} in service · {completed.length} completed</p><div className="queueList">{waiting.map((r,i)=><article className="queueRow" key={r.id}><div className="place">{i+1}</div><div className="grow"><b>{r.name}</b><span>Bib {r.bib_number} · waiting {mins(r.queue_joined_at)} min{r.skip_count?` · skipped ${r.skip_count} time(s)`:''}</span></div><div className="actions">{r.massage_status==='skipped'?<button onClick={()=>returnQueue(r)}>Return to Queue</button>:<button onClick={()=>notFound(r)}>Not Found</button>}</div></article>)}{!waiting.length&&<div className="empty">The massage queue is empty.</div>}</div></section>}
   {page==='therapists'&&<section><h2>Therapists</h2><p>Each therapist can call the next available runner, mark a runner as not found, or complete a treatment.</p><div className="therapists">{therapistNames.map(t=>{const current=active.find(r=>r.therapist===t);return <article className="therapist" key={t}><h3>{t}</h3>{current?<><div className="current"><span>Current runner</span><strong>{current.name}</strong><small>Bib {current.bib_number} · started {fmt(current.massage_start_time)}</small></div><div className="actions stack"><button onClick={()=>notFound(current)}>Runner Not Found</button><button className="primary" onClick={()=>complete(current)}>Complete Massage</button></div></>:<><div className="available">Available</div><button className="primary full" disabled={!waiting.length} onClick={()=>startNext(t)}>Call Next Runner</button></>}</article>})}</div></section>}
   {page==='dashboard'&&<section><h2>Event Dashboard</h2><div className="stats"><Stat label="Runners Arrived" value={`${arrived.length} / ${runners.length}`}/><Stat label="Runners Outstanding" value={runners.length-arrived.length}/><Stat label="Massage Waiting" value={waiting.length}/><Stat label="In Service" value={active.length}/><Stat label="Massage Completed" value={completed.length}/></div><div className="panel"><h3>Recent arrivals</h3>{[...arrived].sort((a,b)=>new Date(b.checkin_time)-new Date(a.checkin_time)).slice(0,8).map(r=><div className="recent" key={r.id}><span><b>Bib {r.bib_number}</b> · {r.name}</span><span>{fmt(r.checkin_time)}</span></div>)}</div></section>}
   </main>
   <footer>Runner Hub · British English interface · Times shown in 24-hour format</footer>
 </div>
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
createRoot(document.getElementById('root')).render(<App/>);
