# MediView Pro - Network DICOM Receiver Setup Guide

## Overview
MediView Pro now includes a network DICOM receiver that allows your USG (Ultrasound) machine and other medical devices to send DICOM files directly to your desktop application over WiFi.

## System Features
- **Automatic File Reception**: Receives DICOM files from networked medical devices
- **Zero Configuration**: Works out-of-the-box when devices are on the same WiFi
- **Auto-Import**: Received files are automatically stored and indexed
- **Real-time Monitoring**: View incoming files in real-time via the Network tab

## Quick Start

### Step 1: Start MediView Pro
1. Launch the MediView Pro desktop application
2. Go to **Settings** (or click the Config icon)
3. Navigate to the **Network** tab

### Step 2: Configure Your USG Machine
You'll see two pieces of information on the Network tab:
- **Network Address**: `[IP]:[PORT]` (e.g., `192.168.1.100:3458`)
- **Storage Location**: Where received files are saved

### Step 3: Set USG DICOM Settings
On your USG machine:
1. Go to: **Settings → Network → DICOM Receiver**
2. Set **DICOM Receiver Address** to the IP shown in Network tab
3. Set **DICOM Receiver Port** to: `3458` (or the port shown)
4. Save and test the connection

### Step 4: Send Test Images
1. From your USG machine, send a DICOM image
2. MediView Pro will receive it automatically
3. You'll see it appear in the **Network** tab → **Received Files**
4. The file is ready to view in the patient viewer

## Network Requirements
- ✓ Both machines on the same WiFi network
- ✓ No firewall blocking port 3458
- ✓ Stable network connection

## File Management
- Received files are stored in: `[AppData]/network-dicom/`
- Files are automatically named with timestamps
- Files can be viewed in the Patient Viewer once received
- To open the storage folder, click the folder icon in the Network tab

## Troubleshooting

### Files Not Received?
1. **Check network connection**: Ensure both devices are on same WiFi
2. **Verify IP address**: Use the correct IP from the Network tab
3. **Check port**: Ensure port 3458 is not blocked by firewall
4. **Restart services**: Close and reopen MediView Pro

### Connection Test
1. Copy the IP:Port from Network tab
2. Try pinging the IP: `ping [IP]`
3. If ping fails, devices are not on same network

### File Not Showing?
1. Check **Received Files** list in Network tab
2. Click refresh button to reload file list
3. Check storage folder location for files

## Advanced Options

### Change Storage Location
Contact support to configure custom storage paths.

### Multiple Devices
MediView Pro can receive files from multiple USG machines simultaneously.

### Firewall Configuration
If port 3458 is blocked:
1. Add exception for port 3458 in firewall settings
2. Or configure your USG to use alternate port (contact support)

## Security Notes
- ⚠️ Network receiver listens on all interfaces (0.0.0.0)
- ⚠️ Only connect on trusted networks
- ⚠️ Files contain patient medical information

## Support
For issues or questions:
- Check the logs in: `[AppData]/logs/`
- Contact your system administrator
- Email: support@mediviewpro.com

---
**MediView Pro v1.0** - Professional DICOM Viewing & Management
