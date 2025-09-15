// Web Scraping Type Definitions

export interface ScrapedLink {
  href: string;
  text: string;
  title?: string;
  isExternal: boolean;
  domain?: string;
  type: 'internal' | 'external' | 'anchor' | 'email' | 'tel';
}

export interface ScrapedImage {
  src: string;
  alt?: string;
  title?: string;
  width?: string | number;
  height?: string | number;
  isAbsolute: boolean;
  fileSize?: number;
  format?: string;
}

export interface ScrapedMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  favicon?: string;
  canonical?: string;
  robots?: string;
  viewport?: string;
  charset?: string;
  language?: string;
}

export interface TableCell {
  content: string;
  colspan?: number;
  rowspan?: number;
  isHeader?: boolean;
}

export interface TableRow {
  cells: TableCell[];
  isHeader?: boolean;
}

export interface ScrapedTable {
  caption?: string;
  headers: string[];
  rows: TableRow[];
  summary?: string;
  id?: string;
  classes?: string[];
}

export interface WebScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  url: string;
  timestamp: string;
  contentType?: string;
  statusCode?: number;
}

export interface HtmlDocument {
  html: string;
  title?: string;
  contentLength: number;
  contentType: string;
  statusCode: number;
  finalUrl: string;
}