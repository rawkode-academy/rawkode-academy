# Platform

- [ ] I need to prepare a C4 diagram.

---

This system is broken down into 2 major components: Event Handlers and Temporal Workflows.

We use HTTP to collect as much information about external events as possible. This is then transformed into CloudEvents, encoded as Protobuf, and sent to RedPanda.

Everything in the platform is a subscriber to RedPanda and may potentially notify a Temporal workflow.

## Event Handlers

### HTTP Based

External events will be collected over HTTP, such as:

- GitHub Events
- Discord Events
- Hasura Events (From PostgreSQL) (YouTube Data)

### RedPanda Based

Consumers will listen to RedPanda and act accordingly.

- Discord & Hasura Events
  - Notify Temporal via Signals
- GitHub Events
  - Notifications to Discord

## Temporal Workflows

- Update YouTube Data
  - Update Google Calendar ICS with new streams
- Update Google Calendar ICS
  - for all Discord events
