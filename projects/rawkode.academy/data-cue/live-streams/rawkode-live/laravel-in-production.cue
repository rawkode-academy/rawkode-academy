package livestreams

import "rawkode.academy/schema"

_series: schema.#Series & {
  title: "Laravel on Kubernetes"
}

"laravel-1": schema.#LiveStream & {
   title: "Hands-on Introduction to Kubescape"
   episodeNumber: 3,
   series: _series,
}

"laravel-2": schema.#LiveStream & {
   title: "Hands-on Introduction to Kubescape"
   episodeNumber: 4,
   series: _series,
}
