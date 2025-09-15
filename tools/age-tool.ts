import { tool } from 'ai';
import { z } from 'zod';

export const ageTool = tool({
  description: 'Get the user\'s age',
  inputSchema: z.object({}),
  execute: async () => {
    return '22';
  },
});