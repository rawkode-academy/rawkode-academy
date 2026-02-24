package operation

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awshttp "github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

var ErrNotFound = errors.New("object not found")

// Store manages operation state persistence in an S3-compatible bucket.
type Store struct {
	endpoint string
	bucket   string
	region   string
	prefix   string
	client   *s3.Client
}

// StoreConfig holds S3 configuration for the operation store.
type StoreConfig struct {
	Bucket    string
	Region    string
	Endpoint  string // defaults to Scaleway S3
	AccessKey string
	SecretKey string
}

// NewStore creates a new S3-backed operation store.
func NewStore(cfg StoreConfig) (*Store, error) {
	cfg.Bucket = strings.TrimSpace(cfg.Bucket)
	cfg.Region = strings.TrimSpace(cfg.Region)
	cfg.Endpoint = strings.TrimSpace(cfg.Endpoint)
	cfg.AccessKey = strings.TrimSpace(cfg.AccessKey)
	cfg.SecretKey = strings.TrimSpace(cfg.SecretKey)

	if cfg.Bucket == "" {
		return nil, fmt.Errorf("state bucket is required")
	}
	if cfg.Region == "" {
		cfg.Region = "fr-par"
	}
	if cfg.Endpoint == "" {
		cfg.Endpoint = fmt.Sprintf("https://s3.%s.scw.cloud", cfg.Region)
	}
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("S3 access key and secret key are required for state storage")
	}

	endpoint := strings.TrimRight(cfg.Endpoint, "/")
	awsCfg := aws.Config{
		Region: cfg.Region,
		Credentials: aws.NewCredentialsCache(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
		EndpointResolverWithOptions: aws.EndpointResolverWithOptionsFunc(
			func(service, region string, _ ...interface{}) (aws.Endpoint, error) {
				if service == s3.ServiceID {
					return aws.Endpoint{
						URL:               endpoint,
						SigningRegion:     cfg.Region,
						HostnameImmutable: true,
					}, nil
				}
				return aws.Endpoint{}, &aws.EndpointNotFoundError{}
			},
		),
	}

	return &Store{
		endpoint: endpoint,
		bucket:   cfg.Bucket,
		region:   cfg.Region,
		prefix:   "operations/",
		client: s3.NewFromConfig(awsCfg, func(o *s3.Options) {
			// Scaleway object storage works reliably with path-style requests.
			o.UsePathStyle = true
		}),
	}, nil
}

// Save persists an operation to S3.
func (s *Store) Save(op *Operation) error {
	data, err := json.MarshalIndent(op, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal operation: %w", err)
	}

	key := s.prefix + op.ID + ".json"
	if err := s.putObject(context.Background(), key, data); err != nil {
		return fmt.Errorf("save operation %s: %w", op.ID, err)
	}

	slog.Debug("operation saved to S3", "id", op.ID, "bucket", s.bucket, "key", key)
	return nil
}

// Load retrieves an operation from S3 by ID.
func (s *Store) Load(id string) (*Operation, error) {
	key := s.prefix + id + ".json"
	data, err := s.getObject(context.Background(), key)
	if err != nil {
		return nil, fmt.Errorf("load operation %s: %w", id, err)
	}

	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return nil, fmt.Errorf("unmarshal operation %s: %w", id, err)
	}

	return &op, nil
}

// Delete removes an operation from S3.
func (s *Store) Delete(id string) error {
	key := s.prefix + id + ".json"
	return s.deleteObject(context.Background(), key)
}

// List returns all operations in the store.
func (s *Store) List() ([]*Operation, error) {
	keys, err := s.listObjects(context.Background(), s.prefix)
	if err != nil {
		return nil, fmt.Errorf("list operations: %w", err)
	}

	var ops []*Operation
	for _, key := range keys {
		if !strings.HasSuffix(key, ".json") {
			continue
		}

		data, err := s.getObject(context.Background(), key)
		if err != nil {
			slog.Warn("failed to load operation", "key", key, "error", err)
			continue
		}

		var op Operation
		if err := json.Unmarshal(data, &op); err != nil {
			slog.Warn("failed to unmarshal operation", "key", key, "error", err)
			continue
		}

		ops = append(ops, &op)
	}

	sort.Slice(ops, func(i, j int) bool {
		return ops[i].UpdatedAt.After(ops[j].UpdatedAt)
	})

	return ops, nil
}

// FindIncomplete returns incomplete operations matching the given type and cluster.
func (s *Store) FindIncomplete(opType Type, cluster string) ([]*Operation, error) {
	all, err := s.List()
	if err != nil {
		return nil, err
	}

	var result []*Operation
	for _, op := range all {
		if op.IsComplete() {
			continue
		}
		if opType != "" && op.Type != opType {
			continue
		}
		if cluster != "" && op.Cluster != cluster {
			continue
		}
		result = append(result, op)
	}

	return result, nil
}

// PutJSON writes arbitrary JSON-serializable data to a key in the store bucket.
func (s *Store) PutJSON(key string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal %s: %w", key, err)
	}

	if err := s.putObject(context.Background(), key, data); err != nil {
		return fmt.Errorf("put %s: %w", key, err)
	}

	return nil
}

// GetJSON reads JSON data from a key in the store bucket.
func (s *Store) GetJSON(key string, dst any) error {
	data, err := s.getObject(context.Background(), key)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(data, dst); err != nil {
		return fmt.Errorf("unmarshal %s: %w", key, err)
	}

	return nil
}

// S3 primitives via AWS SDK v2

func (s *Store) putObject(ctx context.Context, key string, data []byte) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String("application/json"),
	})
	if err != nil && isBucketNotFound(err) {
		if ensureErr := s.ensureBucket(ctx); ensureErr != nil {
			return fmt.Errorf("ensure state bucket %s: %w", s.bucket, ensureErr)
		}

		_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(s.bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader(data),
			ContentType: aws.String("application/json"),
		})
	}
	if err != nil {
		return fmt.Errorf("S3 PUT %s: %w", key, err)
	}

	return nil
}

func (s *Store) getObject(ctx context.Context, key string) ([]byte, error) {
	resp, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isObjectNotFound(err) || isBucketNotFound(err) {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, key)
		}
		return nil, fmt.Errorf("S3 GET %s: %w", key, err)
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func (s *Store) deleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		// DELETE is idempotent; treat missing objects as success.
		if isObjectNotFound(err) || isBucketNotFound(err) {
			return nil
		}
		return fmt.Errorf("S3 DELETE %s: %w", key, err)
	}

	return nil
}

func (s *Store) listObjects(ctx context.Context, prefix string) ([]string, error) {
	paginator := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(prefix),
	})

	var keys []string
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			if isBucketNotFound(err) {
				// First run: bucket not created yet means there are no operations.
				return []string{}, nil
			}
			return nil, fmt.Errorf("S3 LIST %s: %w", prefix, err)
		}

		for _, object := range page.Contents {
			if object.Key == nil {
				continue
			}
			keys = append(keys, *object.Key)
		}
	}

	return keys, nil
}

func (s *Store) ensureBucket(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err == nil {
		return nil
	}
	if !isBucketNotFound(err) {
		return err
	}

	_, err = s.client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(s.bucket),
		CreateBucketConfiguration: &types.CreateBucketConfiguration{
			LocationConstraint: types.BucketLocationConstraint(s.region),
		},
	})
	if err == nil || isBucketAlreadyExists(err) {
		return nil
	}

	return err
}

func isObjectNotFound(err error) bool {
	var noSuchKey *types.NoSuchKey
	if errors.As(err, &noSuchKey) {
		return true
	}

	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "NoSuchKey", "NotFound":
			return true
		}
	}

	var respErr *awshttp.ResponseError
	return errors.As(err, &respErr) && respErr.HTTPStatusCode() == http.StatusNotFound
}

func isBucketNotFound(err error) bool {
	var noSuchBucket *types.NoSuchBucket
	if errors.As(err, &noSuchBucket) {
		return true
	}

	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.ErrorCode() {
		case "NoSuchBucket", "NotFound":
			return true
		}
	}

	var respErr *awshttp.ResponseError
	return errors.As(err, &respErr) && respErr.HTTPStatusCode() == http.StatusNotFound
}

func isBucketAlreadyExists(err error) bool {
	var apiErr smithy.APIError
	if !errors.As(err, &apiErr) {
		return false
	}

	switch apiErr.ErrorCode() {
	case "BucketAlreadyOwnedByYou", "BucketAlreadyExists":
		return true
	default:
		return false
	}
}
