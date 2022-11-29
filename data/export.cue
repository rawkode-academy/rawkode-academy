package export

import "github.com/RawkodeAcademy/RawkodeAcademy/data/courses"

import "github.com/RawkodeAcademy/RawkodeAcademy/data/people"

import "github.com/RawkodeAcademy/RawkodeAcademy/data/shows"
import "github.com/RawkodeAcademy/RawkodeAcademy/data/shows/episodes"

import "github.com/RawkodeAcademy/RawkodeAcademy/data/technologies"

"people": [string]: people.#Person
"people": people

"shows": [string]: shows.#Show
"shows": [string]: host: or([ for k, _ in people {k}]) // Ensure hosts relationship is correct
"shows": shows

"episodes": [string]: [...episodes.#NumberedEpisode]
// Need to work this one out
// Validate shows always point to a real show
"episodes": episodes

"technologies": [string]: technologies.#Technology
"technologies": technologies

"courses": [string]: courses.#Course
"courses": [string]: host: or([ for k, _ in people {k}]) // Ensure hosts relationship is correct
"courses": courses
