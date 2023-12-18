package main

type RawkodeAcademy struct{}

func (m *RawkodeAcademy) Dev() {
	dag.Supabase().DevStack("rawkode-academy", "http://localhost:4321")
}
