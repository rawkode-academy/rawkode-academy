export interface Chapter {
    time: string;
    title: string;
}

export interface Episode extends Syncable {
    type: "episode";
    title: string;
    show: string;
    publishedAt: Date;
    youtubeId: string | undefined;
    youtubeCategory: number;
    links: string[];
    chapters: Chapter[];
}

export interface Person extends Syncable {
    type: "person";
    id: string;
    name: string;
    twitter: string | undefined;
    github: string | undefined;
    youtube: string | undefined;
}

export interface Technology extends Syncable {
    type: "technology";
    title: string;
    website: string;
    documentation: string;
    repository: string;
    description: string;
}

export interface Show extends Syncable {
    type: "show";
    title: string;
}

export interface Syncable {
    type: SyncableType;
}

export type SyncableType = "episode" | "person" | "technology" | "show";
