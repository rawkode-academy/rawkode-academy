# Episode

```hcl
episode "<unique id>" {
    title = "<episode title>"
    draft = <true | false>
    show = "<id of a referenced show>"
    live = <true | false>
    scheduled_for = "<iso-utc-datetime>"
    youtube_id = <optional youtube id>
    youtube_category = <optional youtube category>
    links = <list of links beginning with https://>

    chapter "<chapter title>" {
        time = "<hh:mm:ss>"
    }

    guests = <list of existing person ids>
    technologies = <list of existing technology ids>
}
```
