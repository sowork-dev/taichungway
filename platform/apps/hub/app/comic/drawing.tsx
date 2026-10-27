import { useMemo } from 'react';
import rough from 'roughjs';
import type { Drawable, Options, PathInfo } from 'roughjs/bin/core';
import type { ComicPanel, ComicSceneId, ComicStyleId } from './story';

/** Original geometry, rendered with the real Rough.js generator on server/client.
 * Its SVG paths need no canvas, image request, markup injection or DOM mutation.
 * Seeded strokes are stable across hydration and image export.
 */
export function buildPanelPaths(sceneId: ComicSceneId, index: number, styleId: ComicStyleId): PathInfo[] {
  const sceneIndex = ['market', 'corner', 'park', 'station', 'mountain', 'coast'].indexOf(sceneId);
  let seed = 2100 + sceneIndex * 500 + index * 90;
  const preset: Options = styleId === 'print'
    ? { roughness: 0.6, bowing: 0.5, strokeWidth: 2.2, fillStyle: 'solid', hachureGap: 5 }
    : styleId === 'notebook'
      ? { roughness: 1.35, bowing: 1.2, strokeWidth: 1.7, fillStyle: 'hachure', hachureGap: 6, fillWeight: 0.8 }
      : { roughness: 0.55, bowing: 0.3, strokeWidth: 1.8, fillStyle: 'solid' };
  const g = rough.generator();
  const paths: PathInfo[] = [];
  const blue = '#1A63C8', dark = '#112A4D', pale = '#E9F2FF';
  const options = (fill?: string, extra?: Options): Options => ({ ...preset, stroke: dark, fill, seed: ++seed, ...extra });
  const add = (shape: Drawable) => paths.push(...g.toPaths(shape));
  const line = (x: number, y: number, x2: number, y2: number, color = dark) => add(g.line(x, y, x2, y2, options(undefined, { stroke: color })));
  const rect = (x: number, y: number, w: number, h: number, fill?: string) => add(g.rectangle(x, y, w, h, options(fill)));
  const ellipse = (x: number, y: number, w: number, h: number, fill?: string) => add(g.ellipse(x, y, w, h, options(fill)));
  const path = (d: string, fill?: string, color = dark) => add(g.path(d, options(fill, { stroke: color })));
  const leaf = (x: number, y: number) => { path(`M${x} ${y}q-13 -16 9 -19q5 17 -9 19Z`, pale); line(x, y, x + 5, y - 12, blue); };
  const spark = (x: number, y: number) => { line(x, y - 6, x, y + 6, blue); line(x - 6, y, x + 6, y, blue); };
  const bench = (x: number, y: number) => { rect(x, y, 84, 11, pale); rect(x, y - 28, 84, 19, pale); line(x + 12, y + 11, x + 9, y + 27); line(x + 70, y + 11, x + 73, y + 27); };
  const book = (x: number, y: number, open = false) => {
    if (open) { path(`M${x} ${y}q14 -6 27 0q14 -6 27 0v28q-14 -6 -27 0q-13 -6 -27 0Z`, '#FFFFFF'); line(x + 27, y, x + 27, y + 28); }
    else { rect(x, y, 27, 32, pale); line(x + 5, y + 3, x + 5, y + 29); }
  };
  const basket = (x: number, y: number, tall = false) => {
    if (tall) { path(`M${x + 13} ${y + 4}l-4 -43m13 43l3 -49m-8 47l10 -37`, undefined, blue); }
    path(`M${x} ${y}h36l-6 25h-24Z`, pale); path(`M${x + 4} ${y}q14 -23 28 0`);
    for (let i = 1; i < 4; i++) line(x + i * 8, y + 4, x + i * 7 + 2, y + 21, blue);
  };
  const hat = (x: number, y: number) => { path(`M${x - 12} ${y}l3 -13h21l4 13Z`, pale); ellipse(x + 3, y + 1, 48, 8, '#FFFFFF'); };
  const cat = (x: number, y: number, stretch = false) => {
    ellipse(x, y, stretch ? 48 : 30, 21, pale);
    path(`M${x - 17} ${y - 3}l-3 -19l12 6l9 -7l5 19Z`, '#FFFFFF');
    line(x - 13, y - 11, x - 10, y - 11); line(x - 3, y - 11, x, y - 11);
    path(`M${x + 17} ${y + 1}q21 -24 24 -6`); line(x - 6, y + 8, x - 10, y + 13); line(x + 8, y + 8, x + 15, y + 12);
  };
  const human = (x: number, y: number, pose: 'walk' | 'look' | 'surprise' | 'wave' | 'sit' | 'reach', scale = 1) => {
    const pt = (a: number, b: number) => `${x + a * scale} ${y + b * scale}`;
    // A rounded bob, a striped shirt, animated arms; not a public figure's likeness.
    ellipse(x, y, 30 * scale, 34 * scale, '#FFFFFF');
    path(`M${pt(-16, -1)}q${-3 * scale} ${-25 * scale} ${20 * scale} ${-19 * scale}q${17 * scale} ${2 * scale} ${11 * scale} ${24 * scale}l${-5 * scale} ${-14 * scale}q${-13 * scale} ${9 * scale} ${-22 * scale} ${4 * scale}`, blue);
    ellipse(x - 5 * scale, y + 2 * scale, 2 * scale, 3 * scale, dark); ellipse(x + 5 * scale, y + 2 * scale, 2 * scale, 3 * scale, dark);
    if (pose === 'surprise') ellipse(x, y + 10 * scale, 5 * scale, 7 * scale);
    else path(`M${pt(-5, 9)}q${5 * scale} ${5 * scale} ${10 * scale} 0`);
    path(`M${pt(-12, 20)}q${12 * scale} ${-6 * scale} ${24 * scale} 0l${5 * scale} ${34 * scale}h${-34 * scale}Z`, styleId === 'ink' ? '#FFFFFF' : pale);
    line(x - 12 * scale, y + 31 * scale, x + 12 * scale, y + 31 * scale, blue);
    line(x - 14 * scale, y + 39 * scale, x + 14 * scale, y + 39 * scale, blue);
    if (pose === 'surprise') {
      path(`M${pt(-12, 24)}l${-18 * scale} ${-12 * scale}l${-5 * scale} ${-16 * scale}M${pt(12, 24)}l${20 * scale} ${-10 * scale}l${5 * scale} ${-17 * scale}`);
      spark(x - 30 * scale, y - 20 * scale); spark(x + 34 * scale, y - 18 * scale);
    } else if (pose === 'reach') {
      path(`M${pt(-12, 24)}l${-22 * scale} ${-26 * scale}M${pt(12, 24)}l${19 * scale} ${-30 * scale}l${7 * scale} ${-20 * scale}`);
    } else if (pose === 'wave') {
      path(`M${pt(-12, 24)}l${-10 * scale} ${24 * scale}M${pt(12, 24)}l${18 * scale} ${-8 * scale}l${3 * scale} ${-22 * scale}`);
      line(x + 30 * scale, y - 9 * scale, x + 32 * scale, y - 16 * scale, blue);
    } else if (pose === 'look') {
      path(`M${pt(-12, 24)}l${-12 * scale} ${18 * scale}l${17 * scale} ${2 * scale}M${pt(12, 24)}l${12 * scale} ${17 * scale}l${-20 * scale} ${1 * scale}`);
    } else {
      path(`M${pt(-12, 24)}l${-14 * scale} ${23 * scale}M${pt(12, 24)}l${14 * scale} ${24 * scale}`);
    }
    if (pose === 'sit') path(`M${pt(-9, 54)}l${-5 * scale} ${14 * scale}l${-19 * scale} ${10 * scale}M${pt(9, 54)}l${17 * scale} ${10 * scale}l${2 * scale} ${18 * scale}`);
    else if (pose === 'walk' || pose === 'wave') path(`M${pt(-9, 54)}l${-11 * scale} ${24 * scale}l${-9 * scale} ${2 * scale}M${pt(9, 54)}l${15 * scale} ${15 * scale}l${12 * scale} ${1 * scale}`);
    else path(`M${pt(-9, 54)}l${-3 * scale} ${26 * scale}h${-8 * scale}M${pt(9, 54)}l${7 * scale} ${26 * scale}h${8 * scale}`);
  };

  // Quiet framing leaves caption typography in HTML, outside the drawing.
  if (styleId === 'notebook') {
    for (let y = 34; y < 224; y += 28) line(10, y, 310, y, '#E9F2FF');
  }
  line(18, 218, 302, 218, '#BDD4F3');

  if (sceneId === 'market') {
    // Stall, produce, a recognisable vendor, and the outsized scallion reveal.
    const close = index === 2;
    rect(152, 80, 136, 103, pale);
    path('M143 82l16 -40h116l20 40Z', blue);
    for (let i = 0; i < 5; i++) path(`M${161 + i * 25} 45l-9 35h12l6 -35Z`, '#FFFFFF');
    rect(147, 163, 149, 19, '#FFFFFF');
    for (let i = 0; i < 5; i++) ellipse(162 + i * 25, 155, 19, 16, i % 2 ? pale : '#FFFFFF');
    human(233, 113, index === 3 ? 'wave' : 'look', 0.59);
    human(close ? 91 : index === 3 ? 83 : 76, close ? 110 : 127, close ? 'surprise' : index === 0 ? 'walk' : index === 3 ? 'wave' : 'look', close ? 1.1 : 0.94);
    basket(index === 3 ? 111 : 98, index === 2 ? 174 : 178, index >= 2);
    if (index === 1) { path('M97 98q12 -14 25 -5', undefined, blue); ellipse(124, 87, 4, 4, blue); }
  } else if (sceneId === 'corner') {
    rect(22, 42, 72, 113, pale); rect(39, 87, 32, 68, '#FFFFFF'); rect(108, 68, 44, 75, '#FFFFFF');
    for (let i = 0; i < 4; i++) path(`M${146 + i * 36} 184l18 -28h16l-17 28Z`, pale);
    line(273, 48, 273, 161); rect(258, 36, 29, 59, '#FFFFFF');
    ellipse(272, 53, 12, 12, index < 3 ? blue : '#FFFFFF'); ellipse(272, 77, 12, 12, index === 3 ? blue : '#FFFFFF');
    const x = index === 3 ? 180 : 105;
    // The bicycle remains a bicycle rather than an abstract icon.
    ellipse(x - 44, 193, 32, 32); ellipse(x + 6, 193, 32, 32);
    path(`M${x - 44} 193l17 -29l33 29h-50l25 -12l7 -24h12`);
    line(x - 32, 161, x - 18, 161); line(x + 6, 193, x - 1, 165);
    human(x + 12, 119, index === 3 ? 'walk' : index === 2 ? 'surprise' : 'look', 0.85);
    if (index === 0) leaf(209, 123);
    if (index === 1) { leaf(205, 137); path('M185 110q23 -12 38 -2', undefined, blue); }
    if (index >= 2) { leaf(180, 158); leaf(204, 158); leaf(229, 158); }
  } else if (sceneId === 'park') {
    line(54, 110, 54, 203); path('M55 144l-18 -20m18 2l21 -23');
    ellipse(49, 73, 66, 67, pale); ellipse(79, 90, 47, 45, '#FFFFFF');
    bench(193, 171);
    if (index === 0) { human(121, 121, 'walk'); cat(259, 155); }
    if (index === 1) { human(144, 122, 'look'); cat(238, 155); path('M161 94q13 -10 24 -2m-20 -12q11 -8 20 -1', undefined, blue); }
    if (index === 2) { human(130, 121, 'surprise'); cat(238, 155, true); }
    if (index === 3) { human(207, 111, 'sit', 0.86); cat(256, 155); spark(151, 84); }
    leaf(89, 208); path('M289 214q-5 -13 2 -20m-2 18q13 -11 14 -2', undefined, blue);
  } else if (sceneId === 'station') {
    if (index === 3) {
      rect(153, 55, 148, 137, pale); rect(166, 75, 45, 47, '#FFFFFF'); rect(222, 76, 52, 101, '#FFFFFF');
      line(248, 78, 248, 175); ellipse(180, 194, 29, 29, blue); ellipse(280, 194, 29, 29, blue); human(123, 126, 'walk', 0.9);
      book(134, 154);
    } else {
      line(29, 54, 29, 203); rect(12, 43, 40, 46, pale); rect(19, 53, 25, 14, '#FFFFFF');
      path('M182 61h109l-7 -12h-98Z', pale); line(190, 63, 190, 191); line(283, 63, 283, 191); bench(201, 181);
      human(118, index === 2 ? 110 : 127, index === 0 ? 'walk' : index === 1 ? 'look' : 'surprise', index === 2 ? 1.1 : 1);
      book(index === 2 ? 155 : 143, index === 2 ? 157 : 164, index === 2);
      if (index === 2) { rect(185, 147, 17, 26, pale); spark(213, 136); }
    }
  } else if (sceneId === 'mountain') {
    path('M12 110l59 -74l43 53l42 -64l58 78l40 -41l55 60', pale, blue);
    path('M17 202q106 -73 183 6', undefined, '#BDD4F3');
    path('M207 144V91h75v53Z', pale); path('M196 92l47 -33l50 33Z', '#FFFFFF'); rect(233, 114, 21, 30, '#FFFFFF');
    line(208, 110, 229, 110); line(262, 110, 280, 110);
    if (index === 3) { bench(69, 181); human(101, 119, 'sit', 0.94); book(122, 166, true); leaf(147, 171); }
    else {
      human(index === 0 ? 99 : 125, 124, index === 0 ? 'walk' : index === 1 ? 'look' : 'reach');
      if (index === 0) rect(69, 148, 14, 27, pale);
      if (index === 1) { leaf(154, 78); path('M176 63q-20 2 -13 20', undefined, blue); }
      if (index === 2) { leaf(164, 81); book(78, 161, true); spark(184, 68); }
    }
  } else {
    ellipse(253, 51, 32, 32, pale);
    for (let y = 111; y < 165; y += 20) path(`M13 ${y}q21 -10 42 0t42 0t42 0t42 0t42 0t42 0t42 0`, undefined, '#BDD4F3');
    path('M17 203l113 -40h172', undefined, blue);
    line(21, 176, 21, 204); line(76, 153, 76, 184); line(21, 180, 76, 158);
    if (index === 3) { bench(153, 176); human(182, 113, 'sit', 0.85); hat(182, 94); }
    else {
      const x = index === 0 ? 112 : index === 1 ? 124 : 159;
      human(x, 126, index === 0 ? 'walk' : 'reach');
      if (index === 0) hat(x, 109);
      else { hat(index === 1 ? 219 : 198, index === 1 ? 78 : 79); path('M176 43q46 -15 78 0m-67 15q30 -8 56 0', undefined, blue); }
      if (index === 2) spark(235, 98);
    }
    path('M271 89l8 -6l8 6m-33 -15l7 -5l7 5', undefined, blue);
  }
  return paths;
}

export function ComicDrawing({ sceneId, styleId, panel, index }: { sceneId: ComicSceneId; styleId: ComicStyleId; panel: ComicPanel; index: number }) {
  const paths = useMemo(() => buildPanelPaths(sceneId, index, styleId), [sceneId, index, styleId]);
  return <svg className="comic-drawing" viewBox="0 0 320 238" role="img" aria-label={panel.description} data-scene={sceneId} data-beat={panel.beat}>
    <title>{panel.description}</title>
    {paths.map((part, key) => <path key={key} d={part.d} stroke={part.stroke} strokeWidth={part.strokeWidth} fill={part.fill || 'none'} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}
