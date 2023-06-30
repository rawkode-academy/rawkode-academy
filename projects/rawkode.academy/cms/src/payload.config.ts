import { cloudStorage } from "@payloadcms/plugin-cloud-storage";
import { s3Adapter } from "@payloadcms/plugin-cloud-storage/s3";
import search from "@payloadcms/plugin-search";
import seo from "@payloadcms/plugin-seo";
import axios from "axios";
import path from "path";
import { oAuthPlugin } from "payload-plugin-oauth";
import { buildConfig } from "payload/config";
import { CollectionConfig } from "payload/types";
import Categories from "./collections/Categories";
import Media from "./collections/Media";
import Posts from "./collections/Posts";
import Tags from "./collections/Tags";
import { People } from "./collections/people";
import { Episodes, Shows } from "./collections/shows";
import { Technologies } from "./collections/technologies";

const allCollections: CollectionConfig[] = [
	People,
	Categories,
	Posts,
	Tags,
	Media,
	Shows,
	Episodes,
	Technologies,
];

export default buildConfig({
	serverURL: "http://localhost:3000",
	admin: {
		user: People.slug,
	},
	collections: allCollections,
	typescript: {
		outputFile: path.resolve(__dirname, "payload-types.ts"),
	},
	graphQL: {
		schemaOutputFile: path.resolve(__dirname, "generated-schema.graphql"),
	},
	plugins: [
		oAuthPlugin({
			clientID: process.env.OAUTH_CLIENT_ID,
			clientSecret: process.env.OAUTH_CLIENT_SECRET,
			authorizationURL: `${process.env.OAUTH_BASE_URL}/login/oauth/authorize`,
			tokenURL: `${process.env.OAUTH_BASE_URL}/login/oauth/access_token`,
			callbackURL: `${process.env.SERVER_URL}/oauth2/callback`,
			scope: "user",
			userCollection: {
				slug: People.slug,
			},
			async userinfo(accessToken) {
				const { data: user } = await axios.get("https://api.github.com/user", {
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				});

				console.debug(user);

				return {
					sub: user.login,
					name: user.name,
					email: user.email,
				};
			},
		}),
		seo({
			collections: allCollections
				.filter((collection) => (collection.slug === Media.slug ? false : true))
				.map((collection) => collection.slug),
			uploadsCollection: Media.slug,
		}),
		search({
			collections: allCollections.map((collection) => collection.slug),
		}),
		cloudStorage({
			enabled: process.env.NODE_ENV === "production",
			collections: {
				[Media.slug]: {
					adapter: s3Adapter({
						bucket: "",
						config: {
							endpoint: "",
							credentials: {
								accessKeyId: "",
								secretAccessKey: "",
							},
						},
						acl: "public-read",
					}),
				},
			},
		}),
	],
});
