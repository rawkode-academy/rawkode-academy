---
title: How to ask for help
slug: how-to-ask-for-help
publishedAt: 2023-10-31
updatedAt: 2023-11-10
isDraft: false
authors:
- russell
---

When you are asking a bunch of strangers for help on the internet, there are tricks to get people to be more willing to help you.

Unless you are paying for support, you need to make it as easy as possible for volunteers to help you.

Here's some advice to help people help you.

[Help Me](https://google.com)

## Make it Easy to Read

Learn the system you're writing on so you can convey the information clearly. Having to read badly formatted text is not a nice introduction to your problem.

Separate your question from the log outputs, most systems will have a way to enter code. Use that code format for logs, code, config, etc. Keep each type of sample separate, or at least spaced out well enough, with a comment to show what it is.

### Example

```text
# dmesg log with error
[331337.438088] hub 4-0:1.0: 2 ports detected
[331337.465300] ACPI: bus type thunderbolt registered
[331337.612428] thunderbolt 0000:08:00.0: 0: DROM device_rom_revision 0x0 unknown
[331337.613424] thunderbolt 0-0: ignoring unnecessary extra entries in DROM
[331342.334285] ieee80211 phy0: brcmf_inetaddr_changed: fail to get arp ip table err:-52
[331357.956017] xhci_hcd 0000:3e:00.0: Unable to change power state from D3cold to D0, device inaccessible
[331357.956034] xhci_hcd 0000:3e:00.0: Controller not ready at resume -19
[331357.956035] xhci_hcd 0000:3e:00.0: PCI post-resume error -19!
[331357.956037] xhci_hcd 0000:3e:00.0: HC died; cleaning up
# partial results from lspci
00:1c.0 PCI bridge: Intel Corporation 100 Series/C230 Series Chipset Family PCI Express Root Port #1 (rev f1)
00:1c.1 PCI bridge: Intel Corporation 100 Series/C230 Series Chipset Family PCI Express Root Port #2 (rev f1)
```

## Reproducible Issue

Where possible create a minimal reproduction of the issue. This lets people try recreate the issue with your config and prevents you from leaking secrets that might need to stay secret.

Unless you are certain the problem exists in just one file, make people's lives easier by giving as much info as possible.

The best way to do that is a cut down, reproducible sample.

## Explain Environment

Explain the environment you are running in, it may well be an environmental issue you are facing. Things like what hardware, software and config (where you can) it's running - i.e. Docker version 24.0.2, build cb74dfcd85 on a laptop running Debian 11.7 stable, an AWS VM `m7g.large` running Amazon Linux, etc.

## Make it Quick & Easy for People

Be conscious of the amount of time people have to spend to get up to speed. This ties in with the reproducible sample. Don't post a link to an instruction you followed. If you do that and nothing else you are expecting people to read through that article which takes precious time. Even after reading it, unless there is an obvious mistake in the article, it may not assist you as chances are you've done something different to the article. Maybe you missed a step, maybe you made a typo, used different hosting options, used different versions of software. Feel free to add that you followed an article, but don't expect people helping you to have to read that article before getting started.

## Explain Your Steps so Far

State what you have tried and what you think it might be, there is nothing less rewarding than helping someone who's tried nothing for themselves and given up.

## Provide Useful Information

If someone is helping you, please reply with more than just "that doesn't work". Show how you followed their advice and what the result was. If you aren't paying in cash for the help, pay in effort, show people you've done as they asked and the exact result of what happened.


## Make Single Changes

Change one thing at a time. If more than one person responds, don't apply more than one suggestion at a time. You need to see what each change does. The exception is when you are explicitly told to apply more than one fix as they can see you have more than one issue. Even then though, it's just good practice to make a single change and see what it does.
