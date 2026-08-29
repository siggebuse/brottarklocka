const OVERVIEW = "https://www.ringerdb.de/se/turniere/turnieruebersicht.aspx?Saison=2026&Land=SE&TurnierTyp=-1";

function decodeEntities(s=""){
  return s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'").replace(/&auml;/gi,"ä").replace(/&aring;/gi,"å")
    .replace(/&ouml;/gi,"ö").replace(/&Auml;/gi,"Ä").replace(/&Aring;/gi,"Å")
    .replace(/&Ouml;/gi,"Ö");
}
function strip(s=""){
  return decodeEntities(s.replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]*>/g,""))
    .replace(/\r/g,"").replace(/[ \t]+/g," ").replace(/\n +/g,"\n").trim();
}
function absolute(href, base){ try { return new URL(href, base).href; } catch { return ""; } }

async function getText(url){
  const r = await fetch(url,{headers:{"user-agent":"Mozilla/5.0 Brottarklocka/1.0"}});
  if(!r.ok) throw new Error("HTTP "+r.status);
  const buf=Buffer.from(await r.arrayBuffer());
  let text=buf.toString("utf8");
  if(text.includes("\uFFFD")) text=buf.toString("latin1");
  return text;
}

function parseTournaments(html){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  const out=[];
  for(const row of rows){
    const cells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
    if(cells.length<2) continue;
    const links=[...row.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const classic=links.find(x=>/turniereklassisch\.ringerdb\.de/i.test(x[1]) || /indexSWE\.htm/i.test(x[1]));
    if(!classic) continue;
    const name=strip(classic[2]), date=strip(cells[0]), place=cells.length>2?strip(cells[2]):"";
    const url=absolute(classic[1],OVERVIEW);
    if(name && url) out.push({name,date,place,url});
  }
  const seen=new Set();
  return out.filter(t=>!seen.has(t.url) && seen.add(t.url));
}

function parseMatchPage(html){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  const matches=[];
  for(const row of rows){
    const cells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>strip(m[1]));
    if(cells.length<4) continue;
    const nr=(cells[0]||"").match(/^\s*(\d+)\b/);
    if(!nr) continue;
    const red=(cells[2]||"").split("\n").map(x=>x.trim()).filter(Boolean);
    const blue=(cells[3]||"").split("\n").map(x=>x.trim()).filter(Boolean);
    if(!red.length || !blue.length) continue;
    matches.push({matchNumber:Number(nr[1]),redName:red[0]||"",redClub:red.slice(1).join(" ")||"",
      blueName:blue[0]||"",blueClub:blue.slice(1).join(" ")||""});
  }
  return matches;
}

async function allMatches(indexUrl){
  const html=await getText(indexUrl);
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?Matchlista[\s\S]*?)<\/a>/gi)]
    .map(m=>absolute(m[1],indexUrl)).filter(Boolean);
  const unique=[...new Set(links)], result=new Map();
  for(let i=0;i<unique.length;i+=4){
    const pages=await Promise.all(unique.slice(i,i+4).map(async u=>{try{return await getText(u)}catch{return ""}}));
    for(const p of pages) for(const m of parseMatchPage(p)) if(!result.has(m.matchNumber)) result.set(m.matchNumber,m);
  }
  return [...result.values()].sort((a,b)=>a.matchNumber-b.matchNumber);
}

export async function handler(event){
  try{
    const mode=event.queryStringParameters?.mode||"";
    if(mode==="tournaments"){
      const html=await getText(OVERVIEW);
      return {statusCode:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public,max-age=900"},
        body:JSON.stringify({tournaments:parseTournaments(html)})};
    }
    if(mode==="matches"){
      const url=event.queryStringParameters?.url||"";
      const u=new URL(url);
      if(u.hostname!=="turniereklassisch.ringerdb.de") throw new Error("Otillåten källa");
      return {statusCode:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public,max-age=120"},
        body:JSON.stringify({matches:await allMatches(u.href)})};
    }
    return {statusCode:400,body:"Bad request"};
  }catch(e){
    return {statusCode:500,headers:{"content-type":"application/json; charset=utf-8"},
      body:JSON.stringify({error:String(e.message||e)})};
  }
}
