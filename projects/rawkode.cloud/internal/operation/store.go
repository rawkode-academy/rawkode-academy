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

	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

var ErrNotFound = errors.New("object not found")

// Store manages operation state persistence in an S3-compatible bucket.
type Store struct {
	endpoint  string
	bucket    string
	region    string
	accessKey string
	secretKey string
	prefix    string
	client    *http.Client
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

	return &Store{
		endpoint:  strings.TrimRight(cfg.Endpoint, "/"),
		bucket:    cfg.Bucket,
		region:    cfg.Region,
		accessKey: cfg.AccessKey,
		secretKey: cfg.SecretKey,
		prefix:    "operations/",
		client:    &http.Client{Timeout: 30 * time.Second},
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

// S3 primitives using AWS Signature V4

func (s *Store) putObject(ctx context.Context, key string, data []byte) error {
	url := fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	s.signRequest(req, data)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("S3 PUT %s: %s %s", key, resp.Status, string(body))
	}
	return nil
}

func (s *Store) getObject(ctx context.Context, key string) ([]byte, error) {
	url := fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	s.signRequest(req, nil)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, key)
	}
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("S3 GET %s: %s %s", key, resp.Status, string(body))
	}

	return io.ReadAll(resp.Body)
}

func (s *Store) deleteObject(ctx context.Context, key string) error {
	url := fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	s.signRequest(req, nil)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 && resp.StatusCode != 404 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("S3 DELETE %s: %s %s", key, resp.Status, string(body))
	}
	return nil
}

func (s *Store) listObjects(ctx context.Context, prefix string) ([]string, error) {
	url := fmt.Sprintf("%s/%s?list-type=2&prefix=%s", s.endpoint, s.bucket, prefix)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	s.signRequest(req, nil)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("S3 LIST %s: %s %s", prefix, resp.Status, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return parseS3ListKeys(body), nil
}

// parseS3ListKeys extracts <Key> elements from ListObjectsV2 XML response.
func parseS3ListKeys(xmlBody []byte) []string {
	var keys []string
	content := string(xmlBody)
	for {
		start := strings.Index(content, "<Key>")
		if start == -1 {
			break
		}
		start += len("<Key>")
		end := strings.Index(content[start:], "</Key>")
		if end == -1 {
			break
		}
		keys = append(keys, content[start:start+end])
		content = content[start+end:]
	}
	return keys
}

// signRequest applies AWS Signature V4 to an HTTP request.
func (s *Store) signRequest(req *http.Request, payload []byte) {
	now := time.Now().UTC()
	datestamp := now.Format("20060102")
	amzDate := now.Format("20060102T150405Z")

	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("Host", req.URL.Host)

	payloadHash := sha256Hex(payload)
	req.Header.Set("x-amz-content-sha256", payloadHash)

	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		req.URL.Host, payloadHash, amzDate)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"

	if ct := req.Header.Get("Content-Type"); ct != "" {
		canonicalHeaders = fmt.Sprintf("content-type:%s\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
			ct, req.URL.Host, payloadHash, amzDate)
		signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"
	}

	canonicalURI := req.URL.Path
	canonicalQueryString := req.URL.RawQuery

	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		req.Method, canonicalURI, canonicalQueryString,
		canonicalHeaders, signedHeaders, payloadHash)

	scope := fmt.Sprintf("%s/%s/s3/aws4_request", datestamp, s.region)
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s",
		amzDate, scope, sha256Hex([]byte(canonicalRequest)))

	signingKey := deriveSigningKey(s.secretKey, datestamp, s.region, "s3")
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		s.accessKey, scope, signedHeaders, signature)
	req.Header.Set("Authorization", authHeader)
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func deriveSigningKey(secretKey, datestamp, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), []byte(datestamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}
