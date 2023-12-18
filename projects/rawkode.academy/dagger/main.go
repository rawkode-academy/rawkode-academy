package main

type RawkodeAcademy struct {}

func (m *RawkodeAcademy) Dev() *Container {
  supabase := dag.Supabase().DevStack("rawkode-academy", "http://localhost:4321")

	return dag.
    Container().
    From("alpine:latest").
    WithServiceBinding("postgres", supabase.Postgres()).
    WithExec([]string{"echo", "Hello, world!"})
}
