import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decodePNG(path){
  const buf=readFileSync(path); let off=8, idat=[], W=0,H=0;
  while(off<buf.length){
    const len=buf.readUInt32BE(off), type=buf.toString('ascii',off+4,off+8);
    const data=buf.subarray(off+8,off+8+len);
    if(type==='IHDR'){W=data.readUInt32BE(0);H=data.readUInt32BE(4);}
    else if(type==='IDAT') idat.push(data);
    else if(type==='IEND') break;
    off+=12+len;
  }
  const raw=inflateSync(Buffer.concat(idat)), bpp=3, stride=W*bpp;
  const out=Buffer.alloc(H*stride); let p=0;
  for(let y=0;y<H;y++){
    const ft=raw[p++], line=raw.subarray(p,p+stride); p+=stride;
    const prev=y>0?out.subarray((y-1)*stride,y*stride):Buffer.alloc(stride);
    const cur=out.subarray(y*stride,(y+1)*stride);
    for(let i=0;i<stride;i++){
      const a=i>=bpp?cur[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;
      let v=line[i];
      switch(ft){case 1:v+=a;break;case 2:v+=b;break;case 3:v+=(a+b)>>1;break;
        case 4:{const pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);
                v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);break;}}
      cur[i]=v&0xff;
    }
  }
  return {W,H,px:out};
}

// mosaic 3x3 -> 768x768
const M=768, mos=new Float32Array(M*M);
for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const {W,px}=decodePNG(`t_${dx}_${dy}.png`);
  const ox=(dx+1)*256, oy=(dy+1)*256;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const i=(y*W+x)*3;
    mos[(oy+y)*M+(ox+x)]=(px[i]*256+px[i+1]+px[i+2]/256)-32768;
  }
}
const lat=13.5178, z=15;
const mpp=156543.03392*Math.cos(lat*Math.PI/180)/(2**z);
// center of mosaic = fractional pos within center tile
const cx=256+0.913*256, cy=256+0.004*256;

for (const extent of [400, 1200]) {
  const half=(extent/mpp)/2;
  let min=Infinity,max=-Infinity;
  const cols=56, rows=22, ramp=' .:-=+*#%@';
  let art='';
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const sx=Math.round(cx-half+(c/(cols-1))*2*half);
      const sy=Math.round(cy-half+(r/(rows-1))*2*half);
      const e=mos[Math.min(M-1,Math.max(0,sy))*M+Math.min(M-1,Math.max(0,sx))];
      if(e<min)min=e; if(e>max)max=e;
    }
  }
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const sx=Math.round(cx-half+(c/(cols-1))*2*half);
      const sy=Math.round(cy-half+(r/(rows-1))*2*half);
      const e=mos[Math.min(M-1,Math.max(0,sy))*M+Math.min(M-1,Math.max(0,sx))];
      const t=(e-min)/(max-min||1);
      art+=ramp[Math.min(9,Math.floor(t*10))];
    }
    art+='\n';
  }
  console.log(`\n=== ${extent}m window @ ${mpp.toFixed(1)} m/px (${(2*half).toFixed(0)} source px) ===`);
  console.log(`relief: ${(max-min).toFixed(1)}m  (min ${min.toFixed(0)} → max ${max.toFixed(0)})`);
  console.log(art);
}
