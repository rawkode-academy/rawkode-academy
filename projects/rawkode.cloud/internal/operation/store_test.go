package operation

import (
	"errors"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

func TestNewStore_TrimsConfigValues(t *testing.T) {
	store, err := NewStore(StoreConfig{
		Bucket:    " rawkode-cloud ",
		Region:    " fr-par ",
		Endpoint:  " https://s3.fr-par.scw.cloud/ ",
		AccessKey: " ak ",
		SecretKey: " sk ",
	})
	if err != nil {
		t.Fatalf("NewStore returned error: %v", err)
	}

	if store.bucket != "rawkode-cloud" {
		t.Fatalf("store.bucket = %q, want %q", store.bucket, "rawkode-cloud")
	}
	if store.region != "fr-par" {
		t.Fatalf("store.region = %q, want %q", store.region, "fr-par")
	}
	if store.endpoint != "https://s3.fr-par.scw.cloud" {
		t.Fatalf("store.endpoint = %q, want %q", store.endpoint, "https://s3.fr-par.scw.cloud")
	}
	if store.client == nil {
		t.Fatalf("store.client is nil")
	}
}

func TestIsObjectNotFound(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "s3 no such key",
			err:  &types.NoSuchKey{},
			want: true,
		},
		{
			name: "smithy not found",
			err: &smithy.GenericAPIError{
				Code: "NotFound",
			},
			want: true,
		},
		{
			name: "wrapped no such key",
			err:  errors.Join(errors.New("wrapper"), &types.NoSuchKey{}),
			want: true,
		},
		{
			name: "unrelated",
			err:  errors.New("boom"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isObjectNotFound(tt.err); got != tt.want {
				t.Fatalf("isObjectNotFound(%T) = %t, want %t", tt.err, got, tt.want)
			}
		})
	}
}

func TestIsBucketNotFound(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "s3 no such bucket",
			err:  &types.NoSuchBucket{},
			want: true,
		},
		{
			name: "smithy no such bucket",
			err: &smithy.GenericAPIError{
				Code: "NoSuchBucket",
			},
			want: true,
		},
		{
			name: "wrapped no such bucket",
			err:  errors.Join(errors.New("wrapper"), &types.NoSuchBucket{}),
			want: true,
		},
		{
			name: "unrelated",
			err:  errors.New("boom"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isBucketNotFound(tt.err); got != tt.want {
				t.Fatalf("isBucketNotFound(%T) = %t, want %t", tt.err, got, tt.want)
			}
		})
	}
}

func TestIsBucketAlreadyExists(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "already owned",
			err: &smithy.GenericAPIError{
				Code: "BucketAlreadyOwnedByYou",
			},
			want: true,
		},
		{
			name: "already exists",
			err: &smithy.GenericAPIError{
				Code: "BucketAlreadyExists",
			},
			want: true,
		},
		{
			name: "other",
			err: &smithy.GenericAPIError{
				Code: "AccessDenied",
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isBucketAlreadyExists(tt.err); got != tt.want {
				t.Fatalf("isBucketAlreadyExists(%T) = %t, want %t", tt.err, got, tt.want)
			}
		})
	}
}
