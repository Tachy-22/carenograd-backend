import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import type { GoogleSheetsChartSpec, GoogleSheetsPivotTable } from '../../types/google-sheets';
import { getAccessToken } from '../../utils/auth-context';

const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional(),
  alpha: z.number().min(0).max(1).optional()
});

export const createChartTool = tool({
  description: 'Create a chart in a Google Sheets spreadsheet with various chart types and customization options',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the sheet where the chart will be placed'),
    chartType: z.enum(['COLUMN', 'BAR', 'LINE', 'AREA', 'SCATTER', 'PIE', 'DONUT', 'HISTOGRAM', 'CANDLESTICK', 'TREEMAP', 'WATERFALL', 'ORG', 'COMBO']).describe('Type of chart to create'),
    sourceRange: z.string().describe('A1 notation of the data range for the chart (e.g., "A1:C10")'),
    title: z.string().optional().describe('Title of the chart'),
    position: z.object({
      overlayPosition: z.object({
        anchorCell: z.string().describe('Cell where chart should be anchored (e.g., "E2")'),
        offsetXPixels: z.number().optional(),
        offsetYPixels: z.number().optional(),
        widthPixels: z.number().optional(),
        heightPixels: z.number().optional()
      }).optional(),
      newSheet: z.boolean().optional().describe('Whether to create chart on a new sheet')
    }).describe('Position and size of the chart'),
    legend: z.object({
      position: z.enum(['BOTTOM_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'TOP_LEGEND', 'NO_LEGEND']).optional(),
      alignment: z.enum(['START', 'CENTER', 'END']).optional(),
      textStyle: z.object({
        fontSize: z.number().optional(),
        fontFamily: z.string().optional(),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        foregroundColor: ColorSchema.optional()
      }).optional()
    }).optional().describe('Legend configuration'),
    axes: z.array(z.object({
      position: z.enum(['BOTTOM_AXIS', 'LEFT_AXIS', 'RIGHT_AXIS', 'TOP_AXIS']),
      title: z.string().optional(),
      format: z.object({
        type: z.enum(['NUMBER', 'PERCENT', 'CURRENCY', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC']).optional(),
        pattern: z.string().optional()
      }).optional(),
      textStyle: z.object({
        fontSize: z.number().optional(),
        fontFamily: z.string().optional(),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        foregroundColor: ColorSchema.optional()
      }).optional()
    })).optional().describe('Axis configurations'),
    series: z.array(z.object({
      type: z.enum(['COLUMN', 'BAR', 'LINE', 'AREA', 'SCATTER']).optional(),
      targetAxis: z.enum(['LEFT_AXIS', 'RIGHT_AXIS']).optional(),
      color: ColorSchema.optional(),
      lineStyle: z.object({
        type: z.enum(['SOLID', 'DOTTED', 'DASHED']).optional(),
        width: z.number().optional()
      }).optional(),
      pointStyle: z.object({
        shape: z.enum(['CIRCLE', 'DIAMOND', 'HEXAGON', 'PENTAGON', 'SQUARE', 'STAR', 'TRIANGLE', 'X_MARK']).optional(),
        size: z.number().optional()
      }).optional()
    })).optional().describe('Series-specific configurations'),
    backgroundColor: ColorSchema.optional().describe('Background color of the chart'),
  }),
  execute: async ({
    spreadsheetId,
    sheetId,
    chartType,
    // sourceRange, 
    title,
    position,
    legend,
    axes,
    series,
    backgroundColor
  }) => {
    try {
      const chartSpec: Record<string, unknown> = {
        title: title,
        basicChart: {
          chartType: chartType,
          legendPosition: legend?.position || 'BOTTOM_LEGEND',
          axis: axes?.map(axis => ({
            position: axis.position,
            title: axis.title,
            format: axis.format,
            textStyle: axis.textStyle
          })) || [],
          domains: [
            {
              domain: {
                sourceRange: {
                  sources: [
                    {
                      sheetId: sheetId,
                      // This would need proper A1 notation parsing
                      startRowIndex: 0,
                      endRowIndex: 10,
                      startColumnIndex: 0,
                      endColumnIndex: 1
                    }
                  ]
                }
              }
            }
          ],
          series: series?.map((s, index) => ({
            series: {
              sourceRange: {
                sources: [
                  {
                    sheetId: sheetId,
                    startRowIndex: 0,
                    endRowIndex: 10,
                    startColumnIndex: index + 1,
                    endColumnIndex: index + 2
                  }
                ]
              }
            },
            type: s.type || chartType,
            targetAxis: s.targetAxis,
            color: s.color,
            lineStyle: s.lineStyle,
            pointStyle: s.pointStyle
          })) || [],
          headerCount: 1,
          threeDimensional: false
        },
        backgroundColor: backgroundColor
      };

      let chartPosition: Record<string, unknown> = {};
      if (position?.overlayPosition) {
        chartPosition = {
          overlayPosition: {
            anchorCell: {
              sheetId: sheetId,
              rowIndex: 1, // This would need proper cell parsing
              columnIndex: 4
            },
            offsetXPixels: position.overlayPosition.offsetXPixels || 0,
            offsetYPixels: position.overlayPosition.offsetYPixels || 0,
            widthPixels: position.overlayPosition.widthPixels || 600,
            heightPixels: position.overlayPosition.heightPixels || 371
          }
        };
      } else if (position?.newSheet) {
        chartPosition = { newSheet: true };
      }

      const request = {
        requests: [
          {
            addChart: {
              chart: {
                spec: chartSpec,
                position: chartPosition
              }
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const addChartReply = response.data.replies?.[0]?.addChart;

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        chart: {
          chartId: addChartReply?.chart?.chartId,
          spec: addChartReply?.chart?.spec,
          position: addChartReply?.chart?.position
        }
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const updateChartTool = tool({
  description: 'Update an existing chart in a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    chartId: z.number().describe('The ID of the chart to update'),
    title: z.string().optional().describe('New title for the chart'),
    chartType: z.enum(['COLUMN', 'BAR', 'LINE', 'AREA', 'SCATTER', 'PIE', 'DONUT', 'HISTOGRAM', 'CANDLESTICK', 'TREEMAP', 'WATERFALL', 'ORG', 'COMBO']).optional().describe('New chart type'),
    legend: z.object({
      position: z.enum(['BOTTOM_LEGEND', 'LEFT_LEGEND', 'RIGHT_LEGEND', 'TOP_LEGEND', 'NO_LEGEND']).optional()
    }).optional().describe('Legend configuration'),
    position: z.object({
      anchorCell: z.string().optional().describe('New anchor cell (e.g., "E2")'),
      offsetXPixels: z.number().optional(),
      offsetYPixels: z.number().optional(),
      widthPixels: z.number().optional(),
      heightPixels: z.number().optional()
    }).optional().describe('New position and size'),
    backgroundColor: ColorSchema.optional().describe('New background color'),
  }),
  execute: async ({ spreadsheetId, chartId, title, chartType, legend, position, backgroundColor }) => {
    try {
      const chartSpec: Record<string, unknown> = {};
      const fields: string[] = [];

      if (title) {
        chartSpec.title = title;
        fields.push('title');
      }
      if (chartType || legend) {
        chartSpec.basicChart = {} as Record<string, unknown>;
        if (chartType) {
          (chartSpec.basicChart as Record<string, unknown>).chartType = chartType;
          fields.push('basicChart.chartType');
        }
        if (legend?.position) {
          (chartSpec.basicChart as Record<string, unknown>).legendPosition = legend.position;
          fields.push('basicChart.legendPosition');
        }
      }
      if (backgroundColor) {
        chartSpec.backgroundColor = backgroundColor;
        fields.push('backgroundColor');
      }

      const updateChart: Record<string, unknown> = {
        chartId: chartId,
        spec: chartSpec
      };

      if (position) {
        updateChart.position = {
          overlayPosition: {
            anchorCell: {
              sheetId: 0, // This would need proper parsing
              rowIndex: 1,
              columnIndex: 4
            },
            offsetXPixels: position.offsetXPixels || 0,
            offsetYPixels: position.offsetYPixels || 0,
            widthPixels: position.widthPixels || 600,
            heightPixels: position.heightPixels || 371
          }
        };
        fields.push('position');
      }

      const request = {
        requests: [
          {
            updateChartSpec: {
              chartId: chartId,
              spec: chartSpec,
              fields: fields.join(',')
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        updatedChartId: chartId
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const deleteChartTool = tool({
  description: 'Delete a chart from a Google Sheets spreadsheet',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    chartId: z.number().describe('The ID of the chart to delete'),
  }),
  execute: async ({ spreadsheetId, chartId }) => {
    try {
      const request = {
        requests: [
          {
            deleteEmbeddedObject: {
              objectId: chartId
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        deletedChartId: chartId
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});

export const createPivotTableTool = tool({
  description: 'Create a pivot table in a Google Sheets spreadsheet with flexible grouping and aggregation',
  inputSchema: z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sourceSheetId: z.number().describe('The ID of the sheet containing source data'),
    sourceRange: z.string().describe('A1 notation of the source data range (e.g., "A1:D100")'),
    destinationSheetId: z.number().optional().describe('Sheet where pivot table should be placed (creates new sheet if not specified)'),
    anchorCell: z.string().optional().describe('Cell where pivot table should start (e.g., "A1")'),
    rows: z.array(z.object({
      sourceColumnOffset: z.number().describe('0-based column index in source data'),
      showTotals: z.boolean().optional().describe('Whether to show totals for this row group'),
      sortOrder: z.enum(['ASCENDING', 'DESCENDING']).optional().describe('Sort order for row values'),
      valueBucket: z.object({
        valuesIndex: z.number().optional(),
        buckets: z.array(z.object({
          stringValue: z.string().optional(),
          doubleValue: z.number().optional()
        })).optional()
      }).optional().describe('Custom bucketing for row values')
    })).describe('Row grouping configuration'),
    columns: z.array(z.object({
      sourceColumnOffset: z.number().describe('0-based column index in source data'),
      showTotals: z.boolean().optional().describe('Whether to show totals for this column group'),
      sortOrder: z.enum(['ASCENDING', 'DESCENDING']).optional().describe('Sort order for column values')
    })).optional().describe('Column grouping configuration'),
    values: z.array(z.object({
      sourceColumnOffset: z.number().describe('0-based column index in source data'),
      summarizeFunction: z.enum(['SUM', 'COUNT', 'AVERAGE', 'MAX', 'MIN', 'MEDIAN', 'PRODUCT', 'STDEV', 'STDEVP', 'VAR', 'VARP']).describe('Aggregation function to apply'),
      name: z.string().optional().describe('Custom name for this value field')
    })).describe('Value fields and aggregation functions'),
    filters: z.array(z.object({
      sourceColumnOffset: z.number().describe('0-based column index in source data'),
      criteria: z.object({
        visibleValues: z.array(z.string()).optional().describe('Values to show (all others will be filtered out)'),
        hiddenValues: z.array(z.string()).optional().describe('Values to hide'),
        visibleByDefault: z.boolean().optional().describe('Whether values are visible by default')
      }).optional()
    })).optional().describe('Filter configuration'),
    valueLayout: z.enum(['HORIZONTAL', 'VERTICAL']).optional().describe('How to layout multiple value fields'),
  }),
  execute: async ({
    spreadsheetId,
    sourceSheetId,
    // sourceRange, 
    destinationSheetId,
    anchorCell,
    rows,
    columns,
    values,
    filters,
    valueLayout
  }) => {
    try {
      // This would need proper A1 notation parsing
      const sourceGridRange = {
        sheetId: sourceSheetId,
        startRowIndex: 0,
        endRowIndex: 100,
        startColumnIndex: 0,
        endColumnIndex: 10
      };

      const pivotTable: Partial<GoogleSheetsPivotTable> = {
        source: sourceGridRange,
        rows: rows.map(row => ({
          sourceColumnOffset: row.sourceColumnOffset,
          showTotals: row.showTotals !== false,
          sortOrder: row.sortOrder || 'ASCENDING',
          valueBucket: row.valueBucket
        })),
        columns: columns?.map(col => ({
          sourceColumnOffset: col.sourceColumnOffset,
          showTotals: col.showTotals !== false,
          sortOrder: col.sortOrder || 'ASCENDING'
        })) || [],
        values: values.map(val => ({
          sourceColumnOffset: val.sourceColumnOffset,
          summarizeFunction: val.summarizeFunction,
          name: val.name
        })),
        filters: filters?.map(filter => ({
          sourceColumnOffset: filter.sourceColumnOffset,
          criteria: filter.criteria
        })) || [],
        valueLayout: valueLayout || 'HORIZONTAL'
      };

      let destination: Record<string, unknown> | undefined;
      if (destinationSheetId && anchorCell) {
        destination = {
          sheetId: destinationSheetId,
          rowIndex: 0, // This would need proper cell parsing
          columnIndex: 0
        };
      }

      const request = {
        requests: [
          {
            updateCells: {
              start: destination || {
                sheetId: sourceSheetId,
                rowIndex: 0,
                columnIndex: 12
              },
              fields: 'pivotTable',
              rows: [
                {
                  values: [
                    {
                      pivotTable: pivotTable
                    }
                  ]
                }
              ]
            }
          }
        ]
      };

      const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        pivotTable: {
          source: pivotTable.source,
          configuration: {
            rows: pivotTable.rows,
            columns: pivotTable.columns,
            values: pivotTable.values,
            filters: pivotTable.filters,
            valueLayout: pivotTable.valueLayout
          }
        }
      };
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { status?: number; data?: unknown } };
      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode: err.response?.status,
        details: err.response?.data
      };
    }
  }
});