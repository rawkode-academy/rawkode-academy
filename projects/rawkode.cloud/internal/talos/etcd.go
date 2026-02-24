package talos

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"
	"strings"

	commonapi "github.com/siderolabs/talos/pkg/machinery/api/common"
	machineapi "github.com/siderolabs/talos/pkg/machinery/api/machine"
)

// EtcdSnapshot downloads an etcd snapshot from a control plane node.
func (c *Client) EtcdSnapshot(ctx context.Context, outputPath string) error {
	if strings.TrimSpace(outputPath) == "" {
		return fmt.Errorf("output path is required")
	}
	if c.machine == nil {
		return fmt.Errorf("etcd snapshot requires talosconfig")
	}
	if c.insecure {
		return fmt.Errorf("etcd snapshot requires talosconfig")
	}

	slog.Info("taking etcd snapshot", "target", c.targetNode, "output", outputPath)

	stream, err := c.machine.EtcdSnapshot(ctx, &machineapi.EtcdSnapshotRequest{})
	if err != nil {
		return fmt.Errorf("etcd snapshot failed: %w", err)
	}

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create snapshot output file: %w", err)
	}
	defer outputFile.Close()

	for {
		chunk, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read etcd snapshot stream: %w", err)
		}
		if _, err := outputFile.Write(chunk.GetBytes()); err != nil {
			return fmt.Errorf("write snapshot output file: %w", err)
		}
	}

	return nil
}

// EtcdRestore restores etcd from a snapshot on a control plane node.
func (c *Client) EtcdRestore(ctx context.Context, snapshotPath string) error {
	if strings.TrimSpace(snapshotPath) == "" {
		return fmt.Errorf("snapshot path is required")
	}
	if c.machine == nil {
		return fmt.Errorf("etcd restore requires talosconfig")
	}
	if c.insecure {
		return fmt.Errorf("etcd restore requires talosconfig")
	}

	slog.Info("restoring etcd", "target", c.targetNode, "snapshot", snapshotPath)

	snapshotFile, err := os.Open(snapshotPath)
	if err != nil {
		return fmt.Errorf("open snapshot file: %w", err)
	}
	defer snapshotFile.Close()

	stream, err := c.machine.EtcdRecover(ctx)
	if err != nil {
		return fmt.Errorf("start etcd recovery stream: %w", err)
	}

	buffer := make([]byte, 4096)
	for {
		n, readErr := snapshotFile.Read(buffer)
		if n > 0 {
			if sendErr := stream.Send(&commonapi.Data{Bytes: buffer[:n]}); sendErr != nil {
				return fmt.Errorf("stream etcd recovery data: %w", sendErr)
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("read snapshot file: %w", readErr)
		}
	}

	if _, err := stream.CloseAndRecv(); err != nil {
		return fmt.Errorf("etcd restore failed: %w", err)
	}

	return nil
}

// EtcdRemoveMember removes a member from the etcd cluster.
func (c *Client) EtcdRemoveMember(ctx context.Context, memberID string) error {
	if strings.TrimSpace(memberID) == "" {
		return fmt.Errorf("member ID is required")
	}
	if c.machine == nil {
		return fmt.Errorf("etcd member removal requires talosconfig")
	}
	if c.insecure {
		return fmt.Errorf("etcd member removal requires talosconfig")
	}

	parsedMemberID, err := strconv.ParseUint(strings.TrimSpace(memberID), 10, 64)
	if err != nil {
		return fmt.Errorf("parse etcd member ID %q: %w", memberID, err)
	}

	slog.Info("removing etcd member", "target", c.targetNode, "member", parsedMemberID)
	if _, err := c.machine.EtcdRemoveMemberByID(ctx, &machineapi.EtcdRemoveMemberByIDRequest{
		MemberId: parsedMemberID,
	}); err != nil {
		return fmt.Errorf("etcd remove-member failed: %w", err)
	}

	return nil
}
