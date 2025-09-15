// Google Search API Type Definitions

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  formattedUrl?: string;
  htmlTitle?: string;
  htmlSnippet?: string;
  cacheId?: string;
  mime?: string;
  fileFormat?: string;
  image?: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
  pagemap?: {
    [key: string]: Array<{
      [key: string]: string;
    }>;
  };
}

export interface GoogleImageResult {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
  mime: string;
  fileFormat?: string;
  image: {
    contextLink: string;
    height: number;
    width: number;
    byteSize: number;
    thumbnailLink: string;
    thumbnailHeight: number;
    thumbnailWidth: number;
  };
}

export interface GoogleNewsResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  publishedDate?: string;
  thumbnail?: string;
  category?: string;
}

export interface GoogleFileResult {
  title: string;
  link: string;
  snippet: string;
  fileFormat: string;
  fileSize?: string;
  displayLink: string;
  mime: string;
}

export interface GoogleSearchResponse {
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: {
    request: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
    nextPage?: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
  };
  context: {
    title: string;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items?: GoogleSearchResult[];
}

export interface SearchFilters {
  dateRestrict?: string;
  exactTerms?: string;
  excludeTerms?: string;
  fileType?: string;
  siteSearch?: string;
  siteSearchFilter?: 'e' | 'i';
  sort?: string;
  imgSize?: 'huge' | 'icon' | 'large' | 'medium' | 'small' | 'xlarge' | 'xxlarge';
  imgType?: 'clipart' | 'face' | 'lineart' | 'stock' | 'photo' | 'animated';
  imgColorType?: 'color' | 'gray' | 'mono' | 'trans';
  imgDominantColor?: 'black' | 'blue' | 'brown' | 'gray' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'white' | 'yellow';
  rights?: string;
  safe?: 'active' | 'off';
  searchType?: 'image' | 'news';
}