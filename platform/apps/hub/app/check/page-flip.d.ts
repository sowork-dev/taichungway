declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, options: {
      width: number; height: number; size?: 'fixed' | 'stretch';
      showCover?: boolean; usePortrait?: boolean; autoSize?: boolean;
      flippingTime?: number; maxShadowOpacity?: number; useMouseEvents?: boolean;
      mobileScrollSupport?: boolean; disableFlipByClick?: boolean; clickEventForward?: boolean;
    });
    loadFromHTML(pages: HTMLElement[]): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    on(event: string, callback: (event: { data: unknown }) => void): void;
    destroy(): void;
  }
}
