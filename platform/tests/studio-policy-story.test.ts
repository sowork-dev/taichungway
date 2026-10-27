import test from 'node:test';
import assert from 'node:assert/strict';
import {COMIC_SCENES,createComic} from '../apps/hub/app/comic/story';

test('each comic brings its public proposal into the narrative rather than only appending a source footer',()=>{
 const subjects:Record<string,RegExp>={market:/冷氣/,corner:/人本道路/,park:/共融/,station:/公車免費/,mountain:/客家文化/,coast:/親海步道/};
 for(const scene of COMIC_SCENES){
  const story=createComic({sceneId:scene.id,styleId:'ink',event:'一件生活小事',nickname:''});
  const ending=story.panels.slice(2).map(panel=>panel.caption).join('');
  assert.match(ending,subjects[scene.id],scene.id);assert.match(ending,/提案/,scene.id);
  assert.ok(story.panels.every(panel=>[...panel.caption].length<=20));
  assert.doesNotMatch(ending,/已落實|已完工|保證|一定完成/);
 }
});
