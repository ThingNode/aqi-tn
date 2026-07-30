import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource,Map as MapLibreMap,MapLayerMouseEvent,StyleSpecification} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Station} from '../types';

export type MappedStation=Station&{pm?:number;aqi?:number;windSpeed?:number;windDirection?:number};
export type SchoolPOI={id:string;name:string;lng:number;lat:number;category?:'school'|'university'};
export type MapPick={kind:'station';id:string}|({kind:'school'}&SchoolPOI);
type MapDisplayOptions={schools:boolean;universities:boolean;roads:'major'|'all'|'none';places:'major'|'all'|'none'};
type Props={stations:MappedStation[];selected?:MapPick;userLocation?:[number,number];windowMode:'24h'|'7d'|'30d';onSelect:(pick:MapPick)=>void};

const bandExpression:any=['step',['coalesce',['get','aqi'],0],'#8EBD96',51,'#D8DC82',101,'#FED665',151,'#FA9D45',201,'#E76E6B',301,'#9A5D7C'];
const edgeExpression:any=['step',['coalesce',['get','aqi'],0],'#5E8C68',51,'#8E9346',101,'#A88322',151,'#B5651A',201,'#A83F3C',301,'#6B3A52'];
const fieldBands=[
  {max:50,fill:'#8EBD96',edge:'#5E8C68'},
  {max:100,fill:'#D8DC82',edge:'#8E9346'},
  {max:150,fill:'#FED665',edge:'#A88322'},
  {max:200,fill:'#FA9D45',edge:'#B5651A'},
  {max:300,fill:'#E76E6B',edge:'#A83F3C'},
  {max:Infinity,fill:'#9A5D7C',edge:'#6B3A52'},
];
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

function windowMultiplier(mode:Props['windowMode']){
  // Longer windows communicate a wider accumulated exposure field.
  // 24h inherits the former 7d footprint; 7d inherits the former 30d footprint.
  return mode==='24h'?1.08:mode==='7d'?1.55:1.95;
}

function stationGeoJSON(stations:MappedStation[],mode:Props['windowMode']):FeatureCollection{
  const multiplier=windowMultiplier(mode);
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
    if(sourceLayer==='transportation_name'&&/(shield|route.?number|road.?number)/i.test(layer.id))map.setLayoutProperty(layer.id,'visibility','none');
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

const svgNamespace='http://www.w3.org/2000/svg';
type AirOverlayItem={field:SVGGElement;rings:SVGGElement;station:MappedStation;toward?:number};

function svgElement<K extends keyof SVGElementTagNameMap>(tag:K){return document.createElementNS(svgNamespace,tag)}
function stationSeed(id:string){return Array.from(id).reduce((sum,char)=>((sum*31)+char.charCodeAt(0))%997,17)}
function fieldBand(aqi=0){return fieldBands.findIndex(band=>aqi<=band.max)}
function rgba(hex:string,alpha:number){const value=parseInt(hex.slice(1),16);return `rgba(${(value>>16)&255},${(value>>8)&255},${value&255},${alpha})`}

function positionAirOverlay(map:MapLibreMap,items:AirOverlayItem[]){
  for(const item of items){
    const point=map.project([item.station.lng,item.station.lat]);
    let angle=0;
    if(item.toward!==undefined){
      const bearing=item.toward*Math.PI/180;
      const probeLat=item.station.lat+Math.cos(bearing)*0.01;
      const probeLng=item.station.lng+Math.sin(bearing)*0.01/Math.cos(item.station.lat*Math.PI/180);
      const probe=map.project([probeLng,probeLat]);
      angle=Math.atan2(probe.y-point.y,probe.x-point.x)*180/Math.PI;
    }
    item.field.setAttribute('transform',`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
    item.rings.setAttribute('transform',`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
  }
}

function buildAirOverlay(host:HTMLDivElement,map:MapLibreMap,stations:MappedStation[],mode:Props['windowMode'],reduced:boolean){
  host.textContent='';
  const svg=svgElement('svg');
  svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.setAttribute('aria-hidden','true');
  const defs=svgElement('defs');
  fieldBands.forEach((band,index)=>{
    const gradient=svgElement('radialGradient');gradient.id=`air-gradient-${index}`;
    for(const[offset,opacity]of [['0%','1'],['48%','.78'],['78%','.3'],['100%','0']]){
      const stop=svgElement('stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',band.fill);stop.setAttribute('stop-opacity',opacity);gradient.appendChild(stop);
    }
    defs.appendChild(gradient);
    const halo=svgElement('radialGradient');halo.id=`air-halo-${index}`;
    const haloCore=svgElement('stop');haloCore.setAttribute('offset','0%');haloCore.setAttribute('stop-color',band.fill);haloCore.setAttribute('stop-opacity','.48');
    const haloEdge=svgElement('stop');haloEdge.setAttribute('offset','72%');haloEdge.setAttribute('stop-color',band.fill);haloEdge.setAttribute('stop-opacity','0');
    halo.append(haloCore,haloEdge);defs.appendChild(halo);
  });
  const texture=svgElement('filter');texture.id='air-organic-texture';
  texture.setAttribute('x','-35%');texture.setAttribute('y','-35%');texture.setAttribute('width','170%');texture.setAttribute('height','170%');
  const noise=svgElement('feTurbulence');noise.setAttribute('type','fractalNoise');noise.setAttribute('baseFrequency','.018 .042');noise.setAttribute('numOctaves','2');noise.setAttribute('seed','11');noise.setAttribute('stitchTiles','stitch');noise.setAttribute('result','noise');
  const displaced=svgElement('feDisplacementMap');displaced.setAttribute('in','SourceGraphic');displaced.setAttribute('in2','noise');displaced.setAttribute('scale','10');displaced.setAttribute('xChannelSelector','R');displaced.setAttribute('yChannelSelector','G');displaced.setAttribute('result','displaced');
  const blur=svgElement('feGaussianBlur');blur.setAttribute('in','displaced');blur.setAttribute('stdDeviation','5.5');blur.setAttribute('result','soft');
  const grain=svgElement('feColorMatrix');grain.setAttribute('in','noise');grain.setAttribute('type','matrix');grain.setAttribute('values','1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  .16 .16 .16 0 .48');grain.setAttribute('result','grain');
  const composite=svgElement('feComposite');composite.setAttribute('in','soft');composite.setAttribute('in2','grain');composite.setAttribute('operator','in');
  texture.append(noise,displaced,blur,grain,composite);defs.appendChild(texture);svg.appendChild(defs);

  const fields=svgElement('g');fields.setAttribute('class','air-fields');
  const ringLayer=svgElement('g');ringLayer.setAttribute('class','air-rings');
  const density=mode==='24h'?1:mode==='7d'?0.86:0.62;
  const items:AirOverlayItem[]=[];
  for(const station of stations){
    const bandIndex=fieldBand(station.aqi),band=fieldBands[bandIndex];
    const severity=Math.max(0,bandIndex),pm=station.pm??0;
    const radius=(75+Math.min(pm,70)*2.8)*windowMultiplier(mode)*.68;
    const hasWind=Number.isFinite(station.windSpeed)&&Number.isFinite(station.windDirection);
    const speed=hasWind?Math.max(.2,station.windSpeed!):0;
    // Device telemetry follows the meteorological convention (where wind comes
    // from); the design's plume bearing is the direction the air travels toward.
    const toward=hasWind?(station.windDirection!+180)%360:undefined;
    const push=hasWind?Math.min(.68,speed/8.5):0;
    const stretch=1+push*1.15;
    const duration=Math.max(3.4,Math.min(8.5,(8.6-severity*.3)/(.82+speed*.16)));
    const lobeCount=3+Math.min(3,severity);
    const lobeOpacity=Math.min(.62,.18+(pm/62)*.44)*density/lobeCount*2.3;
    const seed=stationSeed(station.id);
    const field=svgElement('g');field.setAttribute('class','air-plume-station');
    for(let index=0;index<lobeCount;index++){
      const variation=seed*.017+index*1.7;
      const spread=.4+(index/lobeCount)*.7;
      const dx=Math.cos(variation*2.1)*radius*.2+radius*push*spread;
      const dy=Math.sin(variation*1.7)*radius*.15;
      const lobeRadius=radius*(.58+(index/lobeCount)*.55);
      const lobe=svgElement('ellipse');
      lobe.setAttribute('cx',dx.toFixed(1));lobe.setAttribute('cy',dy.toFixed(1));
      lobe.setAttribute('rx',(lobeRadius*stretch).toFixed(1));lobe.setAttribute('ry',(lobeRadius/(hasWind?stretch*.78:1)).toFixed(1));
      lobe.setAttribute('fill',`url(#air-gradient-${bandIndex})`);lobe.setAttribute('filter','url(#air-organic-texture)');
      lobe.setAttribute('class',hasWind&&push>.04?'air-plume-lobe advecting':'air-plume-lobe drifting');
      const delay=hasWind?-(index*duration/lobeCount):-(index*.9);
      lobe.setAttribute('style',`--lobe-opacity:${lobeOpacity.toFixed(3)};--advect:${(radius*push*2.8).toFixed(0)}px;--cycle:${duration.toFixed(2)}s;--delay:${delay.toFixed(2)}s;transform-origin:${dx.toFixed(1)}px ${dy.toFixed(1)}px`);
      if(reduced)lobe.style.animation='none';
      field.appendChild(lobe);
    }
    fields.appendChild(field);

    const rings=svgElement('g');rings.setAttribute('class','air-sensor-rings');
    if(station.pm!==undefined){
      const halo=svgElement('circle');halo.setAttribute('cx','0');halo.setAttribute('cy','0');halo.setAttribute('r','22');halo.setAttribute('fill',`url(#air-halo-${bandIndex})`);halo.setAttribute('class','air-sensor-breathe');halo.setAttribute('style',`--breathe:${Math.max(2.8,5.2-severity*.45).toFixed(1)}s`);if(reduced)halo.style.animation='none';rings.appendChild(halo);
      for(let index=0;index<3;index++){
        const ring=svgElement('circle');ring.setAttribute('cx','0');ring.setAttribute('cy','0');ring.setAttribute('r',String(13+index*4));ring.setAttribute('fill','none');ring.setAttribute('stroke',rgba(band.edge,[.9,.65,.45][index]));ring.setAttribute('stroke-width',index===0?'1.5':'1.25');ring.setAttribute('class','air-sensor-ping');ring.setAttribute('style',`--ring-delay:${(-index*1.4).toFixed(1)}s`);if(reduced)ring.style.animation='none';rings.appendChild(ring);
      }
    }
    ringLayer.appendChild(rings);
    items.push({field,rings,station,toward});
  }
  svg.append(fields,ringLayer);host.appendChild(svg);positionAirOverlay(map,items);return items;
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
  const container=useRef<HTMLDivElement>(null),airOverlay=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),loaded=useRef(false),locationMarker=useRef<maplibregl.Marker|null>(null),airItems=useRef<AirOverlayItem[]>([]);
  const stationsRef=useRef(stations),windowRef=useRef(windowMode),selectedRef=useRef(selected),userLocationRef=useRef(userLocation),poiFiltersRef=useRef<Record<string,any>>({});stationsRef.current=stations;windowRef.current=windowMode;selectedRef.current=selected;userLocationRef.current=userLocation;
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  const refreshAirOverlay=()=>{if(mapRef.current&&airOverlay.current&&loaded.current){airItems.current=buildAirOverlay(airOverlay.current,mapRef.current,stationsRef.current,windowRef.current,matchMedia('(prefers-reduced-motion: reduce)').matches)}};
  const refreshAirOverlayRef=useRef(refreshAirOverlay);refreshAirOverlayRef.current=refreshAirOverlay;
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
      activeMap.addLayer({id:'aqi-field-outer',type:'circle',source:'aqi-stations',paint:{'circle-radius':['get','radius'],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.14,0.05],'circle-blur':0.78,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      activeMap.addLayer({id:'aqi-field',type:'circle',source:'aqi-stations',paint:{'circle-radius':['*',['get','radius'],0.52],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.2,0.07],'circle-blur':0.72,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
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
      refreshAirOverlayRef.current();
      activeMap.on('move',()=>positionAirOverlay(activeMap,airItems.current));
      frameSelection(activeMap,selectedRef.current,stationsRef.current,userLocationRef.current);
    };
    activeMap.on('style.load',addApplicationLayers);
    fallbackTimer=window.setTimeout(()=>{if(!loaded.current&&!disposed)activeMap.setStyle(rasterFallback)},4500);
    };
    void start().catch(error=>{if(!disposed)setMapError(error instanceof Error?error.message:'The map could not start')});
    return()=>{disposed=true;if(fallbackTimer)window.clearTimeout(fallbackTimer);loaded.current=false;locationMarker.current?.remove();airItems.current=[];if(airOverlay.current)airOverlay.current.textContent='';map?.remove();mapRef.current=null};
  },[]);
  useEffect(()=>{if(loaded.current){(mapRef.current!.getSource('aqi-stations') as GeoJSONSource)?.setData(stationGeoJSON(stations,windowMode));refreshAirOverlayRef.current()}},[stations,windowMode]);
  useEffect(()=>{if(loaded.current&&mapRef.current)frameSelection(mapRef.current,selected,stations,userLocation)},[selected,userLocation,stations]);
  useEffect(()=>{if(!userLocation||!mapRef.current)return;locationMarker.current?.remove();const el=document.createElement('div');el.className='user-location-marker';el.setAttribute('aria-label','Your location');locationMarker.current=new maplibregl.Marker({element:el}).setLngLat(normalizeCoordinate(userLocation)).addTo(mapRef.current);},[userLocation]);
  return <><div ref={container} className="real-map" aria-label="Interactive air quality map"/><div ref={airOverlay} className="air-animation-overlay"/>{mapError&&<div className="map-render-error" role="alert"><b>Map could not load</b><span>{mapError}</span></div>}</>;
}
