package main

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sethvargo/go-password/password"
)

type Supabase struct {
	Service    *Service
	AnonKey    string
	ServiceKey string
}

// Giving up, for now, trying to get this running like producation.
// All in one image it is ...
// Want the 'producation' code? Checkout commit
//   - dcc6262a11d455c2b987a80434291f37b66e14c6
func (m *Supabase) DevStack() (*Supabase, err) {
	postgresPassword, err := password.Generate(64, 10, 10, false, false)
	if err != nil {
		return nil, err
	}

	jwtSecret, err := password.Generate(64, 10, 10, false, false)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"role": "anon",
		"iss":  "supabase",
		"iat":  jwt.NewNumericDate(now),
		"exp":  jwt.NewNumericDate(now.Add(time.Duration(4) * time.Hour)),
	})

	m.anonKey, err := token.SignedString(jwtSecret)
	if err != nil {
		return nil, err
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"role": "anon",
		"iss":  "supabase",
		"iat":  jwt.NewNumericDate(now),
		"exp":  jwt.NewNumericDate(now.Add(time.Duration(4) * time.Hour)),
	})

	m.ServiceKey, err := token.SignedString(jwtSecret)
	if err != nil {
		return nil, err
	}

	m.Service = dag.Container().
		From("public.ecr.aws/supabase/postgres:aio-15.1.0.153").
		WithEnvVariable("POSTGRES_PASSWORD", postgresPassword).
		WithEnvVariable("JWT_SECRET", jwtSecret).
		WithEnvVariable("ANON_KEY", m.anonKey).
		WithEnvVariable("SERVICE_ROLE_KEY", m.ServiceKey).
		WithEnvVariable("MACHINE_TYPE", "shared_cpu_1x_512m").
		WithEnvVariable("DATA_VOLUME_MOUNTPOINT", "/data").
		WithExposedPort(5432).
		WithExposedPort(8000).
		AsService()

	return m
}
