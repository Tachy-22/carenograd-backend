// Google Docs API Type Definitions

export interface GoogleDocsRequest {
  insertText?: {
    location: { index: number };
    text: string;
  };
  deleteContentRange?: {
    range: { startIndex: number; endIndex: number };
  };
  replaceAllText?: {
    containsText: {
      text: string;
      matchCase?: boolean;
    };
    replaceText: string;
  };
  insertInlineImage?: {
    location: { index: number };
    uri?: string;
    objectId?: string;
  };
  replaceImage?: {
    imageObjectId: string;
    uri: string;
  };
  deletePositionedObject?: {
    objectId: string;
  };
  insertTable?: {
    location: { index: number };
    rows: number;
    columns: number;
  };
  insertTableRow?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
    insertBelow?: boolean;
  };
  insertTableColumn?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
    insertRight?: boolean;
  };
  deleteTableRow?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
  };
  deleteTableColumn?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
  };
  updateTableCellStyle?: {
    tableCellLocation: {
      tableStartLocation: { index: number };
      rowIndex: number;
      columnIndex: number;
    };
    tableCellStyle: Record<string, unknown>;
    fields: string;
  };
  mergeTableCells?: {
    tableRange: {
      tableCellLocation: {
        tableStartLocation: { index: number };
        rowIndex: number;
        columnIndex: number;
      };
      rowSpan: number;
      columnSpan: number;
    };
  };
  unmergeTableCells?: {
    tableRange: {
      tableCellLocation: {
        tableStartLocation: { index: number };
        rowIndex: number;
        columnIndex: number;
      };
      rowSpan: number;
      columnSpan: number;
    };
  };
  updateTextStyle?: {
    range: { startIndex: number; endIndex: number };
    textStyle: Record<string, unknown>;
    fields: string;
  };
  updateParagraphStyle?: {
    range: { startIndex: number; endIndex: number };
    paragraphStyle: Record<string, unknown>;
    fields: string;
  };
  createParagraphBullets?: {
    range: { startIndex: number; endIndex: number };
    bulletPreset: string;
  };
  createHeader?: {
    type: 'HEADER_DEFAULT' | 'HEADER_FIRST_PAGE_DIFFERENT' | 'HEADER_EVEN_ODD_DIFFERENT';
  };
  createFooter?: {
    type: 'FOOTER_DEFAULT' | 'FOOTER_FIRST_PAGE_DIFFERENT' | 'FOOTER_EVEN_ODD_DIFFERENT';
  };
  deleteHeader?: {
    type: 'HEADER_DEFAULT' | 'HEADER_FIRST_PAGE_DIFFERENT' | 'HEADER_EVEN_ODD_DIFFERENT';
  };
  deleteFooter?: {
    type: 'FOOTER_DEFAULT' | 'FOOTER_FIRST_PAGE_DIFFERENT' | 'FOOTER_EVEN_ODD_DIFFERENT';
  };
  updateDocumentStyle?: {
    documentStyle: Record<string, unknown>;
    fields: string;
  };
  createNamedRange?: {
    name: string;
    range: { startIndex: number; endIndex: number };
  };
  deleteNamedRange?: {
    name?: string;
    namedRangeId?: string;
  };
}

export interface GoogleDocsBatchUpdateRequest {
  requests: GoogleDocsRequest[];
}

export interface GoogleDocsRequestBody {
  title?: string;
  parents?: string[];
}

export interface GoogleDocsFileMetadata {
  id: string;
  name: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
}

export interface GoogleDocsDocumentStyle {
  background?: {
    color?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
  };
  pageNumberStart?: number;
  marginTop?: { magnitude: number; unit: string };
  marginBottom?: { magnitude: number; unit: string };
  marginLeft?: { magnitude: number; unit: string };
  marginRight?: { magnitude: number; unit: string };
  pageSize?: {
    width?: { magnitude: number; unit: string };
    height?: { magnitude: number; unit: string };
  };
  marginHeader?: { magnitude: number; unit: string };
  marginFooter?: { magnitude: number; unit: string };
  useFirstPageHeaderFooter?: boolean;
  useEvenPageHeaderFooter?: boolean;
  firstPageHeaderId?: string;
  firstPageFooterId?: string;
  defaultHeaderId?: string;
  defaultFooterId?: string;
  evenPageHeaderId?: string;
  evenPageFooterId?: string;
}

export interface GoogleDocsSectionStyle {
  columnSeparatorStyle?: 'NONE' | 'BETWEEN_EACH_COLUMN';
  contentDirection?: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  sectionType?: 'SECTION_TYPE_UNSPECIFIED' | 'CONTINUOUS' | 'NEXT_PAGE' | 'NEXT_EVEN_PAGE' | 'NEXT_ODD_PAGE';
  defaultHeaderId?: string;
  defaultFooterId?: string;
  evenPageHeaderId?: string;
  evenPageFooterId?: string;
  firstPageHeaderId?: string;
  firstPageFooterId?: string;
  marginTop?: { magnitude: number; unit: string };
  marginBottom?: { magnitude: number; unit: string };
  marginLeft?: { magnitude: number; unit: string };
  marginRight?: { magnitude: number; unit: string };
  columnProperties?: Array<{
    width?: { magnitude: number; unit: string };
    paddingEnd?: { magnitude: number; unit: string };
  }>;
}

export interface GoogleDocsTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  smallCaps?: boolean;
  backgroundColor?: {
    color?: {
      rgbColor?: {
        red?: number;
        green?: number;
        blue?: number;
      };
    };
  };
  foregroundColor?: {
    color?: {
      rgbColor?: {
        red?: number;
        green?: number;
        blue?: number;
      };
    };
  };
  fontSize?: { magnitude: number; unit: string };
  weightedFontFamily?: {
    fontFamily?: string;
    weight?: number;
  };
  baseline?: 'BASELINE_UNSPECIFIED' | 'NONE' | 'SUPERSCRIPT' | 'SUBSCRIPT';
}

export interface GoogleDocsParagraphStyle {
  headingId?: string;
  namedStyleType?: 'NAMED_STYLE_TYPE_UNSPECIFIED' | 'NORMAL_TEXT' | 'TITLE' | 'SUBTITLE' | 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'HEADING_4' | 'HEADING_5' | 'HEADING_6';
  alignment?: 'ALIGNMENT_UNSPECIFIED' | 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
  lineSpacing?: number;
  direction?: 'CONTENT_DIRECTION_UNSPECIFIED' | 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  spacingMode?: 'SPACING_MODE_UNSPECIFIED' | 'NEVER_COLLAPSE' | 'COLLAPSE_LISTS';
  spaceAbove?: { magnitude: number; unit: string };
  spaceBelow?: { magnitude: number; unit: string };
  borderBetween?: {
    color?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
    width?: { magnitude: number; unit: string };
    padding?: { magnitude: number; unit: string };
    dashStyle?: 'DASH_STYLE_UNSPECIFIED' | 'SOLID' | 'DOT' | 'DASH';
  };
  borderTop?: {
    color?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
    width?: { magnitude: number; unit: string };
    padding?: { magnitude: number; unit: string };
    dashStyle?: 'DASH_STYLE_UNSPECIFIED' | 'SOLID' | 'DOT' | 'DASH';
  };
  borderBottom?: {
    color?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
    width?: { magnitude: number; unit: string };
    padding?: { magnitude: number; unit: string };
    dashStyle?: 'DASH_STYLE_UNSPECIFIED' | 'SOLID' | 'DOT' | 'DASH';
  };
  borderLeft?: {
    color?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
    width?: { magnitude: number; unit: string };
    padding?: { magnitude: number; unit: string };
    dashStyle?: 'DASH_STYLE_UNSPECIFIED' | 'SOLID' | 'DOT' | 'DASH';
  };
  borderRight?: {
    color?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
    width?: { magnitude: number; unit: string };
    padding?: { magnitude: number; unit: string };
    dashStyle?: 'DASH_STYLE_UNSPECIFIED' | 'SOLID' | 'DOT' | 'DASH';
  };
  indentFirstLine?: { magnitude: number; unit: string };
  indentStart?: { magnitude: number; unit: string };
  indentEnd?: { magnitude: number; unit: string };
  tabStops?: Array<{
    offset?: { magnitude: number; unit: string };
    alignment?: 'TAB_STOP_ALIGNMENT_UNSPECIFIED' | 'START' | 'CENTER' | 'END';
  }>;
  keepLinesTogether?: boolean;
  keepWithNext?: boolean;
  avoidWidowAndOrphan?: boolean;
  shading?: {
    backgroundColor?: {
      color?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
      };
    };
  };
}