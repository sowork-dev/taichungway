import { cleanText } from '@taichung/ui/studio';
import { createComic, editComicCaption, type ComicSceneId, type ComicStory, type ComicStyleId } from './story';

export interface ComicEditorState {
  sceneId: ComicSceneId;
  styleId: ComicStyleId;
  nickname: string;
  event: string;
  story: ComicStory | null;
}
export const initialComicState: ComicEditorState = { sceneId: 'market', styleId: 'ink', nickname: '', event: '', story: null };
export type ComicEditorAction =
  | { type: 'event' | 'nickname'; value: string }
  | { type: 'scene'; value: ComicSceneId }
  | { type: 'style'; value: ComicStyleId }
  | { type: 'caption'; index: number; value: string }
  | { type: 'generate' | 'replay' };

/** A local, conservative screen for obvious identifiers, not a complete PII detector. */
export function comicInputIssue(input: Pick<ComicEditorState, 'event' | 'nickname'>): string | null {
  const value = `${input.event}\n${input.nickname}`.normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '');
  const contact = /[\w.+-]+@[a-z\d.-]+\.[a-z]{2,}/iu.test(value)
    || /(?:\+?886[-\s]?)?0?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/u.test(value)
    || /(?:\(?0[2-8]\d?\)?[-\s]?)\d{3,4}[-\s]?\d{4}/u.test(value)
    || /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/u.test(value);
  const identity = /[a-z][12a-d89]\d{8}/iu.test(value);
  const address = /[\p{Script=Han}]{1,12}(?:路|街|大道|巷|弄)\s*\d+(?:[-之]\d+)?\s*(?:號|巷|弄)/u.test(value)
    || /\b\d{1,6}\s+[a-z][a-z\s]{1,45}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b/iu.test(value);
  return contact || identity || address ? '請移除電話、Email、證號或詳細地址，再畫成四格。只留下日常小事就好。' : null;
}

/** The same reducer powers the real controls and the state-boundary tests. */
export function comicReducer(state: ComicEditorState, action: ComicEditorAction): ComicEditorState {
  switch (action.type) {
    case 'event': return { ...state, event: cleanText(action.value, 60) };
    case 'nickname': return { ...state, nickname: cleanText(action.value, 10) };
    case 'scene': {
      const next = { ...state, sceneId: action.value };
      return { ...next, story: state.story && !comicInputIssue(next) ? createComic(next) : null };
    }
    case 'style': {
      const next = { ...state, styleId: action.value };
      return { ...next, story: state.story && !comicInputIssue(next) ? createComic(next) : null };
    }
    case 'generate': return state.event.trim() && !comicInputIssue(state) ? { ...state, story: createComic(state) } : state;
    case 'caption': return state.story ? { ...state, story: editComicCaption(state.story, action.index, cleanText(action.value, 20)) } : state;
    case 'replay': return { ...initialComicState };
  }
}
