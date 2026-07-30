import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource,Map as MapLibreMap,MapLayerMouseEvent,StyleSpecification} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Station} from '../types';

export type MappedStation=Station&{pm?:number;aqi?:number};
export type SchoolPOI={id:string;name:string;lng:number;lat:number;category?:'school'|'university'};
export type MapPick={kind:'station';id:string}|({kind:'school'}&SchoolPOI);
type MapDisplayOptions={schools:boolean;universities:boolean;roads:'major'|'all'|'none';places:'major'|'all'|'none'};
type Props={stations:MappedStation[];selected?:MapPick;userLocation?:[number,number];windowMode:'24h'|'7d'|'30d';onSelect:(pick:MapPick)=>void};

const bandExpression:any=['step',['coalesce',['get','aqi'],0],'#8EBD96',51,'#D8DC82',101,'#FED665',151,'#FA9D45',201,'#E76E6B',301,'#9A5D7C'];
const edgeExpression:any=['step',['coalesce',['get','aqi'],0],'#5E8C68',51,'#8E9346',101,'#A88322',151,'#B5651A',201,'#A83F3C',301,'#6B3A52'];
const defaultMapZoom=12.6;
const defaultDisplayOptions:MapDisplayOptions={schools:true,universities:true,roads:'major',places:'major'};
const rasterFallback:StyleSpecification={
  version:8,
  sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'Map data © OpenStreetMap contributors'}},
  layers:[
    {id:'fallback-background',type:'background',paint:{'background-color':'#FEFAE0'}},
    {id:'fallback-map',type:'raster',source:'osm',paint:{'raster-saturation':-0.45,'raster-opacity':0.82,'raster-contrast':-0.08}},
  ],
};

function stationGeoJSON(stations:MappedStation[],mode:Props['windowMode']):FeatureCollection{
  const multiplier=mode==='24h'?0.72:mode==='7d'?1.08:1.55;
  return{type:'FeatureCollection',features:stations.map(s=>({type:'Feature',id:s.id,geometry:{type:'Point',coordinates:[s.lng,s.lat]},properties:{id:s.id,name:s.name,aqi:s.aqi??0,pm:s.pm??0,hasReading:s.pm===undefined?0:1,radius:(75+Math.min(s.pm??0,70)*2.8)*multiplier,school:s.site_class==='SCHOOL'?1:0}}))};
}
function normalizeCoordinate(point:[number,number]):[number,number]{
  const longitude=((point[0]+180)%360+360)%360-180;
  return[longitude,Math.max(-85,Math.min(85,point[1]))];
}

function educationFilter(options:MapDisplayOptions):any{
  const categories:any[]=[];
  if(options.schools)categories.push(['==',['get','class'],'school']);
  if(options.universities)categories.push(['any',['match',['get','class'],['college','university'],true,false],['match',['get','subclass'],['college','university'],true,false]]);
  return categories.length===0?['==',['get','class'],'__hidden__']:categories.length===1?categories[0]:['any',...categories];
}

function applyDisplayOptions(map:MapLibreMap,options:MapDisplayOptions,poiFilters:Record<string,any>){
  const education=educationFilter(options);
  for(const[id,baseFilter]of Object.entries(poiFilters))if(map.getLayer(id))map.setFilter(id,baseFilter?['all',baseFilter,education]:education);
  if(map.getLayer('poi_transit'))map.setLayoutProperty('poi_transit','visibility','none');
  for(const layer of map.getStyle().layers??[]){
    const sourceLayer=(layer as any)['source-layer'];
    if(layer.type==='symbol'&&['aerodrome_label','housenumber','mountain_peak'].includes(sourceLayer))map.setLayoutProperty(layer.id,'visibility','none');
    if((sourceLayer==='transportation'||sourceLayer==='transportation_name')&&/^(tunnel|highway|bridge|road)/i.test(layer.id)&&!/railway/i.test(layer.id)){
      const isMinor=/(minor|service|track|path|link|oneway|area|pier)/i.test(layer.id);
      map.setLayoutProperty(layer.id,'visibility',options.roads==='none'||(options.roads==='major'&&isMinor)?'none':'visible');
    }
    if(sourceLayer==='place'&&layer.type==='symbol'){
      const isMinorPlace=/(other|town|village)/i.test(layer.id);
      map.setLayoutProperty(layer.id,'visibility',options.places==='none'||(options.places==='major'&&isMinorPlace)?'none':'visible');
    }
  }
}

function educationPick(event:MapLayerMouseEvent):MapPick|undefined{
  const feature=event.features?.[0];
  if(!feature)return;
  const geometry=feature.geometry;
  const coordinates=geometry.type==='Point'?geometry.coordinates:event.lngLat.toArray();
  const[lng,lat]=normalizeCoordinate([Number(coordinates[0]),Number(coordinates[1])]);
  const properties=feature.properties??{};
  const isUniversity=['college','university'].includes(properties.class)||['college','university'].includes(properties.subclass);
  const name=properties['name:en']??properties.name_en??properties['name:latin']??properties.name??(isUniversity?'University':'School');
  return{kind:'school',id:`osm-${feature.id??`${lng.toFixed(6)}-${lat.toFixed(6)}`}`,name:String(name),lng,lat,category:isUniversity?'university':'school'};
}

function frameSelection(map:MapLibreMap,selected:MapPick|undefined,stations:MappedStation[],userLocation:[number,number]|undefined){
  if(!map.getLayer('aqi-selected'))return;
  map.setFilter('aqi-selected',selected?.kind==='station'?['==',['get','id'],selected.id]:['==',['get','id'],'']);
  const point=selected?.kind==='station'?stations.find(station=>station.id===selected.id):selected;
  if(!point)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selectedPoint=normalizeCoordinate([point.lng,point.lat]);
  if(userLocation){
    const locationPoint=normalizeCoordinate(userLocation);
    const bounds=new maplibregl.LngLatBounds(locationPoint,locationPoint);
    bounds.extend(selectedPoint);
    map.fitBounds(bounds,{padding:{top:110,bottom:90,left:70,right:window.innerWidth>700?390:70},maxZoom:defaultMapZoom,duration:reduced?0:900});
  }else map.easeTo({center:selectedPoint,zoom:14,duration:reduced?0:700});
}

export function AirMap({stations,selected,userLocation,windowMode,onSelect}:Props){
  const[mapError,setMapError]=useState('');
  const container=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),loaded=useRef(false),locationMarker=useRef<maplibregl.Marker|null>(null);
  const stationsRef=useRef(stations),windowRef=useRef(windowMode),selectedRef=useRef(selected),userLocationRef=useRef(userLocation),poiFiltersRef=useRef<Record<string,any>>({});stationsRef.current=stations;windowRef.current=windowMode;selectedRef.current=selected;userLocationRef.current=userLocation;
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  useEffect(()=>{
    if(!container.current||mapRef.current)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed=false;
    let map:MapLibreMap|undefined;
    let fallbackTimer:number|undefined;
    const start=async()=>{
      const[styleResponse,tileResponse]=await Promise.all([
        fetch('https://tiles.openfreemap.org/styles/bright'),
        fetch('https://tiles.openfreemap.org/planet'),
      ]);
      if(!styleResponse.ok)throw new Error(`OpenFreeMap style returned ${styleResponse.status}`);
      if(!tileResponse.ok)throw new Error(`OpenFreeMap tiles returned ${tileResponse.status}`);
      const style=await styleResponse.json() as StyleSpecification;
      const tileMetadata=await tileResponse.json() as {tiles?:string[]};
      const tileUrl=tileMetadata.tiles?.[0];
      if(!tileUrl)throw new Error('OpenFreeMap did not provide a vector tile URL');
      style.sources.openmaptiles={type:'vector',tiles:[tileUrl],minzoom:0,maxzoom:14,attribution:'OpenFreeMap / OpenMapTiles / OpenStreetMap contributors'};
      if(disposed||!container.current)return;
      let activeMap:MapLibreMap;
      try{activeMap=new maplibregl.Map({container:container.current,style,center:[79.891,6.928],zoom:defaultMapZoom,pitch:reduced?0:50,bearing:reduced?0:-18,renderWorldCopies:false,canvasContextAttributes:{antialias:true},attributionControl:false})}catch(error){setMapError(error instanceof Error?error.message:'The map could not start');return}
      map=activeMap;
      mapRef.current=activeMap;
      activeMap.on('error',event=>{const message=(event.error as Error|undefined)?.message;if(message&&/(webgl|style.+load|failed to initialize|networkerror)/i.test(message))setMapError(message)});
    activeMap.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    activeMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    const addApplicationLayers=()=>{
      if(loaded.current)return;
      loaded.current=true;
      if(fallbackTimer)window.clearTimeout(fallbackTimer);
      const style=activeMap.getStyle();
      poiFiltersRef.current=Object.fromEntries((style.layers??[]).filter(layer=>/^poi_r\d+$/i.test(layer.id)).map(layer=>[layer.id,(layer as any).filter]));
      for(const layer of style.layers??[]){
        try{
          if(layer.type==='background')activeMap.setPaintProperty(layer.id,'background-color','#FEFAE0');
          if(layer.type==='fill'&&/water/i.test(layer.id))activeMap.setPaintProperty(layer.id,'fill-color','#DCE4D2');
          if(layer.type==='fill'&&/(park|landcover|landuse)/i.test(layer.id))activeMap.setPaintProperty(layer.id,'fill-color','#E9EDC9');
          if(layer.type==='line'&&/(road|street|highway)/i.test(layer.id))activeMap.setPaintProperty(layer.id,'line-color',/primary|trunk/i.test(layer.id)?'#E4DCC4':'#EFE7CE');
        }catch{/* style layers do not all expose the same paint properties */}
      }
      const firstLabel=(style.layers??[]).find((l:any)=>l.type==='symbol'&&l.layout?.['text-field'])?.id;
      if(style.sources.openmaptiles)activeMap.addLayer({id:'aqi-3d-buildings',source:'openmaptiles','source-layer':'building',type:'fill-extrusion',minzoom:14,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],0],0,'#FEFAE0',60,'#F2EBD2',200,'#E4DCC4'],'fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,15.5,['coalesce',['get','render_height'],0]],'fill-extrusion-base':['case',['>=',['zoom'],16],['coalesce',['get','render_min_height'],0],0],'fill-extrusion-opacity':0.92}},firstLabel);
      activeMap.addSource('aqi-stations',{type:'geojson',data:stationGeoJSON(stationsRef.current,windowRef.current)});
      activeMap.addLayer({id:'aqi-field-outer',type:'circle',source:'aqi-stations',paint:{'circle-radius':['get','radius'],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.28,0.08],'circle-blur':0.72,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      activeMap.addLayer({id:'aqi-field',type:'circle',source:'aqi-stations',paint:{'circle-radius':['*',['get','radius'],0.52],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.38,0.1],'circle-blur':0.68,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      activeMap.addLayer({id:'aqi-station-halo',type:'circle',source:'aqi-stations',paint:{'circle-radius':13,'circle-color':'rgba(255,255,255,0)','circle-stroke-width':3,'circle-stroke-color':edgeExpression,'circle-opacity':0.85}});
      activeMap.addLayer({id:'aqi-station-core',type:'circle',source:'aqi-stations',paint:{'circle-radius':7,'circle-color':bandExpression,'circle-stroke-width':3,'circle-stroke-color':'#FEFAE0'}});
      activeMap.addLayer({id:'aqi-selected',type:'circle',source:'aqi-stations',filter:['==',['get','id'],''],paint:{'circle-radius':17,'circle-color':'rgba(0,0,0,0)','circle-stroke-width':2,'circle-stroke-color':'#3A342B'}});
      activeMap.on('click','aqi-station-core',(e:MapLayerMouseEvent)=>{const id=e.features?.[0]?.properties?.id;if(id)selectRef.current({kind:'station',id})});
      applyDisplayOptions(activeMap,defaultDisplayOptions,poiFiltersRef.current);
      for(const id of Object.keys(poiFiltersRef.current)){
        activeMap.on('click',id,(event:MapLayerMouseEvent)=>{const pick=educationPick(event);if(pick)selectRef.current(pick)});
        activeMap.on('mouseenter',id,()=>activeMap.getCanvas().style.cursor='pointer');
        activeMap.on('mouseleave',id,()=>activeMap.getCanvas().style.cursor='');
      }
      for(const id of ['aqi-station-core']){activeMap.on('mouseenter',id,()=>activeMap.getCanvas().style.cursor='pointer');activeMap.on('mouseleave',id,()=>activeMap.getCanvas().style.cursor='')}
      frameSelection(activeMap,selectedRef.current,stationsRef.current,userLocationRef.current);
    };
    activeMap.on('style.load',addApplicationLayers);
    fallbackTimer=window.setTimeout(()=>{if(!loaded.current&&!disposed)activeMap.setStyle(rasterFallback)},4500);
    };
    void start().catch(error=>{if(!disposed)setMapError(error instanceof Error?error.message:'The map could not start')});
    return()=>{disposed=true;if(fallbackTimer)window.clearTimeout(fallbackTimer);loaded.current=false;locationMarker.current?.remove();map?.remove();mapRef.current=null};
  },[]);
  useEffect(()=>{if(loaded.current)(mapRef.current!.getSource('aqi-stations') as GeoJSONSource)?.setData(stationGeoJSON(stations,windowMode))},[stations,windowMode]);
  useEffect(()=>{if(loaded.current&&mapRef.current)frameSelection(mapRef.current,selected,stations,userLocation)},[selected,userLocation,stations]);
  useEffect(()=>{if(!userLocation||!mapRef.current)return;locationMarker.current?.remove();const el=document.createElement('div');el.className='user-location-marker';el.setAttribute('aria-label','Your location');locationMarker.current=new maplibregl.Marker({element:el}).setLngLat(normalizeCoordinate(userLocation)).addTo(mapRef.current);},[userLocation]);
  return <><div ref={container} className="real-map" aria-label="Interactive air quality map"/>{mapError&&<div className="map-render-error" role="alert"><b>Map could not load</b><span>{mapError}</span></div>}</>;
}
