# Installation Guide — Accurate Bridge

## For end users (after the installer is built)

1. Get `AccurateBridge-Setup-1.0.0.exe` from `installer-output/`.
2. **Right-click → Run as administrator** (or just double-click — Windows
   will prompt for UAC because the installer needs to add firewall rules
   and write to `Program Files`).
3. Wizard flow:
   - Welcome → Next
   - Choose install dir (default: `C:\Program Files\Accurate Bridge`) → Next
   - Install → wait
   - **Leave the "Launch Accurate Bridge" checkbox ON** → Finish
4. The bridge starts. You'll see:
   - A new tray icon (red Accurate logo) near the clock
   - The config window opens automatically on first launch
5. Add a printer slot:
   - **Add Printer Slot** button (top-right)
   - Set AE Title (e.g. `BRIDGE_P1`), Port (e.g. `7001`)
   - Pick a Windows printer from the dropdown
   - Pick paper size, layout, copies
   - Toggle **enabled** (power icon) → click **Save & Apply**
6. Configure your modality (MRI / CT / USG console) to send DICOM Storage
   to the bridge:
   - **Destination AE Title**: the same AE Title you set in the slot
   - **IP**: this PC's IP address
   - **Port**: the slot's port
7. Test by sending one image — within `studyDebounceSeconds` (default 30 s)
   it should auto-print.

From the next Windows login, the bridge starts silently in the background.
No user action needed.

---

## For developers (build the installer yourself)

Prerequisites: Node.js 18+, Windows 10/11.

```powershell
cd bridge
npm install
npm run build:win
```

The signed/unsigned installer will be at:

```
bridge\installer-output\AccurateBridge-Setup-1.0.0.exe
```

Distribute that single file to clinic PCs.

---

## Troubleshooting

### Tray icon doesn't appear

- Check `%APPDATA%\AccurateBridge\logs\bridge-YYYY-MM-DD.log` for errors.
- Make sure no antivirus blocked the install.

### Bridge starts but modality says "Connection refused"

- Check the slot is **Enabled** (green dot in the slot card header).
- Check the firewall rule was added:
  ```powershell
  netsh advfirewall firewall show rule name="Accurate Bridge - 7001"
  ```
- If missing, run as administrator once and the rule will be added.

### Modality sends but nothing prints

- Check the **Logs** tab — you should see `[SCP] received 1 file...`
- Wait at least `studyDebounceSeconds` (default 30 s) after the last file.
- If using Microsoft Print to PDF, check `Documents\` for the output PDF.
- Compressed DICOM (JPEG, JPEG2000) is not supported in v1 — see logs for
  warnings and reconfigure modality to send uncompressed.

### Auto-start at login isn't working

- Open **Task Manager → Startup apps** — look for `Accurate Bridge`.
- If missing, open the bridge from the Start menu once; it re-registers on
  every launch.
