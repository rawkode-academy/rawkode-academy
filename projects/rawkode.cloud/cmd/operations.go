package cmd

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	clusterstate "github.com/rawkode-academy/rawkode-cloud3/internal/cluster"
	"github.com/rawkode-academy/rawkode-cloud3/internal/config"
	"github.com/rawkode-academy/rawkode-cloud3/internal/operation"
	"github.com/spf13/cobra"
)

var opsCmd = &cobra.Command{
	Use:     "ops",
	Aliases: []string{"operations"},
	Short:   "Manage in-progress operations",
}

func newOperationStore(cfg *config.Config) (*operation.Store, error) {
	accessKey, secretKey := cfg.ScalewayCredentials()
	return operation.NewStore(operation.StoreConfig{
		Bucket:    cfg.State.Bucket,
		Region:    cfg.State.Region,
		Endpoint:  cfg.State.Endpoint,
		AccessKey: accessKey,
		SecretKey: secretKey,
	})
}

var opsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List in-progress and incomplete operations",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfgPath, _ := cmd.Flags().GetString("config")
		cfg, _, err := loadConfigForClusterOrFile("", cfgPath)
		if err != nil {
			return err
		}

		store, err := newOperationStore(cfg)
		if err != nil {
			return fmt.Errorf("init operation store: %w", err)
		}

		ops, err := store.List()
		if err != nil {
			return fmt.Errorf("list operations: %w", err)
		}

		if len(ops) == 0 {
			fmt.Println("No operations found.")
			return nil
		}

		for _, op := range ops {
			fmt.Printf("  %s  type=%s  cluster=%s  phase=%s  updated=%s\n",
				op.ID, op.Type, op.Cluster, op.CurrentPhase, op.UpdatedAt.Format("2006-01-02 15:04:05"))
		}
		return nil
	},
}

var opsResumeCmd = &cobra.Command{
	Use:   "resume <operation-id>",
	Short: "Resume an incomplete operation",
	Args:  cobra.ExactArgs(1),
	RunE:  runOpsResume,
}

var opsAbortCmd = &cobra.Command{
	Use:   "abort <operation-id>",
	Short: "Abort and rollback an operation",
	Args:  cobra.ExactArgs(1),
	RunE:  runOpsAbort,
}

func runOpsResume(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	cfgPathFlag, _ := cmd.Flags().GetString("config")
	if strings.TrimSpace(cfgPathFlag) == "" {
		return fmt.Errorf("--config is required")
	}
	fromPhase, _ := cmd.Flags().GetString("from-phase")

	cfg, cfgPath, err := loadConfigForClusterOrFile("", cfgPathFlag)
	if err != nil {
		return err
	}

	store, err := newOperationStore(cfg)
	if err != nil {
		return fmt.Errorf("init operation store: %w", err)
	}

	op, err := store.Load(args[0])
	if err != nil {
		return fmt.Errorf("load operation: %w", err)
	}

	if strings.TrimSpace(fromPhase) != "" {
		if err := resetOperationFromPhase(op, fromPhase); err != nil {
			return err
		}
		if err := store.Save(op); err != nil {
			return fmt.Errorf("save reset operation: %w", err)
		}
		fmt.Printf("Reset operation %s from phase %q.\n", op.ID, strings.TrimSpace(fromPhase))
	}

	if op.IsComplete() {
		fmt.Printf("Operation %s is already complete.\n", op.ID)
		return nil
	}

	// If a config was passed that doesn't match, resolve by operation cluster name.
	if strings.TrimSpace(op.Cluster) != "" && op.Cluster != cfg.Environment {
		cfg, cfgPath, err = loadConfigForClusterOrFile(op.Cluster, "")
		if err != nil {
			return fmt.Errorf("operation targets cluster %q but provided config is %q: %w", op.Cluster, cfg.Environment, err)
		}
		store, err = newOperationStore(cfg)
		if err != nil {
			return fmt.Errorf("init operation store: %w", err)
		}
	}

	fmt.Printf("Resuming operation %s (type=%s, phase=%s, config=%s)...\n", op.ID, op.Type, op.CurrentPhase, cfgPath)

	switch op.Type {
	case operation.TypeCreateCluster:
		nodeStore := clusterstate.NewNodeStore(store, cfg.Environment)
		return executeCreateCluster(ctx, op, store, nodeStore, cfg)
	default:
		return fmt.Errorf("resume does not support operation type %q", op.Type)
	}
}

func resetOperationFromPhase(op *operation.Operation, fromPhase string) error {
	if op == nil {
		return fmt.Errorf("operation is required")
	}

	target := strings.TrimSpace(fromPhase)
	if target == "" {
		return fmt.Errorf("from phase is required")
	}

	startIdx := -1
	for i, phaseName := range op.PhaseOrder {
		if phaseName == target {
			startIdx = i
			break
		}
	}
	if startIdx < 0 {
		return fmt.Errorf("phase %q not found in operation %s", target, op.ID)
	}

	for i, phaseName := range op.PhaseOrder {
		if i < startIdx {
			continue
		}

		phase, ok := op.Phases[phaseName]
		if !ok || phase == nil {
			phase = &operation.Phase{}
			op.Phases[phaseName] = phase
		}

		phase.Status = operation.PhasePending
		phase.StartedAt = nil
		phase.CompletedAt = nil
		phase.Error = ""
		phase.Data = nil
	}

	op.CurrentPhase = target
	op.UpdatedAt = time.Now().UTC()
	return nil
}

func runOpsAbort(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	cfgPathFlag, _ := cmd.Flags().GetString("config")
	if strings.TrimSpace(cfgPathFlag) == "" {
		return fmt.Errorf("--config is required")
	}

	cfg, _, err := loadConfigForClusterOrFile("", cfgPathFlag)
	if err != nil {
		return err
	}

	store, err := newOperationStore(cfg)
	if err != nil {
		return fmt.Errorf("init operation store: %w", err)
	}

	op, err := store.Load(args[0])
	if err != nil {
		return fmt.Errorf("load operation: %w", err)
	}

	registry := newCreateCleanupRegistry(cfg)

	fmt.Printf("Aborting operation %s, executing %d cleanup actions...\n", op.ID, len(op.Cleanup))
	errs := registry.ExecuteLIFO(ctx, op.Cleanup)

	resumePhase := op.ResumePhase()
	if resumePhase != "" {
		_ = op.FailPhase(resumePhase, fmt.Errorf("aborted by operator"))
	}
	if err := store.Save(op); err != nil {
		return fmt.Errorf("save aborted operation: %w", err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("abort completed with cleanup errors: %w", errors.Join(errs...))
	}

	fmt.Printf("Operation %s aborted successfully.\n", op.ID)
	return nil
}

func init() {
	opsCmd.AddCommand(opsListCmd)
	opsCmd.AddCommand(opsResumeCmd)
	opsCmd.AddCommand(opsAbortCmd)

	for _, c := range []*cobra.Command{opsListCmd, opsResumeCmd, opsAbortCmd} {
		c.Flags().String("config", "", "Path to cluster config YAML")
	}
	opsResumeCmd.Flags().String("from-phase", "", "Reset operation status from this phase onward before resuming")
}
