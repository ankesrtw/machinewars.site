// Minimal PNG decoder for 8-bit RGB non-interlaced, using node's zlib.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const buf = readFileSync('agumbe.png');
let off = 8, idat = [], W=0, H=0, bitDepth=0, colorType=0;
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off+4, off+8);
  const data = buf.subarray(off+8, off+8+len);
  if (type === 'IHDR') {
    W = data.readUInt32BE(0); H = data.readUInt32BE(4);
    bitDepth = data[8]; colorType = data[9];
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  off += 12 + len;
}
console.log(`PNG ${W}x${H} depth=${bitDepth} colorType=${colorType} (2=RGB)`);
const raw = inflateSync(Buffer.concat(idat));
const bpp = 3, stride = W*bpp;
const out = Buffer.alloc(H*stride);
let p = 0;
for (let y=0; y<H; y++) {
  const ft = raw[p++];
  const line = raw.subarray(p, p+stride); p += stride;
  const prev = y>0 ? out.subarray((y-1)*stride, y*stride) : Buffer.alloc(stride);
  const cur = out.subarray(y*stride, (y+1)*stride);
  for (let i=0;i<stride;i++){
    const a = i>=bpp ? cur[i-bpp] : 0, b = prev[i], c = i>=bpp ? prev[i-bpp] : 0;
    let v = line[i];
    switch(ft){
      case 0: break;
      case 1: v += a; break;
      case 2: v += b; break;
      case 3: v += (a+b)>>1; break;
      case 4: { const pa=Math.abs(b-c), pb=Math.abs(a-c), pc=Math.abs(a+b-2*c);
                v += (pa<=pb&&pa<=pc)?a:(pb<=pc?b:c); break; }
    }
    cur[i] = v & 0xff;
  }
}
// terrarium: (R*256 + G + B/256) - 32768
const elev = new Float32Array(W*H);
let min=Infinity, max=-Infinity;
for (let i=0;i<W*H;i++){
  const R=out[i*3], G=out[i*3+1], B=out[i*3+2];
  const e = (R*256 + G + B/256) - 32768;
  elev[i]=e; if(e<min)min=e; if(e>max)max=e;
}
console.log(`elevation min=${min.toFixed(1)}m max=${max.toFixed(1)}m relief=${(max-min).toFixed(1)}m`);

// ASCII preview, 48x24
const cols=48, rows=24, ramp=' .:-=+*#%@';
let art='';
for(let r=0;r<rows;r++){
  for(let c=0;c<cols;c++){
    const sx=Math.floor(c/cols*W), sy=Math.floor(r/rows*H);
    const e=elev[sy*W+sx];
    const t=(e-min)/(max-min||1);
    art += ramp[Math.min(ramp.length-1, Math.floor(t*ramp.length))];
  }
  art+='\n';
}
console.log(art);
