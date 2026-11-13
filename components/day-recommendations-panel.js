"use client";
import DiscoveryPanel from "./discovery-panel";
export default function DayRecommendationsPanel({activeDay,activeStops=[],onAddStop}) {
 const stops=activeStops.length?activeStops:activeDay.stops||[];
 const last=stops.at(-1),anchor=(activeDay.stops||[]).at(-1)||last,name=typeof anchor==='string'?anchor:anchor?.name;
 const day={...activeDay,date:String(activeDay.id),city:name||activeDay.title||'',center:typeof last==='object'&&Array.isArray(last?.coord)?last.coord:undefined};
 return <DiscoveryPanel days={[day]} onAddStop={onAddStop}/>;
}
