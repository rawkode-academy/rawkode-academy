# Technology

```hcl
technology "<unique id>" {
    draft = <true | false>

    name = "<name>"
    aliases = <list of aliases>

    logo_url = "<optional url to logo>"
    tagline = "<tagline>"
    description = "<description>"

    website = "<optional website link>"
    documentation = "<optional documentation link>"

    open_source {
        enabled = <true | false>
        repository = "<optional repository link>"
    }

    twitter = "<optional twitter handle>"
    youtube = "<optional youtube channel id>"
}
```
