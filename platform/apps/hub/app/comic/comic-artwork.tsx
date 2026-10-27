import { PolicySource } from '@taichung/ui/studio';
import { ComicDrawing } from './drawing';
import { COMIC_SCENES, COMIC_STYLES, type ComicStory } from './story';

export function ComicArtwork({ story, sample = false }: { story: ComicStory; sample?: boolean }) {
  const scene = COMIC_SCENES.find(row => row.id === story.sceneId)!;
  const style = COMIC_STYLES.find(row => row.id === story.styleId)!;
  return <article className={`comic-page comic-style-${story.styleId}`} aria-label="巷口四格漫畫作品">
    <header className="comic-page-heading">
      <div><p className="comic-edition">TAICHUNG EVERYDAY / 4 FRAMES</p><h2>巷口四格漫畫</h2><p className="comic-byline">{story.nickname ? `${story.nickname}的日常小刊` : '把一件小事，留成一頁。'}</p></div>
      <span className="comic-scene-stamp">{scene.label}<span>{style.label}</span></span>
    </header>
    <div className="comic-supplied"><span>{sample ? '範例原文' : '你的原文'} · 未改寫</span><p>{story.event || '今天路過市場，想把普通的一刻留下來。'}</p></div>
    <div className="comic-panels">{story.panels.map((panel, index) => <figure className="comic-panel" key={`${story.sceneId}-${index}`} data-testid={`comic-panel-${index + 1}`}>
      <div className="comic-panel-top"><span>{String(index + 1).padStart(2, '0')}</span><span>{panel.beat}</span></div>
      <ComicDrawing sceneId={story.sceneId} styleId={story.styleId} panel={panel} index={index} />
      <figcaption>{panel.caption || '（這格留白）'}</figcaption>
    </figure>)}</div>
    <div className="comic-colophon"><p>預製故事版・不使用 AI</p><p>原創虛構人物與情節；原文不會變成角色對白。</p></div>
    <PolicySource policyId={story.policyId} />
    <footer className="comic-page-footer"><span>台中味 / SoWork 獨立製作</span><span>每一天，都有值得記住的一格。</span></footer>
  </article>;
}
