export interface ShowHost {
        forename?: string | null;
        surname?: string | null;
}

export interface ShowSummary {
        id: string;
        name: string;
        hosts?: ShowHost[] | null;
}
