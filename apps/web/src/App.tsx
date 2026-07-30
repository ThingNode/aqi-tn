import{useEffect,useMemo,useState}from'react';import{api,connect}from'./api';import type{Reading,Station}from'./types';import{AirMap}from'./components/AirMap';import{TwinReadout}from'./components/TwinReadout';import{DayRibbon}from'./components/DayRibbon';

export function App(){
 const[stations,setStations]=useState<Station[]>([]),[readings,setReadings]=useState<Record<string,Reading>>({}),[demo,setDemo]=useState(true),[error,setError]=useState('');
 useEffect(()=>{Promise.all([api.stations(),api.latest()]).then(([s,r])=>{setStations(s);setReadings(Object.fromEntries(r.map(x=>[x.station_id,x]))) }).catch(()=>setError('Live readings are temporarily unavailable. The station registry is still loading.'));return connect(r=>setReadings(v=>({...v,[r.station_id]:r})))},[]);
 const selected=stations.find(s=>readings[s.id])??stations.find(s=>s.id==='sta-cor-hlr-nugegoda')??stations[0];
 const reading=selected?readings[selected.id]:undefined;const pm=reading?.measurements.pm2_5.value;const sl=reading?.indices.sl_aqi.value;const band=reading?.indices.sl_aqi.band;
 const fieldStations=useMemo(()=>stations.map(s=>({...s,pm:readings[s.id]?.measurements.pm2_5.value})),[stations,readings]);
 return <div className="shell">
  <aside className="rail" aria-label="Primary"><a className="mark" href="/app/" aria-label="aqi.thingsnode home">a.</a><a className="active" href="#home">⌂<span>Home</span></a><a href="#map">⌖<span>Map</span></a><a href="#schools">♙<span>Schools</span></a><a href="#data">↓<span>Data</span></a></aside>
  <main id="home"><header><div><div className="eyebrow">Colombo District</div><h1>What is the air doing?</h1></div><div className="head-actions">{demo&&<button className="demo" onClick={()=>setDemo(false)} title="Stations are being commissioned; figures are simulated from historical distributions.">Demo data <span aria-hidden>×</span></button>}<button className="round" aria-label="Settings">•••</button></div></header>
   {error&&<div className="notice" role="status">{error}</div>}
   <section className="map-card" id="map"><AirMap stations={fieldStations}/><div className="map-label"><span className="live-dot"/> Network now <b>{stations.length||15} stations</b></div></section>
   <section className="content"><div className="location"><div><div className="eyebrow">Nearest station</div><h2>{selected?.name??'Nugegoda — High Level Road'}</h2></div><button className="text-button">Change</button></div>
    <TwinReadout sl={sl} band={band} pm={pm}/>{reading?<><p className="summary">The Sri Lanka index calls this <b>{band!.toLowerCase()}</b>. The measured PM2.5 is <b>{pm!.toFixed(1)} µg/m³</b> against the WHO 24-hour guideline of 15.</p><DayRibbon values={Array(24).fill(pm!)}/></>:<p className="summary" role="status">Waiting for the first reading from this station. No sample value is being substituted.</p>}<div className="cards"><article><div className="eyebrow">School hours</div><h3>See advice for your school</h3><p>Use registered hours and the nearest stations to plan outdoor activity.</p><a href="#schools">Open school view →</a></article><article><div className="eyebrow">Data quality</div><h3>{reading?.provenance.calibration_state??'Awaiting telemetry'}</h3><p>{reading?'Latest reading carries complete source and calibration provenance.':'Waiting for the first live reading.'}</p><a href="#data">View methodology →</a></article></div>
   </section><footer>aqi.thingsnode · Open source air quality for Sri Lanka <span>Apache 2.0 code · CC BY 4.0 data</span></footer>
  </main>
 </div>
}
