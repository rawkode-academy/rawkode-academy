episode "complete-guide-to-spin-rust-sdk-walkthrough" {
  title = "Go SDK Walkthrough | Complete Guide to Spin"
  draft = false
  show = ""
  live = false
  scheduled_for = "2023-01-31T17:00:15Z"
  youtube_id = "OsZaud4D9eI"
  youtube_category = 24
  links = [
    "https://github.com/fermyon/spin",
    "https://cloud.fermyon.com",
    "https://developer.fermyon.com/spin/quickstart",
    "https://www.youtube.com/playlist?list=PLz0t90fOInA66qP_pjNQWZiBvqlZPQDUp",
    "https://developer.fermyon.com/spin/go-components",
    "https://www.fermyon.com/blog/spin-rest-apis"
  ]
  
  chapter "Introductions" {
    time = "00:00:00"
  }

  chapter "Objectives" {
    time = "00:00:30"
  }
  chapter "Setting up a HTTP handler" {
    time = "00:01:19"
  }

  chapter "Collecting HTTP headers" {
    time = "00:02:45"
  }

  chapter "Grabbing HTTP body"  {
    time = "00:05:17"
  }

  chapter "Collecting query parameters" {
    time = "00:08:02"
  }

  chapter "outboud HTTP request" {
    time = "00:09:02"
  }

  chapter "Conclusion" {
    time = "00:12:00"
  }

  description = <<- EOF 
   ### SUMMARY
   Spin is a framework for building, deploying, and running fast, secure, and composable cloud microservices with WebAssembly.
   
   In this video,we will be taking a look at the Go SDK for Spin.
   Like the previous videos in this series, we would be implmenting a simple HTTP service, we would also take a look at parsing request the body,query parameters and headers. 
   Then we'll wrap up by making an outbound HTTP request. 

  EOF

}
