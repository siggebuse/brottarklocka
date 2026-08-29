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


function looksLikeNoise(s=""){
  const x=String(s).trim();
  if(!x) return true;
  if(/^(match|matchnr|matchnummer|nr|matta|mat|lista|matchlista|start|resultat|result|poäng|points?)$/i.test(x)) return true;
  if(/^(GR|FS|WW)\s*\d+/i.test(x)) return true;
  if(/^\d+\s*(kg)?$/i.test(x)) return true;
  if(/^\d{1,2}[:.]\d{2}$/.test(x)) return true;
  if(/^[0-9]+\s*[:\-]\s*[0-9]+$/.test(x)) return true;
  if(/^(VFA|VSU|VPO|VIN|DSQ|EVT|KL|N|Omg\.?|Runde|Round)$/i.test(x)) return true;
  return false;
}

function splitPersonBlock(s=""){
  const parts=String(s).split("\n").map(x=>x.trim()).filter(Boolean);
  if(parts.length>=2){
    return {name:parts[0], club:parts.slice(1).join(" ")};
  }
  return null;
}


function parseRowFlexible(row){
  const rawCells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
  const cells=rawCells.map(c=>strip(c));
  if(cells.length<5) return null;

  // Matchnumret ligger i början av raden.
  let matchNumber=null;
  for(let i=0;i<Math.min(cells.length,4);i++){
    const m=cells[i].match(/^\s*(\d{1,4})\s*$/);
    if(m){
      const n=Number(m[1]);
      if(n>=1 && n<=5000){ matchNumber=n; break; }
    }
  }
  if(matchNumber==null) return null;

  // I RingerDB:s matchlistor är brottarnamnen klickbara länkar.
  // Vi letar därför efter de två celler som innehåller en <a>-tagg
  // och läser "namn + klubb" ur just dessa celler.
  const people=[];
  for(let i=0;i<rawCells.length;i++){
    if(!/<a\b/i.test(rawCells[i])) continue;

    const text=strip(rawCells[i]);
    const lines=text.split("\n").map(x=>x.trim()).filter(Boolean);
    if(lines.length<2) continue;

    // Första raden är normalt brottarens namn, resterande är klubb/distrikt.
    const name=lines[0];
    const club=lines.slice(1).join(" ");

    if(!name || !club) continue;
    if(looksLikeNoise(name) || looksLikeNoise(club)) continue;

    people.push({name,club});
  }

  if(people.length>=2){
    return {
      matchNumber,
      redName:people[0].name,
      redClub:people[0].club,
      blueName:people[1].name,
      blueClub:people[1].club
    };
  }

  // Fallback för sidor där namnen inte är länkar:
  // hitta celler som tydligt innehåller "namn<br>klubb".
  const blocks=[];
  for(const raw of rawCells){
    const b=splitPersonBlock(strip(raw));
    if(!b) continue;
    if(looksLikeNoise(b.name) || looksLikeNoise(b.club)) continue;

    // Undvik pool/omgång som "N2-N1 / N Omg. 2".
    if(/^[A-Z]?\d+\s*-\s*[A-Z]?\d+$/i.test(b.name)) continue;
    if(/\bOmg\.?\b/i.test(b.club)) continue;

    blocks.push(b);
  }

  if(blocks.length>=2){
    return {
      matchNumber,
      redName:blocks[0].name,
      redClub:blocks[0].club,
      blueName:blocks[1].name,
      blueClub:blocks[1].club
    };
  }

  return null;
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

function extractAnchors(html){
  const out=[];
  // Supports href="x", href='x' and href=x
  const re=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))!==null){
    const attrs=m[1]||"";
    const label=strip(m[2]||"");
    const hm=attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if(!hm) continue;
    const href=decodeEntities(hm[1]||hm[2]||hm[3]||"");
    if(href) out.push({href,label});
  }
  return out;
}

function findMatchListLinks(html,indexUrl){
  const result=[];
  for(const a of extractAnchors(html)){
    const href=a.href;
    const label=a.label;
    if(
      /matchlista\s*\d+/i.test(label) ||
      /KF\d{4}\.html?$/i.test(href) ||
      /KF\d{4}\.htm$/i.test(href)
    ){
      const u=absolute(href,indexUrl);
      if(u) result.push(u);
    }
  }

  // Some Turnierverwaltung pages use unusual/malformed anchor markup.
  // As a fallback, collect KF0001.htm-style filenames directly from the HTML.
  for(const m of html.matchAll(/(?:["'=\/])([A-Za-z0-9_-]+KF\d{4}\.htm)(?=["'\s>])/gi)){
    const u=absolute(m[1],indexUrl);
    if(u) result.push(u);
  }

  return [...new Set(result)];
}
function findIndividualMatchesTextLink(html,indexUrl){
  for(const a of extractAnchors(html)){
    if(/individuella matcher/i.test(a.label) || /_sm\.txt$/i.test(a.href)){
      return absolute(a.href,indexUrl);
    }
  }
  const m=html.match(/([A-Za-z0-9_-]+_sm\.txt)/i);
  return m ? absolute(m[1],indexUrl) : "";
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
        try{return await getText(u)}catch(e){ return "<!-- FETCH_ERROR:"+String(e.message||e)+" -->"; }
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
    debug:{matchListCount:links.length, textExportFound:Boolean(txtUrl), parsedMatches:result.size, firstMatchList:links[0]||"", sample:[...result.values()].slice(0,3)}
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
        body:JSON.stringify({
          tournaments:parseTournaments(html),
          debug:{
            htmlLength:html.length,
            hasClassicLinks:/turniereklassisch\.ringerdb\.de/i.test(html)
          }
        })
      };
    }

    if(mode==="matches"){
      const url=event.queryStringParameters?.url||"";
      const u=new URL(url);
      if(!["turniereklassisch.ringerdb.de","www.liga-db.de","liga-db.de"].includes(u.hostname)){
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
