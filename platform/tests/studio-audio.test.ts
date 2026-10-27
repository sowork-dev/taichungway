import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('six original voice-free demo soundbeds are local decodable ten-second PCM WAV loops',()=>{
 const names=['market','sea','birds','rain','train','bell'];
 for(const name of names){
  const data=readFileSync(resolve(import.meta.dirname,`../apps/hub/public/audio/city-${name}.wav`));
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');
  assert.equal(data.readUInt16LE(20),1);assert.equal(data.readUInt16LE(22),1);
  assert.equal(data.readUInt32LE(24),16000);assert.equal(data.readUInt16LE(34),16);
  assert.equal(data.readUInt32LE(40),320000);assert.ok(data.length<400000);
  let energy=0;let max=0;for(let i=44;i<data.length;i+=2){const value=data.readInt16LE(i);energy+=value*value;max=Math.max(max,Math.abs(value));}
  assert.ok(energy>0);assert.ok(max<32000,'avoid clipping');
  assert.ok(Math.abs(data.readInt16LE(44))<150);assert.ok(Math.abs(data.readInt16LE(data.length-2))<150,'loop boundary fade');
 }
});
