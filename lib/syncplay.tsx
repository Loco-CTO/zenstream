"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

export type SyncplayGroup = { id:string; name:string; hostUserId:string; hostName:string; allowViewerControls:boolean; itemId:string|null; position:number; playing:boolean; resumeWhenReady:boolean; revision:number; updatedAt:number; members:{userId:string;username:string;viewing:boolean;loading:boolean;role:"host"|"viewer"}[] };
type Context = { groups:SyncplayGroup[]; active:SyncplayGroup|null; create:()=>Promise<void>; join:(id:string)=>Promise<void>; leave:()=>Promise<void>; refresh:()=>Promise<void>; setControls:(value:boolean)=>Promise<void>; command:(value:{action:string;itemId?:string;position:number;playing:boolean})=>Promise<void>; presence:(viewing:boolean,loading:boolean)=>Promise<void>; canControl:boolean };
const emptyContext: Context = { groups: [], active: null, create: async () => undefined, join: async () => undefined, leave: async () => undefined, refresh: async () => undefined, setControls: async () => undefined, command: async () => undefined, presence: async () => undefined, canControl: false };
const SyncplayContext=createContext<Context>(emptyContext);
async function call(path:string, method="GET", body?:unknown) { const r=await fetch(`/api/syncplay/${path}`,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store"}); if(!r.ok) throw new Error((await r.json().catch(()=>({}))).message??"Syncplay request failed."); return r.status===204?null:r.json(); }
export function SyncplayProvider({userId,children}:{userId:string;children:ReactNode}) {
 const router=useRouter(); const pathname=usePathname();
 const [groups,setGroups]=useState<SyncplayGroup[]>([]); const [active,setActive]=useState<SyncplayGroup|null>(null);
 const refresh=useCallback(async()=>{const d=await call("groups");setGroups(d.groups); setActive(current=>current?d.groups.find((x:SyncplayGroup)=>x.id===current.id)??null:current);},[]);
 useEffect(()=>{const initial=window.setTimeout(()=>void refresh().catch(()=>undefined),0);const id=window.setInterval(()=>void refresh().catch(()=>undefined),1500);return()=>{window.clearTimeout(initial);window.clearInterval(id);};},[refresh]);
 useEffect(()=>{if(active?.itemId && !pathname.includes(active.itemId)) router.push(`/show/${encodeURIComponent(active.itemId)}`);},[active?.itemId,pathname,router]);
 const adopt=(group:SyncplayGroup)=>{setActive(group);setGroups(old=>[group,...old.filter(x=>x.id!==group.id)]);};
 const create=async()=>adopt(await call("groups","POST")); const join=async(id:string)=>adopt(await call(`groups/${id}/join`,"POST"));
 const leave=async()=>{if(!active)return;await call(`groups/${active.id}`,"DELETE");setActive(null);await refresh();};
 const setControls=async(value:boolean)=>{if(active)adopt(await call(`groups/${active.id}`,"PATCH",{allowViewerControls:value}));};
 const command=async(value:{action:string;itemId?:string;position:number;playing:boolean})=>{if(active)adopt(await call(`groups/${active.id}/command`,"POST",{...value,revision:active.revision}));};
 const presence=async(viewing:boolean,loading:boolean)=>{if(active)adopt(await call(`groups/${active.id}/presence`,"POST",{viewing,loading}));};
 const value=useMemo(()=>({groups,active,create,join,leave,refresh,setControls,command,presence,canControl:Boolean(active&&(active.hostUserId===userId||active.allowViewerControls))}),[groups,active,userId,refresh]);
 return <SyncplayContext.Provider value={value}>{children}</SyncplayContext.Provider>;
}
export function useSyncplay(){return useContext(SyncplayContext);}
