import type { Context } from '../types';

export const catalogResolver = {
  async getCatalog(_parent: unknown, _args: unknown, context: Context) {
    try {
      const catalogObject = await context.env.ANALYTICS_CATALOG.get('catalog/tables.json');

      if (!catalogObject) {
        return null;
      }

      const catalog = await catalogObject.json();
      return catalog;
    } catch (error) {
      console.error('Error fetching catalog:', error);
      throw new Error('Failed to fetch catalog');
    }
  },
};
