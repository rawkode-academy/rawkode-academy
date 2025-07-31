export interface Meeting {
	id: string;
	name: string;
}

export interface MeetingProvider {
	createMeeting(name: string): Promise<Meeting>;
}
