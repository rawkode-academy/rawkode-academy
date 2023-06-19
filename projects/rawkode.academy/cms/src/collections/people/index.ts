import { CollectionConfig } from 'payload/types';

export const People: CollectionConfig = {
  slug: 'people',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    }
  ],
};
