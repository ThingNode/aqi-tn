import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource,Map as MapLibreMap,MapLayerMouseEvent} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Station} from '../types';

export type MappedStation=Station&{pm?:number;aqi?:number};
export type SchoolPOI={id:string;name:string;lng:number;lat:number};
export type MapPick={kind:'station';id:string}|{kind:'school';id:string};
type Props={stations:MappedStation[];schools:SchoolPOI[];selected?:MapPick;userLocation?:[number,number];windowMode:'24h'|'7d'|'30d';onSelect:(pick:MapPick)=>void};

const bandExpression:any=['step',['coalesce',['get','aqi'],0],'#8EBD96',51,'#D8DC82',101,'#FED665',151,'#FA9D45',201,'#E76E6B',301,'#9A5D7C'];
const edgeExpression:any=['step',['coalesce',['get','aqi'],0],'#5E8C68',51,'#8E9346',101,'#A88322',151,'#B5651A',201,'#A83F3C',301,'#6B3A52'];

function stationGeoJSON(stations:MappedStation[],mode:Props['windowMode']):FeatureCollection{
  const multiplier=mode==='24h'?0.72:mode==='7d'?1.08:1.55;
  return{type:'FeatureCollection',features:stations.map(s=>({type:'Feature',id:s.id,geometry:{type:'Point',coordinates:[s.lng,s.lat]},properties:{id:s.id,name:s.name,aqi:s.aqi??0,pm:s.pm??0,hasReading:s.pm===undefined?0:1,radius:(20+Math.min(s.pm??0,70)*1.15)*multiplier,school:s.site_class==='SCHOOL'?1:0}}))};
}
function schoolGeoJSON(schools:SchoolPOI[]):FeatureCollection{return{type:'FeatureCollection',features:schools.map(s=>({type:'Feature',id:s.id,geometry:{type:'Point',coordinates:[s.lng,s.lat]},properties:{id:s.id,name:s.name}}))}}

export function AirMap({stations,schools,selected,userLocation,windowMode,onSelect}:Props){
  const[mapError,setMapError]=useState('');
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),loaded=useRef(false),locationMarker=useRef<maplibregl.Marker|null>(null);
  const stationsRef=useRef(stations),schoolsRef=useRef(schools),windowRef=useRef(windowMode);stationsRef.current=stations;schoolsRef.current=schools;windowRef.current=windowMode;
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  useEffect(()=>{
    if(!container.current||mapRef.current)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let map:MapLibreMap;
    try{map=new maplibregl.Map({container:container.current,style:'https://tiles.openfreemap.org/styles/bright',center:[79.891,6.928],zoom:11.5,pitch:reduced?0:50,bearing:reduced?0:-18,canvasContextAttributes:{antialias:true},attributionControl:false})}catch(error){setMapError(error instanceof Error?error.message:'The map could not start');return}
    mapRef.current=map;
    map.on('error',event=>{const message=(event.error as Error|undefined)?.message;if(message&&/(webgl|style.+load|failed to initialize)/i.test(message))setMapError(message)});
    map.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    map.on('load',()=>{
      loaded.current=true;
      const style=map.getStyle();
      for(const layer of style.layers??[]){
        try{
          if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#FEFAE0');
          if(layer.type==='fill'&&/water/i.test(layer.id))map.setPaintProperty(layer.id,'fill-color','#DCE4D2');
          if(layer.type==='fill'&&/(park|landcover|landuse)/i.test(layer.id))map.setPaintProperty(layer.id,'fill-color','#E9EDC9');
          if(layer.type==='line'&&/(road|street|highway)/i.test(layer.id))map.setPaintProperty(layer.id,'line-color',/primary|trunk/i.test(layer.id)?'#E4DCC4':'#EFE7CE');
        }catch{/* style layers do not all expose the same paint properties */}
      }
      const firstLabel=(style.layers??[]).find((l:any)=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
      map.addSource('aqi-buildings',{url:'https://tiles.openfreemap.org/planet',type:'vector'});
      map.addLayer({id:'aqi-3d-buildings',source:'aqi-buildings','source-layer':'building',type:'fill-extrusion',minzoom:14,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],0],0,'#FEFAE0',60,'#F2EBD2',200,'#E4DCC4'],'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,15.5,['coalesce',['get','render_height'],0]],'fill-extrusion-base':['case',['>=',['zoom'],16],['coalesce',['get','render_min_height'],0],0],'fill-extrusion-opacity':0.92}},firstLabel);
      map.addSource('aqi-stations',{type:'geojson',data:stationGeoJSON(stationsRef.current,windowRef.current)});
      map.addLayer({id:'aqi-field',type:'circle',source:'aqi-stations',paint:{'circle-radius':['get','radius'],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.24,0.08],'circle-blur':0.82,'circle-pitch-alignment':'map'}});
      map.addLayer({id:'aqi-station-halo',type:'circle',source:'aqi-stations',paint:{'circle-radius':13,'circle-color':'rgba(255,255,255,0)','circle-stroke-width':3,'circle-stroke-color':edgeExpression,'circle-opacity':0.85}});
      map.addLayer({id:'aqi-station-core',type:'circle',source:'aqi-stations',paint:{'circle-radius':7,'circle-color':bandExpression,'circle-stroke-width':3,'circle-stroke-color':'#FEFAE0'}});
      map.addSource('aqi-schools',{type:'geojson',data:schoolGeoJSON(schoolsRef.current)});
      map.addLayer({id:'aqi-school-points',type:'circle',source:'aqi-schools',paint:{'circle-radius':5,'circle-color':'#FEFAE0','circle-stroke-width':1.5,'circle-stroke-color':'#6E6555'}});
      map.addLayer({id:'aqi-selected',type:'circle',source:'aqi-stations',filter:['==',['get','id'],''],paint:{'circle-radius':17,'circle-color':'rgba(0,0,0,0)','circle-stroke-width':2,'circle-stroke-color':'#3A342B'}});
      map.on('click','aqi-station-core',(e:MapLayerMouseEvent)=>{const id=e.features?.[0]?.properties?.id;if(id)selectRef.current({kind:'station',id})});
      map.on('click','aqi-school-points',(e:MapLayerMouseEvent)=>{const id=e.features?.[0]?.properties?.id;if(id)selectRef.current({kind:'school',id})});
      for(const id of ['aqi-station-core','aqi-school-points']){map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='')}
    });
    return()=>{loaded.current=false;locationMarker.current?.remove();map.remove();mapRef.current=null};
  },[]);
  useEffect(()=>{if(loaded.current)(mapRef.current!.getSource('aqi-stations') as GeoJSONSource)?.setData(stationGeoJSON(stations,windowMode))},[stations,windowMode]);
  useEffect(()=>{if(loaded.current)(mapRef.current!.getSource('aqi-schools') as GeoJSONSource)?.setData(schoolGeoJSON(schools))},[schools]);
  useEffect(()=>{if(!loaded.current)return;const map=mapRef.current!;map.setFilter('aqi-selected',selected?.kind==='station'?['==',['get','id'],selected.id]:['==',['get','id'],'']);const point=selected?.kind==='station'?stations.find(s=>s.id===selected.id):schools.find(s=>s.id===selected?.id);if(!point)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(userLocation){map.fitBounds([userLocation,[point.lng,point.lat]],{padding:{top:110,bottom:90,left:70,right:window.innerWidth>700?390:70},maxZoom:14,duration:reduced?0:900})}else map.easeTo({center:[point.lng,point.lat],zoom:14,duration:reduced?0:700});},[selected,userLocation]);
  useEffect(()=>{if(!userLocation||!mapRef.current)return;locationMarker.current?.remove();const el=document.createElement('div');el.className='user-location-marker';el.setAttribute('aria-label','Your location');locationMarker.current=new maplibregl.Marker({element:el}).setLngLat(userLocation).addTo(mapRef.current);mapRef.current.flyTo({center:userLocation,zoom:13.8,pitch:45,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000});},[userLocation]);
  return <><div ref={container} className="real-map" aria-label="Interactive air quality map"/>{mapError&&<div className="map-render-error" role="alert"><b>Map could not load</b><span>{mapError}</span></div>}</>;
}
