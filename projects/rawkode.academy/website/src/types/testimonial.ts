export interface TestimonialAuthor {
	name: string;
	title?: string;
	image?: string;
	link?: string;
}

export interface Testimonial {
	quote: string;
	author: TestimonialAuthor;
}
