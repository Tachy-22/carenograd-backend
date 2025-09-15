// Google Sheets API Type Definitions

export interface GoogleSheetsSheetProperties {
  sheetId?: number;
  title?: string;
  index?: number;
  sheetType?: 'GRID' | 'OBJECT';
  gridProperties?: {
    rowCount?: number;
    columnCount?: number;
    frozenRowCount?: number;
    frozenColumnCount?: number;
    hideGridlines?: boolean;
    rowGroupControlAfter?: boolean;
    columnGroupControlAfter?: boolean;
  };
  hidden?: boolean;
  tabColor?: {
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
  };
  rightToLeft?: boolean;
  dataSourceSheetProperties?: {
    dataSourceId?: string;
    columns?: Array<{
      reference?: {
        name?: string;
      };
      formula?: string;
    }>;
    dataExecutionStatus?: {
      state?: 'DATA_EXECUTION_STATE_UNSPECIFIED' | 'NOT_STARTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
      errorCode?: 'DATA_EXECUTION_ERROR_CODE_UNSPECIFIED' | 'TIMED_OUT' | 'TOO_MANY_ROWS' | 'TOO_MANY_COLUMNS' | 'TOO_MANY_CELLS' | 'ENGINE' | 'PARAMETER_INVALID' | 'UNSUPPORTED_DATA_TYPE' | 'DUPLICATE_COLUMN_NAMES' | 'INTERRUPTED' | 'CONCURRENT_QUERY' | 'OTHER' | 'TOO_MANY_CHARS_PER_CELL' | 'DATA_NOT_FOUND' | 'PERMISSION_DENIED' | 'MISSING_COLUMN_ALIAS' | 'OBJECT_NOT_FOUND' | 'DATA_EXECUTION_CANCELLED' | 'USER_NOT_AUTHORIZED';
      errorMessage?: string;
      lastRefreshTime?: string;
    };
  };
}

export interface GoogleSheetsDuplicateSheetRequest {
  sourceSheetId: number;
  insertSheetIndex?: number;
  newSheetId?: number;
  newSheetName?: string;
}

export interface GoogleSheetsUpdateSheetPropertiesRequest {
  properties: GoogleSheetsSheetProperties;
  fields: string;
}

export interface GoogleSheetsChartSpec {
  title?: string;
  altText?: string;
  titleTextFormat?: {
    foregroundColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  subtitle?: string;
  subtitleTextFormat?: {
    foregroundColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  fontName?: string;
  maximized?: boolean;
  backgroundColor?: {
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
  };
  basicChart?: {
    chartType?: 'BASIC_CHART_TYPE_UNSPECIFIED' | 'BAR' | 'LINE' | 'AREA' | 'COLUMN' | 'SCATTER' | 'COMBO' | 'STEPPED_AREA';
    legendPosition?: 'BASIC_CHART_LEGEND_POSITION_UNSPECIFIED' | 'BOTTOM_LEGEND' | 'LEFT_LEGEND' | 'RIGHT_LEGEND' | 'TOP_LEGEND' | 'NO_LEGEND';
    axis?: Array<{
      position?: 'BASIC_CHART_AXIS_POSITION_UNSPECIFIED' | 'BOTTOM_AXIS' | 'LEFT_AXIS' | 'RIGHT_AXIS';
      title?: string;
      format?: {
        backgroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        textFormat?: {
          foregroundColor?: {
            red?: number;
            green?: number;
            blue?: number;
            alpha?: number;
          };
          fontFamily?: string;
          fontSize?: number;
          bold?: boolean;
          italic?: boolean;
          strikethrough?: boolean;
          underline?: boolean;
        };
      };
      titleTextPosition?: {
        horizontalAlignment?: 'HORIZONTAL_ALIGN_UNSPECIFIED' | 'LEFT' | 'CENTER' | 'RIGHT';
      };
    }>;
    domains?: Array<{
      domain?: {
        sourceRange?: {
          sources?: Array<{
            sheetId?: number;
            startRowIndex?: number;
            endRowIndex?: number;
            startColumnIndex?: number;
            endColumnIndex?: number;
          }>;
        };
      };
      reversed?: boolean;
    }>;
    series?: Array<{
      series?: {
        sourceRange?: {
          sources?: Array<{
            sheetId?: number;
            startRowIndex?: number;
            endRowIndex?: number;
            startColumnIndex?: number;
            endColumnIndex?: number;
          }>;
        };
      };
      targetAxis?: 'BASIC_CHART_AXIS_POSITION_UNSPECIFIED' | 'BOTTOM_AXIS' | 'LEFT_AXIS' | 'RIGHT_AXIS';
      type?: 'BASIC_CHART_TYPE_UNSPECIFIED' | 'BAR' | 'LINE' | 'AREA' | 'COLUMN' | 'SCATTER' | 'COMBO' | 'STEPPED_AREA';
      color?: {
        red?: number;
        green?: number;
        blue?: number;
        alpha?: number;
      };
      colorStyle?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
        themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
      };
      lineStyle?: {
        width?: number;
        type?: 'LINE_DASH_TYPE_UNSPECIFIED' | 'INVISIBLE' | 'CUSTOM' | 'SOLID' | 'DOTTED' | 'MEDIUM_DASHED' | 'MEDIUM_DASHED_DOTTED' | 'LONG_DASHED' | 'LONG_DASHED_DOTTED';
      };
      pointStyle?: {
        size?: number;
        shape?: 'POINT_SHAPE_UNSPECIFIED' | 'CIRCLE' | 'DIAMOND' | 'HEXAGON' | 'PENTAGON' | 'SQUARE' | 'STAR' | 'TRIANGLE' | 'X_MARK';
      };
    }>;
    headerCount?: number;
    threeDimensional?: boolean;
    interpolateNulls?: boolean;
    stackedType?: 'BASIC_CHART_STACKED_TYPE_UNSPECIFIED' | 'NOT_STACKED' | 'STACKED' | 'PERCENT_STACKED';
    lineSmoothing?: boolean;
    compareMode?: 'BASIC_CHART_COMPARE_MODE_UNSPECIFIED' | 'DATUM' | 'CATEGORY';
  };
  pieChart?: {
    legendPosition?: 'PIE_CHART_LEGEND_POSITION_UNSPECIFIED' | 'BOTTOM_LEGEND' | 'LEFT_LEGEND' | 'RIGHT_LEGEND' | 'TOP_LEGEND' | 'NO_LEGEND';
    domain?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    series?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    threeDimensional?: boolean;
    pieHole?: number;
  };
  candlestickChart?: {
    domain?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    data?: Array<{
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    }>;
  };
  orgChart?: {
    nodeSize?: 'ORG_CHART_LABEL_SIZE_UNSPECIFIED' | 'SMALL' | 'MEDIUM' | 'LARGE';
    nodeColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    nodeColorStyle?: {
      rgbColor?: {
        red?: number;
        green?: number;
        blue?: number;
      };
      themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
    };
    selectedNodeColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    selectedNodeColorStyle?: {
      rgbColor?: {
        red?: number;
        green?: number;
        blue?: number;
      };
      themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
    };
    labels?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    parentLabels?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    tooltips?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
  };
  histogramChart?: {
    series?: Array<{
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    }>;
    legendPosition?: 'HISTOGRAM_CHART_LEGEND_POSITION_UNSPECIFIED' | 'BOTTOM_LEGEND' | 'LEFT_LEGEND' | 'RIGHT_LEGEND' | 'TOP_LEGEND' | 'NO_LEGEND' | 'INSIDE_LEGEND';
    showItemDividers?: boolean;
    bucketSize?: number;
    outlierPercentile?: number;
  };
  waterfallChart?: {
    series?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    domain?: {
      sourceRange?: {
        sources?: Array<{
          sheetId?: number;
          startRowIndex?: number;
          endRowIndex?: number;
          startColumnIndex?: number;
          endColumnIndex?: number;
        }>;
      };
    };
    stackedType?: 'WATERFALL_STACKED_TYPE_UNSPECIFIED' | 'STACKED' | 'SEQUENTIAL';
    firstValueIsSubtotal?: boolean;
    hideConnectorLines?: boolean;
  };
}

export interface GoogleSheetsEmbeddedChart {
  chartId?: number;
  spec?: GoogleSheetsChartSpec;
  position?: {
    sheetId?: number;
    overlayPosition?: {
      anchorCell?: {
        sheetId?: number;
        rowIndex?: number;
        columnIndex?: number;
      };
      offsetXPixels?: number;
      offsetYPixels?: number;
      widthPixels?: number;
      heightPixels?: number;
    };
    newSheet?: boolean;
  };
  border?: {
    color?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    colorStyle?: {
      rgbColor?: {
        red?: number;
        green?: number;
        blue?: number;
      };
      themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
    };
  };
}

export interface GoogleSheetsPivotTable {
  source?: {
    sheetId?: number;
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
  };
  rows?: Array<{
    sourceColumnOffset?: number;
    showTotals?: boolean;
    sortOrder?: 'SORT_ORDER_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING';
    valueBucket?: {
      valuesIndex?: number;
      buckets?: Array<{
        stringValue?: string;
      }>;
    };
    repeatHeadings?: boolean;
    label?: string;
    groupRule?: {
      manualRule?: {
        groups?: Array<{
          groupName?: {
            stringValue?: string;
          };
          items?: Array<{
            stringValue?: string;
          }>;
        }>;
      };
      histogramRule?: {
        intervalSize?: number;
        minValue?: number;
        maxValue?: number;
      };
      dateTimeRule?: {
        type?: 'DATE_TIME_RULE_TYPE_UNSPECIFIED' | 'SECOND' | 'MINUTE' | 'HOUR' | 'HOUR_MINUTE' | 'HOUR_MINUTE_AMPM' | 'DAY_OF_WEEK' | 'DAY_OF_YEAR' | 'DAY_OF_MONTH' | 'DAY_MONTH' | 'MONTH' | 'QUARTER' | 'YEAR' | 'YEAR_MONTH' | 'YEAR_QUARTER' | 'YEAR_MONTH_DAY';
      };
    };
    groupLimit?: {
      countLimit?: number;
      applyOrder?: number;
    };
  }>;
  columns?: Array<{
    sourceColumnOffset?: number;
    showTotals?: boolean;
    sortOrder?: 'SORT_ORDER_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING';
    valueBucket?: {
      valuesIndex?: number;
      buckets?: Array<{
        stringValue?: string;
      }>;
    };
    repeatHeadings?: boolean;
    label?: string;
    groupRule?: {
      manualRule?: {
        groups?: Array<{
          groupName?: {
            stringValue?: string;
          };
          items?: Array<{
            stringValue?: string;
          }>;
        }>;
      };
      histogramRule?: {
        intervalSize?: number;
        minValue?: number;
        maxValue?: number;
      };
      dateTimeRule?: {
        type?: 'DATE_TIME_RULE_TYPE_UNSPECIFIED' | 'SECOND' | 'MINUTE' | 'HOUR' | 'HOUR_MINUTE' | 'HOUR_MINUTE_AMPM' | 'DAY_OF_WEEK' | 'DAY_OF_YEAR' | 'DAY_OF_MONTH' | 'DAY_MONTH' | 'MONTH' | 'QUARTER' | 'YEAR' | 'YEAR_MONTH' | 'YEAR_QUARTER' | 'YEAR_MONTH_DAY';
      };
    };
    groupLimit?: {
      countLimit?: number;
      applyOrder?: number;
    };
  }>;
  values?: Array<{
    sourceColumnOffset?: number;
    summarizeFunction?: 'PIVOT_STANDARD_VALUE_FUNCTION_UNSPECIFIED' | 'SUM' | 'COUNTA' | 'COUNT' | 'COUNTUNIQUE' | 'AVERAGE' | 'MAX' | 'MIN' | 'MEDIAN' | 'PRODUCT' | 'STDEV' | 'STDEVP' | 'VAR' | 'VARP';
    name?: string;
    calculatedDisplayType?: 'PIVOT_VALUE_CALCULATED_DISPLAY_TYPE_UNSPECIFIED' | 'PERCENT_OF_ROW_TOTAL' | 'PERCENT_OF_COLUMN_TOTAL' | 'PERCENT_OF_GRAND_TOTAL';
    formula?: string;
  }>;
  valueLayout?: 'HORIZONTAL' | 'VERTICAL';
  filters?: Array<{
    sourceColumnOffset?: number;
    criteria?: {
      visibleValues?: string[];
      condition?: {
        type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
        values?: Array<{
          relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
          userEnteredValue?: string;
        }>;
      };
      visibleByDefault?: boolean;
    };
    filterSpecs?: Array<{
      filterCriteria?: {
        hiddenValues?: string[];
        condition?: {
          type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
          values?: Array<{
            relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
            userEnteredValue?: string;
          }>;
        };
        visibleByDefault?: boolean;
      };
      columnIndex?: number;
      dataSourceColumnReference?: {
        name?: string;
      };
    }>;
  }>;
}

export interface GoogleSheetsCellFormat {
  numberFormat?: {
    type?: 'NUMBER_FORMAT_TYPE_UNSPECIFIED' | 'TEXT' | 'NUMBER' | 'PERCENT' | 'CURRENCY' | 'DATE' | 'TIME' | 'DATE_TIME' | 'SCIENTIFIC';
    pattern?: string;
  };
  backgroundColor?: {
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
  };
  backgroundColorStyle?: {
    rgbColor?: {
      red?: number;
      green?: number;
      blue?: number;
    };
    themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
  };
  borders?: {
    top?: {
      style?: 'STYLE_UNSPECIFIED' | 'DOTTED' | 'DASHED' | 'SOLID' | 'SOLID_MEDIUM' | 'SOLID_THICK' | 'NONE' | 'DOUBLE';
      width?: number;
      color?: {
        red?: number;
        green?: number;
        blue?: number;
        alpha?: number;
      };
      colorStyle?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
        themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
      };
    };
    bottom?: {
      style?: 'STYLE_UNSPECIFIED' | 'DOTTED' | 'DASHED' | 'SOLID' | 'SOLID_MEDIUM' | 'SOLID_THICK' | 'NONE' | 'DOUBLE';
      width?: number;
      color?: {
        red?: number;
        green?: number;
        blue?: number;
        alpha?: number;
      };
      colorStyle?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
        themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
      };
    };
    left?: {
      style?: 'STYLE_UNSPECIFIED' | 'DOTTED' | 'DASHED' | 'SOLID' | 'SOLID_MEDIUM' | 'SOLID_THICK' | 'NONE' | 'DOUBLE';
      width?: number;
      color?: {
        red?: number;
        green?: number;
        blue?: number;
        alpha?: number;
      };
      colorStyle?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
        themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
      };
    };
    right?: {
      style?: 'STYLE_UNSPECIFIED' | 'DOTTED' | 'DASHED' | 'SOLID' | 'SOLID_MEDIUM' | 'SOLID_THICK' | 'NONE' | 'DOUBLE';
      width?: number;
      color?: {
        red?: number;
        green?: number;
        blue?: number;
        alpha?: number;
      };
      colorStyle?: {
        rgbColor?: {
          red?: number;
          green?: number;
          blue?: number;
        };
        themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
      };
    };
  };
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  horizontalAlignment?: 'HORIZONTAL_ALIGN_UNSPECIFIED' | 'LEFT' | 'CENTER' | 'RIGHT';
  verticalAlignment?: 'VERTICAL_ALIGN_UNSPECIFIED' | 'TOP' | 'MIDDLE' | 'BOTTOM';
  wrapStrategy?: 'WRAP_STRATEGY_UNSPECIFIED' | 'OVERFLOW_CELL' | 'LEGACY_WRAP' | 'CLIP' | 'WRAP';
  textDirection?: 'TEXT_DIRECTION_UNSPECIFIED' | 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  textFormat?: {
    foregroundColor?: {
      red?: number;
      green?: number;
      blue?: number;
      alpha?: number;
    };
    foregroundColorStyle?: {
      rgbColor?: {
        red?: number;
        green?: number;
        blue?: number;
      };
      themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
    };
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    link?: {
      uri?: string;
    };
  };
  hyperlinkDisplayType?: 'HYPERLINK_DISPLAY_TYPE_UNSPECIFIED' | 'LINKED' | 'PLAIN_TEXT';
  textRotation?: {
    angle?: number;
    vertical?: boolean;
  };
}

export interface GoogleSheetsDataValidationRule {
  condition?: {
    type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
    values?: Array<{
      relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
      userEnteredValue?: string;
    }>;
  };
  inputMessage?: string;
  strict?: boolean;
  showCustomUi?: boolean;
}

export interface GoogleSheetsRequestBody {
  title?: string;
  parents?: string[];
  properties?: {
    title?: string;
    locale?: string;
    autoRecalc?: 'RECALCULATION_INTERVAL_UNSPECIFIED' | 'ON_CHANGE' | 'MINUTE' | 'HOUR';
    timeZone?: string;
    defaultFormat?: GoogleSheetsCellFormat;
    iterativeCalculationSettings?: {
      maxIterations?: number;
      convergenceThreshold?: number;
    };
    spreadsheetTheme?: {
      primaryFontFamily?: string;
      themeColors?: Array<{
        colorType?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        color?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
        };
      }>;
    };
  };
  sheets?: Array<{
    properties?: GoogleSheetsSheetProperties;
    data?: Array<{
      startRow?: number;
      startColumn?: number;
      rowData?: Array<{
        values?: Array<{
          userEnteredValue?: {
            stringValue?: string;
            numberValue?: number;
            boolValue?: boolean;
            formulaValue?: string;
            errorValue?: {
              type?: 'ERROR_TYPE_UNSPECIFIED' | 'ERROR' | 'NULL_VALUE' | 'DIVIDE_BY_ZERO' | 'VALUE' | 'REF' | 'NAME' | 'NUM' | 'N_A' | 'LOADING';
              message?: string;
            };
          };
          effectiveValue?: {
            stringValue?: string;
            numberValue?: number;
            boolValue?: boolean;
            formulaValue?: string;
            errorValue?: {
              type?: 'ERROR_TYPE_UNSPECIFIED' | 'ERROR' | 'NULL_VALUE' | 'DIVIDE_BY_ZERO' | 'VALUE' | 'REF' | 'NAME' | 'NUM' | 'N_A' | 'LOADING';
              message?: string;
            };
          };
          formattedValue?: string;
          userEnteredFormat?: GoogleSheetsCellFormat;
          effectiveFormat?: GoogleSheetsCellFormat;
          hyperlink?: string;
          note?: string;
          textFormatRuns?: Array<{
            startIndex?: number;
            format?: {
              foregroundColor?: {
                red?: number;
                green?: number;
                blue?: number;
                alpha?: number;
              };
              foregroundColorStyle?: {
                rgbColor?: {
                  red?: number;
                  green?: number;
                  blue?: number;
                };
                themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
              };
              fontFamily?: string;
              fontSize?: number;
              bold?: boolean;
              italic?: boolean;
              strikethrough?: boolean;
              underline?: boolean;
              link?: {
                uri?: string;
              };
            };
          }>;
          dataValidation?: GoogleSheetsDataValidationRule;
          pivotTable?: GoogleSheetsPivotTable;
        }>;
      }>;
      rowMetadata?: Array<{
        hiddenByFilter?: boolean;
        hiddenByUser?: boolean;
        pixelSize?: number;
        developerMetadata?: Array<{
          metadataId?: number;
          metadataKey?: string;
          metadataValue?: string;
          location?: {
            locationType?: 'DEVELOPER_METADATA_LOCATION_TYPE_UNSPECIFIED' | 'ROW' | 'COLUMN' | 'SHEET' | 'SPREADSHEET';
            spreadsheet?: boolean;
            sheetId?: number;
            dimensionRange?: {
              sheetId?: number;
              dimension?: 'DIMENSION_UNSPECIFIED' | 'ROWS' | 'COLUMNS';
              startIndex?: number;
              endIndex?: number;
            };
          };
          visibility?: 'DEVELOPER_METADATA_VISIBILITY_UNSPECIFIED' | 'DOCUMENT' | 'PROJECT';
        }>;
      }>;
      columnMetadata?: Array<{
        hiddenByFilter?: boolean;
        hiddenByUser?: boolean;
        pixelSize?: number;
        developerMetadata?: Array<{
          metadataId?: number;
          metadataKey?: string;
          metadataValue?: string;
          location?: {
            locationType?: 'DEVELOPER_METADATA_LOCATION_TYPE_UNSPECIFIED' | 'ROW' | 'COLUMN' | 'SHEET' | 'SPREADSHEET';
            spreadsheet?: boolean;
            sheetId?: number;
            dimensionRange?: {
              sheetId?: number;
              dimension?: 'DIMENSION_UNSPECIFIED' | 'ROWS' | 'COLUMNS';
              startIndex?: number;
              endIndex?: number;
            };
          };
          visibility?: 'DEVELOPER_METADATA_VISIBILITY_UNSPECIFIED' | 'DOCUMENT' | 'PROJECT';
        }>;
      }>;
    }>;
    charts?: GoogleSheetsEmbeddedChart[];
    filterViews?: Array<{
      filterViewId?: number;
      title?: string;
      range?: {
        sheetId?: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      namedRangeId?: string;
      sortSpecs?: Array<{
        dimensionIndex?: number;
        sortOrder?: 'SORT_ORDER_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING';
        foregroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        foregroundColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        backgroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        backgroundColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
      }>;
      criteria?: {
        [key: string]: {
          hiddenValues?: string[];
          condition?: {
            type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
            values?: Array<{
              relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
              userEnteredValue?: string;
            }>;
          };
          visibleByDefault?: boolean;
        };
      };
    }>;
    protectedRanges?: Array<{
      protectedRangeId?: number;
      range?: {
        sheetId?: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      namedRangeId?: string;
      description?: string;
      warningOnly?: boolean;
      requestingUserCanEdit?: boolean;
      unprotectedRanges?: Array<{
        sheetId?: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      }>;
      editors?: {
        users?: string[];
        groups?: string[];
        domainUsersCanEdit?: boolean;
      };
    }>;
    basicFilter?: {
      range?: {
        sheetId?: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      sortSpecs?: Array<{
        dimensionIndex?: number;
        sortOrder?: 'SORT_ORDER_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING';
        foregroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        foregroundColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        backgroundColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        backgroundColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
      }>;
      criteria?: {
        [key: string]: {
          hiddenValues?: string[];
          condition?: {
            type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
            values?: Array<{
              relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
              userEnteredValue?: string;
            }>;
          };
          visibleByDefault?: boolean;
        };
      };
      filterSpecs?: Array<{
        filterCriteria?: {
          hiddenValues?: string[];
          condition?: {
            type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
            values?: Array<{
              relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
              userEnteredValue?: string;
            }>;
          };
          visibleByDefault?: boolean;
        };
        columnIndex?: number;
        dataSourceColumnReference?: {
          name?: string;
        };
      }>;
    };
    conditionalFormats?: Array<{
      ranges?: Array<{
        sheetId?: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      }>;
      booleanRule?: {
        condition?: {
          type?: 'CONDITION_TYPE_UNSPECIFIED' | 'NUMBER_GREATER' | 'NUMBER_GREATER_THAN_EQ' | 'NUMBER_LESS' | 'NUMBER_LESS_THAN_EQ' | 'NUMBER_EQ' | 'NUMBER_NOT_EQ' | 'NUMBER_BETWEEN' | 'NUMBER_NOT_BETWEEN' | 'TEXT_CONTAINS' | 'TEXT_NOT_CONTAINS' | 'TEXT_STARTS_WITH' | 'TEXT_ENDS_WITH' | 'TEXT_EQ' | 'TEXT_IS_EMAIL' | 'TEXT_IS_URL' | 'DATE_EQ' | 'DATE_BEFORE' | 'DATE_AFTER' | 'DATE_ON_OR_BEFORE' | 'DATE_ON_OR_AFTER' | 'DATE_BETWEEN' | 'DATE_NOT_BETWEEN' | 'DATE_IS_VALID' | 'ONE_OF_RANGE' | 'ONE_OF_LIST' | 'BLANK' | 'NOT_BLANK' | 'CUSTOM_FORMULA' | 'BOOLEAN' | 'TEXT_NOT_EQ' | 'DATE_NOT_EQ';
          values?: Array<{
            relativeDate?: 'RELATIVE_DATE_UNSPECIFIED' | 'PAST_YEAR' | 'PAST_MONTH' | 'PAST_WEEK' | 'YESTERDAY' | 'TODAY' | 'TOMORROW';
            userEnteredValue?: string;
          }>;
        };
        format?: GoogleSheetsCellFormat;
      };
      gradientRule?: {
        minpoint?: {
          color?: {
            red?: number;
            green?: number;
            blue?: number;
            alpha?: number;
          };
          colorStyle?: {
            rgbColor?: {
              red?: number;
              green?: number;
              blue?: number;
            };
            themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
          };
          type?: 'INTERPOLATION_POINT_TYPE_UNSPECIFIED' | 'MIN' | 'MAX' | 'NUMBER' | 'PERCENT' | 'PERCENTILE';
          value?: string;
        };
        midpoint?: {
          color?: {
            red?: number;
            green?: number;
            blue?: number;
            alpha?: number;
          };
          colorStyle?: {
            rgbColor?: {
              red?: number;
              green?: number;
              blue?: number;
            };
            themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
          };
          type?: 'INTERPOLATION_POINT_TYPE_UNSPECIFIED' | 'MIN' | 'MAX' | 'NUMBER' | 'PERCENT' | 'PERCENTILE';
          value?: string;
        };
        maxpoint?: {
          color?: {
            red?: number;
            green?: number;
            blue?: number;
            alpha?: number;
          };
          colorStyle?: {
            rgbColor?: {
              red?: number;
              green?: number;
              blue?: number;
            };
            themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
          };
          type?: 'INTERPOLATION_POINT_TYPE_UNSPECIFIED' | 'MIN' | 'MAX' | 'NUMBER' | 'PERCENT' | 'PERCENTILE';
          value?: string;
        };
      };
    }>;
    bandedRanges?: Array<{
      bandedRangeId?: number;
      range?: {
        sheetId?: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      rowProperties?: {
        headerColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        headerColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        firstBandColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        firstBandColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        secondBandColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        secondBandColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        footerColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        footerColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
      };
      columnProperties?: {
        headerColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        headerColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        firstBandColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        firstBandColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        secondBandColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        secondBandColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
        footerColor?: {
          red?: number;
          green?: number;
          blue?: number;
          alpha?: number;
        };
        footerColorStyle?: {
          rgbColor?: {
            red?: number;
            green?: number;
            blue?: number;
          };
          themeColor?: 'THEME_COLOR_TYPE_UNSPECIFIED' | 'TEXT' | 'BACKGROUND' | 'ACCENT1' | 'ACCENT2' | 'ACCENT3' | 'ACCENT4' | 'ACCENT5' | 'ACCENT6' | 'LINK';
        };
      };
    }>;
    developerMetadata?: Array<{
      metadataId?: number;
      metadataKey?: string;
      metadataValue?: string;
      location?: {
        locationType?: 'DEVELOPER_METADATA_LOCATION_TYPE_UNSPECIFIED' | 'ROW' | 'COLUMN' | 'SHEET' | 'SPREADSHEET';
        spreadsheet?: boolean;
        sheetId?: number;
        dimensionRange?: {
          sheetId?: number;
          dimension?: 'DIMENSION_UNSPECIFIED' | 'ROWS' | 'COLUMNS';
          startIndex?: number;
          endIndex?: number;
        };
      };
      visibility?: 'DEVELOPER_METADATA_VISIBILITY_UNSPECIFIED' | 'DOCUMENT' | 'PROJECT';
    }>;
    rowGroups?: Array<{
      range?: {
        sheetId?: number;
        dimension?: 'DIMENSION_UNSPECIFIED' | 'ROWS' | 'COLUMNS';
        startIndex?: number;
        endIndex?: number;
      };
      depth?: number;
      collapsed?: boolean;
    }>;
    columnGroups?: Array<{
      range?: {
        sheetId?: number;
        dimension?: 'DIMENSION_UNSPECIFIED' | 'ROWS' | 'COLUMNS';
        startIndex?: number;
        endIndex?: number;
      };
      depth?: number;
      collapsed?: boolean;
    }>;
  }>;
  namedRanges?: Array<{
    namedRangeId?: string;
    name?: string;
    range?: {
      sheetId?: number;
      startRowIndex?: number;
      endRowIndex?: number;
      startColumnIndex?: number;
      endColumnIndex?: number;
    };
  }>;
  spreadsheetUrl?: string;
  developerMetadata?: Array<{
    metadataId?: number;
    metadataKey?: string;
    metadataValue?: string;
    location?: {
      locationType?: 'DEVELOPER_METADATA_LOCATION_TYPE_UNSPECIFIED' | 'ROW' | 'COLUMN' | 'SHEET' | 'SPREADSHEET';
      spreadsheet?: boolean;
      sheetId?: number;
      dimensionRange?: {
        sheetId?: number;
        dimension?: 'DIMENSION_UNSPECIFIED' | 'ROWS' | 'COLUMNS';
        startIndex?: number;
        endIndex?: number;
      };
    };
    visibility?: 'DEVELOPER_METADATA_VISIBILITY_UNSPECIFIED' | 'DOCUMENT' | 'PROJECT';
  }>;
}