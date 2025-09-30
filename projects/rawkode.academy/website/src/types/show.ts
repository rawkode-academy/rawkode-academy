export interface ShowHost {
        forename?: string | null;
        surname?: string | null;
}

export interface ShowEpisode {
        video?: {
                title?: string | null;
                thumbnailUrl?: string | null;
                publishedAt?: string | null;
        } | null;
}

export interface ShowSummary {
        id: string;
        name: string;
        hosts?: ShowHost[] | null;
        episodes?: (ShowEpisode | null)[] | null;
}
