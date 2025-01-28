import {
	GetObjectCommand,
	type GetObjectCommandInput,
	ListObjectsV2Command,
	S3Client,
} from '@aws-sdk/client-s3';
import { existsSync } from '@std/fs';
import { db } from './data-model/client.ts';
import { videosTable } from './data-model/schema.ts';
import {slugifyWithCounter} from '@sindresorhus/slugify';

const cloudflareR2 = {
	accountId: '0aeb879de8e3cdde5fb3d413025222ce',
	accessKey: Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY')!,
	secretKey: Deno.env.get('CLOUDFLARE_R2_SECRET_KEY')!,
};

const s3 = new S3Client({
	region: 'auto',
	endpoint: `https://${cloudflareR2.accountId}.eu.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: cloudflareR2.accessKey,
		secretAccessKey: cloudflareR2.secretKey,
	},
});

const downloadFromR2 = async (remote: string, local: string) => {
	if (existsSync(local)) {
		console.log(`File already exists: ${local}`);
		return;
	}

	console.log(`R2 Downloading ${remote} to ${local}...`);

	const command: GetObjectCommandInput = {
		Bucket: 'rawkode-academy-videos',
		Key: remote,
	};

	try {
		const s3Command = new GetObjectCommand(command);
		const response = await s3.send(s3Command);
		if (!response.Body) {
			throw new Error('No body in response.');
		}

		Deno.writeFileSync(
			local,
			await response.Body.transformToByteArray(),
		);

		console.log(`File ${remote} downloaded to ${local}.`);
	} catch (error) {
		console.log(`Failed to download: ${error}`);
	}
};

const listDirectories = async (bucketName: string, prefix: string = '') => {
	const command = new ListObjectsV2Command({
		Bucket: bucketName,
		Delimiter: '/',
		Prefix: prefix,
	});

	try {
		const response = await s3.send(command);
		return {
			directories: response.CommonPrefixes?.map((p) => p.Prefix) || [],
			files: response.Contents?.map((c) => c.Key) || [],
		};
	} catch (error) {
		console.error('Error listing S3 directories:', error);
		throw error;
	}
};

interface Metadata {
	id: string;
	title: string;
	thumbnail: string;
	description: string;
	timestamp: number;
	duration: number;
	view_count: number;
	like_count: number;
	live_status: 'was_live' | 'none';
	chapters: [{
		start_time: number;
		title: string;
		end_time: number;
	}];
	availability: 'public' | 'private';
}

const getYouTubeMetadata = (metadataJson: string): Metadata => {
	return JSON.parse(
		Deno.readTextFileSync(metadataJson),
	) satisfies Metadata;
};

const allDirectories = await listDirectories('rawkode-academy-videos');

const slugify = slugifyWithCounter();

for (const directory of allDirectories.directories) {
	if (!directory) {
		console.log(`Skipping directory: ${directory}`);
		continue;
	}

	if (directory === 'rawkode-academy-videos/') {
		console.log(`Skipping root directory: ${directory}`);
		continue;
	}

	console.log(`Processing directory: ${directory}`);

	const dirName = directory.substring(0, directory.length - 1);

	if (!existsSync(`transcode/${dirName}`)) {
		Deno.mkdirSync(`transcode/${dirName}`, { recursive: true });
	}

	// Download Metadata
	await downloadFromR2(
		`${dirName}/youtube/metadata.json`,
		`./transcode/${dirName}/metadata.json`,
	);

	const metadata = getYouTubeMetadata(`./transcode/${dirName}/metadata.json`);

	if (metadata.availability === 'private') {
		continue;
	}

	// Remove anything after "|" in title
	const cleanTitle = metadata.title.split('|')[0].trim();

	console.log(`Upserting ${dirName} - ${cleanTitle}`);

	await db
		.insert(videosTable)
		.values({
			id: dirName,
			title: cleanTitle,
			subtitle: '',
			slug: slugify(cleanTitle, {
				decamelize: false,
			}),
			description: metadata.description,
			duration: metadata.duration,
			publishedAt: new Date(metadata.timestamp * 1000),
		})
		.onConflictDoUpdate({
			target: videosTable.id,
			set: {
				title: cleanTitle,
				subtitle: '',
				slug: slugify(cleanTitle, {
					decamelize: false,
				}),
				description: metadata.description,
				duration: metadata.duration,
				publishedAt: new Date(metadata.timestamp * 1000),
			},
		});
}
