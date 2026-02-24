package infisical

import (
	"errors"
	"testing"

	sdkerrors "github.com/infisical/go-sdk/packages/errors"
)

func TestIsFolderAlreadyExistsError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "conflict status",
			err: &sdkerrors.APIError{
				StatusCode: 409,
			},
			want: true,
		},
		{
			name: "bad request with already exists message",
			err: &sdkerrors.APIError{
				StatusCode:   400,
				ErrorMessage: "Folder with name 'projects' already exists in path '/'",
			},
			want: true,
		},
		{
			name: "bad request with unrelated message",
			err: &sdkerrors.APIError{
				StatusCode:   400,
				ErrorMessage: "validation failed",
			},
			want: false,
		},
		{
			name: "non api error",
			err:  errors.New("boom"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isFolderAlreadyExistsError(tt.err); got != tt.want {
				t.Fatalf("isFolderAlreadyExistsError(%T) = %t, want %t", tt.err, got, tt.want)
			}
		})
	}
}
