package operation

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
)

// CleanupHandler is a function that executes a single cleanup action.
type CleanupHandler func(ctx context.Context, data json.RawMessage) error

// CleanupRegistry maps action types to their handlers.
type CleanupRegistry struct {
	handlers map[string]CleanupHandler
}

// NewCleanupRegistry creates a new cleanup handler registry.
func NewCleanupRegistry() *CleanupRegistry {
	return &CleanupRegistry{
		handlers: make(map[string]CleanupHandler),
	}
}

// Register adds a cleanup handler for an action type.
func (r *CleanupRegistry) Register(actionType string, handler CleanupHandler) {
	r.handlers[actionType] = handler
}

// ExecuteLIFO runs cleanup actions in reverse order (LIFO).
// Continues through all actions even if some fail, collecting errors.
func (r *CleanupRegistry) ExecuteLIFO(ctx context.Context, actions []CleanupAction) []error {
	var errs []error

	for i := len(actions) - 1; i >= 0; i-- {
		action := actions[i]
		handler, ok := r.handlers[action.Type]
		if !ok {
			slog.Warn("no cleanup handler registered", "type", action.Type)
			errs = append(errs, fmt.Errorf("no handler for cleanup type %q", action.Type))
			continue
		}

		slog.Info("executing cleanup action", "type", action.Type, "index", i)
		if err := handler(ctx, action.Data); err != nil {
			slog.Error("cleanup action failed", "type", action.Type, "error", err)
			errs = append(errs, fmt.Errorf("cleanup %q: %w", action.Type, err))
		}
	}

	return errs
}
