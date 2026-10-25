import { deflateSync } from 'node:zlib';
import { mkdirSync,writeFileSync } from 'node:fs';
function crc(data){let value=0xffffffff;for(const byte of data){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const size=Buffer.alloc(4);size.writeUInt32BE(data.length);const check=Buffer.alloc(4);check.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,check]);}
mkdirSync('public',{recursive:true});
for(const size of [192,512]){const bytes=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*(size*4+1)+1+x*4;const u=x/size-.5,v=y/size-.5;const mark=Math.abs(u)+Math.abs(v)<.22||Math.hypot(u-.24,v+.24)<.055;bytes[i]=mark?250:117;bytes[i+1]=mark?248:98;bytes[i+2]=mark?255:195;bytes[i+3]=255;}const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;writeFileSync(`public/icon-${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes)),chunk('IEND',Buffer.alloc(0))]));}
