--[[
  DICOM Activity Callback Script for Orthanc
  
  This script notifies the web application when:
  - A new instance (image) is stored
  - A new patient is detected
  - A new study is created
  - A study becomes stable (all images received)
  
  Configuration: Add this script to orthanc.json:
  "LuaScripts": ["C:\\path\\to\\dicom-callbacks.lua"]
]]--

-- Configuration - update this to match your PHP server URL
local ACTIVITY_API_URL = "http://localhost:8080/api/dicom/activity.php"

-- Helper function to make HTTP POST request to activity API
function NotifyActivity(eventType, sourceAet, sourceIp, modalityName, message)
    -- Build JSON payload
    local payload = string.format(
        '{"event_type":"%s","source_aet":"%s","source_ip":"%s","modality_name":"%s","message":"%s"}',
        eventType or "unknown",
        sourceAet or "UNKNOWN",
        sourceIp or "unknown",
        modalityName or "",
        message or ""
    )
    
    -- Use Orthanc's built-in HTTP client
    local response = HttpPost(ACTIVITY_API_URL, payload, {["Content-Type"] = "application/json"})
    
    if response then
        print(string.format("[DICOM Callback] Notified activity: %s from %s", eventType, sourceAet))
    else
        print("[DICOM Callback] Failed to notify activity API")
    end
end

-- Called when Orthanc receives a C-ECHO request (ping/verification)
function OnEcho(remoteAet, remoteIp, calledAet)
    print(string.format("[DICOM Callback] C-ECHO received from %s (%s)", remoteAet, remoteIp))
    NotifyActivity("c_echo", remoteAet, remoteIp, "", "C-ECHO verification request received")
    return true  -- Allow the echo
end

-- Called when a new DICOM instance is stored
function OnStoredInstance(instanceId, tags, metadata, origin)
    local patientName = tags["PatientName"] or "Unknown"
    local patientId = tags["PatientID"] or "Unknown"
    local modality = tags["Modality"] or "Unknown"
    local sourceAet = origin["RemoteAet"] or "LOCAL"
    local sourceIp = origin["RemoteIp"] or "localhost"
    
    local message = string.format("New %s image stored for patient %s (%s)", modality, patientName, patientId)
    
    print(string.format("[DICOM Callback] Instance stored: %s from %s", instanceId, sourceAet))
    NotifyActivity("NewInstance", sourceAet, sourceIp, modality, message)
end

-- Called when a study becomes stable (no new images for StableAge seconds)
function OnStableStudy(studyId, tags, metadata)
    local patientName = tags["PatientName"] or "Unknown"
    local patientId = tags["PatientID"] or "Unknown"
    local studyDesc = tags["StudyDescription"] or "No description"
    local modality = tags["ModalitiesInStudy"] or "Unknown"
    
    local message = string.format("Study complete for %s: %s", patientName, studyDesc)
    
    print(string.format("[DICOM Callback] Study stable: %s", studyId))
    NotifyActivity("StableStudy", "ORTHANC", "localhost", modality, message)
end

-- Called when a new patient is created
function OnStablePatient(patientId, tags, metadata)
    local patientName = tags["PatientName"] or "Unknown"
    local patientDicomId = tags["PatientID"] or "Unknown"
    
    local message = string.format("New patient: %s (ID: %s)", patientName, patientDicomId)
    
    print(string.format("[DICOM Callback] Patient stable: %s", patientId))
    NotifyActivity("NewPatient", "ORTHANC", "localhost", "", message)
end

-- Log startup
print("========================================")
print("[DICOM Callback] Script loaded successfully")
print("[DICOM Callback] Activity API: " .. ACTIVITY_API_URL)
print("========================================")
