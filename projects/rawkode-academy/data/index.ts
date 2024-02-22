import { loadPeople } from "./people";
import { loadShows } from "./shows";

const people = await loadPeople();
people.map((person) => console.log(person));
// sync to Turso

const shows = await loadShows();
shows.map((show) => console.log(show));
// sync to Turso
