import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSchema } from 'drizzle-graphql';
import { drizzle } from 'drizzle-orm/libsql';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { client } from "../data-model/client";
import * as dbSchema from '../data-model/schema';

const db = drizzle(client, { schema: dbSchema });

const { entities } = buildSchema(db);

const schema = new GraphQLSchema({
	query: new GraphQLObjectType({
		name: 'Query',
		fields: {
			show: entities.queries.showsTableSingle,
			shows: entities.queries.showsTable,
		},
  })
});

const server = new ApolloServer({ schema });
const { url } = await startStandaloneServer(server);

console.log(`🚀 Server ready at ${url}`);
