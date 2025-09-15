import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const scrapeTableTool = tool({
  description: 'Extracts structured data from HTML tables on a webpage. Converts tables to JSON format.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL containing the table to scrape'),
    tableSelector: z.string().optional().default('table').describe('CSS selector for the table element'),
    includeHeaders: z.boolean().optional().default(true).describe('Whether to treat first row as headers'),
    maxRows: z.number().optional().default(100).describe('Maximum number of rows to extract'),
  }),
  execute: async ({ url, tableSelector, includeHeaders, maxRows }) => {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      const tables: Array<{
        tableIndex: number;
        headers: string[];
        rows: Array<string[] | Record<string, string>>;
        rowCount: number;
        columnCount: number;
      }> = [];
      
      $(tableSelector).each((tableIndex, tableElement) => {
        const $table = $(tableElement);
        const headers: string[] = [];
        const rows: Array<string[] | Record<string, string>> = [];
        
        // Extract headers if requested
        if (includeHeaders) {
          $table.find('thead tr:first-child th, tr:first-child th, tr:first-child td').each((_, headerElement) => {
            headers.push($(headerElement).text().trim());
          });
        }
        
        // Extract table rows
        const rowSelector = includeHeaders ? 'tbody tr, tr:not(:first-child)' : 'tbody tr, tr';
        const $rows = $table.find(rowSelector);
        
        $rows.slice(0, maxRows).each((_, rowElement) => {
          const $row = $(rowElement);
          const rowData: string[] = [];
          
          $row.find('td, th').each((_, cellElement) => {
            rowData.push($(cellElement).text().trim());
          });
          
          if (rowData.length > 0) {
            if (includeHeaders && headers.length > 0) {
              // Create object with headers as keys
              const rowObject: Record<string, string> = {};
              rowData.forEach((cell, index) => {
                const header = headers[index] || `column_${index}`;
                rowObject[header] = cell;
              });
              rows.push(rowObject);
            } else {
              // Use array format
              rows.push(rowData);
            }
          }
        });
        
        if (rows.length > 0) {
          tables.push({
            tableIndex,
            headers,
            rows,
            rowCount: rows.length,
            columnCount: headers.length || (rows[0] as string[]).length || 0
          });
        }
      });
      
      return {
        success: true,
        url,
        tablesFound: tables.length,
        tables
      };
    } catch (error: unknown) {
       const err = error as Error & { response?: { status?: number } };
      return {
        success: false,
        url,
        error: err.message || 'Unknown error occurred',
        statusCode: err.response?.status || null
      };
    }
  },
});