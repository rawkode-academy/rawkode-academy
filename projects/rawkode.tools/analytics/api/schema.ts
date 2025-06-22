import {
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import { analyticsResolver } from './resolvers/analytics';
import { catalogResolver } from './resolvers/catalog';

const TimeRangeInput = new GraphQLInputObjectType({
  name: 'TimeRangeInput',
  fields: {
    start: { type: new GraphQLNonNull(GraphQLString) },
    end: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const TableMetadataType = new GraphQLObjectType({
  name: 'TableMetadata',
  fields: {
    tableName: { type: new GraphQLNonNull(GraphQLString) },
    eventType: { type: new GraphQLNonNull(GraphQLString) },
    totalRows: { type: new GraphQLNonNull(GraphQLInt) },
    totalSizeBytes: { type: new GraphQLNonNull(GraphQLFloat) },
    lastUpdated: { type: new GraphQLNonNull(GraphQLString) },
  },
});

const CatalogType = new GraphQLObjectType({
  name: 'Catalog',
  fields: {
    version: { type: new GraphQLNonNull(GraphQLString) },
    lastUpdated: { type: new GraphQLNonNull(GraphQLString) },
    tables: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TableMetadataType))),
    },
  },
});

const EventCountType = new GraphQLObjectType({
  name: 'EventCount',
  fields: {
    dimensions: { type: new GraphQLNonNull(GraphQLString) }, // JSON string
    count: { type: new GraphQLNonNull(GraphQLInt) },
  },
});

const AnalyticsType = new GraphQLObjectType({
  name: 'Analytics',
  fields: {
    eventCounts: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(EventCountType))),
      args: {
        eventType: { type: GraphQLString },
        timeRange: { type: TimeRangeInput },
        groupBy: { type: new GraphQLList(new GraphQLNonNull(GraphQLString)) },
      },
      resolve: analyticsResolver.eventCounts,
    },
    rawQuery: {
      type: new GraphQLNonNull(GraphQLString), // JSON string
      args: {
        query: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: analyticsResolver.rawQuery,
    },
  },
});

const QueryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    catalog: {
      type: CatalogType,
      resolve: catalogResolver.getCatalog,
    },
    analytics: {
      type: new GraphQLNonNull(AnalyticsType),
      resolve: () => ({}), // Return empty object as resolver is on field level
    },
  },
});

export const schema = new GraphQLSchema({
  query: QueryType,
});
