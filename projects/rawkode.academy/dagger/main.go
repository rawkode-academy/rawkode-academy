package main

type RawkodeAcademy struct {
}

func (m *RawkodeAcademy) Dev(stringArg string) *Container {
	return dag.Container().From("alpine:latest").WithExec([]string{"echo", stringArg})
}
