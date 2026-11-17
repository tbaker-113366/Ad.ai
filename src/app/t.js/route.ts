/**
 * The website snippet. Only runs when the visit came from a Google ad
 * (gclid / gbraid / wbraid in the URL). Sets no cookies and stores nothing
 * in the browser. Loaded with:
 *   <script async src="https://adiro.ai/t.js" data-site="SITE_KEY"></script>
 */
const SCRIPT = `(function(){try{
var s=document.currentScript;var k=s&&s.getAttribute("data-site");if(!k)return;
var q=new URLSearchParams(location.search);var g=q.get("gclid"),gb=q.get("gbraid"),wb=q.get("wbraid");
if(!g&&!gb&&!wb)return;
var base=s.src.replace(/\\/t\\.js.*$/,"");var n=navigator;var tz="";
try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}
var sig={wd:!!n.webdriver,sw:screen.width|0,sh:screen.height|0,dpr:window.devicePixelRatio||1,
lang:(n.languages||[n.language||""]).slice(0,3),cores:n.hardwareConcurrency|0,mem:n.deviceMemory||0,touch:n.maxTouchPoints|0,pl:(n.plugins||[]).length|0};
function h(x){var v=2166136261;for(var i=0;i<x.length;i++){v^=x.charCodeAt(i);v=Math.imul(v,16777619)}return(v>>>0).toString(16)}
var dh=h([n.userAgent,sig.sw,sig.sh,sig.dpr,tz,sig.cores,sig.mem,sig.touch,sig.lang.join(",")].join("|"));
var t0=Date.now(),inter=false,id=null,done=false;
function post(b,beacon){var body=JSON.stringify(b);if(beacon&&n.sendBeacon){n.sendBeacon(base+"/api/t",new Blob([body],{type:"text/plain"}));return null}
return fetch(base+"/api/t",{method:"POST",headers:{"Content-Type":"text/plain"},body:body,keepalive:true})}
var r=post({t:"click",k:k,gclid:g,gbraid:gb,wbraid:wb,path:location.pathname,tz:tz,dh:dh,s:sig});
r&&r.then(function(x){return x.json()}).then(function(d){id=d&&d.id}).catch(function(){});
["scroll","click","keydown","touchstart"].forEach(function(e){addEventListener(e,function(){inter=true},{once:true,passive:true})});
function bye(){if(done||!id)return;done=true;post({t:"update",k:k,id:id,dwell:Date.now()-t0,interacted:inter},true)}
addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")bye()});addEventListener("pagehide",bye);
}catch(e){}})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
