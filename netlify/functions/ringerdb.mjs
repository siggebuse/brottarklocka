const OVERVIEW = "https://www.ringerdb.de/se/turniere/turnieruebersicht.aspx?Saison=2026&Land=SE&TurnierTyp=-1";

function decodeEntities(s=""){
  return s
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/&auml;/gi,"ä").replace(/&aring;/gi,"å").replace(/&ouml;/gi,"ö")
    .replace(/&Auml;/gi,"Ä").replace(/&Aring;/gi,"Å").replace(/&Ouml;/gi,"Ö");
}

function strip(s=""){
  return decodeEntities(
    String(s)
      .replace(/<br\s*\/?>/gi,"\n")
      .replace(/<\/p>/gi,"\n")
      .replace(/<\/div>/gi,"\n")
      .replace(/<[^>]*>/g,"")
  )
    .replace(/\r/g,"")
    .replace(/[ \t]+/g," ")
    .replace(/\n +/g,"\n")
    .replace(/\n{2,}/g,"\n")
    .trim();
}

function absolute(href,base){
  try { return new URL(href,base).href; } catch { return ""; }
}

async function getBuffer(url){
  const r = await fetch(url,{
    headers:{
      "user-agent":"Mozilla/5.0 (Brottarklocka; RingerDB reader)",
      "accept":"text/html,text/plain,*/*"
    }
  });
  if(!r.ok) throw new Error("HTTP "+r.status+" för "+url);
  return Buffer.from(await r.arrayBuffer());
}

function decodeBuffer(buf){
  // RingerDB/Turnierverwaltung pages and exports can use older Western-European encodings.
  for(const enc of ["utf-8","windows-1252","iso-8859-1"]){
    try{
      const text = new TextDecoder(enc,{fatal:true}).decode(buf);
      if(text) return text;
    }catch{}
  }
  return buf.toString("latin1");
}

async function getText(url){
  return decodeBuffer(await getBuffer(url));
}

function parseTournaments(html){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  const out=[];
  for(const row of rows){
    const cells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
    if(cells.length<2) continue;

    const links=[...row.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const classic=links.find(x=>
      /turniereklassisch\.ringerdb\.de/i.test(x[1]) ||
      /\/VT\/20\d\d\/SE\//i.test(x[1]) ||
      /indexSWE\.htm/i.test(x[1])
    );
    if(!classic) continue;

    const name=strip(classic[2]);
    const date=strip(cells[0]);
    const place=cells.length>2 ? strip(cells[2]) : "";
    const url=absolute(classic[1],OVERVIEW);

    if(name && url) out.push({name,date,place,url});
  }

  const seen=new Set();
  return out.filter(t=>!seen.has(t.url) && seen.add(t.url));
}

function looksLikeNoise(s){
  const x=s.trim();
  if(!x) return true;
  if(/^(match|matchnr|matchnummer|nr|matta|mat|lista|matchlista|start|resultat|result|poäng|points?)$/i.test(x)) return true;
  if(/^(GR|FS|WW)\s*\d+/i.test(x)) return true;
  if(/^\d+\s*(kg)?$/i.test(x)) return true;
  if(/^\d{1,2}[:.]\d{2}$/.test(x)) return true;
  if(/^[0-9]+\s*[:\-]\s*[0-9]+$/.test(x)) return true;
  if(/^(VFA|VSU|VPO|VIN|DSQ|EVT|KL|N|Omg\.?|Runde|Round)$/i.test(x)) return true;
  return false;
}

function splitPersonBlock(s){
  const parts=s.split("\n").map(x=>x.trim()).filter(Boolean);
  if(parts.length>=2){
    return {name:parts[0], club:parts.slice(1).join(" ")};
  }
  return null;
}

function parseRowFlexible(row){
  const rawCells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>strip(m[1]));
  if(rawCells.length<3) return null;

  // Match number can be in different columns depending on list layout.
  let numberIndex=-1, matchNumber=null;
  for(let i=0;i<Math.min(rawCells.length,6);i++){
    const m=rawCells[i].match(/^\s*(\d{1,4})\s*$/);
    if(m){
      const n=Number(m[1]);
      if(n>=1 && n<=5000){ numberIndex=i; matchNumber=n; break; }
    }
  }
  if(matchNumber==null) return null;

  // Layout A: each wrestler is a cell containing "Name<br>Club".
  const blocks=[];
  for(let i=numberIndex+1;i<rawCells.length;i++){
    const b=splitPersonBlock(rawCells[i]);
    if(b && !looksLikeNoise(b.name) && !looksLikeNoise(b.club)){
      blocks.push(b);
    }
  }
  if(blocks.length>=2){
    return {
      matchNumber,
      redName:blocks[0].name, redClub:blocks[0].club,
      blueName:blocks[1].name, blueClub:blocks[1].club
    };
  }

  // Layout B: name and club use separate cells.
  const candidates=[];
  for(let i=numberIndex+1;i<rawCells.length;i++){
    const v=rawCells[i].replace(/\n/g," ").trim();
    if(!v || looksLikeNoise(v)) continue;
    // Ignore obvious result/metadata cells.
    if(/^\(?\d+\s*:\s*\d+\)?$/.test(v)) continue;
    if(/^(röd|rot|red|blå|blau|blue)$/i.test(v)) continue;
    candidates.push(v);
  }

  // Most RingerDB match lists yield:
  // wrestler 1, club 1, wrestler 2, club 2 among the textual candidates.
  // Prefer a 4-item window whose names look like personal names and clubs look plausible.
  function nameScore(v){
    let s=0;
    if(v.split(/\s+/).length>=2) s+=2;
    if(!/\b(BK|IK|AK|IF|Klubb|Wrestling|Brottning|Atlet|Stadslag|AIR|Thor)\b/i.test(v)) s+=1;
    return s;
  }
  function clubScore(v){
    let s=0;
    if(/\b(BK|IK|AK|IF|Klubb|Wrestling|Brottning|Atlet|Stadslag|AIR|Thor|Sparta|Ore|Pan|Viking)\b/i.test(v)) s+=2;
    if(v.length>=3) s+=1;
    return s;
  }

  let best=null, bestScore=-1;
  for(let i=0;i+3<candidates.length;i++){
    const a=candidates[i], b=candidates[i+1], c=candidates[i+2], d=candidates[i+3];
    const score=nameScore(a)+clubScore(b)+nameScore(c)+clubScore(d);
    if(score>bestScore){
      bestScore=score;
      best={matchNumber,redName:a,redClub:b,blueName:c,blueClub:d};
    }
  }
  return bestScore>=6 ? best : null;
}

function parseMatchPage(html){
  const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
  const matches=[];
  for(const row of rows){
    const m=parseRowFlexible(row);
    if(m) matches.push(m);
  }
  return matches;
}

function findMatchListLinks(html,indexUrl){
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const result=[];
  for(const m of links){
    const href=m[1];
    const label=strip(m[2]);
    // Match list files generated by Turnierverwaltung commonly contain KF + list number.
    if(/matchlista/i.test(label) || /KF\d+\.html?$/i.test(href) || /KF\d+\.htm$/i.test(href)){
      const u=absolute(href,indexUrl);
      if(u) result.push(u);
    }
  }
  return [...new Set(result)];
}

function findIndividualMatchesTextLink(html,indexUrl){
  const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for(const m of links){
    const href=m[1], label=strip(m[2]);
    if(/individuella matcher/i.test(label) || /_sm\.txt$/i.test(href)){
      return absolute(href,indexUrl);
    }
  }
  return "";
}

function parseIndividualText(text){
  const out=[];
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);

  for(const line of lines){
    let cols;
    if(line.includes("\t")) cols=line.split("\t");
    else if(line.includes(";")) cols=line.split(";");
    else if(line.includes("|")) cols=line.split("|");
    else continue;

    cols=cols.map(x=>x.trim().replace(/^"|"$/g,"")).filter(x=>x!=="");
    if(cols.length<5) continue;

    let numberIndex=cols.findIndex((x,i)=>i<6 && /^\d{1,4}$/.test(x));
    if(numberIndex<0) continue;
    const matchNumber=Number(cols[numberIndex]);
    if(matchNumber<1 || matchNumber>5000) continue;

    const candidates=cols.slice(numberIndex+1).filter(x=>!looksLikeNoise(x));
    if(candidates.length<4) continue;

    // Search for the best adjacent name/club/name/club window.
    function ns(v){ return v.split(/\s+/).length>=2 ? 2 : 0; }
    function cs(v){ return /\b(BK|IK|AK|IF|Klubb|Wrestling|Brottning|Atlet|Stadslag|AIR|Thor|Sparta|Ore|Pan|Viking)\b/i.test(v)?2:1; }

    let best=null,bestScore=-1;
    for(let i=0;i+3<candidates.length;i++){
      const score=ns(candidates[i])+cs(candidates[i+1])+ns(candidates[i+2])+cs(candidates[i+3]);
      if(score>bestScore){
        bestScore=score;
        best={
          matchNumber,
          redName:candidates[i],redClub:candidates[i+1],
          blueName:candidates[i+2],blueClub:candidates[i+3]
        };
      }
    }
    if(best && bestScore>=6) out.push(best);
  }
  return out;
}

async function allMatches(indexUrl){
  const indexHtml=await getText(indexUrl);
  const result=new Map();

  // First try the official individual-match text export.
  const txtUrl=findIndividualMatchesTextLink(indexHtml,indexUrl);
  if(txtUrl){
    try{
      const txt=await getText(txtUrl);
      for(const m of parseIndividualText(txt)){
        if(!result.has(m.matchNumber)) result.set(m.matchNumber,m);
      }
    }catch{}
  }

  // Then/fallback: parse every official RingerDB match list.
  const links=findMatchListLinks(indexHtml,indexUrl);
  for(let i=0;i<links.length;i+=4){
    const pages=await Promise.all(
      links.slice(i,i+4).map(async u=>{
        try{return await getText(u)}catch{return ""}
      })
    );
    for(const p of pages){
      for(const m of parseMatchPage(p)){
        if(!result.has(m.matchNumber)) result.set(m.matchNumber,m);
      }
    }
  }

  return {
    matches:[...result.values()].sort((a,b)=>a.matchNumber-b.matchNumber),
    debug:{matchListCount:links.length, textExportFound:Boolean(txtUrl)}
  };
}

export async function handler(event){
  try{
    const mode=event.queryStringParameters?.mode||"";

    if(mode==="tournaments"){
      const html=await getText(OVERVIEW);
      return {
        statusCode:200,
        headers:{
          "content-type":"application/json; charset=utf-8",
          "cache-control":"public,max-age=900"
        },
        body:JSON.stringify({tournaments:parseTournaments(html)})
      };
    }

    if(mode==="matches"){
      const url=event.queryStringParameters?.url||"";
      const u=new URL(url);
      if(u.hostname!=="turniereklassisch.ringerdb.de"){
        throw new Error("Otillåten källa");
      }

      const data=await allMatches(u.href);
      return {
        statusCode:200,
        headers:{
          "content-type":"application/json; charset=utf-8",
          "cache-control":"no-store"
        },
        body:JSON.stringify(data)
      };
    }

    return {statusCode:400,body:"Bad request"};
  }catch(e){
    return {
      statusCode:500,
      headers:{"content-type":"application/json; charset=utf-8"},
      body:JSON.stringify({error:String(e.message||e)})
    };
  }
}
