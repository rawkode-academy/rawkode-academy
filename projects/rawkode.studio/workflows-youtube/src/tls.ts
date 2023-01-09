import { NativeConnection } from "@temporalio/worker";
import { Connection, Client } from "@temporalio/client";
import * as fs from "fs";

import { getEnv } from "./env";
import { ConnectionLike } from "@temporalio/client";

export const getConnection = async (): Promise<
	NativeConnection | undefined
> => {
	console.log("getConnection");
	const env = getEnv();

	if (!env.useTls) {
		return undefined;
	}

	let serverRootCACertificate: Buffer | undefined = undefined;
	if (env.serverRootCACertificatePath) {
		serverRootCACertificate = fs.readFileSync(env.serverRootCACertificatePath);
	}

	console.debug(serverRootCACertificate);
	console.debug({
		address: env.address,
		tls: {
			serverNameOverride: env.serverNameOverride,
			serverRootCACertificate,
			clientCertPair: {
				crt: fs.readFileSync(env.clientCertPath!),
				key: fs.readFileSync(env.clientKeyPath!),
			},
		},
	});

	return await NativeConnection.connect({
		address: env.address,
		tls: {
			serverNameOverride: env.serverNameOverride,
			serverRootCACertificate,
			clientCertPair: {
				crt: fs.readFileSync(env.clientCertPath!),
				key: fs.readFileSync(env.clientKeyPath!),
			},
		},
	});
};

export const getClientConnection = async (): Promise<
	ConnectionLike | undefined
> => {
	console.log("getClientConnection");
	const env = getEnv();

	if (!env.useTls) {
		return undefined;
	}

	let serverRootCACertificate: Buffer | undefined = undefined;
	if (env.serverRootCACertificatePath) {
		serverRootCACertificate = fs.readFileSync(env.serverRootCACertificatePath);
	}

	console.debug(serverRootCACertificate);
	console.debug({
		address: env.address,
		tls: {
			serverNameOverride: env.serverNameOverride,
			serverRootCACertificate,
			clientCertPair: {
				crt: fs.readFileSync(env.clientCertPath!),
				key: fs.readFileSync(env.clientKeyPath!),
			},
		},
	});

	return await Connection.connect({
		address: env.address,
		tls: {
			serverNameOverride: env.serverNameOverride,
			serverRootCACertificate,
			clientCertPair: {
				crt: fs.readFileSync(env.clientCertPath!),
				key: fs.readFileSync(env.clientKeyPath!),
			},
		},
	});
};
