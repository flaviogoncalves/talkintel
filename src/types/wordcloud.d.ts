declare module 'wordcloud' {
  interface WordCloudOptions {
    list: [string, number][];
    gridSize?: number;
    weightFactor?: (size: number) => number;
    fontFamily?: string;
    color?: (word: string, weight: number) => string;
    rotateRatio?: number;
    rotationSteps?: number;
    backgroundColor?: string;
    drawOutOfBound?: boolean;
    shrinkToFit?: boolean;
    minSize?: number;
    click?: (item: [string, number]) => void;
    hover?: (item: [string, number] | undefined, dimension: any, event: MouseEvent) => void;
  }

  function WordCloud(canvas: HTMLCanvasElement, options: WordCloudOptions): void;
  export = WordCloud;
} 