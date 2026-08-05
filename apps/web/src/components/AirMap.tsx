import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource,Map as MapLibreMap,MapLayerMouseEvent,StyleSpecification} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {Station} from '../types';
import beachIconUrl from '../assets/icons/beach.png';
import hospitalIconUrl from '../assets/icons/hospital.png';
import hotelIconUrl from '../assets/icons/hotel.png';
import parkIconUrl from '../assets/icons/park.png';
import schoolIconUrl from '../assets/icons/school.png';
import universityIconUrl from '../assets/icons/university.png';

export type MappedStation=Station&{pm?:number;aqi?:number;windSpeed?:number;windDirection?:number};
export type POICategory='school'|'university'|'hospital'|'hotel'|'park'|'beach';
export type MapPOI={id:string;name:string;lng:number;lat:number;category:POICategory};
export type MapPick={kind:'station';id:string}|({kind:'poi'}&MapPOI);
type MapDisplayOptions={roads:'major'|'all'|'none';places:'major'|'all'|'none'};
type Props={stations:MappedStation[];selected?:MapPick;userLocation?:[number,number];locationFocus:number;windowMode:'24h'|'7d'|'30d';onSelect:(pick:MapPick)=>void};

const bandExpression:any=['step',['coalesce',['get','aqi'],0],'#8EBD96',51,'#D8DC82',101,'#FED665',151,'#FA9D45',201,'#E76E6B',301,'#9A5D7C'];
const fieldBands=[
  {max:50,fill:'#8EBD96'},
  {max:100,fill:'#D8DC82'},
  {max:150,fill:'#FED665'},
  {max:200,fill:'#FA9D45'},
  {max:300,fill:'#E76E6B'},
  {max:Infinity,fill:'#9A5D7C'},
];
const defaultMapZoom=12.6;
const defaultDisplayOptions:MapDisplayOptions={roads:'major',places:'major'};
const poiIcons:Record<POICategory,{url:string;colour:string}>={
  school:{url:schoolIconUrl,colour:'#A9702F'},
  university:{url:universityIconUrl,colour:'#A9702F'},
  hospital:{url:hospitalIconUrl,colour:'#6E6555'},
  hotel:{url:hotelIconUrl,colour:'#6E6555'},
  park:{url:parkIconUrl,colour:'#66744E'},
  beach:{url:beachIconUrl,colour:'#66744E'},
};
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

const poiCategoryTests:Record<POICategory,any>={
  university:['any',['match',['get','class'],['college','university'],true,false],['match',['get','subclass'],['college','university'],true,false]],
  school:['==',['get','class'],'school'],
  hospital:['any',['==',['get','class'],'hospital'],['match',['get','subclass'],['hospital','clinic'],true,false]],
  hotel:['any',['==',['get','class'],'lodging'],['match',['get','subclass'],['hotel','motel','hostel','guest_house'],true,false]],
  park:['any',['==',['get','class'],'park'],['match',['get','subclass'],['park','garden','nature_reserve'],true,false]],
  beach:['any',['==',['get','class'],'beach'],['==',['get','subclass'],'beach']],
};

function supportedPoiFilter(categories:POICategory[]):any{
  const tests=categories.map(category=>poiCategoryTests[category]);
  return['all',['match',['geometry-type'],['Point','MultiPoint'],true,false],tests.length===1?tests[0]:['any',...tests]];
}

function rankedPoiFilter(categories:POICategory[],minimum:number,maximum?:number):any{
  const rank=['coalesce',['get','rank'],1];
  return['all',supportedPoiFilter(categories),['>=',rank,minimum],...(maximum===undefined?[]:[['<=',rank,maximum]])];
}

function poiIconExpression(categories:POICategory[]):any{
  const expression:any[]=['case'];
  for(const category of categories)expression.push(poiCategoryTests[category],`aqi-poi-${category}`);
  expression.push('');
  return expression;
}

function taggedPoiCategory(properties:Record<string,any>):POICategory|undefined{
  const primary=String(properties.class??''),secondary=String(properties.subclass??'');
  if(['college','university'].includes(primary)||['college','university'].includes(secondary))return'university';
  if(primary==='school')return'school';
  if(primary==='hospital'||['hospital','clinic'].includes(secondary))return'hospital';
  if(primary==='lodging'||['hotel','motel','hostel','guest_house'].includes(secondary))return'hotel';
  if(primary==='park'||['park','garden','nature_reserve'].includes(secondary))return'park';
  if(primary==='beach'||secondary==='beach')return'beach';
}

async function addThemedPoiIcons(map:MapLibreMap){
  await Promise.all(Object.entries(poiIcons).map(async([category,definition])=>{
    const name=`aqi-poi-${category}`;
    if(map.hasImage(name))return;
    const response=await map.loadImage(definition.url);
    const source=response.data;
    const tint=document.createElement('canvas');tint.width=64;tint.height=64;
    const tintContext=tint.getContext('2d',{willReadFrequently:true});
    if(!tintContext)return;
    tintContext.drawImage(source,0,0,64,64);
    tintContext.globalCompositeOperation='source-in';tintContext.fillStyle=definition.colour;tintContext.fillRect(0,0,64,64);
    const marker=document.createElement('canvas');marker.width=80;marker.height=80;
    const context=marker.getContext('2d',{willReadFrequently:true});
    if(!context)return;
    context.beginPath();context.arc(40,40,35,0,Math.PI*2);context.fillStyle='#FEFAE0';context.fill();context.lineWidth=3;context.strokeStyle='#CCD5AE';context.stroke();
    context.drawImage(tint,20,20,40,40);
    map.addImage(name,context.getImageData(0,0,80,80),{pixelRatio:2});
  }));
}

function applyDisplayOptions(map:MapLibreMap,options:MapDisplayOptions,poiFilters:Record<string,any>){
  for(const id of Object.keys(poiFilters))if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
  if(map.getLayer('poi_transit'))map.setLayoutProperty('poi_transit','visibility','none');
  for(const layer of map.getStyle().layers??[]){
    const sourceLayer=(layer as any)['source-layer'];
    if(layer.type==='symbol'&&['aerodrome_label','housenumber','mountain_peak'].includes(sourceLayer))map.setLayoutProperty(layer.id,'visibility','none');
    if(sourceLayer==='transportation_name'&&/(shield|route.?number|road.?number)/i.test(layer.id)){map.setLayoutProperty(layer.id,'visibility','none');continue}
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

function poiPick(event:MapLayerMouseEvent):MapPick|undefined{
  const feature=event.features?.[0];
  if(!feature)return;
  const geometry=feature.geometry;
  const coordinates=geometry.type==='Point'?geometry.coordinates:event.lngLat.toArray();
  const[lng,lat]=normalizeCoordinate([Number(coordinates[0]),Number(coordinates[1])]);
  const properties=feature.properties??{};
  const category=taggedPoiCategory(properties);
  if(!category)return;
  const fallback=category[0].toUpperCase()+category.slice(1);
  const name=properties['name:en']??properties.name_en??properties['name:latin']??properties.name??fallback;
  return{kind:'poi',id:`osm-${feature.id??`${lng.toFixed(6)}-${lat.toFixed(6)}`}`,name:String(name),lng,lat,category};
}

const svgNamespace='http://www.w3.org/2000/svg';
type AirOverlayItem={rings:SVGGElement;station:MappedStation};

function svgElement<K extends keyof SVGElementTagNameMap>(tag:K){return document.createElementNS(svgNamespace,tag)}
function stationSeed(id:string){return Array.from(id).reduce((sum,char)=>((sum*31)+char.charCodeAt(0))%997,17)}
function fieldBand(aqi=0){return fieldBands.findIndex(band=>aqi<=band.max)}

function positionAirOverlay(map:MapLibreMap,items:AirOverlayItem[]){
  for(const item of items){
    const point=map.project([item.station.lng,item.station.lat]);
    item.rings.setAttribute('transform',`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
  }
}

function projectedWindAngle(map:MapLibreMap,station:MappedStation,toward:number){
  const point=map.project([station.lng,station.lat]);
  const bearing=toward*Math.PI/180;
  const probeLat=station.lat+Math.cos(bearing)*0.01;
  const probeLng=station.lng+Math.sin(bearing)*0.01/Math.cos(station.lat*Math.PI/180);
  const probe=map.project([probeLng,probeLat]);
  return Math.atan2(probe.y-point.y,probe.x-point.x);
}

function plumeGeoJSON(map:MapLibreMap,stations:MappedStation[],mode:Props['windowMode'],elapsedMs:number):FeatureCollection{
  const density=mode==='24h'?1:mode==='7d'?0.86:0.62;
  const features:FeatureCollection['features']=[];
  for(const station of stations){
    if(station.pm===undefined)continue;
    const bandIndex=fieldBand(station.aqi),severity=Math.max(0,bandIndex),pm=station.pm;
    const baseRadius=(75+Math.min(pm,70)*2.8)*windowMultiplier(mode)*.68;
    const hasWind=Number.isFinite(station.windSpeed)&&Number.isFinite(station.windDirection);
    const speed=hasWind?Math.max(.2,station.windSpeed!):0;
    const toward=hasWind?(station.windDirection!+180)%360:0;
    const angle=hasWind?projectedWindAngle(map,station,toward):0;
    const push=hasWind?Math.min(.68,speed/8.5):0;
    const duration=Math.max(3.4,Math.min(8.5,(8.6-severity*.3)/(.82+speed*.16)));
    const lobeCount=3+Math.min(3,severity);
    const peakOpacity=Math.min(.62,.18+(pm/62)*.44)*density/lobeCount*2.3;
    const seed=stationSeed(station.id),origin=map.project([station.lng,station.lat]);
    for(let index=0;index<lobeCount;index++){
      const phase=((elapsedMs/1000/duration)+(index/lobeCount))%1;
      const variation=seed*.017+index*1.7;
      const spread=.4+(index/lobeCount)*.7;
      const baseX=Math.cos(variation*2.1)*baseRadius*.2+baseRadius*push*spread;
      const baseY=Math.sin(variation*1.7)*baseRadius*.15;
      const advect=hasWind?baseRadius*push*2.8*phase:Math.sin(phase*Math.PI*2)*baseRadius*.04;
      const localX=baseX+advect,localY=baseY;
      const screenX=origin.x+localX*Math.cos(angle)-localY*Math.sin(angle);
      const screenY=origin.y+localX*Math.sin(angle)+localY*Math.cos(angle);
      const coordinates=map.unproject([screenX,screenY]);
      const scale=hasWind?0.82+0.63*phase:1+0.085*Math.sin(phase*Math.PI*2);
      const opacity=phase<.45?peakOpacity*(.25+.75*phase/.45):peakOpacity*(1-(phase-.45)/.55);
      features.push({type:'Feature',id:`${station.id}-${index}`,geometry:{type:'Point',coordinates:[coordinates.lng,coordinates.lat]},properties:{aqi:station.aqi??0,radius:baseRadius*(.58+(index/lobeCount)*.55)*scale,opacity:Math.max(0,opacity)}});
    }
  }
  return{type:'FeatureCollection',features};
}

function buildAirOverlay(host:HTMLDivElement,map:MapLibreMap,stations:MappedStation[],reduced:boolean){
  host.textContent='';
  const svg=svgElement('svg');
  svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.setAttribute('aria-hidden','true');
  const defs=svgElement('defs');
  fieldBands.forEach((band,index)=>{
    const halo=svgElement('radialGradient');halo.id=`air-halo-${index}`;
    const haloCore=svgElement('stop');haloCore.setAttribute('offset','0%');haloCore.setAttribute('stop-color',band.fill);haloCore.setAttribute('stop-opacity','.48');
    const haloEdge=svgElement('stop');haloEdge.setAttribute('offset','72%');haloEdge.setAttribute('stop-color',band.fill);haloEdge.setAttribute('stop-opacity','0');
    halo.append(haloCore,haloEdge);defs.appendChild(halo);
  });
  svg.appendChild(defs);
  const ringLayer=svgElement('g');ringLayer.setAttribute('class','air-rings');
  const items:AirOverlayItem[]=[];
  for(const station of stations){
    const bandIndex=fieldBand(station.aqi),band=fieldBands[bandIndex];
    const rings=svgElement('g');rings.setAttribute('class','air-sensor-rings');
    if(station.pm!==undefined){
      const severity=Math.max(0,bandIndex);
      const halo=svgElement('circle');halo.setAttribute('cx','0');halo.setAttribute('cy','0');halo.setAttribute('r','23');halo.setAttribute('fill',`url(#air-halo-${bandIndex})`);halo.setAttribute('class','air-sensor-breathe');halo.setAttribute('style',`--breathe:${Math.max(2.8,5.2-severity*.45).toFixed(1)}s`);if(reduced)halo.style.animation='none';rings.appendChild(halo);
    }
    ringLayer.appendChild(rings);
    items.push({rings,station});
  }
  svg.appendChild(ringLayer);host.appendChild(svg);positionAirOverlay(map,items);return items;
}

function frameNetwork(map:MapLibreMap,stations:MappedStation[],reduced:boolean){
  if(!stations.length)return;
  const first=normalizeCoordinate([stations[0].lng,stations[0].lat]);
  const bounds=new maplibregl.LngLatBounds(first,first);
  for(const station of stations.slice(1))bounds.extend(normalizeCoordinate([station.lng,station.lat]));
  const mobile=window.innerWidth<700;
  map.fitBounds(bounds,{padding:mobile?{top:150,bottom:80,left:30,right:30}:{top:110,bottom:80,left:60,right:60},maxZoom:defaultMapZoom,duration:reduced?0:850});
}

function focusUserLocation(map:MapLibreMap,userLocation:[number,number]){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  map.easeTo({center:normalizeCoordinate(userLocation),zoom:Math.max(map.getZoom(),14),duration:reduced?0:800});
}

function placeUserMarker(map:MapLibreMap,userLocation:[number,number],current:maplibregl.Marker|null){
  current?.remove();
  const element=document.createElement('div');element.className='user-location-marker';element.setAttribute('aria-label','Your location');
  return new maplibregl.Marker({element}).setLngLat(normalizeCoordinate(userLocation)).addTo(map);
}

function frameSelection(map:MapLibreMap,selected:MapPick|undefined,stations:MappedStation[]){
  if(map.getLayer('aqi-selected'))map.setFilter('aqi-selected',selected?.kind==='station'?['==',['get','id'],selected.id]:['==',['get','id'],'']);
  const point=selected?.kind==='station'?stations.find(station=>station.id===selected.id):selected;
  if(!point)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selectedPoint=normalizeCoordinate([point.lng,point.lat]);
  map.easeTo({center:selectedPoint,zoom:14,duration:reduced?0:700});
}

export function AirMap({stations,selected,userLocation,locationFocus,windowMode,onSelect}:Props){
  const[mapError,setMapError]=useState('');
  const container=useRef<HTMLDivElement>(null),airOverlay=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),loaded=useRef(false),networkFramed=useRef(false),locationMarker=useRef<maplibregl.Marker|null>(null),airItems=useRef<AirOverlayItem[]>([]);
  const stationsRef=useRef(stations),windowRef=useRef(windowMode),selectedRef=useRef(selected),userLocationRef=useRef(userLocation),locationFocusRef=useRef(locationFocus),poiFiltersRef=useRef<Record<string,any>>({});stationsRef.current=stations;windowRef.current=windowMode;selectedRef.current=selected;userLocationRef.current=userLocation;locationFocusRef.current=locationFocus;
  const selectRef=useRef(onSelect);selectRef.current=onSelect;
  const refreshAirOverlay=()=>{if(mapRef.current&&airOverlay.current&&loaded.current){airItems.current=buildAirOverlay(airOverlay.current,mapRef.current,stationsRef.current,matchMedia('(prefers-reduced-motion: reduce)').matches)}};
  const refreshAirOverlayRef=useRef(refreshAirOverlay);refreshAirOverlayRef.current=refreshAirOverlay;
  useEffect(()=>{
    if(!container.current||mapRef.current)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let disposed=false;
    let map:MapLibreMap|undefined;
    let fallbackTimer:number|undefined;
    let plumeAnimation:number|undefined;
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
      try{activeMap=new maplibregl.Map({container:container.current,style,center:[79.891,6.928],zoom:defaultMapZoom,pitch:0,bearing:0,renderWorldCopies:false,canvasContextAttributes:{antialias:true},attributionControl:false})}catch(error){setMapError(error instanceof Error?error.message:'The map could not start');return}
      map=activeMap;
      mapRef.current=activeMap;
      activeMap.on('error',event=>{const message=(event.error as Error|undefined)?.message;if(message&&/(webgl|style.+load|failed to initialize|networkerror)/i.test(message))setMapError(message)});
    activeMap.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    activeMap.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    const addApplicationLayers=async()=>{
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
      try{await addThemedPoiIcons(activeMap)}catch(error){console.warn('Place icons could not be loaded',error)}
      if(disposed)return;
      activeMap.addSource('aqi-stations',{type:'geojson',data:stationGeoJSON(stationsRef.current,windowRef.current)});
      activeMap.addSource('aqi-plumes',{type:'geojson',data:plumeGeoJSON(activeMap,stationsRef.current,windowRef.current,0)});
      activeMap.addLayer({id:'aqi-field-outer',type:'circle',source:'aqi-stations',paint:{'circle-radius':['get','radius'],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.14,0.05],'circle-blur':0.78,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      activeMap.addLayer({id:'aqi-field',type:'circle',source:'aqi-stations',paint:{'circle-radius':['*',['get','radius'],0.52],'circle-color':bandExpression,'circle-opacity':['case',['==',['get','hasReading'],1],0.2,0.07],'circle-blur':0.72,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      activeMap.addLayer({id:'aqi-plume-outer',type:'circle',source:'aqi-plumes',paint:{'circle-radius':['get','radius'],'circle-color':bandExpression,'circle-opacity':['*',['get','opacity'],0.72],'circle-blur':0.78,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      activeMap.addLayer({id:'aqi-plume-inner',type:'circle',source:'aqi-plumes',paint:{'circle-radius':['*',['get','radius'],0.58],'circle-color':bandExpression,'circle-opacity':['*',['get','opacity'],0.48],'circle-blur':0.62,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}},firstLabel);
      // OpenMapTiles exposes the original OpenStreetMap class/subclass tags in
      // its POI layer. Rank keeps the overview quiet; local POIs join at z16.
      const essentialCategories:POICategory[]=['school','university','hospital'];
      const contextCategories:POICategory[]=['hotel','park','beach'];
      const allPoiCategories:POICategory[]=[...essentialCategories,...contextCategories];
      const poiLayout=(categories:POICategory[])=>({'icon-image':poiIconExpression(categories),'icon-size':['interpolate',['linear'],['zoom'],14,.72,17,.9],'icon-allow-overlap':false,'icon-ignore-placement':false,'icon-padding':8,'symbol-sort-key':['coalesce',['get','rank'],99]});
      activeMap.addLayer({id:'aqi-poi-essential',type:'symbol',source:'openmaptiles','source-layer':'poi',minzoom:14,filter:rankedPoiFilter(essentialCategories,1,5),layout:poiLayout(essentialCategories)} as any,firstLabel);
      activeMap.addLayer({id:'aqi-poi-context',type:'symbol',source:'openmaptiles','source-layer':'poi',minzoom:14,filter:rankedPoiFilter(contextCategories,1,5),layout:poiLayout(contextCategories)} as any,firstLabel);
      activeMap.addLayer({id:'aqi-poi-local',type:'symbol',source:'openmaptiles','source-layer':'poi',minzoom:16,filter:rankedPoiFilter(allPoiCategories,6),layout:poiLayout(allPoiCategories)} as any,firstLabel);
      activeMap.addLayer({id:'aqi-station-core',type:'circle',source:'aqi-stations',paint:{'circle-radius':7,'circle-color':bandExpression,'circle-stroke-width':3,'circle-stroke-color':'#FEFAE0'}});
      activeMap.on('click','aqi-station-core',(e:MapLayerMouseEvent)=>{const id=e.features?.[0]?.properties?.id;if(id)selectRef.current({kind:'station',id})});
      applyDisplayOptions(activeMap,defaultDisplayOptions,poiFiltersRef.current);
      // Keep the solid sensor core above every map and plume layer. The soft
      // breathing halo is the separate DOM overlay immediately above the map.
      activeMap.moveLayer('aqi-station-core');
      for(const id of ['aqi-poi-essential','aqi-poi-context','aqi-poi-local']){
        activeMap.on('click',id,(event:MapLayerMouseEvent)=>{const pick=poiPick(event);if(pick)selectRef.current(pick)});
        activeMap.on('mouseenter',id,()=>activeMap.getCanvas().style.cursor='pointer');
        activeMap.on('mouseleave',id,()=>activeMap.getCanvas().style.cursor='');
      }
      for(const id of ['aqi-station-core']){activeMap.on('mouseenter',id,()=>activeMap.getCanvas().style.cursor='pointer');activeMap.on('mouseleave',id,()=>activeMap.getCanvas().style.cursor='')}
      refreshAirOverlayRef.current();
      activeMap.on('move',()=>positionAirOverlay(activeMap,airItems.current));
      if(reduced)(activeMap.getSource('aqi-plumes') as GeoJSONSource).setData(plumeGeoJSON(activeMap,stationsRef.current,windowRef.current,1800));
      else{
        const animatePlumes=(time:number)=>{
          if(disposed)return;
          if(time-lastPlumeFrame>=50){(activeMap.getSource('aqi-plumes') as GeoJSONSource)?.setData(plumeGeoJSON(activeMap,stationsRef.current,windowRef.current,time));lastPlumeFrame=time}
          plumeAnimation=requestAnimationFrame(animatePlumes);
        };
        let lastPlumeFrame=0;
        plumeAnimation=requestAnimationFrame(animatePlumes);
      }
      if(stationsRef.current.length){frameNetwork(activeMap,stationsRef.current,reduced);networkFramed.current=true}
      frameSelection(activeMap,selectedRef.current,stationsRef.current);
      if(userLocationRef.current){locationMarker.current=placeUserMarker(activeMap,userLocationRef.current,locationMarker.current);if(locationFocusRef.current>0)focusUserLocation(activeMap,userLocationRef.current)}
    };
    activeMap.on('style.load',()=>{void addApplicationLayers()});
    fallbackTimer=window.setTimeout(()=>{if(!loaded.current&&!disposed)activeMap.setStyle(rasterFallback)},4500);
    };
    void start().catch(error=>{if(!disposed)setMapError(error instanceof Error?error.message:'The map could not start')});
    return()=>{disposed=true;if(fallbackTimer)window.clearTimeout(fallbackTimer);if(plumeAnimation)cancelAnimationFrame(plumeAnimation);loaded.current=false;locationMarker.current?.remove();airItems.current=[];if(airOverlay.current)airOverlay.current.textContent='';map?.remove();mapRef.current=null};
  },[]);
  useEffect(()=>{if(loaded.current){const map=mapRef.current!;(map.getSource('aqi-stations') as GeoJSONSource)?.setData(stationGeoJSON(stations,windowMode));(map.getSource('aqi-plumes') as GeoJSONSource)?.setData(plumeGeoJSON(map,stations,windowMode,performance.now()));refreshAirOverlayRef.current();if(!networkFramed.current&&stations.length){frameNetwork(map,stations,matchMedia('(prefers-reduced-motion: reduce)').matches);networkFramed.current=true}}},[stations,windowMode]);
  useEffect(()=>{if(loaded.current&&mapRef.current)frameSelection(mapRef.current,selected,stations)},[selected,stations]);
  useEffect(()=>{if(locationFocus>0&&userLocation&&loaded.current&&mapRef.current)focusUserLocation(mapRef.current,userLocation)},[locationFocus,userLocation]);
  useEffect(()=>{if(!userLocation||!mapRef.current)return;locationMarker.current=placeUserMarker(mapRef.current,userLocation,locationMarker.current)},[userLocation]);
  return <><div ref={container} className="real-map" aria-label="Interactive air quality map"/><div ref={airOverlay} className="air-animation-overlay"/>{mapError&&<div className="map-render-error" role="alert"><b>Map could not load</b><span>{mapError}</span></div>}</>;
}
