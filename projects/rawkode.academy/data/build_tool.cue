// package scripts

// import "encoding/json"

// import "tool/cli"

// import "tool/file"

// import "rawkode.academy/live-streams:shows"

// command: build: {
// 	// data: {
// 	// 	for slug, show in shows {
// 	// 		(show.name): print: cli.Print & {
// 	// 			text: slug
// 	// 		}
// 	// 	}
// 	// }

// 	export: cli.Print & {
// 		text: json.Marshal({
//       "shows": {
//         for slug, show in shows {
//           (slug): show & {
//             liveStreams: [
//               for _
//             ]
//           }
//         }
//       }
//     })
// 	}
// }
