export type Station={id:string;name:string;lat:number;lng:number;site_class:string;district:string;corridor?:string};
export type Reading={station_id:string;timestamp_utc:string;measurements:{pm2_5:{value:number;unit:string};pm10:{value:number;unit:string}};indices:{sl_aqi:{value:number;band:string;dominant:string};us_aqi:{value:number;band:string};who_24h:{status:string;guideline:number;ratio:number}};provenance:{source_type:string;calibration_state:string;confidence:string}};

