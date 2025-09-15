import { tool } from 'ai';
import { z } from 'zod';

export const nameTool = tool({
  description: 'Get the user\'s name',
  inputSchema: z.object({}),
  execute: async () => {
    return 'Agu Jonas';
  },
});