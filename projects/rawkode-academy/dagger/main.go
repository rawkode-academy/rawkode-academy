package main

import (
	"context"
)

type RawkodeAcademy struct{}

func (m *RawkodeAcademy) Dev(ctx context.Context) *Service {
	supabase := dag.Supabase().DevStack()

	// anonKey, err := supabase.AnonKey(ctx)
	// if err != nil {
	// 	log.Fatal(err)
	// 	return nil
	// }

	// serviceKey, err := supabase.ServiceKey(ctx)
	// if err != nil {
	// 	log.Fatal(err)
	// 	return nil
	// }

	// if err := os.WriteFile(".env.local", []byte(fmt.Sprintf("hello\n %s \nbye\n %s \n", anonKey, serviceKey)), 0666); err != nil {
	// 	log.Fatal(err)
	// 	return nil
	// }

	return supabase.Service()
}
