import { cloudStorage } from "@payloadcms/plugin-cloud-storage";
import { s3Adapter } from "@payloadcms/plugin-cloud-storage/s3";
import search from "@payloadcms/plugin-search";
import axios from "axios";
import path from "path";
import { oAuthPlugin } from "payload-plugin-oauth";
import { buildConfig } from "payload/config";
import { CollectionConfig } from "payload/types";
import Categories from "./collections/Categories";
import Posts from "./collections/Posts";
import { Logo } from "./collections/media";
import { People } from "./collections/people";
import { Episodes, Shows } from "./collections/shows";
import { Technologies } from "./collections/technologies";

const allCollections: CollectionConfig[] = [
	People,
	Categories,
	Posts,
	Shows,
	Episodes,
	Technologies,
	Logo,
];

export default buildConfig({
	serverURL: process.env.APPSETTING_DNS_NAME,
	debug: process.env.NODE_ENV === "production" ? false : true,
	admin: {
		user: People.slug,
	},
	indexSortableFields: true,
	collections: allCollections,
	typescript: {
		outputFile: path.resolve(__dirname, "payload-types.ts"),
	},
	graphQL: {
		schemaOutputFile: path.resolve(__dirname, "generated-schema.graphql"),
	},
	plugins: [
		oAuthPlugin({
			clientID: process.env.APPSETTING_OAUTH_CLIENT_ID || "",
			clientSecret: process.env.APPSETTING_OAUTH_CLIENT_SECRET || "",
			authorizationURL: `${process.env.APPSETTING_OAUTH_BASE_URL}/login/oauth/authorize`,
			tokenURL: `${process.env.APPSETTING_OAUTH_BASE_URL}/login/oauth/access_token`,
			callbackURL: `${
				process.env.APPSETTING_DNS_NAME || "https://localhost:3000"
			}/oauth2/callback`,
			scope: "basic",
			// This needs to be set, but setting it to anything other
			// than an empty string will cause it to try and connect
			// to the database during build
			mongoUrl: process.env.APPSETTING_MONGODB_URI,
			userCollection: {
				slug: People.slug,
			},
			subField: {
				name: "github",
			},
			async userinfo(accessToken) {
				const { data: user } = await axios.get("https://api.github.com/user", {
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				});

				const role = user.login === "rawkode" ? "admin" : "guest";

				return {
					sub: user.login,
					github: user.login,
					name: user.name,
					email: user.email,
					role,
				};
			},
		}),
		search({
			collections: allCollections.map((collection) => collection.slug),
		}),
		cloudStorage({
			enabled: process.env.NODE_ENV === "production",
			collections: {
				[Logo.slug]: {
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
