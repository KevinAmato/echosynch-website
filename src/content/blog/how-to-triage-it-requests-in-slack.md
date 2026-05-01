---
title: "How to Triage IT Requests in Slack (That Stick)"
description: "A practical guide to triaging IT requests in Slack: labels, routing rules, SLA thresholds, and the exact configs that stop ticket queues from burning down."
pubDate: 2026-05-01
category: guides
tags: [slack-triage, it-helpdesk, ticket-routing, sla-tracking]
author: Echo-Synch Team
avoids_overlap_with:
  - "Slack Helpdesk Best Practices That Actually Scale"
---

Every #it-help channel eventually hits the same wall. Someone posts a VPN issue at 9:02 AM. Someone else posts a password reset at 9:04 AM. A P1 printer outage lands at 9:07 AM. By 9:15 AM, a senior engineer is scrolling upward trying to figure out which of those three things is on fire. Nobody owns any of them. The printer burns for another 40 minutes because it looked like routine noise in a sea of routine noise.

That's a triage failure. Not a staffing failure, not a tooling failure. A triage failure. The fix isn't more people watching the channel. It's a system that makes severity, ownership, and status legible at a glance, without anyone having to scroll or guess.

## Why Freeform Channels Collapse Past ~30 Tickets/Day

The informal "just post in #it-help" workflow works up to a point. That point is roughly 25-35 requests per day, based on what we've seen across teams of 50-500 employees. Below that threshold, a sharp technician can hold the queue in their head. Above it, things fall through based on who happened to be looking at Slack at the right moment.

The structural problem: Slack's default channel view is chronological. There's no native severity sort, no assignee field, no aging indicator. A critical issue posted 2 hours ago looks identical to a low-priority one posted 2 minutes ago. Once your queue volume crosses that ~30/day line, you need to impose structure externally, because the channel won't give it to you.

The second structural problem is that emoji reactions used as status signals (the classic ✅ for "done", 👀 for "looking at it") decay fast. They're invisible in search, they don't timestamp state changes, and they evaporate from institutional memory the moment that engineer goes on vacation.

## Define Your Severity Tiers Before You Touch Any Config

Triage automation is only as good as the severity model underneath it. Build this first, in writing, before you configure a single workflow or bot rule.

A workable four-tier model for mid-sized IT shops:

| Tier | Label | Response SLA | Example |
|------|-------|-------------|---------|
| P1 | Critical | 15 min | Outage affecting 10+ users, security incident |
| P2 | High | 1 hour | Single user can't access core system |
| P3 | Medium | 4 hours | Software install, account provisioning |
| P4 | Low | Next business day | Hardware request, desk move |

The specific SLA numbers matter less than the fact that they're written down and agreed upon. We've seen teams spend weeks tuning automation, then discover their P1/P2 boundary was defined differently by the helpdesk lead and the IT manager. That misalignment means escalation logic fires at the wrong threshold and nobody trusts the system.

Get sign-off on this table before touching anything else.

## Build the Intake Form That Forces Signal at Submission

The single highest-leverage change you can make: stop accepting freeform text as intake. Every unstructured message is a triage decision that a human has to make manually. A structured intake form pushes that decision to the requester, where the cost is 30 seconds of their time instead of 5 minutes of yours.

Slack Workflow Builder supports modal forms natively. A minimal effective intake form for an IT request:

```json
{
  "type": "modal",
  "title": { "type": "plain_text", "text": "IT Request" },
  "submit": { "type": "plain_text", "text": "Submit" },
  "blocks": [
    {
      "type": "input",
      "block_id": "request_type",
      "label": { "type": "plain_text", "text": "Request type" },
      "element": {
        "type": "static_select",
        "action_id": "type_select",
        "options": [
          { "text": { "type": "plain_text", "text": "Access / Permissions" }, "value": "access" },
          { "text": { "type": "plain_text", "text": "Hardware" }, "value": "hardware" },
          { "text": { "type": "plain_text", "text": "Software / Install" }, "value": "software" },
          { "text": { "type": "plain_text", "text": "Outage / Not working" }, "value": "outage" },
          { "text": { "type": "plain_text", "text": "Security concern" }, "value": "security" }
        ]
      }
    },
    {
      "type": "input",
      "block_id": "severity",
      "label": { "type": "plain_text", "text": "How many people are affected?" },
      "element": {
        "type": "static_select",
        "action_id": "scope_select",
        "options": [
          { "text": { "type": "plain_text", "text": "Just me" }, "value": "1" },
          { "text": { "type": "plain_text", "text": "My team (2-10)" }, "value": "team" },
          { "text": { "type": "plain_text", "text": "Wider (10+)" }, "value": "wide" }
        ]
      }
    },
    {
      "type": "input",
      "block_id": "description",
      "label": { "type": "plain_text", "text": "Describe the issue" },
      "element": { "type": "plain_text_input", "action_id": "desc_input", "multiline": true }
    }
  ]
}
```

Wire this to a `/it-help` slash command or a button in your channel header. The "how many people affected" field does most of your automatic severity work: "wider (10+)" maps directly to P1 or P2. No human triage required for that routing decision.

## Route to the Right Queue, Not Just the Right Channel

A common mistake: building one triage workflow that posts everything into one channel with different emoji labels. That doesn't scale. By the time you have separate sub-teams handling access requests vs. hardware vs. security, routing to a single channel with labels is just noise with extra steps.

Effective routing means different request types land in different places:

- `request_type: access` → #it-access-queue + DM to the IAM admin
- `request_type: security` → #security-incidents + page the on-call
- `request_type: outage` + `scope: wide` → #it-p1-live + alert the IT manager
- Everything else → #it-queue with assigned tier label

The [Slack Helpdesk Best Practices That Actually Scale](/blog/slack-helpdesk-best-practices) post covers channel architecture in depth. The key principle here: routing rules should be additive. Start with two destinations (P1 fast lane, everything else). Add more lanes only when you have evidence that a category of tickets is being delayed or mishandled.

## SLA Tracking Without a Dedicated ITSM Tool

If you're not ready for a full ServiceNow or Jira Service Management deployment, you can approximate SLA tracking inside Slack with timestamps and scheduled reminders. It's not elegant, but it works.

The minimum viable SLA tracker uses Slack's scheduled messages and Workflow Builder step outputs. When a ticket is created, log the creation timestamp. Schedule a follow-up message to fire at the SLA threshold: 15 minutes for P1, 1 hour for P2. If the ticket is still unresolved when that message fires, it pings the assignee and the IT manager in the ticket thread.

The failure mode we hit in production: Workflow Builder's "scheduled message" step uses the workspace timezone, not the submitter's timezone. An overnight P3 submitted at 11:58 PM by a user in EST will fire its 4-hour SLA reminder at 3:58 AM. You need to either restrict submission windows for low-priority tiers or add a business-hours check before the reminder fires.

Echo-Synch handles this natively with business-hours-aware SLA windows per tier, so a P3 submitted at 11:58 PM doesn't generate an alert at 3:58 AM. It calculates elapsed business time, not wall-clock time.

## Assign at Intake, Not at Review

The default behavior on most teams: tickets land in the queue, then the helpdesk lead looks at the queue and assigns tickets during a morning standup or ad hoc throughout the day. This creates a gap between submission and assignment that can easily stretch to 30-60 minutes even during business hours.

Assign at intake instead. Your routing logic should include an assignment step, not just a destination step. Round-robin across available technicians for P3/P4. Assign directly to the on-call for P1/P2. This requires knowing who's available, which means maintaining a simple on-call rotation config (even a hardcoded Slack user ID in your workflow is better than nothing).

The psychological effect of automatic assignment is underrated. Requesters feel acknowledged immediately. Technicians know their queue without having to monitor a shared channel for their name. Managers can see utilization without a standup.

## Handling the Tickets That Land Outside the Form

No intake form catches everything. Users will still DM the IT team directly. They'll post in #general. They'll tag @it-support in random channels. You need a handling policy for out-of-band tickets, not just a technical solution.

The practical answer: designate one person per shift to monitor for out-of-band requests and manually route them through the same intake flow (most tools let you create a ticket on behalf of a user). Don't try to automate catch-all monitoring across every channel. The signal-to-noise ratio makes it unreliable, and you'll generate false positives constantly.

What you can automate: a Slack app with `channels:history` scope can scan for keywords ("not working", "can't access", "urgent", "broken") in specified channels and surface them to a triage inbox. Use this as an alert, not a routing mechanism. A human still decides whether to convert it to a ticket.

## Quick Answers

### Can I triage IT requests in Slack without buying any extra tools?

Yes, with limits. Slack's native Workflow Builder handles intake forms and basic routing for free on paid plans. What you lose without dedicated tooling: SLA tracking, ticket aging visibility, assignee load balancing, and audit trails. For teams under ~20 tickets/day, native Workflow Builder is often enough. Above that, the manual overhead of tracking SLAs in spreadsheets or following up on stale tickets usually costs more in engineering time than a purpose-built tool.

### What's the right number of severity tiers?

Four is the practical ceiling for most teams (50-500 employees). Three tiers work fine if your workload is homogeneous. Five or more tiers introduce ambiguity at the boundaries: technicians spend time deciding whether something is P2 vs. P3 instead of just resolving it. Simpler is faster.

### How do I stop users from marking everything as P1?

Two approaches work in combination. First, replace self-reported severity with impact scope ("how many people are affected?") instead of asking users to self-assign a priority label. Users are better at counting affected people than estimating priority. Second, set an explicit expectation in your intake form: P1 means you'll be paged immediately. Most users don't actually want that level of urgency for a password reset.

### How does Echo-Synch handle triage differently from a native Slack workflow?

Echo-Synch applies label classification automatically based on request content, not just the fields the user fills in. If a user describes an outage but selects "software" as the type, the classification model catches the mismatch and flags it for review before routing. Native Workflow Builder only routes on what the user explicitly selects.

---

The thing most teams discover after building their first triage system: the bottleneck shifts. Before triage automation, the bottleneck is intake (everything lands in one place, nothing is sorted). After triage automation, the bottleneck usually moves to resolution (tickets are routed correctly, but some queues have no capacity). A well-built triage system makes your capacity problems visible in a way that a chaotic channel never does. That visibility is uncomfortable at first. It's also the only way to actually fix what's broken.