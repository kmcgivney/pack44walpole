# Cub Scout Pack Signup Website

## Project Goal

Create a practical website for Cub Scout Pack 44 of Walpole, Massachusetts. The site will announce events, collect family RSVPs, coordinate fundraiser shifts, and be suitable for real pack use after testing.

## First Version: Minimum Useful Product

A family should be able to:

- Open the website on a phone or computer.
- Open a specific event link on a phone or computer.
- See only the event represented by that link.
- Read the date, time, location, and description for an event.
- Submit one signup for the family by entering a parent or guardian name and email address.
- Enter the number of adults and scouts attending.
- RSVP for a regular event, or claim a time slot when an event needs scheduled help.
- See a confirmation after submitting the form.

A pack leader should be able to:

- See the signup list for each event.
- See attendance totals.
- See which fundraiser time slots still have room for families.
- Create, edit, archive, and delete events.
- Choose whether an event is a regular RSVP, campout RSVP, or fundraiser with time slots.
- Configure event details, attendance questions, shift times, and per-shift family limits.
- Export or copy the signup list later.

The Cubmaster is the only administrative user. Families do not create accounts. A family receives an event link for signing up and a separate private manage link for editing or cancelling its own signup.

## Important First Decision

During early development, the application may save sample data in the browser using local storage. That is useful for learning and testing, but it is not acceptable for the real pack website because families need to see the same data from different devices.

Before launch, the application will use a hosted database, secure self-service signup links, backups, and Cubmaster-only organizer access.

## Suggested Technology

### Frontend

- HTML for the page structure.
- CSS for layout, colors, typography, and mobile support.
- Plain JavaScript for forms, buttons, and application behavior.

### Development Tool

- Node.js runs the local development commands.
- Vite starts a fast local web server and prepares the site for deployment.

Node.js will initially be a tool used to run the project. We do not need to learn servers, APIs, or databases on day one.

### Later Additions

When the prototype feels right, we can add:

- A small Node.js server or a hosted backend.
- A database such as SQLite, Supabase, or another hosted service.
- Organizer login.
- Email confirmations and reminders.
- Public links for individual events.
- Pack 44 branding using Cub Scout royal blue with Walpole High Wolfpack orange accents.

## Proposed Pages and Views

### 1. Event Signup Page

An event link will show only that event:

- Event name.
- Date and time.
- Location.
- Short description.
- Event type: RSVP or scheduled volunteer shifts.
- Current attendance or remaining slot capacity.
- A button or form to sign up.

The public event page may show attendance totals and fundraiser slot availability, but it will not show the full family roster by default.

### 2. Signup Form

Every signup represents one family and will collect:

- Parent or guardian name.
- Email address.
- Number of scouts attending.
- Number of adults attending.
- Optional notes.

For a regular event, this is a simple RSVP. For a fundraiser or other work event, the family will choose one or more available time slots. Each time slot can be claimed by multiple families until its configured maximum is reached. For example, the event can offer 1 PM, 2 PM, and 3 PM slots, with several families allowed in each slot.

After submitting, the family will receive a private edit/cancel link. To avoid accounts and passwords, the link will be a long, unguessable token shown on the confirmation page and sent to the signup email. The database will store a hash of the token rather than the usable token itself. That link exposes only the family's own signup.

The form should validate required fields and show a clear confirmation after submission.

### 3. Organizer View

The organizer view will show:

- All events.
- Event type and attendance or slot totals.
- Family names and attendance counts.
- Families assigned to each fundraiser time slot.
- Organizer tools to correct or remove a signup when needed.
- Event management tools to create, edit, archive, or delete events.
- Event settings for RSVP questions, campout day/overnight counts, and fundraiser shifts.

The production view must be protected by Cubmaster authentication. Only the Cubmaster can see the full event calendar, family roster details, email addresses, and management controls. The current prototype still shows sample events and rosters for local testing; that is a known limitation to remove before launch.

## Data Model

An **event** will contain:

- `id`
- `title`
- `date`
- `time`
- `location`
- `description`
- `signupType` (`rsvp` or `time-slots`)
- `timeSlotFamilyLimit` (optional configurable maximum number of families per slot; default 20)
- `timeSlots` (optional list of scheduled shifts)

A **signup** will contain:
- `id`
- `eventId`
- `parentName`
- `email`
- `scoutCount`
- `adultCount`
- `dayScoutCount` and `dayAdultCount` (for campouts)
- `overnightScoutCount` and `overnightAdultCount` (for campouts)
- `timeSlotIds` (for fundraisers)
- `notes` (optional)
- `createdAt`
- `editTokenHash` (hash of the private token for self-service changes)

An event with `signupType: rsvp` only needs attendance counts. There are no attendance limits or waitlists. An event with `signupType: time-slots` has slots such as 1 PM, 2 PM, and 3 PM. Each slot defaults to a maximum of 20 families, can be configured higher, or can be unlimited. The limit counts families, not individual adults or scouts. A signup can reference multiple slots, provided each selected limited slot still has room.

## Build Milestones

### Milestone 1: Static Event List

Create the page layout and display a few sample events. No forms or saved data yet.

### Milestone 2: Working RSVP Form

Add the family signup form for regular RSVP events, including validation, a confirmation message, and temporary local browser storage.

### Milestone 3: Scheduled Time Slots

Add fundraiser events with available 1 PM, 2 PM, and 3 PM slots. Let a family choose multiple slots while submitting its adult and scout counts, allow multiple families per slot, and enforce the configurable default maximum of 20 families per slot. The organizer can raise the limit or choose unlimited. Regular RSVP events remain unlimited.

### Milestone 4: Organizer Summary

Add a public view that displays attendance totals, family names, and families assigned to each time slot. Add private edit and cancel links for families.

### Milestone 5: Cubmaster Event Management

Add a Cubmaster-only dashboard where the Cubmaster can create, edit, archive, and delete events. The event editor will support regular RSVP events, campouts with daytime and overnight counts, and fundraisers with multiple time slots and configurable family limits.

### Milestone 6: Pack-Specific Content

Replace sample events with real pack information, colors, contact details, and fundraiser slot formats.

### Milestone 7: Shared Online Version

Choose a backend, add secure family edit/cancel links and Cubmaster-only organizer authentication, move signup data to a shared database, test backups and privacy behavior, and deploy the site for Pack 44. Event management must be included before launch.

The selected backend is Supabase. The initial database schema is in `supabase/schema.sql` and includes active/archived events, event types, fundraiser slots, family signups, and slot selections. Signup creation and family edit/cancel operations should use server-side functions so email addresses and private edit tokens are not exposed to the public browser.

## Privacy and Safety Requirements

Because this involves children and families:

- Collect only information needed for event planning.
- Do not collect scout birth dates, addresses, or other sensitive information.
- Do not display family email addresses publicly.
- Public visitors should see only an event they were given a link to; they should not receive the full event calendar.
- Public event pages may show aggregate attendance and slot availability, but not the complete family roster.
- Add organizer authentication before using management tools with the whole pack.
- Use private, unguessable edit/cancel links; rate-limit attempts and never expose the token in the public signup list.
- Keep historical signup records by default; allow the Cubmaster to correct or remove records when needed.
- Include a way for an organizer to correct or delete a signup.

## Questions to Resolve Before Building

## Recommended Starting Point

Start with Milestones 1 and 2 as a local learning prototype, then immediately test Milestone 3 with realistic fundraiser data. Because this is intended for real use, the production work must include shared storage, private token links for self-service edits and cancellations, privacy review, backups, Cubmaster-only administration, and deployment before inviting the pack to use it.

## Data Retention

The expected volume is small: even 20 events per year with 50 family signups per event would be only about 1,000 signup records per year, consisting mostly of short text fields. Storage costs and performance will not be a concern.

The initial policy is to keep historical signup records rather than automatically deleting them. This preserves useful pack history and avoids a cleanup job that could accidentally remove needed information. The Cubmaster can correct or remove an individual record when there is a specific reason, and the retention policy can be revisited after the site has been used for a while.

## Event Management Policy

The Cubmaster should be able to manage the event calendar without changing code. Creating an event should include its title, date, time, location, description, and signup type. The available signup types are:

- RSVP: adult and scout counts, with no attendance limit or waitlist.
- Campout: separate daytime and overnight adult and scout counts.
- Fundraiser: one or more selectable time slots, with a configurable maximum number of families per slot.

Deleting an event should require confirmation. Archiving is preferred once an event has signups, so historical records remain available and a live event cannot disappear accidentally. Editing an event should warn the Cubmaster before changing or removing time slots that families have already selected.

## First Test Event

Use this event as the initial sample data while building and testing the application:

- Event: Pack hike
- Date: October 3, 2026
- Signup type: RSVP
- Attendance limits: none
- Waitlist: none

The first test signup will be:

- Family contact: Test contact
- Email: test@example.com (placeholder for local testing)

The adult and scout counts can be entered during the test. This sample contact should be removed or replaced before sharing the prototype outside the test group.

## Additional Event

- Event: Pack 44 fundraiser at Rocky's Ace Hardware
- Date: October 10, 2026
- Signup type: Scheduled time slots
- Location: Rocky's Ace Hardware, Walpole, MA
- Default capacity: 20 families per time slot
- Shift times: 9:00-10:00 AM, 10:00-11:00 AM, and 11:00 AM-12:00 PM

## Pack 44 Identity

- Pack: Pack 44 of Walpole, MA
- Primary color: Cub Scout royal blue
- Accent color: Walpole High Wolfpack orange
- Contact: walpole.pack44.cubmaster@gmail.com
- Organizer: Cubmaster only, for the initial release

## Next Session Todo

### Complete

- [x] Create a Supabase project for Pack 44.
- [x] Run `supabase/schema.sql` in the Supabase SQL Editor.
- [x] Verify the `events`, `event_slots`, `signups`, and `signup_slots` tables.
- [x] Enable email authentication for the Cubmaster.
- [x] Create the initial Cubmaster account.
- [x] Add secure RPC functions for creating, editing, and cancelling family signups.
- [x] Enforce fundraiser slot limits atomically.
- [x] Add the local Supabase URL and publishable key through an ignored `.env` file.
- [x] Load active events and public roster data from Supabase.
- [x] Add the Pack 44 About and privacy section.
- [x] Verify Cubmaster access to detailed signup records.
- [x] Verify anonymous access is limited to aggregate attendance and slot summaries.
- [x] Verify event-specific links such as `/?event=<event-id>`.
- [x] Add and verify private family manage links for editing a signup.

### Remaining

- [x] Run and verify `supabase/rpc.sql` and `supabase/seed.sql` together after the latest fixes.
- [x] Replace the prototype's all-events selector with event-specific public URLs.
- [x] Replace the public full roster with aggregate attendance and slot availability.
- [x] Add private family manage URLs that expose only that family's signup.
- [ ] Send family manage links by email.
- [ ] Build the Cubmaster dashboard for creating, editing, archiving, and deleting events.
- [ ] Add Cubmaster-only access to full rosters and email addresses.
- [ ] Test capacity limits, private links, archiving, backups, and failure cases before launch.
