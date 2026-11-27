
─╔╗╔╗───────────────────────────╔╗────────────────╔╗──────╔╗─╔╗────╔╗╔╗─────────╔╗──────────╔╗────────╔╗
╔╝╚╣║──────────────────────────╔╝╚╗───────────────║║────╔╦╝╚╗║║───╔╝╚╣║─────────║║──────────║║────────║║
╚╗╔╣╚═╦╦══╗╔╦══╗╔══╗╔══╦═╦╦╗╔╦═╩╗╔╬══╗╔══╦══╦══╗╔═╝╠══╦═╣╠╗╔╝║╚═╦═╩╗╔╣╚═╦══╦═╗╔═╝╠══╦╗╔╗╔╦═╗║║╔══╦══╦═╝╠╦═╗╔══╗
─║║║╔╗╠╣══╣╠╣══╣║╔╗║║╔╗║╔╬╣╚╝║╔╗║║║║═╣║╔╗║╔╗║╔╗║║╔╗║╔╗║╔╬╣║║─║╔╗║╔╗║║║╔╗║║═╣╔╝║╔╗║╔╗║╚╝╚╝║╔╗╣║║╔╗║╔╗║╔╗╠╣╔╗╣╔╗║
─║╚╣║║║╠══║║╠══║║╔╗║║╚╝║║║╠╗╔╣╔╗║╚╣║═╣║╔╗║╚╝║╚╝║║╚╝║╚╝║║║║║╚╗║╚╝║╚╝║╚╣║║║║═╣║─║╚╝║╚╝╠╗╔╗╔╣║║║╚╣╚╝║╔╗║╚╝║║║║║╚╝║
─╚═╩╝╚╩╩══╝╚╩══╝╚╝╚╝║╔═╩╝╚╝╚╝╚╝╚╩═╩══╝╚╝╚╣╔═╣╔═╝╚══╩══╩╝╚╝╚═╝╚══╩══╩═╩╝╚╩══╩╝─╚══╩══╝╚╝╚╝╚╝╚╩═╩══╩╝╚╩══╩╩╝╚╩═╗║
────────────────────║║───────────────────║║─║║─────────────────────────────────────────────────────────────╔═╝║
────────────────────╚╝───────────────────╚╝─╚╝─────────────────────────────────────────────────────────────╚══╝



# BookTrack

BookTrack is a restaurant booking book. It runs in the browser on Windows and installs on an iPhone from Safari, without a Mac, Xcode, or the App Store.

The book is shared by the two people who use it. Opening BookTrack asks for the password. A booking added on one phone shows on the other, and can ping that phone when notifications are on. The book records the guest, party size, date, time, table, and whether they are still due, seated, finished, cancelled, or a no-show.

## What you need

- Windows 10 or 11
- [Node.js 20 or newer](https://nodejs.org/), which includes npm
- An iPhone with Safari, when you want the home-screen app

## Run it on your PC

Open PowerShell in this folder:

```powershell
cd C:\Users\YOURNAME\WHERE_YOU_DOWNLOADED\BookTrack
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge.

## Check the booking rules

```powershell
npm test
```

The tests cover covers for the day, table clashes including sittings that pass midnight, party size against the table, guest search, backups, and the spreadsheet export.

## Build the production app

```powershell
npm run build
npm run preview
```

`npm run build` type-checks the project and writes the site to `dist`. `npm run preview` serves that folder at http://localhost:4173.

The live copy is published with GitHub Pages from the `main` branch: https://skibnation.github.io/BookTrack/

## Install it on an iPhone

1. Open https://skibnation.github.io/BookTrack/ in **Safari**. Chrome on iPhone cannot add a web app to the Home Screen.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.
4. Open **BookTrack** from the new icon.

From the home screen it opens full screen, without Safari’s address bar. The BookTrack icon is a green booking list on black.

Open it once while you are online. That visit stores the app on the phone. After that, the book works with no connection. Closing the app or restarting the phone does not delete the bookings.

## What the book does

- **Today** is the service. Move between days, see covers still to arrive, seated, and finished, then seat a party or mark them finished.
- **Diary** is the month. A number on a day is the covers still expected. Cancelled bookings and no-shows are left out of that count.
- **Find** searches a guest by name, phone number, or note.
- **Settings** stores the restaurant name, the usual party size and sitting length, and the tables.

A booking needs a name, a phone number, a party of 1 to 40, a date, and a time. The usual sitting is 90 minutes.

If the table is already held by another booking that is still booked or seated, BookTrack warns you. The same happens when the party is larger than the table. You can save anyway. A sitting that has finished, been cancelled, or not arrived does not keep the table. Two sittings may touch: a table free at 21:00 can be booked again at 21:00.

Times are the clock time you type. “Today” uses the timezone of the device the book was first opened on. Days are stored as dates, so a 23:30 booking still belongs to that service even when it ends after midnight.

## Shared book and backups

Both phones open the same book. The password is checked by the server and is not stored in the app or the public site. After the first unlock, that phone stays unlocked.

Turn on notifications from Today. On an iPhone this only works after you add BookTrack to the Home Screen and open it from that icon.

Bookings still need a connection to reach the other phone. A copy of the last book stays on the device, so you can look at it if the connection drops. Use **Settings → Backup**:

- **Export bookings as CSV** opens in Excel. The file includes a byte-order mark so names survive.
- **Download full backup** saves every booking, table, and setting as JSON.
- **Restore a backup** replaces the book on that device. Confirm before restoring.

On an iPhone, export uses the share sheet when Safari allows it, so you can save the file to Files or send it to yourself.

Private browsing can block or wipe this storage. Use a normal Safari tab, then add that page to the Home Screen.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the local app |
| `npm test` | Run the booking tests |
| `npm run build` | Type-check and build `dist` |
| `npm run preview` | Serve the production build |
| `npm run icons` | Regenerate the app icons |
