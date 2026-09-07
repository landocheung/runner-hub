import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import './styles.css';

const sbUrl=import.meta.env.VITE_SUPABASE_URL;
const sbKey=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=sbUrl&&sbKey?createClient(sbUrl,sbKey):null;
const STORE='runner-hub-v2';
const SETTINGS_STORE='runner-hub-settings-v1';
const therapistNames=['Therapist 1','Therapist 2','Therapist 3'];
const sample=[
  ['001','Alex Morgan'],['002','Jamie Chan'],['003','Taylor Wong'],['004','Sam Lee'],['005','Jordan Smith'],['006','Casey Lam'],['007','Riley Ho'],['008','Morgan Patel']
].map(([bib,name])=>normalise({id:crypto.randomUUID(),bib_number:bib,name}));

function fmt(ts){if(!ts)return '—';return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts));}
function mins(ts){if(!ts)return 0;return Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/60000));}
function titleCase(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());}
function normalise(row){return {
  id:row.id||crypto.randomUUID(), bib_number:String(row.bib_number||row.bib||'').trim(), name:String(row.name||'').trim(),
  checkin_time:row.checkin_time||null, massage_status:row.massage_status||'not_requested', queue_joined_at:row.queue_joined_at||null,
  massage_start_time:row.massage_start_time||null, massage_end_time:row.massage_end_time||null, therapist:row.therapist||null,
  skip_count:Number(row.skip_count||0), interview_interest:Boolean(row.interview_interest), interview_status:row.interview_status||'not_interested',
  interview_joined_at:row.interview_joined_at||null, interview_contacted_at:row.interview_contacted_at||null,
  interview_start_time:row.interview_start_time||null, interview_end_time:row.interview_end_time||null, notes:row.notes||''
}}

async function loadRunners(){
  if(supabase){const {data,error}=await supabase.from('runners').select('*').order('bib_number');if(error)throw error;return data.map(normalise)}
  const raw=localStorage.getItem(STORE); if(raw) return JSON.parse(raw).map(normalise); localStorage.setItem(STORE,JSON.stringify(sample)); return sample;
}
async function saveRunner(r){
  if(supabase){const {error}=await supabase.from('runners').upsert(r);if(error)throw error;return}
  const rows=JSON.parse(localStorage.getItem(STORE)||'[]'); const i=rows.findIndex(x=>x.id===r.id); if(i>=0)rows[i]=r;else rows.push(r);localStorage.setItem(STORE,JSON.stringify(rows));
}
async function saveMany(rows){if(supabase){const {error}=await supabase.from('runners').upsert(rows);if(error)throw error;}else localStorage.setItem(STORE,JSON.stringify(rows));}
async function loadSettings(){
  if(supabase){const {data,error}=await supabase.from('event_settings').select('*').eq('id','default').maybeSingle();if(error)throw error;return data||{id:'default',logo_data_url:null}}
  return JSON.parse(localStorage.getItem(SETTINGS_STORE)||'{"id":"default","logo_data_url":null}');
}
async function saveSettings(settings){
  if(supabase){const {error}=await supabase.from('event_settings').upsert({...settings,id:'default',updated_at:new Date().toISOString()});if(error)throw error;return}
  localStorage.setItem(SETTINGS_STORE,JSON.stringify({...settings,id:'default'}));
}

function App(){
 const [runners,setRunners]=useState([]); const [settings,setSettings]=useState({id:'default',logo_data_url:null});
 const [page,setPage]=useState('checkin'); const [q,setQ]=useState(''); const [notice,setNotice]=useState(''); const [,setTick]=useState(0);
 const [noteRunner,setNoteRunner]=useState(null); const [noteDraft,setNoteDraft]=useState('');
 const refresh=async()=>{try{setRunners(await loadRunners())}catch(e){setNotice(`Could not refresh runners: ${e.message}`)}};
 const refreshSettings=async()=>{try{setSettings(await loadSettings())}catch(e){setNotice(`Could not load event settings: ${e.message}`)}};
 useEffect(()=>{refresh();refreshSettings(); const t=setInterval(()=>setTick(x=>x+1),30000); let runnerChannel,settingsChannel; if(supabase){
   runnerChannel=supabase.channel('runner-updates').on('postgres_changes',{event:'*',schema:'public',table:'runners'},refresh).subscribe();
   settingsChannel=supabase.channel('settings-updates').on('postgres_changes',{event:'*',schema:'public',table:'event_settings'},refreshSettings).subscribe();
 } return()=>{clearInterval(t); if(runnerChannel)supabase.removeChannel(runnerChannel);if(settingsChannel)supabase.removeChannel(settingsChannel)}} ,[]);
 const searched=useMemo(()=>{const s=q.trim().toLowerCase(); if(!s)return []; return runners.filter(r=>r.bib_number.toLowerCase().includes(s)||r.name.toLowerCase().includes(s)).slice(0,8)},[q,runners]);
 const arrived=runners.filter(r=>r.checkin_time);
 const waiting=runners.filter(r=>['waiting','skipped'].includes(r.massage_status)).sort((a,b)=>new Date(a.queue_joined_at)-new Date(b.queue_joined_at));
 const active=runners.filter(r=>r.massage_status==='in_service'); const completed=runners.filter(r=>r.massage_status==='completed');
 const interviewAvailable=runners.filter(r=>r.interview_status==='available').sort((a,b)=>new Date(a.interview_joined_at)-new Date(b.interview_joined_at));
 const interviewContacted=runners.filter(r=>r.interview_status==='contacted'); const interviewActive=runners.filter(r=>r.interview_status==='in_interview');
 const interviewCompleted=runners.filter(r=>r.interview_status==='completed');
 const notes=runners.filter(r=>r.notes.trim());
 async function patch(r,p){try{const n={...r,...p}; await saveRunner(n); setRunners(prev=>prev.map(x=>x.id===r.id?n:x)); if(noteRunner?.id===r.id)setNoteRunner(n); return n}catch(e){setNotice(`Update failed: ${e.message}`);throw e}}
 async function checkin(r){const n=await patch(r,{checkin_time:r.checkin_time||new Date().toISOString()});setNotice(`${n.name} checked in at ${fmt(n.checkin_time)}`)}
 async function joinQueue(r){await patch(r,{massage_status:'waiting',queue_joined_at:r.queue_joined_at||new Date().toISOString()});setNotice(`${r.name} joined the massage queue.`)}
 async function startNext(t){
   if(supabase){const {data,error}=await supabase.rpc('claim_next_runner',{p_therapist:t});if(error){setNotice(`Could not call next runner: ${error.message}`);return}if(!data){setNotice('No runners are currently waiting.');return}await refresh();setNotice(`${data.name||'Runner'} assigned to ${t}.`);return}
   const candidate=waiting.find(r=>r.massage_status==='waiting')||waiting[0]; if(!candidate){setNotice('No runners are currently waiting.');return} await patch(candidate,{massage_status:'in_service',therapist:t,massage_start_time:new Date().toISOString()}); setNotice(`${candidate.name} assigned to ${t}.`)
 }
 async function complete(r){await patch(r,{massage_status:'completed',massage_end_time:new Date().toISOString()});setNotice(`${r.name}'s massage has been completed.`)}
 async function skipMassage(r){await patch(r,{massage_status:'skipped',skip_count:(r.skip_count||0)+1,therapist:null,massage_start_time:null}); setNotice(`${r.name} skipped. The next runner may be called.`)}
 async function returnQueue(r){await patch(r,{massage_status:'waiting',queue_joined_at:new Date().toISOString()});setNotice(`${r.name} returned to the queue.`)}
 async function setInterviewInterest(r,interested){
   const now=new Date().toISOString();
   await patch(r,interested?{interview_interest:true,interview_status:'available',interview_joined_at:r.interview_joined_at||now}:{interview_interest:false,interview_status:'not_interested',interview_joined_at:null,interview_contacted_at:null,interview_start_time:null,interview_end_time:null});
   setNotice(interested?`${r.name} added to the interview list.`:`${r.name} marked as not interested in an interview.`)
 }
 async function contactInterview(r){await patch(r,{interview_status:'contacted',interview_contacted_at:new Date().toISOString()});setNotice(`${r.name} marked as contacted.`)}
 async function startInterview(r){await patch(r,{interview_status:'in_interview',interview_start_time:new Date().toISOString()});setNotice(`${r.name}'s interview started.`)}
 async function completeInterview(r){await patch(r,{interview_status:'completed',interview_end_time:new Date().toISOString()});setNotice(`${r.name}'s interview completed.`)}
 async function skipInterview(r){await patch(r,{interview_status:'skipped'});setNotice(`${r.name} skipped for interview.`)}
 async function returnInterview(r){await patch(r,{interview_status:'available',interview_joined_at:new Date().toISOString(),interview_contacted_at:null,interview_start_time:null});setNotice(`${r.name} returned to the interview list.`)}
 function openNotes(r){setNoteRunner(r);setNoteDraft(r.notes||'')}
 async function saveNote(){if(!noteRunner)return;await patch(noteRunner,{notes:noteDraft});setNotice(`Note saved for ${noteRunner.name}.`);setNoteRunner(null)}
 function importCsv(file){const fr=new FileReader();fr.onload=async e=>{const lines=e.target.result.split(/\r?\n/).filter(Boolean);const head=lines.shift().split(',').map(x=>x.trim().toLowerCase());const bi=head.findIndex(x=>['bib','bib_number','bib number'].includes(x));const ni=head.findIndex(x=>x==='name');if(bi<0||ni<0){setNotice('CSV must contain bib_number and name columns.');return}const parsed=lines.map(line=>{const parts=line.split(',');return normalise({bib_number:parts[bi],name:parts[ni]})}).filter(x=>x.bib_number&&x.name);await saveMany(parsed);await refresh();setNotice(`${parsed.length} runners imported.`)};fr.readAsText(file)}
 function uploadLogo(file){if(!file)return;const img=new Image();const fr=new FileReader();fr.onload=e=>{img.onload=async()=>{const size=512,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,size,size);const scale=Math.min(size/img.width,size/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);const logo_data_url=canvas.toDataURL('image/png');const next={...settings,logo_data_url};await saveSettings(next);setSettings(next);setNotice('Event logo updated.')};img.src=e.target.result};fr.readAsDataURL(file)}
 return <div className="app">
   <header><div><div className="eyebrow">HALF MARATHON EVENT</div><h1>Runner Hub</h1></div><div className="headerTools"><div className="mode">{supabase?'Live database':'Local demo mode'}</div><label className="logoBox" title="Upload a square event logo">{settings.logo_data_url?<img src={settings.logo_data_url} alt="Event logo"/>:<span>Upload<br/>Logo</span>}<input type="file" accept="image/*" onChange={e=>e.target.files[0]&&uploadLogo(e.target.files[0])}/></label></div></header>
   <nav>{[['checkin','Check-in'],['queue','Massage Queue'],['interview','Interview'],['therapists','Therapists'],['dashboard','Dashboard']].map(([k,l])=><button key={k} className={page===k?'active':''} onClick={()=>setPage(k)}>{l}</button>)}</nav>
   {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}</div>}
   <main>
   {page==='checkin'&&<section><div className="sectionHead"><div><h2>Runner Check-in</h2><p>Search by bib number or name, record arrival, and note interview interest.</p></div><label className="import">Import CSV<input type="file" accept=".csv" onChange={e=>e.target.files[0]&&importCsv(e.target.files[0])}/></label></div>
     <input className="search" autoFocus placeholder="Search by bib number or name" value={q} onChange={e=>setQ(e.target.value)}/>
     <div className="results">{searched.map(r=><article className="runner clickable" key={r.id} onClick={()=>openNotes(r)}><div><span className="bib">Bib {r.bib_number}</span><h3>{r.name}</h3><p>{r.checkin_time?`Checked in at ${fmt(r.checkin_time)}`:'Not yet arrived'}{r.notes?' · Note saved':''}</p></div><div className="actions" onClick={e=>e.stopPropagation()}>{!r.checkin_time?<button className="primary" onClick={()=>checkin(r)}>Check In</button>:<span className="success">✓ Checked in</span>}{r.checkin_time&&r.massage_status==='not_requested'&&<button onClick={()=>joinQueue(r)}>Join Massage Queue</button>}{r.checkin_time&&!r.interview_interest&&<button onClick={()=>setInterviewInterest(r,true)}>Interested in Interview</button>}{r.checkin_time&&r.interview_interest&&<button className="softSuccess" onClick={()=>setInterviewInterest(r,false)}>✓ Interview Interest</button>}{r.massage_status!=='not_requested'&&<span className="tag">Massage: {titleCase(r.massage_status)}</span>}{r.interview_interest&&<span className="tag">Interview: {titleCase(r.interview_status)}</span>}</div></article>)}{q&&searched.length===0&&<div className="empty">No matching runner found.</div>}</div>
   </section>}
   {page==='queue'&&<section><h2>Massage Queue</h2><p>{waiting.length} waiting · {active.length} in service · {completed.length} completed</p><div className="queueList">{waiting.map((r,i)=><article className="queueRow clickable" key={r.id} onClick={()=>openNotes(r)}><div className="place">{i+1}</div><div className="grow"><b>{r.name}</b><span>Bib {r.bib_number} · waiting {mins(r.queue_joined_at)} min{r.skip_count?` · skipped ${r.skip_count} time(s)`:''}{r.notes?' · note':''}</span></div><div className="actions" onClick={e=>e.stopPropagation()}>{r.massage_status==='skipped'?<button onClick={()=>returnQueue(r)}>Return to Queue</button>:<button onClick={()=>skipMassage(r)}>Skip</button>}</div></article>)}{!waiting.length&&<div className="empty">The massage queue is empty.</div>}</div></section>}
   {page==='interview'&&<section><h2>Interview Queue</h2><p>{interviewAvailable.length} available · {interviewContacted.length} contacted · {interviewActive.length} in interview · {interviewCompleted.length} completed</p><div className="queueList">{[...interviewAvailable,...interviewContacted,...interviewActive,...runners.filter(r=>r.interview_status==='skipped')].map((r,i)=><article className="queueRow clickable" key={r.id} onClick={()=>openNotes(r)}><div className="place">{r.interview_status==='available'?i+1:'•'}</div><div className="grow"><b>{r.name}</b><span>Bib {r.bib_number} · {titleCase(r.interview_status)}{r.interview_joined_at?` · added ${fmt(r.interview_joined_at)}`:''}{r.notes?' · note':''}</span></div><div className="actions" onClick={e=>e.stopPropagation()}>{r.interview_status==='available'&&<><button onClick={()=>skipInterview(r)}>Skip</button><button className="primary" onClick={()=>contactInterview(r)}>Contact</button></>}{r.interview_status==='contacted'&&<><button onClick={()=>skipInterview(r)}>Skip</button><button className="primary" onClick={()=>startInterview(r)}>Start</button></>}{r.interview_status==='in_interview'&&<button className="primary" onClick={()=>completeInterview(r)}>Complete</button>}{r.interview_status==='skipped'&&<button onClick={()=>returnInterview(r)}>Return to List</button>}</div></article>)}{!interviewAvailable.length&&!interviewContacted.length&&!interviewActive.length&&!runners.some(r=>r.interview_status==='skipped')&&<div className="empty">No runners are currently available for interview.</div>}</div></section>}
   {page==='therapists'&&<section><h2>Therapists</h2><p>Each therapist can call the next available runner, skip a runner, or complete a treatment.</p><div className="therapists">{therapistNames.map(t=>{const current=active.find(r=>r.therapist===t);return <article className="therapist" key={t}><h3>{t}</h3>{current?<><div className="current clickable" onClick={()=>openNotes(current)}><span>Current runner</span><strong>{current.name}</strong><small>Bib {current.bib_number} · started {fmt(current.massage_start_time)}</small></div><div className="actions stack"><button onClick={()=>skipMassage(current)}>Skip</button><button className="primary" onClick={()=>complete(current)}>Complete Massage</button></div></>:<><div className="available">Available</div><button className="primary full" disabled={!waiting.some(r=>r.massage_status==='waiting')} onClick={()=>startNext(t)}>Call Next Runner</button></>}</article>})}</div></section>}
   {page==='dashboard'&&<section><h2>Event Dashboard</h2><div className="stats"><Stat label="Runners Arrived" value={`${arrived.length} / ${runners.length}`}/><Stat label="Runners Outstanding" value={runners.length-arrived.length}/><Stat label="Massage Waiting" value={waiting.length}/><Stat label="Massage Completed" value={completed.length}/><Stat label="Interview Available" value={interviewAvailable.length}/><Stat label="Interviews Completed" value={interviewCompleted.length}/></div><div className="dashboardGrid"><HistoryPanel title="Recent arrivals" rows={[...arrived].sort((a,b)=>new Date(b.checkin_time)-new Date(a.checkin_time)).slice(0,10)} timeKey="checkin_time" onOpen={openNotes}/><HistoryPanel title="Massage history" rows={[...runners.filter(r=>['completed','skipped'].includes(r.massage_status))].sort((a,b)=>new Date(b.massage_end_time||b.queue_joined_at)-new Date(a.massage_end_time||a.queue_joined_at)).slice(0,10)} statusKey="massage_status" timeKey="massage_end_time" onOpen={openNotes}/><HistoryPanel title="Interview history" rows={[...runners.filter(r=>['completed','skipped'].includes(r.interview_status))].sort((a,b)=>new Date(b.interview_end_time||b.interview_joined_at)-new Date(a.interview_end_time||a.interview_joined_at)).slice(0,10)} statusKey="interview_status" timeKey="interview_end_time" onOpen={openNotes}/><div className="panel"><h3>Follow-up notes</h3>{notes.length?notes.slice(0,10).map(r=><button className="historyRow noteRow" key={r.id} onClick={()=>openNotes(r)}><span><b>Bib {r.bib_number}</b> · {r.name}<small>{r.notes}</small></span><span>Open</span></button>):<div className="empty compact">No follow-up notes yet.</div>}</div></div></section>}
   </main>
   <footer>Runner Hub · British English interface · Times shown in 24-hour format</footer>
   {noteRunner&&<div className="modalBackdrop" onClick={()=>setNoteRunner(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modalHead"><div><span className="bib">Bib {noteRunner.bib_number}</span><h3>{noteRunner.name}</h3></div><button className="iconButton" onClick={()=>setNoteRunner(null)}>×</button></div><label>Runner note / follow-up<textarea autoFocus rows="7" value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} placeholder="Add comments, follow-up questions or anything the team should remember after the event."/></label><div className="actions modalActions"><button onClick={()=>setNoteRunner(null)}>Cancel</button><button className="primary" onClick={saveNote}>Save Note</button></div></div></div>}
 </div>
}
function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}
function HistoryPanel({title,rows,timeKey,statusKey,onOpen}){return <div className="panel"><h3>{title}</h3>{rows.length?rows.map(r=><button className="historyRow" key={r.id} onClick={()=>onOpen(r)}><span><b>Bib {r.bib_number}</b> · {r.name}{statusKey&&<small>{titleCase(r[statusKey])}</small>}</span><span>{fmt(r[timeKey])}</span></button>):<div className="empty compact">No history yet.</div>}</div>}
createRoot(document.getElementById('root')).render(<App/>);
