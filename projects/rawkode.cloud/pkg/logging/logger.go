package logging

import (
	"log/slog"
	"os"
)

// Setup initializes the default structured logger with JSON output.
// All log lines include structured key-value pairs for easy filtering
// and searching in production.
func Setup(level slog.Level) {
	handler := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		Level: level,
	})
	slog.SetDefault(slog.New(handler))
}
