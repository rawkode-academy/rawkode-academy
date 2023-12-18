package main

type RawkodeAcademy struct {
}

func (m *RawkodeAcademy) Dev(stringArg string) *Container {
  supabase := dag.Supabase().DevStack("high")

	return dag.
    Container().
    From("alpine:latest").
    WithServiceBinding("postgres", supabase.Postgres()).
    WithExec([]string{"echo", stringArg})
}
