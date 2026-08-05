import type {Reading,Station} from './types';
const base=import.meta.env.VITE_API_BASE ?? '/api/v1';
async function get<T>(path:string):Promise<T>{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(`${base}${path}`,{signal:controller.signal});if(!r.ok)throw new Error(`API ${r.status}`);return r.json()}finally{clearTimeout(timeout)}}
export const api={stations:()=>get<Station[]>('/stations'),latest:()=>get<Reading[]>('/readings/latest'),health:()=>get<{status:string;data_mode:string}>('/health')};
export function connect(onReading:(reading:Reading)=>void){
  const url=new URL(`${base}/ws`,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
  let ws:WebSocket|undefined,stopped=false,delay=1000;
  const open=()=>{ws=new WebSocket(url);ws.onopen=()=>{delay=1000;ws?.send(JSON.stringify({action:'subscribe'}))};ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='reading')onReading(m)};ws.onclose=()=>{if(!stopped)setTimeout(open,delay=Math.min(delay*2,30000))}};open();
  return()=>{stopped=true;ws?.close()};
}
