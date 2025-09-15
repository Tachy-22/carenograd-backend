// Semantic Scholar API Type Definitions

export interface SemanticScholarAuthor {
  authorId: string;
  name: string;
  url?: string;
  affiliations?: string[];
  homepage?: string;
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
}

export interface SemanticScholarPaper {
  paperId: string;
  externalIds?: {
    MAG?: string;
    ACL?: string;
    PubMed?: string;
    Medline?: string;
    PubMedCentral?: string;
    DBLP?: string;
    ArXiv?: string;
    S2?: string;
    Corpus?: string;
    DOI?: string;
  };
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  year?: number;
  referenceCount?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  fieldsOfStudy?: string[];
  s2FieldsOfStudy?: Array<{
    category: string;
    source: string;
  }>;
  publicationTypes?: string[];
  publicationDate?: string;
  journal?: {
    name: string;
    pages?: string;
    volume?: string;
  };
  authors?: SemanticScholarAuthor[];
  citations?: SemanticScholarPaper[];
  references?: SemanticScholarPaper[];
}

export interface SemanticScholarSearchResponse {
  total: number;
  offset: number;
  next?: number;
  data: SemanticScholarPaper[] | SemanticScholarAuthor[];
}

export interface SemanticScholarAuthorWithPapers extends SemanticScholarAuthor {
  papers?: SemanticScholarPaper[];
}

export interface ProcessedAuthor {
  authorId: string;
  name: string;
  url?: string;
  affiliations: string[];
  homepage?: string;
  paperCount: number;
  citationCount: number;
  hIndex: number;
}

export interface ProcessedPaper {
  paperId: string;
  title: string;
  abstract?: string;
  venue?: string;
  year?: number;
  citationCount: number;
  influentialCitationCount: number;
  referenceCount: number;
  isOpenAccess: boolean;
  openAccessUrl?: string;
  fieldsOfStudy: string[];
  authors: string[];
  url?: string;
  doi?: string;
  publicationDate?: string;
}

export interface AuthorStatistics {
  totalPapers: number;
  totalCitations: number;
  hIndex: number;
  yearRange: {
    earliest: number;
    latest: number;
  };
  topVenues: Array<{
    venue: string;
    count: number;
  }>;
  fieldsOfStudy: string[];
}

export interface PaperRecommendation extends ProcessedPaper {
  recommendationReason?: string;
  relevanceScore?: number;
}