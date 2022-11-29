package people

[string]: #Person

#Person: {
	name:     string
	github:   #GitHub
	twitter?: #Twitter
	youtube?: #YouTube
}

#GitHub: {
	handle: string
	url:    "https://github.com/\(handle)"
}

#Twitter: {
	handle: string
	url:    "https://twitter.com/\(handle)"
}

#YouTube: {
	handle: string
	url:    "https://youtube.com/@\(handle)"
}
