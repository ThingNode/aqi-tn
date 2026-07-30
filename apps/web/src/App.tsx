import {useEffect,useMemo,useState} from 'react';
import {api,connect} from './api';
import type {Reading,Station} from './types';
import {AirMap} from './components/AirMap';
import {TwinReadout} from './components/TwinReadout';
import {DayRibbon} from './components/DayRibbon';

type View='home'|'map'|'station'|'schools'|'data';
function route():{view:View;stationId?:string}{
  const path=location.pathname.replace(/\/+$/,'');
  const station=path.match(/^\/app\/stations\/([^/]+)$/);
  if(station)return{view:'station',stationId:decodeURIComponent(station[1])};
  if(path.endsWith('/map'))return{view:'map'};
  if(path.endsWith('/schools'))return{view:'schools'};
  if(path.endsWith('/data'))return{view:'data'};
  return{view:'home'};
}

export function App(){
  const current=route();
  const[stations,setStations]=useState<Station[]>([]);
  const[readings,setReadings]=useState<Record<string,Reading>>({});
  const[demo,setDemo]=useState(true);
  const[registryError,setRegistryError]=useState(false);
  const[retry,setRetry]=useState(0);

  useEffect(()=>{
    let alive=true;
    api.stations().then(s=>{if(alive){setStations(s);setRegistryError(false)}}).catch(()=>{if(alive)setRegistryError(true)});
    api.latest().then(r=>{if(alive)setReadings(Object.fromEntries(r.map(x=>[x.station_id,x])))}).catch(()=>{});
    const disconnect=connect(r=>setReadings(v=>({...v,[r.station_id]:r})));
    return()=>{alive=false;disconnect()};
  },[retry]);

  const selected=stations.find(s=>s.id===current.stationId)??stations.find(s=>readings[s.id])??stations.find(s=>s.id==='sta-cor-hlr-nugegoda')??stations[0];
  const fieldStations=useMemo(()=>stations.map(s=>({...s,pm:readings[s.id]?.measurements.pm2_5.value})),[stations,readings]);
  return <div className="shell">
    <Nav active={current.view}/>
    <main>
      <TopBar title={current.view==='home'?'What is the air doing?':current.view==='map'?'Air across the network':current.view==='station'?(selected?.name??'Station detail'):current.view==='schools'?'School view':'Open data'} demo={demo} dismissDemo={()=>setDemo(false)}/>
      {registryError&&<div className="notice error-notice" role="alert"><div><b>Could not reach the application API.</b><br/>Station locations and live readings are unavailable.</div><button onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}
      {current.view==='home'&&<Home stations={stations} readings={readings} selected={selected} fieldStations={fieldStations}/>} 
      {current.view==='map'&&<MapPage stations={stations} readings={readings} fieldStations={fieldStations}/>} 
      {current.view==='station'&&<StationPage station={selected} reading={selected?readings[selected.id]:undefined}/>} 
      {current.view==='schools'&&<SchoolsPage stations={stations} readings={readings}/>} 
      {current.view==='data'&&<DataPage stations={stations} readings={readings}/>} 
      <footer>aqi.thingsnode · Open source air quality for Sri Lanka <span>Apache 2.0 code · CC BY 4.0 data</span></footer>
    </main>
  </div>
}

function Nav({active}:{active:View}){return <aside className="rail" aria-label="Primary"><a className="mark" href="/app/" aria-label="aqi.thingsnode home">a.</a><a className={active==='home'?'active':''} href="/app/"><span className="nav-icon">⌂</span><span>Home</span></a><a className={active==='map'||active==='station'?'active':''} href="/app/map"><span className="nav-icon">⌖</span><span>Map</span></a><a className={active==='schools'?'active':''} href="/app/schools"><span className="nav-icon">♙</span><span>Schools</span></a><a className={active==='data'?'active':''} href="/app/data"><span className="nav-icon">↓</span><span>Data</span></a></aside>}
function TopBar({title,demo,dismissDemo}:{title:string;demo:boolean;dismissDemo:()=>void}){return <header><div><div className="eyebrow">Colombo District</div><h1>{title}</h1></div><div className="head-actions">{demo&&<button className="demo" onClick={dismissDemo} title="Stations are being commissioned; figures are simulated from historical distributions.">Demo data <span aria-hidden>×</span></button>}<button className="round" aria-label="Settings">•••</button></div></header>}

function Home({stations,readings,selected,fieldStations}:{stations:Station[];readings:Record<string,Reading>;selected?:Station;fieldStations:(Station&{pm?:number})[]}){
  const reading=selected?readings[selected.id]:undefined,pm=reading?.measurements.pm2_5.value,sl=reading?.indices.sl_aqi.value,band=reading?.indices.sl_aqi.band;
  return <><a className="map-card" href="/app/map" aria-label="Open full network map"><AirMap stations={fieldStations}/><div className="map-label"><span className="live-dot"/> Network now <b>{stations.length} stations</b></div></a><section className="content"><div className="location"><div><div className="eyebrow">Nearest station</div><h2>{selected?.name??'Station registry unavailable'}</h2></div><a className="text-button" href="/app/map">Change</a></div><TwinReadout sl={sl} band={band} pm={pm}/>{reading?<><p className="summary">The Sri Lanka index calls this <b>{band!.toLowerCase()}</b>. The measured PM2.5 is <b>{pm!.toFixed(1)} µg/m³</b> against the WHO 24-hour guideline of 15.</p><DayRibbon values={Array(24).fill(pm!)}/></>:<p className="summary" role="status">Waiting for the first reading from this station. No sample value is being substituted.</p>}<div className="cards"><article><div className="eyebrow">School hours</div><h3>See advice for your school</h3><p>Use registered hours and the nearest stations to plan outdoor activity.</p><a href="/app/schools">Open school view →</a></article><article><div className="eyebrow">Data quality</div><h3>{reading?.provenance.calibration_state??'Awaiting telemetry'}</h3><p>{reading?'Latest reading carries complete source and calibration provenance.':'Waiting for the first live reading.'}</p><a href="/app/data">View methodology →</a></article></div></section></>
}

function MapPage({stations,readings,fieldStations}:{stations:Station[];readings:Record<string,Reading>;fieldStations:(Station&{pm?:number})[]}){return <section className="page-content map-page"><div className="full-map"><AirMap stations={fieldStations}/><div className="map-label"><span className="live-dot"/> {Object.keys(readings).length} reporting now</div></div><div className="station-list"><div className="section-heading"><div><div className="eyebrow">Station registry</div><h2>{stations.length} planned stations</h2></div></div>{stations.map(s=>{const r=readings[s.id];return <a className="station-row" href={`/app/stations/${s.id}`} key={s.id}><span><b>{s.name}</b><small>{s.site_class.replaceAll('_',' ')} · {s.district}</small></span><span className="row-value numeric">{r?r.indices.sl_aqi.value:'—'}<small>SL AQI</small></span></a>})}</div></section>}

function StationPage({station,reading}:{station?:Station;reading?:Reading}){if(!station)return <Empty title="Station unavailable"/>;const pm=reading?.measurements.pm2_5.value;return <section className="page-content"><a className="back" href="/app/map">← All stations</a><div className="detail-grid"><div><div className="eyebrow">{station.site_class.replaceAll('_',' ')}</div><h2>{station.name}</h2><p className="muted">{station.district}{station.corridor?` · ${station.corridor}`:''}</p></div><TwinReadout sl={reading?.indices.sl_aqi.value} band={reading?.indices.sl_aqi.band} pm={pm}/></div><div className="cards detail-cards"><article><div className="eyebrow">Particulates</div><h3 className="numeric">{pm?.toFixed(1)??'—'} µg/m³ PM2.5</h3><p className="numeric">{reading?.measurements.pm10.value.toFixed(1)??'—'} µg/m³ PM10</p></article><article><div className="eyebrow">Provenance</div><h3>{reading?.provenance.source_type??'Awaiting telemetry'}</h3><p>{reading?`${reading.provenance.calibration_state} · ${reading.provenance.confidence} confidence`:'No reading has been substituted.'}</p></article></div></section>}

function SchoolsPage({stations,readings}:{stations:Station[];readings:Record<string,Reading>}){const schoolStations=stations.filter(s=>s.site_class==='SCHOOL');return <section className="page-content"><div className="intro"><p className="eyebrow">Advice belongs here</p><h2>Outdoor activity, grounded in school hours</h2><p>School advisories use the station paired with each school gate. Demo stations show the final workflow without claiming measured conditions.</p></div><div className="cards school-grid">{schoolStations.map(s=>{const r=readings[s.id],pm=r?.measurements.pm2_5.value;return <article key={s.id}><div className="eyebrow">{s.district}</div><h3>{s.name}</h3><p>{pm===undefined?'Awaiting the first reading.':pm<=15?'Within the WHO 24-hour PM2.5 guideline.':`${pm.toFixed(1)} µg/m³ is above the WHO guideline.`}</p><a href={`/app/stations/${s.id}`}>View station evidence →</a></article>})}</div></section>}

function DataPage({stations,readings}:{stations:Station[];readings:Record<string,Reading>}){return <section className="page-content"><div className="intro"><p className="eyebrow">Open by default</p><h2>Methods, readings and provenance</h2><p>Every reading retains its raw values, correction state, source and confidence. The public API is available without browser credentials.</p></div><div className="cards data-grid"><article><div className="eyebrow">REST API</div><h3>{stations.length} stations · {Object.keys(readings).length} live readings</h3><p>Explore the generated OpenAPI reference and inspect exact response schemas.</p><a href="/api/v1/docs">Open API documentation →</a></article><article><div className="eyebrow">Station catalogue</div><h3>Download registry JSON</h3><p>Names, proposed coordinates, site classes and supported parameters.</p><a href="/api/v1/stations" download>Download stations →</a></article><article><div className="eyebrow">Methodology</div><h3>Known limits are part of the data</h3><p>SL AQI validation range, provisional RH correction and exposure reference are published in the repository.</p><a href="https://github.com/ThingNode/aqi-tn/tree/main/docs/methodology">Read methodology →</a></article></div></section>}
function Empty({title}:{title:string}){return <section className="page-content"><div className="notice">{title}</div></section>}
