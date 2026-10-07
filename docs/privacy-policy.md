# Privacy Policy

**Effective date:** 7 October 2026

This policy explains what personal data Keepup ("the app", "we") processes, why, for how long, who we share it with, and the rights you have. It applies to the Keepup web app at its published address and to any installed version of it.

## 1. Who is responsible (data controller)

Keepup is operated by **Ilya Naumenko**, an individual, who is the controller of the personal data described here.

Contact for all privacy questions and requests: **naumchas00@gmail.com**

## 2. Data we process

We process only the data the app needs to work.

**Account** (from you, or from Google if you sign in with Google)

- Your email address and a unique account identifier.
- Your password, if you sign in with email and password. It is stored only as a hash by our sign-in provider (Supabase Auth); we never see it.
- If you sign in with Google: the profile details Google shares (your name, email address and a link to your Google profile picture) are kept with your login. Keepup uses only the name, to suggest a display name when you start.

**Profile and settings** (from you)

- Display name, avatar emoji and colour, time zone, first day of the week, and what you use Keepup for (optional).
- The daily reminder hour, Pause all notifications, the celebrations setting (full or subtle), and the dates you finished onboarding, accepted this policy and last used Reset my data.
- Notification settings for each kind of notification (on or off; sound, silent or Inbox only) and for each habit (muted, reminders on or off, reminder time).

**Habits and activity** (from you, and calculated by the app)

- Habits you create: title, emoji, category, schedule, start and end dates.
- Check-ins with their date and time (including when you tapped, for check-ins made offline), pauses, rest days, completed and missed periods, and streaks.
- Points (XP) and how you earned them, levels, badges, weekly and monthly recaps, and which celebrations you have seen.

**Groups** (from you and other group members)

- Groups you create or join: name, kind, avatar, time zone and first day of the week; your membership, role and when you joined or left.
- Invite links (who made them and when they expire), group habits, approvals, and the cheers and preset nudges you send and receive.

**Children's profiles** (from the parent or guardian who adds the child, see section 9)

- Nickname, avatar emoji and colour, and the chosen kid view theme.
- The child's habits and check-ins (and whether the child tapped it), stars, garden progress and treat goals.
- Points, levels and badges the app keeps for the child behind the scenes; children never see them.

**Notifications** (when you allow them)

- Your Inbox: the notifications shown in the app.
- For each device you turn on push notifications for: the push address and encryption keys your browser gives us to deliver notifications, and your browser's user-agent string (it says which browser and operating system you use, so Settings can name the device).

**Demo** (when you choose "Try the demo")

- An anonymous demo login with sample data and anything you add to it. It has no email address, and it is deleted after 24 hours (section 6).

**Usage and error traces** (automatically, when you use the app)

- For each request to our servers: your account ID and email address, the page or action, the addresses of the requests the app makes to the database (which contain the IDs of habits, children and groups), timings, error messages, your browser's user-agent string and the page you came from.
- For each check-in: the habit's ID, title and category; the child's ID and nickname if it was for a child; whether it counted, was refused (and why) or failed; and the points it earned.
- Passwords, sign-in codes, session tokens, cookies and keys are removed before anything is sent. These traces go to Grafana Labs (section 5) and are kept for 14 days.

**Technical data** (automatically, by our hosting providers)

- IP address, browser and device information, timestamps and error details in server logs, and the session cookies needed to keep you signed in.

We do **not** collect photos you take, precise location, contacts, health records from other apps, payment data, or advertising identifiers. We use no analytics or advertising services, and we don't track you on other sites.

## 3. Why we process it (purposes and legal bases)

- **Providing the app** (account, habits, check-ins, streaks, groups, recaps, rewards, the demo). Data: account, profile and settings, habits and activity, groups, children's profiles. Legal basis: performance of a contract (GDPR Art. 6(1)(b)), i.e. providing the service you signed up for.
- **Children's profiles.** Data: the child's profile data. Provided by, and processed on the instruction of, the parent or guardian as part of the service; see section 9.
- **Push notifications and reminders.** Data: push device data and notification settings. Legal basis: consent (Art. 6(1)(a)). You turn notifications on, and can turn them off at any time.
- **Sign-in emails** (confirming your address, resetting your password). Data: your email address. Legal basis: performance of a contract (Art. 6(1)(b)).
- **Security, abuse prevention, keeping the service working, finding and fixing errors.** Data: technical data, usage and error traces. Legal basis: legitimate interests (Art. 6(1)(f)) in a secure, working service.
- **Backups for disaster recovery.** Data: all app data, encrypted. Legal basis: legitimate interests (Art. 6(1)(f)) in not losing your data.
- **Answering your requests.** Data: your messages and the data needed to act on them. Legal basis: legal obligation (Art. 6(1)(c)) and legitimate interests.

We do not sell personal data, do not use it for advertising, and do not make automated decisions that have legal or similarly significant effects on you.

## 4. Who can see your data inside the app

- **Private habits** and their check-ins are visible only to you.
- **Group data** (group habits, check-ins on them, approvals, cheers, nudges, your display name and avatar) is visible to the members of that group.
- **Children's profiles** are visible to the adult members of the group the child belongs to.
- Access is enforced in the database itself (row-level security), not only by the app's screens.
- The operator (section 1) can see the usage and error traces described in section 2, to keep Keepup working and fix problems.

## 5. Service providers (processors) and international transfers

We use these providers to run Keepup. They process data only on our behalf, under their data-processing terms.

- **Supabase:** database, sign-in, real-time updates, scheduled jobs. Where: EU (Frankfurt, Germany).
- **Supabase Edge Functions:** sending push notifications. Where: Supabase's edge network, which may run outside the EU.
- **Vercel:** hosting the web app and serving pages. Where: EU (Frankfurt) for the app's server functions; its global network may route and cache requests worldwide.
- **Grafana Labs (Grafana Cloud):** receiving and storing the usage and error traces described in section 2: your account ID and email address, habit titles, children's nicknames and IDs, and what you did in the app, with passwords and keys removed. Kept for 14 days. Where: EU (Germany).
- **Google:** "Sign in with Google" (only if you choose it), and sending our sign-in emails (address confirmation and password reset) through Gmail. Where: global.
- **GitHub:** running the nightly backup job, and storing the **encrypted** database backups in a private repository. Where: United States.
- **Browser push services** (for example Apple, Google, Mozilla): delivering push notifications to your device; the message content is encrypted end to end. Where: global.

Where data is transferred outside the EU/EEA (for example to the United States), it is protected by the provider's safeguards: the EU–US Data Privacy Framework where the provider is certified, or the European Commission's Standard Contractual Clauses.

## 6. How long we keep data

- **Account, profile, habits, groups, children's profiles:** until you delete them or delete your account.
- **Points (XP), levels and badges:** until you use Reset my data or delete your account.
- **Inbox (in-app notifications):** 60 days.
- **Records that a weekly or monthly recap was already sent** (no content): 62 days.
- **Push devices:** until you remove the device in Settings or sign out on it, until the push service tells us the device is gone, or until you delete your account.
- **Group invite links:** they work for 7 days or until revoked. The invite record stays with the group until the group is deleted.
- **Demo logins ("Try the demo"):** deleted automatically, with everything in them, after 24 hours.
- **Usage and error traces (Grafana Labs):** 14 days.
- **Encrypted backups:** 30 days on a rolling basis; deleted data disappears from backups within 30 days.
- **Server logs held by our providers:** according to the provider's retention, typically days to a few weeks.

When you delete your account, your personal data is deleted from the live database immediately, and from backups within 30 days. Usage and error traces already sent expire after 14 days. Group habits you created stay with the group, without your name; your own check-ins on them are deleted. A group in which you are the only member is deleted, together with its children's profiles. If you were the last admin of a group with other members, admin rights pass to the longest-standing member.

## 7. Your rights and controls

In the app, at any time:

- **Export my data** (Settings): a copy of your data as a JSON file. It includes the children's profiles of groups you are an admin of.
- **Reset my data** (Settings): deletes your private habits with their check-ins, your points, levels and badges, and your Inbox. It keeps your account, settings, groups, children, and your check-ins in group habits, which are part of the group's history.
- **Delete account** (Settings): deletes your account and personal data straight away, as described in section 6. Before you confirm, the app tells you which groups will be deleted and who becomes admin.
- **Change your password** by email: "Forgot password?" on the sign-in page.
- **For a child** (on the child's page): any adult member of the child's group can correct the child's profile or export the child's data; a group admin can reset the child (keeping only the nickname and avatar) or delete the child's profile.

Depending on where you live, you also have the right to:

- **access** your data and get a copy (the export above);
- **correct** inaccurate data (in the app, or by contacting us);
- **delete** your data (Delete account above);
- **restrict** or **object to** processing based on legitimate interests;
- **data portability** (the export above is machine-readable);
- **withdraw consent** at any time, for example by turning off notifications; this does not affect earlier processing;
- **complain** to a data protection authority: in the EU, the authority of your country; in Israel, the Privacy Protection Authority.

To exercise a right that the app doesn't cover directly, write to naumchas00@gmail.com. We answer within one month. We may need to confirm it's really you before acting.

## 8. Security

- Encryption in transit (HTTPS) everywhere.
- Access rules enforced in the database (row-level security), with automated tests.
- Only the minimum keys in the browser; administrative keys never leave the server.
- Passwords, sign-in codes, session tokens and keys are removed from usage and error traces before they leave our servers, with an automated test.
- Encrypted backups.

No system is perfectly secure. If a personal data breach is likely to put you at risk, we will inform you and the competent authority as the law requires.

## 9. Children

- **Own accounts:** Keepup accounts are for adults aged **18 or older**.
- **Anyone under 18** can appear in Keepup only as a **child profile** added by a parent or legal guardian who is an admin of a group. By adding a child, the parent or guardian confirms that they have parental responsibility and agrees to the processing described here for that child.
- **What a child profile contains:** a **nickname and an avatar emoji** (never a photo, full name, birth date or contact details), plus the child's habits, check-ins, stars, garden and treat goals.
- **Who sees it:** only the adult members of the child's group. Children don't have their own login, can't message anyone, and can't be found by other users. Like other app data, a child's data is processed by our service providers (section 5); the usage and error traces include the child's nickname for each check-in made for the child.
- **Control:** any adult member of the child's group can view, export or correct the child's profile at any time from the child's page; a group admin can reset or delete it; anyone can also ask us by contacting us.
- **Accidental accounts:** if we learn that an account belongs to someone under 18, we will delete it or, with a parent's agreement, turn it into a child profile.

## 10. Cookies and storage on your device

- We use only **strictly necessary** cookies: to keep you signed in and to protect the sign-in flow.
- The app keeps a few small settings in your browser's local storage: tips and cards you have already seen, the kid view's sound setting, and which account the saved pages below belong to.
- **Offline check-ins:** a check-in you make without a connection is kept on your device (in the browser's IndexedDB) until it reaches our servers, then removed from the device.
- **Saved pages:** the app's offline page, this policy, the app's scripts, and your last Today page and kid view are kept in the browser's cache so they open without a connection.
- When you sign out, waiting check-ins are sent first (if some can't be sent, you are asked before they are dropped), then the saved pages and waiting check-ins are removed from the device. Saved pages are also removed when a different person signs in on the same device.
- We use no analytics, advertising or tracking cookies, so no consent banner is needed for them.

## 11. Changes to this policy

If we change this policy in a meaningful way, we will say so in the app's What's new before the change takes effect. The effective date at the top always shows the current version.

## 12. Additional information for users in Israel

Keepup is operated from Israel. Data is processed in accordance with the Israeli Privacy Protection Law, 5741-1981, and its regulations (including the Information Security Regulations and the 2024–25 amendment), in addition to the GDPR where it applies. You may request access to and correction of your data as provided by that law, using the contact above.

## 13. Contact

Ilya Naumenko · naumchas00@gmail.com
