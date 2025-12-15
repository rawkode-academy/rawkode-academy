// Example: How to use #PlatformService in a service's env.cue
//
// In your service directory (e.g., ./content/env.cue):
//
// package cuenv
//
// import (
//     "github.com/cuenv/cuenv/schema"
//     "github.com/rawkodeacademy/rawkodeacademy/projects/rawkode.academy/cubes/platform-service"
// )
//
// // Define your platform service
// _service: platformservice.#PlatformService & {
//     serviceName: "content"
//     servicePrefix: "platform"
//     includeDataModel: false
//     includeReadModel: false
//     includeHttp: true
//     bindings: {
//         services: [{
//             binding: "ARTICLES"
//             service: "platform-articles-rpc"
//         }]
//     }
// }
//
// // Use the generated cube in your project
// schema.#Project & {
//     name: "rawkode-academy-content"
//     cube: _service.cube
//
//     // ... rest of your env.cue (tasks, ci, env, etc.)
// }
//
// Then run: cuenv sync cubes .

package platformservice

// This is just for validation - shows a concrete example
_example: #PlatformService & {
	serviceName:       "example-service"
	servicePrefix:     "platform"
	includeDataModel:  true
	includeReadModel:  true
	includeWriteModel: false
	includeHttp:       true
	bindings: {
		d1Databases: [{
			binding:      "DB"
			databaseName: "example-db"
			databaseId:   "placeholder-id"
		}]
		services: [{
			binding: "OTHER_SERVICE"
			service: "platform-other-rpc"
		}]
	}
}
